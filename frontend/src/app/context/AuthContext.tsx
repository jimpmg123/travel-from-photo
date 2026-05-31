import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGetCurrentUser, apiLogin } from '../services/authApi'
import type { AuthUser, Role } from '../types'

const TOKEN_KEY = 'tfp_token'
const USER_KEY = 'tfp_user'

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

type AuthContextValue = {
  isLoggedIn: boolean
  user: AuthUser | null
  role: Role
  userDisplayName: string
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser)

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password)

    const authUser: AuthUser = {
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      role: data.role as Role,
    }

    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))
    setToken(data.access_token)
    setUser(authUser)
  }


  useEffect(() => {
    if (!token) return
    let cancelled = false
    apiGetCurrentUser(token)
      .then((data) => {
        if (cancelled) return
        const authUser: AuthUser = {
          userId: data.user_id,
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          role: data.role as Role,
        }
        localStorage.setItem(USER_KEY, JSON.stringify(authUser))
        setUser(authUser)
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  const isLoggedIn = !!token && !!user
  const role: Role = user?.role ?? 'traveler'
  const userDisplayName = user ? `${user.firstName} ${user.lastName}`.trim() : ''

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, role, userDisplayName, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
