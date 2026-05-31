import { useEffect, useMemo, useRef, useState } from 'react'
import { Hash, Image, Send, Users, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  getChatMessages,
  getChatRooms,
  sendChatMessage,
  type ChatMessage,
  type ChatRoom,
} from '../services/socialApi'
import { absoluteImageUrl, fetchCollections, type SavedPlace } from '../services/galleryApi'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://127.0.0.1:8000/api'

const TOKEN_KEY = 'tfp_token'

function toWsUrl(roomId: number): string {
  const token = localStorage.getItem(TOKEN_KEY) ?? ''
  const base = API_BASE_URL.startsWith('http')
    ? API_BASE_URL
    : `${window.location.origin}${API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`}`
  const apiUrl = new URL(base)
  apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, '')}/ws/chat/${roomId}`
  apiUrl.search = `token=${encodeURIComponent(token)}`
  return apiUrl.toString()
}

function roomMatchesTags(room: ChatRoom, tags: string[]): boolean {
  if (!tags.length) return false
  return tags.includes(room.tagKey)
}

export function ChatPage() {
  const [searchParams] = useSearchParams()
  const recommendedTags = useMemo(
    () => (searchParams.get('tags') ?? '').split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    [searchParams],
  )
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState('Loading tag lounges...')
  const [isSending, setIsSending] = useState(false)
  const [socketState, setSocketState] = useState<'connecting' | 'online' | 'polling'>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const [galleryImages, setGalleryImages] = useState<SavedPlace[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [attachment, setAttachment] = useState<{ imageUrl: string } | null>(null)

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null

  const openPicker = () => {
    setPickerOpen(true)
    if (galleryImages.length === 0) {
      fetchCollections()
        .then((collections) => {
          const withPhotos = collections
            .flatMap((collection) => collection.saves)
            .filter((save) => Boolean(save.image_url))
          setGalleryImages(withPhotos)
        })
        .catch((error: Error) => setStatusMessage(error.message))
    }
  }

  useEffect(() => {
    getChatRooms()
      .then((items) => {
        setRooms(items)
        const recommended = items.find((room) => roomMatchesTags(room, recommendedTags))
        setActiveRoomId((current) => current ?? recommended?.id ?? items[0]?.id ?? null)
        setStatusMessage('13 permanent tag lounges are loaded from the backend database.')
      })
      .catch((error: Error) => setStatusMessage(error.message))
  }, [recommendedTags])

  useEffect(() => {
    if (!activeRoomId) return
    let cancelled = false

    const loadMessages = () => {
      getChatMessages(activeRoomId, 50)
        .then((items) => {
          if (cancelled) return
          setMessages(items)
          setStatusMessage('Past messages are loaded from PostgreSQL. Empty lounges are still permanent.')
        })
        .catch((error: Error) => {
          if (!cancelled) setStatusMessage(error.message)
        })
    }

    loadMessages()
    const timer = window.setInterval(loadMessages, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeRoomId])

  useEffect(() => {
    if (!activeRoomId) return
    socketRef.current?.close()
    const socket = new WebSocket(toWsUrl(activeRoomId))
    socketRef.current = socket
    setSocketState('connecting')

    socket.onopen = () => setSocketState('online')
    socket.onerror = () => setSocketState('polling')
    socket.onclose = () => setSocketState('polling')
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: 'message'; message: ChatMessage }
          | { type: 'presence'; onlineCount: number }
          | { type: 'error'; detail: string }
        if (payload.type === 'message') {
          setMessages((items) => {
            if (items.some((item) => item.id === payload.message.id)) return items
            return [...items, payload.message]
          })
        } else if (payload.type === 'presence') {
          setRooms((items) => items.map((room) => room.id === activeRoomId ? { ...room, onlineCount: payload.onlineCount } : room))
        } else if (payload.type === 'error') {
          setStatusMessage(payload.detail)
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    }

    return () => {
      socket.close()
    }
  }, [activeRoomId])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !activeRoomId) return
    const imageUrl = attachment?.imageUrl ?? null
    setIsSending(true)
    try {
      const socket = socketRef.current
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ messageText: text, imageUrl }))
        setDraft('')
        setAttachment(null)
        setStatusMessage('Message sent through WebSocket.')
      } else {
        const saved = await sendChatMessage(activeRoomId, { messageText: text, imageUrl })
        setMessages((items) => [...items, saved])
        setDraft('')
        setAttachment(null)
        setStatusMessage('Message sent through REST fallback.')
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to send message.')
    } finally {
      setIsSending(false)
    }
  }

  const groupedRooms = useMemo(() => {
    const groups: Record<string, ChatRoom[]> = { nature: [], urban: [], culture: [], experience: [] }
    rooms.forEach((room) => {
      const key = room.category in groups ? room.category : 'experience'
      groups[key].push(room)
    })
    return groups
  }, [rooms])

  return (
    <div className="stack-xl">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Live Chat</p>
          <h2>Tag-based travel lounges</h2>
        </div>
        <p className="section-copy">
          Search tags recommend one of 13 permanent lounges. Messages stay saved even when nobody is online.
        </p>
      </section>

      <section className="chat-layout panel">
        <aside className="chat-sidebar chat-sidebar--lounges">
          <div className="chat-sidebar-head">
            <h3>13 Lounges</h3>
            <span className="pill"><Users size={14} /> {rooms.reduce((sum, room) => sum + room.onlineCount, 0)} online</span>
          </div>
          {recommendedTags.length ? (
            <div className="lounge-recommendation-note">
              <Hash size={14} /> Recommended from Search tags: {recommendedTags.map((tag) => `#${tag}`).join(' ')}
            </div>
          ) : null}

          {Object.entries(groupedRooms).map(([category, items]) => items.length ? (
            <div className="lounge-group" key={category}>
              <p className="lounge-group-title">{category}</p>
              {items.map((room) => (
                <button
                  key={room.id}
                  className={`chat-room lounge-room${room.id === activeRoomId ? ' is-active' : ''}${roomMatchesTags(room, recommendedTags) ? ' is-recommended' : ''}`}
                  type="button"
                  onClick={() => setActiveRoomId(room.id)}
                >
                  <span className="lounge-emoji">{room.emoji}</span>
                  <span>
                    <strong>{room.displayName}</strong>
                    <small>{room.onlineCount} online · {room.messageCount} messages</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null)}
        </aside>

        <article className="chat-panel">
          <div className="chat-header">
            <div>
              <strong>{activeRoom ? `${activeRoom.emoji} ${activeRoom.displayName}` : 'Select a lounge'}</strong>
              {activeRoom ? <p className="field-note">{activeRoom.description}</p> : null}
            </div>
            <span className={`pill ${socketState === 'online' ? 'pill-success' : ''}`}>
              {socketState === 'online' ? 'WebSocket online' : socketState === 'connecting' ? 'Connecting...' : 'REST polling fallback'}
            </span>
          </div>

          <div className="chat-messages">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className="chat-message">
                <div><strong>{message.senderName}</strong><span>{new Date(message.createdAt).toLocaleString()}</span></div>
                <p>{message.messageText}</p>
                {message.imageUrl ? (
                  <img className="chat-message-image" src={absoluteImageUrl(message.imageUrl) ?? undefined} alt="shared from gallery" loading="lazy" />
                ) : message.imageId ? (
                  <span className="message-attachment"><Image size={13} /> image #{message.imageId}</span>
                ) : null}
              </div>
            )) : <p className="muted-copy">No messages in this lounge yet. The room still exists and will keep future messages.</p>}
          </div>

          {attachment ? (
            <div className="chat-attachment-preview">
              <img src={absoluteImageUrl(attachment.imageUrl) ?? undefined} alt="attachment preview" />
              <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
                <X size={14} /> Remove photo
              </button>
            </div>
          ) : null}

          <div className="chat-input-row">
            <button
              type="button"
              className="chat-attach-button"
              onClick={openPicker}
              disabled={!activeRoom}
              aria-label="Attach a photo from your gallery"
              title="Attach a photo from your gallery"
            >
              <Image size={18} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={activeRoom ? `Message ${activeRoom.displayName}...` : 'Select a lounge first...'}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSend() }}
              disabled={!activeRoom}
            />
            <button className="button-primary" type="button" onClick={handleSend} disabled={isSending || !activeRoom}>
              <Send size={16} /> Send
            </button>
          </div>
          <p className="field-note">{statusMessage}</p>
        </article>
      </section>

      {pickerOpen ? (
        <div className="picker-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="picker-card" onClick={(e) => e.stopPropagation()}>
            <div className="picker-head">
              <h3>Attach a photo from your gallery</h3>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {galleryImages.length ? (
              <div className="picker-grid">
                {galleryImages.map((save) => (
                  <button
                    key={save.id}
                    type="button"
                    className="picker-thumb"
                    onClick={() => {
                      if (save.image_url) setAttachment({ imageUrl: save.image_url })
                      setPickerOpen(false)
                    }}
                    title={save.place_name}
                  >
                    <img src={absoluteImageUrl(save.image_url) ?? undefined} alt={save.place_name} loading="lazy" />
                    <span>{save.place_name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy">No saved photos yet. Save a place in your gallery first.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
