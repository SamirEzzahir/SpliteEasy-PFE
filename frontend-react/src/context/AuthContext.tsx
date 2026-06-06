import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem('currentUser')
      return u ? JSON.parse(u) : null
    } catch { return null }
  })

  const refreshUser = useCallback(async () => {
    try {
      const res = await client.get<User>('/users/user/me')
      setUser(res.data)
      localStorage.setItem('currentUser', JSON.stringify(res.data))
    } catch {
      setUser(null)
      localStorage.removeItem('currentUser')
    }
  }, [])

  useEffect(() => {
    if (token && !user) refreshUser()
  }, [token, user, refreshUser])

  const login = async (username: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const res = await client.post<{ access_token: string }>('/auth/login', form)
    const t = res.data.access_token
    setToken(t)
    localStorage.setItem('token', t)
    const me = await client.get<User>('/users/user/me', {
      headers: { Authorization: `Bearer ${t}` }
    })
    setUser(me.data)
    localStorage.setItem('currentUser', JSON.stringify(me.data))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('currentUser')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
