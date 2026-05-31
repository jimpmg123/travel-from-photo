import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BookText,
  Camera,
  Image as ImageIcon,
  type LucideIcon,
  Menu,
  MessageCircle,
  Search,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { navItems } from '../data'

const navPath: Record<string, string> = {
  home: '/',
  journal: '/journal',
  gallery: '/gallery',
  'live-chat': '/chat',
  profile: '/profile',
  settings: '/settings',
  admin: '/admin',
}

const navIcons: Record<string, LucideIcon> = {
  home: Search,
  journal: BookText,
  gallery: ImageIcon,
  'live-chat': MessageCircle,
  profile: User,
  settings: Settings,
  admin: Shield,
}

function getActiveNavId(pathname: string): string {
  if (pathname === '/' || pathname === '/search-results') return 'home'
  if (pathname.startsWith('/gallery')) return 'gallery'
  if (pathname === '/journal') return 'journal'
  if (pathname === '/chat') return 'live-chat'
  if (pathname === '/profile') return 'profile'
  if (pathname === '/settings') return 'settings'
  if (pathname === '/admin') return 'admin'
  return ''
}

type TopBarProps = {
  onLogout: () => void
}

export function TopBar({ onLogout }: TopBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, role, userDisplayName } = useAuth()
  const activeNavId = getActiveNavId(location.pathname)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [location.pathname])

  const openUserPage = () => {
    navigate(isLoggedIn ? '/profile' : '/sign-in')
  }

  const handleNavSelect = (id: string) => {
    navigate(navPath[id] ?? '/')
    setIsMobileNavOpen(false)
  }

  const visibleNavItems = navItems.filter((item) => item.id !== 'admin' || role === 'admin')

  return (
    <>
      <header className="topbar" aria-label="Application header">
        <button type="button" className="brand-anchor" onClick={() => navigate('/')}>
          <span className="brand-anchor-icon" aria-hidden="true">
            <Camera />
          </span>
          <span className="brand-anchor-copy">
            <strong>Travel From Photo</strong>
          </span>
        </button>

        <nav className="topbar-nav" aria-label="Primary inline">
          {visibleNavItems.map((item) => {
            const Icon = navIcons[item.id]
            return (
              <button
                key={item.id}
                type="button"
                className={`topbar-nav-button ${activeNavId === item.id ? 'is-active' : ''}`}
                onClick={() => navigate(navPath[item.id] ?? '/')}
                aria-label={item.label}
                title={item.label}
              >
                {Icon ? <Icon className="topbar-nav-icon" /> : null}
                <span className="topbar-nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="topbar-tools">
          {isLoggedIn ? (
            <>
              {role === 'admin' && <span className="topbar-chip">Admin</span>}
              <span className="topbar-username">{userDisplayName}</span>
              <button
                type="button"
                className="topbar-chip topbar-chip--accent"
                onClick={onLogout}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="topbar-chip topbar-chip--accent"
              onClick={() => navigate('/sign-in')}
            >
              Sign in
            </button>
          )}

          <button
            type="button"
            className={`topbar-profile ${location.pathname === '/profile' ? 'is-active' : ''}`}
            onClick={openUserPage}
            aria-label={isLoggedIn ? `Open profile for ${userDisplayName}` : 'Open sign-in page'}
            title={isLoggedIn ? userDisplayName : 'Sign in'}
          >
            <User />
          </button>
        </div>
      </header>

      <nav className="desktop-side-nav" aria-label="Primary desktop">
        {visibleNavItems.map((item) => {
          const Icon = navIcons[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`desktop-side-button ${activeNavId === item.id ? 'is-active' : ''}`}
              onClick={() => navigate(navPath[item.id] ?? '/')}
              aria-label={item.label}
              title={item.label}
            >
              {Icon ? <Icon className="desktop-side-icon" /> : null}
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {isMobileNavOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setIsMobileNavOpen(false)} />
      )}

      <button
        type="button"
        className={`mobile-nav-toggle ${isMobileNavOpen ? 'is-open' : ''}`}
        onClick={() => setIsMobileNavOpen((prev) => !prev)}
        aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isMobileNavOpen}
      >
        {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav
        className={`mobile-bottom-nav ${isMobileNavOpen ? 'is-open' : ''}`}
        aria-label="Mobile primary"
        aria-hidden={!isMobileNavOpen}
      >
        {visibleNavItems.map((item) => {
          const Icon = navIcons[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-button ${activeNavId === item.id ? 'is-active' : ''}`}
              onClick={() => handleNavSelect(item.id)}
              aria-label={item.label}
              tabIndex={isMobileNavOpen ? 0 : -1}
            >
              {Icon ? <Icon className="mobile-nav-icon" /> : null}
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
