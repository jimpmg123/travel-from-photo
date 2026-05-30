import { useEffect, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
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

const emptySummary: AdminSummary = {
  totalUsers: 0,
  activeUsers: 0,
  reviewUsers: 0,
  disabledUsers: 0,
  openModerationItems: 0,
  totalChatMessages: 0,
}

export function AdminPanelPage() {
  const [summary, setSummary] = useState<AdminSummary>(emptySummary)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [queue, setQueue] = useState<ModerationItem[]>([])
  const [query, setQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState('Loading admin data...')

  const loadAdminData = async (q = query) => {
    try {
      const [nextSummary, nextUsers, nextQueue] = await Promise.all([
        getAdminSummary(),
        getAdminUsers(q),
        getModerationItems(),
      ])
      setSummary(nextSummary)
      setUsers(nextUsers)
      setQueue(nextQueue)
      setStatusMessage('Admin data loaded from the backend.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load admin data.')
    }
  }

  useEffect(() => {
    void loadAdminData('')
  }, [])

  const handleRoleToggle = async (user: AdminUser) => {
    const nextRole = user.role === 'admin' ? 'traveler' : 'admin'
    try {
      const updated = await updateAdminUser(user.id, { role: nextRole })
      setUsers((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      setStatusMessage('User role updated.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update role.')
    }
  }

  const handleStatusToggle = async (user: AdminUser) => {
    const nextStatus = user.status === 'disabled' ? 'active' : 'disabled'
    try {
      const updated = await updateAdminUser(user.id, { status: nextStatus })
      setUsers((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      void loadAdminData(query)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update status.')
    }
  }

  const handleResolve = async (itemId: string) => {
    try {
      const updated = await resolveModerationItem(itemId)
      setQueue((items) => items.map((item) => (item.id === itemId ? updated : item)))
      void loadAdminData(query)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to resolve item.')
    }
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Admin Panel</h2>
        </div>
        <p className="section-copy">Manage users, roles, account status, chat reports, and moderation cases.</p>
      </section>

      <section className="admin-summary-grid">
        <div className="panel stat-card"><span>Total users</span><strong>{summary.totalUsers}</strong></div>
        <div className="panel stat-card"><span>Active users</span><strong>{summary.activeUsers}</strong></div>
        <div className="panel stat-card"><span>Disabled</span><strong>{summary.disabledUsers}</strong></div>
        <div className="panel stat-card"><span>Open cases</span><strong>{summary.openModerationItems}</strong></div>
      </section>

      <section className="admin-layout">
        <article className="panel content-panel">
          <div className="admin-toolbar">
            <div className="section-mini"><ShieldCheck /><h3>User management</h3></div>
            <label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." /></label>
            <button type="button" className="button-secondary" onClick={() => void loadAdminData(query)}>Search</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName}</td>
                    <td>{user.email}</td>
                    <td><span className="pill">{user.role}</span></td>
                    <td><span className="pill">{user.status}</span></td>
                    <td className="table-actions">
                      <button type="button" className="button-secondary" onClick={() => void handleRoleToggle(user)}>Change role</button>
                      <button type="button" className="button-secondary" onClick={() => void handleStatusToggle(user)}>{user.status === 'disabled' ? 'Enable' : 'Disable'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-note">{statusMessage}</p>
        </article>

        <article className="panel content-panel">
          <div className="section-mini"><h3>Moderation queue</h3><p className="muted-copy">Review reported content and support cases.</p></div>
          <div className="moderation-list">
            {queue.map((item) => (
              <div key={item.id} className="result-card">
                <span className="result-label">{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <div className="badge-row"><span className="pill">{item.reporter}</span><span className="pill">{item.status}</span></div>
                {item.status === 'open' ? <button type="button" className="button-primary" onClick={() => void handleResolve(item.id)}>Resolve</button> : null}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
