import { useEffect, useState } from 'react'
import { adminQueue, profileNotes } from '../data'
import { SectionIntro } from '../components/SectionIntro'
import { WorkflowList } from '../components/WorkflowList'
import type { MockAccount, PageNavigator, Role } from '../types'
import { getCurrentProfile, updateProfile, type ProfilePayload } from '../services/socialApi'

type ProfilePageProps = {
  account: MockAccount
  isLoggedIn: boolean
  role: Role
  onOpenPage: PageNavigator
}

type EditableProfile = Pick<ProfilePayload, 'firstName' | 'lastName' | 'email' | 'bio'>

export function ProfilePage({ account, isLoggedIn, role, onOpenPage }: ProfilePageProps) {
  const [profile, setProfile] = useState<EditableProfile>({
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    bio: 'I like saving travel photos and checking places later.',
  })
  const [statusMessage, setStatusMessage] = useState('Profile is ready for editing.')
  const [isSaving, setIsSaving] = useState(false)
  const displayName = `${profile.firstName} ${profile.lastName}`.trim()

  useEffect(() => {
    let ignore = false

    getCurrentProfile()
      .then((payload) => {
        if (!ignore) {
          setProfile({
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            bio: payload.bio ?? '',
          })
          setStatusMessage('Loaded profile from the backend API.')
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatusMessage('Backend profile API is not connected yet. Using local demo data.')
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const saved = await updateProfile(profile)
      setProfile({
        firstName: saved.firstName,
        lastName: saved.lastName,
        email: saved.email,
        bio: saved.bio ?? '',
      })
      setStatusMessage('Profile saved successfully.')
    } catch {
      setStatusMessage('Saved locally for the demo. Backend profile API was not reachable.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Account, profile, and B-track shortcuts</h2>
        </div>
        <p className="section-copy">
          This page now connects the profile view with settings, live chat, and admin features from
          the Social track.
        </p>
      </section>

      <section className="profile-grid">
        <article className="panel profile-card">
          <div className="avatar-ring">
            <span>{`${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`}</span>
          </div>
          <div>
            <h3>{displayName}</h3>
            <p className="muted-copy">
              {isLoggedIn
                ? 'Signed in with a mock secure session.'
                : 'Browsing in guest preview mode.'}
            </p>
          </div>
          <div className="summary-list">
            <span>ID: {account.userId}</span>
            <span>Email: {profile.email}</span>
            <span>Bio: {profile.bio || 'No bio added yet.'}</span>
          </div>
          <div className="badge-row">
            <span className="pill">{role === 'traveler' ? 'Traveler' : 'Admin'} view</span>
            <span className="pill">{isLoggedIn ? 'Gallery enabled' : 'Gallery locked'}</span>
          </div>
          <div className="profile-actions">
            <button type="button" className="button-secondary" onClick={() => onOpenPage('settings')}>
              Open settings
            </button>
            <button type="button" className="button-secondary" onClick={() => onOpenPage('live-chat')}>
              Open live chat
            </button>
            {role === 'admin' ? (
              <button type="button" className="button-secondary" onClick={() => onOpenPage('admin')}>
                Open admin
              </button>
            ) : null}
          </div>
        </article>

        <article className="panel content-panel">
          <SectionIntro
            title="Edit profile"
            detail="This form is connected to GET /api/users/me and PUT /api/profile when the backend is running."
          />
          <div className="form-stack">
            <div className="field-grid">
              <label className="field">
                <span>First name</span>
                <input
                  value={profile.firstName}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, firstName: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input
                  value={profile.lastName}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, lastName: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Email</span>
              <input
                value={profile.email}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Bio</span>
              <textarea
                value={profile.bio ?? ''}
                onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                rows={4}
              />
            </label>
            <button type="button" className="button-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save profile'}
            </button>
            <p className="field-note">{statusMessage}</p>
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
            detail="A simple summary area for uploads, saved places, and journal activity."
          />
          <div className="result-grid">
            <div className="result-card">
              <span className="result-label">Uploads</span>
              <strong>4 recent photos</strong>
              <p>Travel memories are grouped into the private gallery.</p>
            </div>
            <div className="result-card">
              <span className="result-label">Journals</span>
              <strong>2 draft logs</strong>
              <p>Journal drafts can use saved photos and selected locations.</p>
            </div>
            <div className="result-card">
              <span className="result-label">Support</span>
              <strong>Live chat ready</strong>
              <p>Users can ask for help and admins can review support messages.</p>
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
