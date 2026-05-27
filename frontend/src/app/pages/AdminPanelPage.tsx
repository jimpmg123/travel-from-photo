import { useEffect, useState } from 'react'
import { SectionIntro } from '../components/SectionIntro'
import type { Role } from '../types'
import {
  getAdminSummary,
  getAdminUsers,
  getModerationItems,
  resolveModerationItem,
  updateAdminUser,
  type AdminSummary,
  type AdminUser,
  type ModerationItem,
} from '../services/socialApi'

type AdminPanelPageProps = {
  role: Role
  isLoggedIn: boolean
}

const fallbackUsers: AdminUser[] = [
  {
    id: 'jaemin001',
    displayName: 'Jaemin Jeon',
    email: 'jaemin@example.com',
    role: 'admin',
    status: 'active',
    uploads: 12,
    journals: 3,
    lastActive: 'Today',
  },
  {
    id: 'traveler102',
    displayName: 'Mina Park',
    email: 'mina@example.com',
    role: 'traveler',
    status: 'review',
    uploads: 7,
    journals: 1,
    lastActive: 'Yesterday',
  },
]

const fallbackSummary: AdminSummary = {
  totalUsers: 2,
  activeUsers: 1,
  reviewUsers: 1,
  disabledUsers: 0,
  openModerationItems: 1,
  totalChatMessages: 1,
}

const fallbackQueue: ModerationItem[] = [
  {
    id: 'mod_local_001',
    type: 'Search result',
    title: 'Wrong place candidate reported',
    reporter: 'Mina Park',
    reason: 'The candidate was in the correct country but the landmark was wrong.',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
]

export function AdminPanelPage({ role, isLoggedIn }: AdminPanelPageProps) {
  const [users, setUsers] = useState<AdminUser[]>(fallbackUsers)
  const [queue, setQueue] = useState<ModerationItem[]>(fallbackQueue)
  const [summary, setSummary] = useState<AdminSummary>(fallbackSummary)
  const [query, setQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState('Admin panel is ready.')

  useEffect(() => {
    let ignore = false

    Promise.all([getAdminUsers(), getModerationItems(), getAdminSummary()])
      .then(([userItems, moderationItems, summaryData]) => {
        if (!ignore) {
          setUsers(userItems)
          setQueue(moderationItems)
          setSummary(summaryData)
          setStatusMessage('Loaded admin data from the backend API.')
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatusMessage('Backend admin API is not reachable. Using local fallback data.')
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleSearch = async () => {
    try {
      const userItems = await getAdminUsers(query)
      setUsers(userItems)
      setStatusMessage(`Found ${userItems.length} user record(s).`)
    } catch {
      const normalized = query.trim().toLowerCase()
      const filtered = normalized
        ? fallbackUsers.filter(
            (user) =>
              user.displayName.toLowerCase().includes(normalized) ||
              user.email.toLowerCase().includes(normalized) ||
              user.id.toLowerCase().includes(normalized),
          )
        : fallbackUsers
      setUsers(filtered)
      setStatusMessage('Searched local fallback data because the backend API was not reachable.')
    }
  }

  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active'
    try {
      const updated = await updateAdminUser(user.id, { status: nextStatus })
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)))
      setSummary((current) => ({
        ...current,
        activeUsers: current.activeUsers + (nextStatus === 'active' ? 1 : -1),
        disabledUsers: current.disabledUsers + (nextStatus === 'disabled' ? 1 : -1),
      }))
      setStatusMessage(`Updated ${updated.displayName}.`)
    } catch {
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)),
      )
      setStatusMessage('Updated local fallback status. Backend admin API was not reachable.')
    }
  }

  const handleResolve = async (item: ModerationItem) => {
    try {
      const updated = await resolveModerationItem(item.id)
      setQueue((current) => current.map((queueItem) => (queueItem.id === item.id ? updated : queueItem)))
      setSummary((current) => ({
        ...current,
        openModerationItems: Math.max(0, current.openModerationItems - 1),
      }))
      setStatusMessage(`Resolved ${updated.title}.`)
    } catch {
      setQueue((current) =>
        current.map((queueItem) =>
          queueItem.id === item.id ? { ...queueItem, status: 'resolved' } : queueItem,
        ),
      )
      setStatusMessage('Resolved local fallback item. Backend admin API was not reachable.')
    }
  }


  if (!isLoggedIn || role !== 'admin') {
    return (
      <section className="panel locked-card">
        <h2>Admin panel is locked</h2>
        <p>Switch to the admin role in the top bar to review users and moderation items.</p>
      </section>
    )
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>User search, moderation, and role control</h2>
        </div>
        <p className="section-copy">
          This page uses database-backed admin APIs for user lookup, account status updates,
          and moderation review.
        </p>
      </section>

      <section className="metric-grid admin-summary-grid" aria-label="Admin summary">
        <div className="metric-card">
          <span className="metric-label">Total users</span>
          <strong className="metric-value">{summary.totalUsers}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Open reviews</span>
          <strong className="metric-value">{summary.openModerationItems}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Disabled users</span>
          <strong className="metric-value">{summary.disabledUsers}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Chat records</span>
          <strong className="metric-value">{summary.totalChatMessages}</strong>
        </div>
      </section>

      <section className="admin-layout">
        <article className="panel content-panel">
          <SectionIntro
            title="User management"
            detail="Search users and update account status using database-backed records."
          />
          <div className="admin-search-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or user ID"
            />
            <button type="button" className="button-secondary" onClick={handleSearch}>
              Search
            </button>
          </div>

          <div className="admin-table" role="table" aria-label="Admin users">
            <div className="admin-table__row admin-table__head" role="row">
              <span>User</span>
              <span>Role</span>
              <span>Status</span>
              <span>Activity</span>
              <span>Action</span>
            </div>
            {users.map((user) => (
              <div key={user.id} className="admin-table__row" role="row">
                <span>
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                </span>
                <span>{user.role}</span>
                <span>{user.status}</span>
                <span>
                  {user.uploads} uploads / {user.journals} journals
                </span>
                <span>
                  <button
                    type="button"
                    className="button-secondary compact-button"
                    onClick={() => void handleToggleStatus(user)}
                  >
                    {user.status === 'active' ? 'Disable' : 'Activate'}
                  </button>
                </span>
              </div>
            ))}
          </div>
          <p className="field-note">{statusMessage}</p>
        </article>

        <article className="panel content-panel">
          <SectionIntro
            title="Moderation queue"
            detail="Review reported search results, user messages, and support issues."
          />
          <div className="moderation-list">
            {queue.map((item) => (
              <div key={item.id} className="result-card">
                <span className="result-label">{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <div className="badge-row">
                  <span className="pill">{item.reporter}</span>
                  <span className="pill">{item.status}</span>
                </div>
                <button
                  type="button"
                  className="button-secondary compact-button"
                  onClick={() => void handleResolve(item)}
                  disabled={item.status === 'resolved'}
                >
                  {item.status === 'resolved' ? 'Resolved' : 'Mark resolved'}
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
