import { useEffect, useState } from 'react'
import { SectionIntro } from '../components/SectionIntro'
import type { MockAccount } from '../types'
import { getSettings, updateSettings, type SettingsPayload } from '../services/socialApi'

type SettingsPageProps = {
  account: MockAccount
  isLoggedIn: boolean
}

const fallbackSettings: SettingsPayload = {
  displayName: 'Jaemin Jeon',
  defaultPrivacy: 'private',
  theme: 'system',
  emailNotifications: true,
}

export function SettingsPage({ account, isLoggedIn }: SettingsPageProps) {
  const [settings, setSettings] = useState<SettingsPayload>({
    ...fallbackSettings,
    displayName: `${account.firstName} ${account.lastName}`.trim(),
  })
  const [statusMessage, setStatusMessage] = useState('Settings are ready for local editing.')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    getSettings()
      .then((payload) => {
        if (!ignore) {
          setSettings(payload)
          setStatusMessage('Loaded settings from the backend API.')
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatusMessage('Backend is not connected yet. Using local demo settings.')
        }
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
    } catch {
      setStatusMessage('Saved locally for the demo. Backend settings API was not reachable.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="panel locked-card">
        <h2>Settings are locked</h2>
        <p>Please sign in before changing profile and privacy preferences.</p>
      </section>
    )
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Profile preferences and privacy defaults</h2>
        </div>
        <p className="section-copy">
          These controls complete the B-track settings requirement. They cover display name,
          default journal privacy, theme preference, and email notification behavior.
        </p>
      </section>

      <section className="dual-grid">
        <article className="panel content-panel">
          <SectionIntro
            title="Account preferences"
            detail="Update the settings that affect saved journals, gallery visibility, and the user interface."
          />

          <div className="form-stack">
            <label className="field">
              <span>Display name</span>
              <input
                value={settings.displayName}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Default privacy</span>
              <select
                value={settings.defaultPrivacy}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    defaultPrivacy: event.target.value as SettingsPayload['defaultPrivacy'],
                  }))
                }
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>

            <label className="field">
              <span>Theme</span>
              <select
                value={settings.theme}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    theme: event.target.value as SettingsPayload['theme'],
                  }))
                }
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    emailNotifications: event.target.checked,
                  }))
                }
              />
              <span>Send email notifications for support replies and account notices.</span>
            </label>

            <button type="button" className="button-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>
            <p className="field-note">{statusMessage}</p>
          </div>
        </article>

        <article className="panel content-panel">
          <SectionIntro
            title="Why this matters"
            detail="The design document requires settings input validation and basic preference updates."
          />
          <div className="result-grid">
            <div className="result-card">
              <span className="result-label">Privacy</span>
              <strong>{settings.defaultPrivacy}</strong>
              <p>New journals and saved content can default to the user’s selected visibility.</p>
            </div>
            <div className="result-card">
              <span className="result-label">Theme</span>
              <strong>{settings.theme}</strong>
              <p>The page is ready for a future visual theme switch without changing the flow.</p>
            </div>
            <div className="result-card">
              <span className="result-label">Notifications</span>
              <strong>{settings.emailNotifications ? 'Enabled' : 'Disabled'}</strong>
              <p>Support messages and account events can respect the user preference.</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
