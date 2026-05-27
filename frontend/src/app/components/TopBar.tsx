import { navItems } from '../data'
import type { PageId, Role } from '../types'

type TopBarProps = {
  activePage: PageId
  isLoggedIn: boolean
  isPending: boolean
  role: Role
  userDisplayName: string
  onOpenPage: (page: PageId) => void
  onOpenUserPage: () => void
  onLogout: () => void
  onToggleRole: () => void
  onToggleLogin: () => void
}

export function TopBar({
  activePage,
  isLoggedIn,
  isPending,
  role,
  userDisplayName,
  onOpenPage,
  onOpenUserPage,
  onLogout,
  onToggleRole,
  onToggleLogin,
}: TopBarProps) {
  const navActivePage =
    activePage === 'search-results'
      ? 'search'
      : activePage === 'travelize-2' || activePage === 'travelize-3' || activePage === 'travelize-4'
        ? 'travelize-1'
        : activePage

  return (
    <header className="topbar panel">
      <div className="shortcut-cluster">
        {isLoggedIn ? (
          <button
            type="button"
            className="shortcut-button logout-shortcut"
            onClick={onLogout}
            aria-label="Log out"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14 4h-4a2 2 0 0 0-2 2v2h2V6h4v12h-4v-2H8v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"
                fill="currentColor"
              />
              <path
                d="M12.5 12.75H5.91l2.3 2.3-1.06 1.06L3.03 12l4.12-4.11 1.06 1.06-2.3 2.3h6.59v1.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        ) : null}

        <button
          type="button"
          className="shortcut-button user-shortcut"
          onClick={onOpenUserPage}
          aria-label={isLoggedIn ? 'Open profile page' : 'Open sign-in page'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 12a4.25 4.25 0 1 0-4.25-4.25A4.25 4.25 0 0 0 12 12Zm0 2.25c-4.07 0-7.5 2.2-7.5 4.75V20h15v-1c0-2.55-3.43-4.75-7.5-4.75Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      <div className="brand-block">
        <p className="eyebrow">Travel From Photo</p>
        <div className="brand-row">
          <h1>Travel-photo search workspace</h1>
          <span className="pill">temporary frontend flow</span>
        </div>
        <p className="brand-copy">
          Upload travel images, extract metadata, and stage EXIF, landmark recognition, CLIP, and
          OpenAI based location inference in one flow.
        </p>
      </div>

      <nav className="nav-links" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-pill ${navActivePage === item.id ? 'is-active' : ''}`}
            onClick={() => onOpenPage(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.hint}</small>
          </button>
        ))}
      </nav>

      <div className="auth-cluster">
        <div className="auth-summary">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>{isLoggedIn ? `Signed in as ${userDisplayName}` : 'Guest preview mode'}</strong>
            <p>
              {isLoggedIn
                ? `${role === 'traveler' ? 'Traveler' : 'Admin'} view enabled`
                : 'Gallery remains locked until sign-in'}
            </p>
          </div>
          {isPending ? <span className="pending-badge">Switching view...</span> : null}
        </div>

        <div className="auth-actions">
          <button type="button" className="button-secondary" onClick={onToggleRole}>
            Role: {role === 'traveler' ? 'Traveler' : 'Admin'}
          </button>
          <button type="button" className="button-primary" onClick={onToggleLogin}>
            {isLoggedIn ? 'Mock Sign Out' : 'Mock Sign In'}
          </button>
        </div>
      </div>
    </header>
  )
}
