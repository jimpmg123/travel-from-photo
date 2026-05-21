import { adminQueue, profileNotes } from '../data'
import { SectionIntro } from '../components/SectionIntro'
import { WorkflowList } from '../components/WorkflowList'
import type { AuthUser, Role } from '../types'

type ProfilePageProps = {
  user: AuthUser | null
  isLoggedIn: boolean
  role: Role
}

export function ProfilePage({ user, isLoggedIn, role }: ProfilePageProps) {
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Guest'

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Account and saved context</h2>
        </div>
        <p className="section-copy">
          This page reserves space for login status, preferences, private history controls, and an
          admin view if needed.
        </p>
      </section>

      <section className="profile-grid">
        <article className="panel profile-card">
          <div className="avatar-ring">
            <span>{user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` : '?'}</span>
          </div>
          <div>
            <h3>{displayName}</h3>
            <p className="muted-copy">
              {isLoggedIn ? 'Signed in.' : 'Browsing in guest preview mode.'}
            </p>
          </div>
          {user && (
            <div className="summary-list">
              <span>ID: {user.userId}</span>
              <span>Email: {user.email}</span>
            </div>
          )}
          <div className="badge-row">
            <span className="pill">{role === 'traveler' ? 'Traveler' : 'Admin'} view</span>
            <span className="pill">{isLoggedIn ? 'Gallery enabled' : 'Gallery locked'}</span>
          </div>
        </article>

        <article className="panel content-panel">
          <SectionIntro
            title="Saved preferences"
            detail="Inputs here can later personalize search defaults and routing behavior."
          />
          <WorkflowList items={profileNotes} compact />
        </article>

        <article className="panel content-panel">
          <SectionIntro
            title="Recent activity snapshot"
            detail="A simple summary area for uploads, saved places, and restaurant lookups."
          />
          <div className="result-grid">
            <div className="result-card">
              <span className="result-label">Uploads</span>
              <strong>4 recent photos</strong>
              <p>Landmark and food memories are mixed into the same personal timeline.</p>
            </div>
            <div className="result-card">
              <span className="result-label">Saved routes</span>
              <strong>2 draft guides</strong>
              <p>Reserved for future directions and shareable itineraries.</p>
            </div>
            <div className="result-card">
              <span className="result-label">Gallery access</span>
              <strong>4 grouped collections</strong>
              <p>Open your private gallery to review uploads, rename sets, and browse saved images.</p>
            </div>
          </div>
        </article>

        {role === 'admin' ? (
          <article className="panel admin-panel">
            <SectionIntro
              title="Admin review lane"
              detail="Visible only in the admin mock view to satisfy the multi-role course requirement."
            />
            <WorkflowList items={adminQueue} compact />
          </article>
        ) : null}
      </section>
    </div>
  )
}
