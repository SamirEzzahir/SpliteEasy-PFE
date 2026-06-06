import axios from 'axios'

// Prefer Vite dev proxy (`/api`) to avoid CORS locally.
// In production, set `VITE_API_URL` to an absolute URL like `https://api.example.com`.
export const API_URL = import.meta.env.VITE_API_URL || '/api'

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

export function getApiHttpBase() {
  if (isAbsoluteUrl(API_URL)) return API_URL.replace(/\/$/, '')
  // Resolve `/api` -> `http(s)://host/api`
  return new URL(API_URL, window.location.origin).toString().replace(/\/$/, '')
}

export function getApiWsBase() {
  const httpBase = getApiHttpBase()
  return httpBase.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
}

const client = axios.create({ baseURL: API_URL })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('currentUser')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
