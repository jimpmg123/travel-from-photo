const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'
const TOKEN_KEY = 'tfp_token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('tfp_user')
    throw new Error('Your session has expired — please sign in again.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

// ----- Types matching backend Pydantic schemas -----

export type JournalStatus = 'pending' | 'processing' | 'done' | 'partial_success' | 'failed'

export type JournalSkippedImage = {
  image_id: number
  reason: string
}

export type JournalJobAccepted = {
  job_id: number
  status: JournalStatus
}

export type JournalJobStatus = {
  job_id: number
  status: JournalStatus
  journal_id: number | null
  progress?: { done: number; total: number } | null
  entries_created?: number | null
  skipped?: JournalSkippedImage[] | null
  error?: string | null
}

export type JournalEntry = {
  id: number
  image_id: number
  image_url: string | null
  entry_order: number
  place_name: string | null
  country: string | null
  city: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  captured_at: string | null
  clip_subject: string[] | null
  clip_atmosphere: string[] | null
  clip_activity: string[] | null
  gpt_shooting_style: string | null
  gpt_subject_focus: string | null
  gpt_time_of_day: string | null
  gpt_atmosphere: string | null
  gpt_weather_light: string | null
  gpt_composition_habit: string | null
  gpt_color_mood: string | null
  gpt_cultural_layer: string | null
  gpt_detail_note: string | null
  journal_text: string | null
  generated_by: string
  model_version: string | null
  vocab_version: string | null
  generated_at: string
}

export type JournalDetail = {
  id: number
  title: string | null
  summary: string | null
  status: JournalStatus
  visibility: string
  error_reason: string | null
  skipped: JournalSkippedImage[] | null
  created_at: string
  updated_at: string
  entries: JournalEntry[]
}

export type JournalSummary = {
  id: number
  title: string | null
  status: JournalStatus
  primary_city: string | null
  primary_country: string | null
  entry_count: number
  earliest_captured_at: string | null
  created_at: string
  cover_image_url: string | null
}

export type JournalStats = {
  photo_count: number
  country_count: number
  city_count: number
  countries: string[]
  cities: string[]
  total_distance_km: number
  subject_distribution: Record<string, number>
  atmosphere_distribution: Record<string, number>
  activity_distribution: Record<string, number>
  cultural_layer_distribution: Record<string, number>
  color_mood_distribution: Record<string, number>
  composition_distribution: Record<string, number>
  time_of_day_distribution: Record<string, number>
}

export type RecommendationItem = {
  name: string
  country: string
  reason: string
}

export type JournalRecommendations = {
  recommendations: RecommendationItem[]
  low_data: boolean
  model_version: string | null
}

export type JournalEntryEdit = {
  id: number
  journal_text?: string | null
}

export type JournalEditRequest = {
  title?: string | null
  entries?: JournalEntryEdit[]
}

// ----- Calls -----

export async function generateJournal(
  image_ids: number[],
  title?: string,
): Promise<JournalJobAccepted> {
  const res = await fetch(`${API_BASE}/journals/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ image_ids, title }),
  })
  return handleResponse(res)
}

export async function pollJournalJob(jobId: number): Promise<JournalJobStatus> {
  const res = await fetch(`${API_BASE}/journals/jobs/${jobId}`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function listJournals(): Promise<JournalSummary[]> {
  const res = await fetch(`${API_BASE}/journals`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function getJournalDetail(id: number): Promise<JournalDetail> {
  const res = await fetch(`${API_BASE}/journals/${id}`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function editJournal(
  id: number,
  payload: JournalEditRequest,
): Promise<JournalDetail> {
  const res = await fetch(`${API_BASE}/journals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function discardJournal(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/journals/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function getJournalStats(): Promise<JournalStats> {
  const res = await fetch(`${API_BASE}/journals/stats`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function getJournalRecommendations(): Promise<JournalRecommendations> {
  const res = await fetch(`${API_BASE}/journals/recommendations`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}
