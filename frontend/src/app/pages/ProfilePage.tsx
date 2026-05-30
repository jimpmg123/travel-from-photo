import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Shield, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getCurrentProfile, updateProfile, type ProfilePayload } from '../services/socialApi'

type EditableProfile = Pick<ProfilePayload, 'firstName' | 'lastName' | 'email' | 'bio'>

export function ProfilePage() {
  const { user, role } = useAuth()
  const [profile, setProfile] = useState<EditableProfile>({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    bio: '',
  })
  const [statusMessage, setStatusMessage] = useState('Loading profile...')
  const [isSaving, setIsSaving] = useState(false)

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
          setStatusMessage('Profile loaded from the backend.')
        }
      })
      .catch((error: Error) => {
        if (!ignore) setStatusMessage(error.message)
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
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || 'Traveler'

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Account and saved context</h2>
        </div>
        <p className="section-copy">
          Manage your profile data and connect to settings, live chat, and admin tools.
        </p>
      </section>

      <section className="profile-grid b-track-grid">
        <article className="panel profile-card">
          <div className="avatar-ring"><span>{displayName.slice(0, 2).toUpperCase()}</span></div>
          <div>
            <h3>{displayName}</h3>
            <p className="muted-copy">Signed in as {role === 'admin' ? 'Admin' : 'Traveler'}.</p>
          </div>
          <div className="summary-list">
            <span><UserRound size={16} /> ID: {user?.userId ?? 'unknown'}</span>
            <span><Mail size={16} /> {profile.email}</span>
            <span><Shield size={16} /> Account status: Active</span>
          </div>
          <div className="profile-actions">
            <Link className="button-secondary" to="/settings">Open settings</Link>
            <Link className="button-secondary" to="/chat">Open live chat</Link>
            {role === 'admin' ? <Link className="button-secondary" to="/admin">Open admin</Link> : null}
          </div>
        </article>

        <article className="panel content-panel">
          <div className="section-mini">
            <p className="eyebrow">Editable profile</p>
            <h3>Profile information</h3>
            <p className="muted-copy">Connected to GET /api/users/me and PUT /api/profile.</p>
          </div>
          <div className="form-stack">
            <div className="field-grid">
              <label className="field">
                <span>First name</span>
                <input value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} />
              </label>
            </div>
            <label className="field">
              <span>Email</span>
              <input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <label className="field">
              <span>Bio</span>
              <textarea rows={4} value={profile.bio ?? ''} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} />
            </label>
            <button type="button" className="button-primary" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save profile'}</button>
            <p className="field-note">{statusMessage}</p>
          </div>
        </article>
      </section>
    </div>
  )
}
