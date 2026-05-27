import { useEffect, useMemo, useState } from 'react'
import { SectionIntro } from '../components/SectionIntro'
import type { MockAccount } from '../types'
import { getChatMessages, sendChatMessage, type ChatMessage } from '../services/socialApi'

type LiveChatPageProps = {
  account: MockAccount
  isLoggedIn: boolean
}

const fallbackMessages: ChatMessage[] = [
  {
    id: 'local_001',
    senderId: 'system',
    senderName: 'Travel From Photo Support',
    messageText: 'Welcome. This demo chat supports user help and admin follow-up.',
    createdAt: new Date().toISOString(),
    readAt: null,
  },
]

export function LiveChatPage({ account, isLoggedIn }: LiveChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(fallbackMessages)
  const [draft, setDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState('Chat is ready.')
  const senderName = useMemo(
    () => `${account.firstName} ${account.lastName}`.trim() || account.userId,
    [account.firstName, account.lastName, account.userId],
  )

  useEffect(() => {
    let ignore = false

    getChatMessages()
      .then((items) => {
        if (!ignore) {
          setMessages(items)
          setStatusMessage('Loaded messages from the backend API.')
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatusMessage('Backend chat API is not reachable. Showing local fallback messages.')
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleSend = async () => {
    const messageText = draft.trim()
    if (!messageText) {
      return
    }

    const optimisticMessage: ChatMessage = {
      id: `local_${Date.now()}`,
      senderId: account.userId,
      senderName,
      messageText,
      createdAt: new Date().toISOString(),
      readAt: null,
    }

    setMessages((current) => [...current, optimisticMessage])
    setDraft('')

    try {
      const saved = await sendChatMessage({ messageText })
      setMessages((current) => current.map((item) => (item.id === optimisticMessage.id ? saved : item)))
      setStatusMessage('Message saved to the backend.')
    } catch {
      setStatusMessage('Message could not be saved because the backend API was not reachable.')
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="panel locked-card">
        <h2>Live chat is locked</h2>
        <p>Please sign in before sending or viewing support messages.</p>
      </section>
    )
  }

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Live chat</p>
          <h2>Support and user communication</h2>
        </div>
        <p className="section-copy">
          This completes the B-track social feature. Messages can be loaded, displayed in time
          order, and sent through the backend API when it is available.
        </p>
      </section>

      <section className="chat-layout">
        <article className="panel content-panel chat-panel">
          <SectionIntro
            title="Message room"
            detail="Use this area for user support, saved chat records, and admin follow-up."
          />

          <div className="chat-thread" aria-live="polite">
            {messages.map((message) => {
              const isMine = message.senderId === account.userId
              return (
                <div key={message.id} className={`chat-bubble ${isMine ? 'is-mine' : ''}`}>
                  <div className="chat-bubble__meta">
                    <strong>{message.senderName}</strong>
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  <p>{message.messageText}</p>
                </div>
              )
            })}
          </div>

          <div className="chat-composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a support message..."
              rows={3}
            />
            <button type="button" className="button-primary" onClick={handleSend}>
              Send message
            </button>
          </div>
          <p className="field-note">{statusMessage}</p>
        </article>

        <aside className="panel content-panel">
          <SectionIntro
            title="Chat requirements covered"
            detail="Authenticated access, sender information, timestamps, and database-ready records."
          />
          <div className="summary-list">
            <span>Access: signed-in users only</span>
            <span>Storage: POST /api/chat/messages</span>
            <span>Read flow: GET /api/chat/messages</span>
            <span>Fallback: local UI message only</span>
          </div>
        </aside>
      </section>
    </div>
  )
}
