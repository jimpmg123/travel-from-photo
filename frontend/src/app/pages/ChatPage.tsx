import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { getChatMessages, sendChatMessage, type ChatMessage } from '../services/socialApi'

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState('Loading messages...')
  const [isSending, setIsSending] = useState(false)

  const loadMessages = () => {
    getChatMessages()
      .then((items) => {
        setMessages(items)
        setStatusMessage('Live chat is connected to the backend database.')
      })
      .catch((error: Error) => setStatusMessage(error.message))
  }

  useEffect(() => {
    loadMessages()
    const timer = window.setInterval(loadMessages, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text) return
    setIsSending(true)
    try {
      const saved = await sendChatMessage({ messageText: text })
      setMessages((items) => [...items, saved])
      setDraft('')
      setStatusMessage('Message sent.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to send message.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Live Chat</p>
          <h2>Chat with support</h2>
        </div>
        <p className="section-copy">Messages are saved in PostgreSQL and protected by login.</p>
      </section>

      <section className="chat-layout panel">
        <aside className="chat-sidebar">
          <h3>Conversations</h3>
          <button className="chat-room is-active" type="button"><MessageCircle size={18} /> Support Room</button>
          <p className="muted-copy">Authenticated users can send support messages here.</p>
        </aside>
        <article className="chat-panel">
          <div className="chat-header"><strong>Support Room</strong><span className="pill">Online</span></div>
          <div className="chat-messages">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className="chat-message">
                <div><strong>{message.senderName}</strong><span>{new Date(message.createdAt).toLocaleString()}</span></div>
                <p>{message.messageText}</p>
              </div>
            )) : <p className="muted-copy">No messages yet.</p>}
          </div>
          <div className="chat-input-row">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message..." onKeyDown={(e) => { if (e.key === 'Enter') void handleSend() }} />
            <button className="button-primary" type="button" onClick={handleSend} disabled={isSending}><Send size={16} /> Send</button>
          </div>
          <p className="field-note">{statusMessage}</p>
        </article>
      </section>
    </div>
  )
}
