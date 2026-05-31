const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '')

const TOKEN_KEY = 'tfp_token'

function authHeader(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handle<T>(res: Response): Promise<T> {
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

export type SavedPlace = {
  id: number
  collection_name: string
  place_name: string
  formatted_address: string | null
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  image_url: string | null
  image_metadata_id: number | null
  has_gps: boolean
  created_at: string
}

export type Collection = {
  name: string
  saves: SavedPlace[]
}

export function absoluteImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${FILE_BASE}${path}`
}

export async function fetchCollections(): Promise<Collection[]> {
  const res = await fetch(`${API_BASE}/gallery/collections`, { headers: authHeader() })
  const body = await handle<{ collections: Collection[] }>(res)
  return body.collections
}

export type CreateSavedPlaceInput = {
  imageBlob: Blob
  imageName: string
  placeName: string
  collectionName?: string
  formattedAddress?: string | null
  country?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
}

export async function createSavedPlace(input: CreateSavedPlaceInput): Promise<SavedPlace> {
  const form = new FormData()
  form.append('image', input.imageBlob, input.imageName)
  form.append('place_name', input.placeName)
  if (input.collectionName) form.append('collection_name', input.collectionName)
  if (input.formattedAddress) form.append('formatted_address', input.formattedAddress)
  if (input.country) form.append('country', input.country)
  if (input.city) form.append('city', input.city)
  if (input.latitude != null) form.append('latitude', String(input.latitude))
  if (input.longitude != null) form.append('longitude', String(input.longitude))

  const res = await fetch(`${API_BASE}/gallery/saves`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  })
  return handle<SavedPlace>(res)
}

export type UpdateSavedPlaceInput = Partial<{
  placeName: string
  collectionName: string
  latitude: number
  longitude: number
  formattedAddress: string | null
}>

export async function updateSavedPlace(id: number, patch: UpdateSavedPlaceInput): Promise<SavedPlace> {
  const body: Record<string, unknown> = {}
  if (patch.placeName !== undefined) body.place_name = patch.placeName
  if (patch.collectionName !== undefined) body.collection_name = patch.collectionName
  if (patch.latitude !== undefined) body.latitude = patch.latitude
  if (patch.longitude !== undefined) body.longitude = patch.longitude
  if (patch.formattedAddress !== undefined) body.formatted_address = patch.formattedAddress

  const res = await fetch(`${API_BASE}/gallery/saves/${id}`, {
    method: 'PATCH',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handle<SavedPlace>(res)
}

export async function deleteSavedPlace(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/gallery/saves/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
  await handle<{ deleted_id: number }>(res)
}

export async function deleteCollection(name: string): Promise<{ deleted_count: number }> {
  const res = await fetch(`${API_BASE}/gallery/collections/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
  return handle<{ deleted_count: number }>(res)
}

export async function renameCollection(oldName: string, newName: string): Promise<{ renamed_count: number; new_name: string }> {
  const res = await fetch(`${API_BASE}/gallery/collections/rename`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  })
  return handle<{ renamed_count: number; new_name: string }>(res)
}
