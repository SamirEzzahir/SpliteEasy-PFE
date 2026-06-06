import client from './client'
import type { DashboardSummary, ActivityLog } from '../types'

export const dashboardApi = {
  summary: () => client.get<DashboardSummary>('/dashboard/summary'),
  activity: () => client.get<ActivityLog[]>('/activity'),
}
