import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { BASE_URL } from '../constants/config'

export const TOKEN_KEY = 'spliteasy_token'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// Attach JWT on every request
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → clear token and redirect to login
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      // Import dynamically to avoid circular deps
      const { useAuthStore } = await import('../store/authStore')
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  },
)

export default client
