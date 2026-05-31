const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://127.0.0.1:8000/api'

const TOKEN_KEY = 'tfp_token'

function buildAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
      ...(options?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error((body as { detail?: string } | null)?.detail ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export type SettingsPayload = {
  displayName: string
  defaultPrivacy: 'private' | 'unlisted' | 'public'
  theme: 'system' | 'light' | 'dark'
  emailNotifications: boolean
}

export type ProfilePayload = {
  firstName: string
  lastName: string
  userId: string
  email: string
  bio?: string | null
  displayName: string
  defaultPrivacy: string
  theme: string
}

export type ChatRoom = {
  id: number
  tagKey: string
  displayName: string
  emoji: string
  description: string
  category: string
  onlineCount: number
  messageCount: number
}

export type ChatMessage = {
  id: string
  roomId: number
  roomTag: string
  senderId: string
  senderName: string
  messageText: string
  imageId?: number | null
  createdAt: string
  readAt?: string | null
}

export type AdminUser = {
  id: string
  displayName: string
  email: string
  role: 'traveler' | 'admin'
  status: 'active' | 'disabled' | 'review'
  uploads: number
  journals: number
  lastActive: string
}

export type ModerationItem = {
  id: string
  type: string
  title: string
  reporter: string
  reason: string
  status: 'open' | 'resolved'
  createdAt: string
}

export type AdminSummary = {
  totalUsers: number
  activeUsers: number
  reviewUsers: number
  disabledUsers: number
  openModerationItems: number
  totalChatMessages: number
}

export async function getCurrentProfile(): Promise<ProfilePayload> {
  return requestJson<ProfilePayload>('/users/me')
}

export async function updateProfile(payload: Pick<ProfilePayload, 'firstName' | 'lastName' | 'email' | 'bio'>): Promise<ProfilePayload> {
  return requestJson<ProfilePayload>('/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getSettings(): Promise<SettingsPayload> {
  return requestJson<SettingsPayload>('/settings')
}

export async function updateSettings(payload: SettingsPayload): Promise<SettingsPayload> {
  return requestJson<SettingsPayload>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getChatRooms(): Promise<ChatRoom[]> {
  const response = await requestJson<{ items: ChatRoom[] }>('/chat-rooms')
  return response.items
}

export async function getRecommendedChatRooms(tags: string[] = [], imageId?: number): Promise<ChatRoom[]> {
  const params = new URLSearchParams()
  if (tags.length) params.set('tags', tags.join(','))
  if (imageId != null) params.set('imageId', String(imageId))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const response = await requestJson<{ items: ChatRoom[] }>(`/chat-rooms/recommendations${suffix}`)
  return response.items
}

export async function getChatMessages(roomId: number, limit = 50): Promise<ChatMessage[]> {
  const response = await requestJson<{ items: ChatMessage[] }>(`/chat-rooms/${roomId}/messages?limit=${limit}`)
  return response.items
}

export async function sendChatMessage(roomId: number, payload: { messageText: string; imageId?: number | null }): Promise<ChatMessage> {
  return requestJson<ChatMessage>(`/chat-rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function markChatMessageRead(messageId: string): Promise<ChatMessage> {
  return requestJson<ChatMessage>(`/chat/messages/${messageId}/read`, { method: 'PATCH' })
}

export async function getAdminSummary(): Promise<AdminSummary> {
  return requestJson<AdminSummary>('/admin/summary')
}

export async function getAdminUsers(query = ''): Promise<AdminUser[]> {
  const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
  const response = await requestJson<{ items: AdminUser[] }>(`/admin/users${search}`)
  return response.items
}

export async function updateAdminUser(
  userId: string,
  payload: Partial<Pick<AdminUser, 'role' | 'status'>>,
): Promise<AdminUser> {
  return requestJson<AdminUser>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getModerationItems(): Promise<ModerationItem[]> {
  const response = await requestJson<{ items: ModerationItem[] }>('/admin/moderation')
  return response.items
}

export async function resolveModerationItem(itemId: string): Promise<ModerationItem> {
  return requestJson<ModerationItem>(`/admin/moderation/${itemId}`, { method: 'PATCH' })
}
