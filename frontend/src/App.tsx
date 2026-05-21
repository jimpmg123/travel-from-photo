import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './app/context/AuthContext'
import { TopBar } from './app/components/TopBar'
import { useGalleryBrowser } from './app/hooks/useGalleryBrowser'
import { ChatPage } from './app/pages/ChatPage'
import { GalleryPage } from './app/pages/GalleryPage'
import { ImagesPage } from './app/pages/ImagesPage'
import { JournalPage } from './app/pages/JournalPage'
import { LandingAuthPage } from './app/pages/LandingAuthPage'
import { ProfilePage } from './app/pages/ProfilePage'
import { SearchPage } from './app/pages/SearchPage'
import { SearchResultsPage } from './app/pages/SearchResultsPage'
import { SettingsPage } from './app/pages/SettingsPage'
import { retryFailedSearchUpload } from './app/search/api'
import { buildSearchResultBundle } from './app/search/data'
import type { SearchRun } from './app/search/types'

function App() {
  const navigate = useNavigate()
  const { isLoggedIn, user, role, logout } = useAuth()
  const [latestSearchSession, setLatestSearchSession] = useState<SearchRun | null>(null)
  const {
    closeImage,
    galleryState,
    navigateImage,
    openGroup,
    openImage,
    renameGroup,
    selectedGalleryGroup,
    selectedGalleryImage,
  } = useGalleryBrowser()

  const handleRunSearch = (session: SearchRun) => {
    setLatestSearchSession(session)
    navigate('/search-results')
  }

  const handleRetryFailedSearchImage = async (uploadId: string, userHint: string) => {
    if (!latestSearchSession) return
    const targetUpload = latestSearchSession.uploads.find((u) => u.id === uploadId)
    if (!targetUpload) return

    const nextAnalysis = await retryFailedSearchUpload(targetUpload, {
      countryHint: latestSearchSession.countryHint,
      cityHint: latestSearchSession.cityHint,
      userHint,
    })

    const nextAnalyses = latestSearchSession.analyses.map((a) =>
      a.uploadId === uploadId ? nextAnalysis : a,
    )

    setLatestSearchSession({
      ...latestSearchSession,
      analyses: nextAnalyses,
      bundle: buildSearchResultBundle({
        countryHint: latestSearchSession.countryHint,
        cityHint: latestSearchSession.cityHint,
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

        <main className="page-surface">
          <Routes>
            <Route path="/" element={<SearchPage onRunSearch={handleRunSearch} />} />
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
            <Route
              path="/gallery"
              element={
                <GalleryPage
                  groups={galleryState}
                  isLoggedIn={isLoggedIn}
                  onRenameGroup={renameGroup}
                  onViewImages={(group) => {
                    openGroup(group)
                    navigate('/gallery/images')
                  }}
                />
              }
            />
            <Route
              path="/gallery/images"
              element={
                selectedGalleryGroup ? (
                  <ImagesPage
                    group={selectedGalleryGroup}
                    selectedImage={selectedGalleryImage}
                    onBack={() => navigate('/gallery')}
                    onOpenImage={openImage}
                    onCloseImage={closeImage}
                    onNavigateImage={navigateImage}
                  />
                ) : (
                  <Navigate to="/gallery" replace />
                )
              }
            />
            <Route
              path="/profile"
              element={<ProfilePage user={user} isLoggedIn={isLoggedIn} role={role} />}
            />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
