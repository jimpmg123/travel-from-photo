import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BookText,
  Camera,
  Globe,
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
import { LANGUAGE_OPTIONS, useLanguage } from '../context/LanguageContext'
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
  const { language, languageLabel, setLanguage } = useLanguage()
  const activeNavId = getActiveNavId(location.pathname)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          {/* Language picker */}
          <div className="lang-picker" ref={langRef}>
            <button
              type="button"
              className="lang-globe-btn"
              onClick={() => setLangOpen((v) => !v)}
              title="Select language"
              aria-label="Select language"
            >
              <Globe size={15} />
              <span>{languageLabel}</span>
            </button>
            {langOpen && (
              <div className="lang-dropdown">
                {LANGUAGE_OPTIONS.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    className={`lang-option${language === code ? ' is-active' : ''}`}
                    onClick={() => { setLanguage(code); setLangOpen(false) }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <>
              {role === 'admin' && <span className="topbar-chip">Admin</span>}
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
