const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export type RegisterPayload = {
  first_name: string
  last_name: string
  user_id: string
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user_id: string
  role: string
  first_name: string
  last_name: string
  email: string
}

export async function apiRegister(payload: RegisterPayload): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function apiVerifyOtp(email: string, code: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  return handleResponse(res)
}

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse(res)
}
