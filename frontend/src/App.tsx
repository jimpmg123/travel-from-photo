import { useEffect, useState, useTransition } from 'react'
import './App.css'
import { defaultMockAccount } from './app/data'
import { TopBar } from './app/components/TopBar'
import { useGalleryBrowser } from './app/hooks/useGalleryBrowser'
import { CreateAccountPage } from './app/pages/CreateAccountPage'
import { GalleryPage } from './app/pages/GalleryPage'
import { ImagesPage } from './app/pages/ImagesPage'
import { JournalPage } from './app/pages/JournalPage'
import { ProfilePage } from './app/pages/ProfilePage'
import { SettingsPage } from './app/pages/SettingsPage'
import { LiveChatPage } from './app/pages/LiveChatPage'
import { AdminPanelPage } from './app/pages/AdminPanelPage'
import { SearchPage } from './app/pages/SearchPage'
import { SearchResultsPage } from './app/pages/SearchResultsPage'
import { SignInPage } from './app/pages/SignInPage'
import { TravelizeAnalysisPage } from './app/pages/TravelizeAnalysisPage'
import { TravelizeImageInputPage } from './app/pages/TravelizeImageInputPage'
import { TravelizeIntroPage } from './app/pages/TravelizeIntroPage'
import { TravelizePlanPage } from './app/pages/TravelizePlanPage'
import type { SearchSession } from './app/search/types'
import {
  buildTravelizeAnalysisResults,
  createTravelizeGalleryItems,
  createTravelizeUploadItems,
  defaultTravelizeSetup,
  maxTravelizeImages,
} from './app/travelize/data'
import type { TravelizeInputImage, TravelizeSetup } from './app/travelize/types'
import type { MockAccount, PageId, Role } from './app/types'
import { setSocialApiUserContext } from './app/services/socialApi'

