import client from './client'
import type { TokenResponse, User } from '../types'

export const authApi = {
  login: (username: string, password: string) => {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)
    return client.post<TokenResponse>('/auth/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },

  register: (username: string, email: string, password: string) =>
    client.post<User>('/auth/register', { username, email, password }),

  me: () => client.get<User>('/auth/me'),
}
