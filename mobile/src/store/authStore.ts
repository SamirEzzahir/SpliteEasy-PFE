import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { TOKEN_KEY } from '../api/client'
import { authApi } from '../api/auth'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadToken: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY)
      if (token) {
        set({ token, isAuthenticated: true })
        await get().fetchMe()
      }
    } catch {
      // no token stored
    } finally {
      set({ isLoading: false })
    }
  },

  fetchMe: async () => {
    try {
      const res = await authApi.me()
      set({ user: res.data })
    } catch {
      await get().logout()
    }
  },

  login: async (username, password) => {
    const res = await authApi.login(username, password)
    const { access_token } = res.data
    await SecureStore.setItemAsync(TOKEN_KEY, access_token)
    set({ token: access_token, isAuthenticated: true })
    await get().fetchMe()
  },

  register: async (username, email, password) => {
    await authApi.register(username, email, password)
    await get().login(username, password)
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    set({ token: null, user: null, isAuthenticated: false })
  },
}))
