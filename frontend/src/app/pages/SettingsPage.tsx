import { Settings } from 'lucide-react'

export function SettingsPage() {
  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Account and preferences</h2>
        </div>
        <p className="section-copy">
          Notification settings, privacy controls, and account management will live here.
        </p>
      </section>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem' }}>
        <Settings size={40} />
        <strong>Coming soon</strong>
        <p className="muted-copy">
          This space is reserved for settings once the auth backend is connected.
        </p>
      </div>
    </div>
  )
}