function App() {
  const [activePage, setActivePage] = useState<PageId>('search')
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [role, setRole] = useState<Role>('traveler')
  const [currentAccount, setCurrentAccount] = useState<MockAccount>(defaultMockAccount)
  const [createdAccount, setCreatedAccount] = useState<MockAccount | null>(null)
  const [latestSearchSession, setLatestSearchSession] = useState<SearchSession | null>(null)
  const [travelizeSetup, setTravelizeSetup] = useState<TravelizeSetup>(defaultTravelizeSetup)
  const [travelizeImages, setTravelizeImages] = useState<TravelizeInputImage[]>([])
  const [isPending, startTransition] = useTransition()
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

  const travelizeResults = buildTravelizeAnalysisResults(travelizeImages, travelizeSetup.regionInput)
  const travelizePlanKey = [
    travelizeSetup.tripDays,
    travelizeSetup.startDate,
    travelizeSetup.wakeUpTime,
    travelizeSetup.departureTime,
    travelizeSetup.regionInput,
    travelizeImages.map((image) => image.id).join('|'),
  ].join('::')

  useEffect(() => {
    setSocialApiUserContext({
      userId: currentAccount.userId,
      email: currentAccount.email,
      displayName: `${currentAccount.firstName} ${currentAccount.lastName}`.trim(),
    })
  }, [currentAccount])

  const openPage = (page: PageId) => {
    startTransition(() => {
      setActivePage(page)
    })
  }

  const toggleLogin = () => {
    if (isLoggedIn) {
      setIsLoggedIn(false)
      return
    }

    setCurrentAccount(createdAccount ?? defaultMockAccount)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    openPage('sign-in')
  }

  const handleRunSearch = (session: SearchSession) => {
    setLatestSearchSession(session)
    openPage('search-results')
  }

  const mergeTravelizeImages = (incomingImages: TravelizeInputImage[]) => {
    setTravelizeImages((current) => {
      const nextImages = [...current]

      incomingImages.forEach((image) => {
        if (nextImages.length >= maxTravelizeImages) {
          return
        }

        if (nextImages.some((existing) => existing.id === image.id)) {
          return
        }

        nextImages.push(image)
      })

      return nextImages
    })
  }

  const handleTravelizeSetupChange = (patch: Partial<TravelizeSetup>) => {
    setTravelizeSetup((current) => ({ ...current, ...patch }))
  }

  const handleTravelizeUploads = (files: File[]) => {
    mergeTravelizeImages(createTravelizeUploadItems(files))
  }

  const handleTravelizeGroupLoad = (group: (typeof galleryState)[number]) => {
    mergeTravelizeImages(createTravelizeGalleryItems(group))
  }

  const handleTravelizeRemoveImage = (imageId: string) => {
    setTravelizeImages((current) => current.filter((image) => image.id !== imageId))
  }

  const toggleRole = () => {
    setRole((current) => (current === 'traveler' ? 'admin' : 'traveler'))
  }

  const openUserPage = () => {
    openPage(isLoggedIn ? 'profile' : 'sign-in')
  }

  const handleCreateAccount = (account: MockAccount) => {
    setCreatedAccount(account)
    setCurrentAccount(account)
    setIsLoggedIn(false)
    openPage('sign-in')
  }

  const handleLogin = (identifier: string, password: string) => {
    if (!createdAccount) {
      return {
        success: false,
        message:
          'Create an account first. Until backend auth is added, this sign-in only checks the account created in this session.',
      }
    }

    const normalizedIdentifier = identifier.toLowerCase()
    const isMatchingIdentifier =
      createdAccount.userId.toLowerCase() === normalizedIdentifier ||
      createdAccount.email.toLowerCase() === normalizedIdentifier

    if (!isMatchingIdentifier || createdAccount.password !== password) {
      return {
        success: false,
        message: 'ID/email or password does not match the created account.',
      }
    }

    setCurrentAccount(createdAccount)
    setIsLoggedIn(true)
    openPage('profile')

    return { success: true }
  }

  const renderActivePage = () => {
    switch (activePage) {
      case 'search':
        return <SearchPage onRunSearch={handleRunSearch} onOpenPage={openPage} />
      case 'search-results':
        return (
          <SearchResultsPage
            isLoggedIn={isLoggedIn}
            searchSession={latestSearchSession}
            onOpenPage={openPage}
          />
        )
      case 'travelize-1':
        return (
          <TravelizeIntroPage
            setup={travelizeSetup}
            onSetupChange={handleTravelizeSetupChange}
            onNext={() => openPage('travelize-2')}
            onOpenSearch={() => openPage('search')}
          />
        )
      case 'travelize-2':
        return (
          <TravelizeImageInputPage
            galleryGroups={galleryState}
            selectedImages={travelizeImages}
            onAddUploads={handleTravelizeUploads}
            onLoadGalleryGroup={handleTravelizeGroupLoad}
            onRemoveImage={handleTravelizeRemoveImage}
            onBack={() => openPage('travelize-1')}
            onAnalyze={() => openPage('travelize-3')}
          />
        )
      case 'travelize-3':
        return (
          <TravelizeAnalysisPage
            results={travelizeResults}
            onBack={() => openPage('travelize-2')}
            onNext={() => openPage('travelize-4')}
          />
        )
      case 'travelize-4':
        return (
          <TravelizePlanPage
            key={travelizePlanKey}
            setup={travelizeSetup}
            images={travelizeImages}
            results={travelizeResults}
            onBack={() => openPage('travelize-3')}
          />
        )
      case 'gallery':
        return (
          <GalleryPage
            groups={galleryState}
            isLoggedIn={isLoggedIn}
            onOpenPage={openPage}
            onRenameGroup={renameGroup}
            onViewImages={(group) => {
              openGroup(group)
              openPage('images')
            }}
          />
        )
      case 'journal':
        return <JournalPage />
      case 'images':
        if (!selectedGalleryGroup) {
          return (
            <GalleryPage
              groups={galleryState}
              isLoggedIn={isLoggedIn}
              onOpenPage={openPage}
              onRenameGroup={renameGroup}
              onViewImages={(group) => {
                openGroup(group)
                openPage('images')
              }}
            />
          )
        }

        return (
          <ImagesPage
            group={selectedGalleryGroup}
            selectedImage={selectedGalleryImage}
            onBack={() => openPage('gallery')}
            onOpenImage={openImage}
            onCloseImage={closeImage}
            onNavigateImage={navigateImage}
          />
        )
      case 'profile':
        return (
          <ProfilePage
            account={currentAccount}
            isLoggedIn={isLoggedIn}
            role={role}
            onOpenPage={openPage}
          />
        )
      case 'settings':
        return <SettingsPage account={currentAccount} isLoggedIn={isLoggedIn} />
      case 'live-chat':
        return <LiveChatPage account={currentAccount} isLoggedIn={isLoggedIn} />
      case 'admin':
        return <AdminPanelPage role={role} isLoggedIn={isLoggedIn} />
      case 'sign-in':
        return (
          <SignInPage
            existingAccount={createdAccount}
            onLogin={handleLogin}
            onOpenPage={openPage}
          />
        )
      case 'create-account':
        return <CreateAccountPage onCreateAccount={handleCreateAccount} onOpenPage={openPage} />
      default:
        return <SearchPage onRunSearch={handleRunSearch} onOpenPage={openPage} />
    }
  }

  const userDisplayName = `${currentAccount.firstName} ${currentAccount.lastName}`.trim()

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-a" />
      <div className="backdrop backdrop-b" />
      <div className="app-frame">
        <TopBar
          activePage={activePage}
          isLoggedIn={isLoggedIn}
          isPending={isPending}
          role={role}
          userDisplayName={userDisplayName}
          onOpenPage={openPage}
          onOpenUserPage={openUserPage}
          onLogout={handleLogout}
          onToggleRole={toggleRole}
          onToggleLogin={toggleLogin}
        />

        <main className="page-surface">{renderActivePage()}</main>
      </div>
    </div>
  )
}

export default App
