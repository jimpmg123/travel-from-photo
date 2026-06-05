import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './app/context/AuthContext'
import { getSettings } from './app/services/socialApi'
import { GenerationToast } from './app/components/GenerationToast'
import { TopBar } from './app/components/TopBar'
import { AdminPanelPage } from './app/pages/AdminPanelPage'
import { ChatPage } from './app/pages/ChatPage'
import { CollectionDetailPage } from './app/pages/CollectionDetailPage'
import { GalleryPage } from './app/pages/GalleryPage'
import { JournalCollectionsPage } from './app/pages/JournalCollectionsPage'
import { JournalDetailPage } from './app/pages/JournalDetailPage'
import { JournalPage } from './app/pages/JournalPage'
import { JournalResultPage } from './app/pages/JournalResultPage'
import { LandingAuthPage } from './app/pages/LandingAuthPage'
import { ProfilePage } from './app/pages/ProfilePage'
import { SearchPage } from './app/pages/SearchPage'
import { SearchResultsPage } from './app/pages/SearchResultsPage'
import { SettingsPage } from './app/pages/SettingsPage'
import { analyzeSearchUploads, applyCrossImageClusterReweight, retryFailedSearchUpload } from './app/search/api'
import { buildSearchResultBundle } from './app/search/data'
import type { SearchRun, SearchUploadItem } from './app/search/types'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, role, logout } = useAuth()

  useEffect(() => {
    if (!isLoggedIn) {
      document.documentElement.removeAttribute('data-theme')
      return
    }
    getSettings()
      .then((s) => { document.documentElement.setAttribute('data-theme', s.theme) })
      .catch(() => {})
  }, [isLoggedIn])
  const [latestSearchSession, setLatestSearchSession] = useState<SearchRun | null>(null)
  const [searchInFlight, setSearchInFlight] = useState(false)
  const [readyToast, setReadyToast] = useState<string | null>(null)
  const readyToastTimer = useRef<number | null>(null)

  const handleStartSearch = (input: {
    uploads: SearchUploadItem[]
    hint: string
  }) => {
    if (searchInFlight) return
    setSearchInFlight(true)
    const startedFromPath = location.pathname
    ;(async () => {
      try {
        const analyses = await analyzeSearchUploads(input.uploads, {
          countryHint: '',
          cityHint: '',
          userHint: input.hint,
        })
        const bundle = buildSearchResultBundle({
          hint: input.hint,
          uploads: input.uploads,
          analyses,
        })
        setLatestSearchSession({
          hint: input.hint,
          uploads: input.uploads,
          analyses,
          bundle,
        })
        if (window.location.pathname === startedFromPath && startedFromPath === '/') {
          navigate('/search-results')
        } else {
          setReadyToast('Search results are ready')
          if (readyToastTimer.current) window.clearTimeout(readyToastTimer.current)
          readyToastTimer.current = window.setTimeout(() => setReadyToast(null), 6000)
        }
      } finally {
        setSearchInFlight(false)
      }
    })()
  }

  useEffect(() => {
    return () => {
      if (readyToastTimer.current) window.clearTimeout(readyToastTimer.current)
    }
  }, [])

  const handleRetryFailedSearchImage = async (uploadId: string, userHint: string) => {
    if (!latestSearchSession) return
    const targetUpload = latestSearchSession.uploads.find((u) => u.id === uploadId)
    if (!targetUpload) return

    const nextAnalysis = await retryFailedSearchUpload(targetUpload, {
      countryHint: latestSearchSession.countryHint,
      cityHint: latestSearchSession.cityHint,
      userHint,
    })

    const replaced = latestSearchSession.analyses.map((a) =>
      a.uploadId === uploadId ? nextAnalysis : a,
    )
    const nextAnalyses = applyCrossImageClusterReweight(replaced)

    setLatestSearchSession({
      ...latestSearchSession,
      analyses: nextAnalyses,
      bundle: buildSearchResultBundle({
        hint: latestSearchSession.hint,
        uploads: latestSearchSession.uploads,
        analyses: nextAnalyses,
      }),
    })
  }

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/sign-in" element={<LandingAuthPage />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    )
  }

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-a" />
      <div className="backdrop backdrop-b" />
      <div className="app-frame">
        <TopBar onLogout={() => { logout(); navigate('/sign-in') }} />
        <GenerationToast />

        {searchInFlight && location.pathname !== '/' ? (
          <div className="search-bg-banner">
            <span className="search-bg-banner-spinner" />
            <span>Searching in the background — feel free to keep browsing.</span>
          </div>
        ) : null}

        {readyToast ? (
          <button
            type="button"
            className="search-ready-toast"
            onClick={() => {
              setReadyToast(null)
              navigate('/search-results')
            }}
          >
            {readyToast} — click to view
          </button>
        ) : null}

        <main className="page-surface">
          <Routes>
            <Route
              path="/"
              element={<SearchPage onStartSearch={handleStartSearch} isSearching={searchInFlight} />}
            />
            <Route
              path="/search-results"
              element={
                <SearchResultsPage
                  isLoggedIn={isLoggedIn}
                  searchSession={latestSearchSession}
                  onRetryFailedImage={handleRetryFailedSearchImage}
                />
              }
            />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/result/:journalId" element={<JournalResultPage />} />
            <Route path="/journal/collections" element={<JournalCollectionsPage />} />
            <Route path="/journal/collections/:journalId" element={<JournalDetailPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/gallery/collection/:collectionName" element={<CollectionDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/admin"
              element={role === 'admin' ? <AdminPanelPage /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
