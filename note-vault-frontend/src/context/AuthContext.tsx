import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { ApiError, notifyError, request } from '@/lib/api'
import type { User } from '@/types'

const TOKEN_KEY = 'notevault-token'

interface Credentials {
  email: string
  password: string
}

interface RegistrationDetails extends Credentials {
  name: string
  interests: string[]
}

interface AuthResponse {
  token: string
  user: User
}

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  isAdmin: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (details: RegistrationDetails) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<User>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const currentUser = await request<User>('/users/me')
    setUser(currentUser)
    return currentUser
  }, [])

  const login = useCallback(async (credentials: Credentials) => {
    const result = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: credentials,
      authenticated: false,
    })
    sessionStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
  }, [])

  const register = useCallback(async (details: RegistrationDetails) => {
    const result = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: details,
      authenticated: false,
    })
    sessionStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
  }, [])

  useEffect(() => {
    let active = true
    const restore = async () => {
      const storedToken = sessionStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        setLoading(false)
        return
      }

      setToken(storedToken)
      try {
        const currentUser = await request<User>('/users/me')
        if (active) setUser(currentUser)
      } catch (error) {
        sessionStorage.removeItem(TOKEN_KEY)
        if (active) {
          setToken(null)
          setUser(null)
          if (!(error instanceof ApiError && error.status === 401)) notifyError(error)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void restore()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      logout()
      toast.error('Your session expired. Please log in again.')
    }
    window.addEventListener('notevault:unauthorized', onUnauthorized)
    return () => window.removeEventListener('notevault:unauthorized', onUnauthorized)
  }, [logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
