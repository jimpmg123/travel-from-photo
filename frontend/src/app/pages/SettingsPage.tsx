import { useEffect, useState } from 'react'
import { Bell, Bug, Lock, Palette } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSettings, reportBug, updateSettings, type SettingsPayload } from '../services/socialApi'

const fallbackSettings: SettingsPayload = {
  displayName: '',
  defaultPrivacy: 'private',
  theme: 'system',
  emailNotifications: true,
}

export function SettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<SettingsPayload>({
    ...fallbackSettings,
    displayName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
  })
  const [statusMessage, setStatusMessage] = useState('Loading settings...')
  const [isSaving, setIsSaving] = useState(false)

  const [bugTitle, setBugTitle] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [bugStatus, setBugStatus] = useState('')
  const [isReporting, setIsReporting] = useState(false)

  const handleReportBug = async () => {
    const title = bugTitle.trim()
    const description = bugDescription.trim()
    if (title.length < 3 || description.length < 5) {
      setBugStatus('Please add a short title and a description before sending.')
      return
    }
    setIsReporting(true)
    try {
      await reportBug({ title, description })
      setBugTitle('')
      setBugDescription('')
      setBugStatus('Thanks! Your bug report was sent to the admin team.')
    } catch (error) {
      setBugStatus(error instanceof Error ? error.message : 'Failed to send the bug report.')
    } finally {
      setIsReporting(false)
    }
  }

  useEffect(() => {
    let ignore = false
    getSettings()
      .then((payload) => {
        if (!ignore) {
          setSettings(payload)
          setStatusMessage('Settings loaded from the backend.')
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
      const saved = await updateSettings(settings)
      setSettings(saved)
      setStatusMessage('Settings saved successfully.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Profile preferences and privacy defaults</h2>
        </div>
        <p className="section-copy">Save display, privacy, theme, and notification preferences.</p>
      </section>

      <section className="settings-layout">
        <article className="panel content-panel">
          <div className="section-mini"><Palette /><h3>Account settings</h3></div>
          <div className="form-stack">
            <label className="field">
              <span>Display name</span>
              <input value={settings.displayName} onChange={(e) => setSettings((s) => ({ ...s, displayName: e.target.value }))} />
            </label>
            <label className="field">
              <span>Default privacy</span>
              <select value={settings.defaultPrivacy} onChange={(e) => setSettings((s) => ({ ...s, defaultPrivacy: e.target.value as SettingsPayload['defaultPrivacy'] }))}>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="field">
              <span>Theme</span>
              <select value={settings.theme} onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value as SettingsPayload['theme'] }))}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="toggle-row">
              <span><Bell size={18} /> Email notifications</span>
              <input type="checkbox" checked={settings.emailNotifications} onChange={(e) => setSettings((s) => ({ ...s, emailNotifications: e.target.checked }))} />
            </label>
            <button type="button" className="button-primary" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save settings'}</button>
            <p className="field-note">{statusMessage}</p>
          </div>
        </article>

        <article className="panel content-panel">
          <div className="section-mini"><Lock /><h3>Security preferences</h3></div>
          <p className="muted-copy">JWT authentication protects profile, settings, chat, and admin API requests.</p>
          <div className="result-grid">
            <div className="result-card"><span className="result-label">API key safety</span><strong>Backend only</strong><p>OpenAI and map keys are read from environment variables.</p></div>
            <div className="result-card"><span className="result-label">Private data</span><strong>Owner scoped</strong><p>Private content is tied to authenticated users.</p></div>
          </div>
        </article>

        <article className="panel content-panel">
          <div className="section-mini"><Bug /><h3>Report a bug</h3></div>
          <p className="muted-copy">Found something broken? Send it to the admin team. Reports appear in the moderation queue.</p>
          <div className="form-stack">
            <label className="field">
              <span>Summary</span>
              <input
                value={bugTitle}
                onChange={(e) => setBugTitle(e.target.value)}
                placeholder="e.g. Search map does not load on mobile"
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>What happened?</span>
              <textarea
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="Describe the steps, what you expected, and what went wrong."
                rows={4}
                maxLength={2000}
              />
            </label>
            <button type="button" className="button-primary" onClick={handleReportBug} disabled={isReporting}>
              {isReporting ? 'Sending...' : 'Send bug report'}
            </button>
            {bugStatus ? <p className="field-note">{bugStatus}</p> : null}
          </div>
        </article>
      </section>
    </div>
  )
}
