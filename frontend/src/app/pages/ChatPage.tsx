import { MessageCircle } from 'lucide-react'

export function ChatPage() {
  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Live Chat</p>
          <h2>Chat with other travelers</h2>
        </div>
        <p className="section-copy">
          Real-time chat between users is planned for a future release.
        </p>
      </section>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem' }}>
        <MessageCircle size={40} />
        <strong>Coming soon</strong>
        <p className="muted-copy">
          This space is reserved for live chat once the social backend is connected.
        </p>
      </div>
    </div>
  )
}
