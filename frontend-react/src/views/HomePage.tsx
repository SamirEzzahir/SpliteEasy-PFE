import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { ActivityLog, Group } from '../types'

type DashboardSummary = {
  total_income: number
  total_expense: number
  net_balance: number
  recent_expenses: Array<{ description: string; amount: number; currency: string; created_at: string }>
}

function money(v: number, currency = 'USD') {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)} ${currency}`
}

function smallLinePath(values: number[]) {
  if (values.length < 2) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const w = 260
  const h = 78
  const pad = 6
  const span = max - min || 1
  const points = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (values.length - 1)
    const y = pad + (h - pad * 2) * (1 - (v - min) / span)
    return [x, y] as const
  })
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
}

export default function HomePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [groupsRes, activityRes, summaryRes] = await Promise.all([
          client.get<Group[]>('/groups'),
          client.get<ActivityLog[]>('/activity'),
          client.get<DashboardSummary>('/dashboard/summary'),
        ])
        if (cancelled) return
        setGroups(groupsRes.data || [])
        setActivity((activityRes.data || []).slice(0, 6))
        setSummary(summaryRes.data)
      } catch {
        if (cancelled) return
        setGroups([])
        setActivity([])
        setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeGroups = groups.length
  const totalExpenses = useMemo(() => {
    return groups.reduce((sum, g) => sum + (g.expenses_count || 0), 0)
  }, [groups])

  const chartValues = useMemo(() => {
    const base = summary?.recent_expenses?.slice(0, 6).map((e) => Number(e.amount)) || []
    if (base.length >= 2) return base.reverse()
    return [12, 36, 24, 44, 32, 58, 40]
  }, [summary])

  const spark = smallLinePath(chartValues)

  return (
    <>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-muted small">Dashboard</div>
          <h1 className="h4 mb-0">Welcome, {user?.username || 'SplitEasy'}</h1>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card stat-card p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Total Balance</div>
                <div className="h4 mb-0">{loading ? '...' : summary ? money(summary.net_balance) : '—'}</div>
                <div className="small text-muted">vs last month</div>
              </div>
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4a5cff, #7c4dff)' }}>
                <i className="bi bi-cash-coin"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="card stat-card p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Total Expenses</div>
                <div className="h4 mb-0">{loading ? '...' : summary ? money(summary.total_expense) : '—'}</div>
                <div className="small text-muted">{totalExpenses} items</div>
              </div>
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fb7185)' }}>
                <i className="bi bi-receipt"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="card stat-card p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Total Income</div>
                <div className="h4 mb-0">{loading ? '...' : summary ? money(summary.total_income) : '—'}</div>
                <div className="small text-muted">This month</div>
              </div>
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
                <i className="bi bi-graph-up-arrow"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="card stat-card p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Active Groups</div>
                <div className="h4 mb-0">{loading ? '...' : activeGroups}</div>
                <div className="small text-muted">In your account</div>
              </div>
              <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}>
                <i className="bi bi-people-fill"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-7">
          <div className="card stat-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="fw-semibold">Expenses Overview</div>
              <button className="btn btn-sm btn-outline-secondary" type="button">
                This month
              </button>
            </div>
            <div className="text-muted small mb-2">Quick trend</div>
            <div className="p-2">
              <svg width="100%" height="92" viewBox="0 0 260 78" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#4a5cff" stopOpacity="0.22" />
                    <stop offset="1" stopColor="#7c4dff" stopOpacity="0.06" />
                  </linearGradient>
                </defs>
                <path d={spark} fill="none" stroke="#4a5cff" strokeWidth="2.5" />
                <path d={`${spark} L 254 72 L 6 72 Z`} fill="url(#g)" />
              </svg>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="card stat-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="fw-semibold">Recent Expenses</div>
              <button className="btn btn-sm btn-outline-secondary" type="button">
                This month
              </button>
            </div>
            {summary?.recent_expenses?.length ? (
              <div className="d-flex flex-column">
                {summary.recent_expenses.slice(0, 5).map((e, idx) => (
                  <div className="activity-item d-flex align-items-center" key={idx}>
                    <div className="me-3">
                      <span className="user-avatar" style={{ width: 34, height: 34, borderRadius: 12 }}>
                        <i className="bi bi-receipt"></i>
                      </span>
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{e.description}</div>
                      <div className="text-muted small">{new Date(e.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="fw-semibold">{money(e.amount, e.currency)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted py-4 text-center">{loading ? 'Loading...' : 'No expenses yet'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="card activity-card p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">Recent Activity</div>
          <span className="text-muted small">Latest</span>
        </div>

        {activity.length === 0 ? (
          <div className="text-muted py-4 text-center">{loading ? 'Loading...' : 'No activity yet'}</div>
        ) : (
          <div>
            {activity.map((a) => (
              <div className="activity-item d-flex align-items-start gap-2" key={a.id}>
                <i className="bi bi-clock-history text-primary mt-1"></i>
                <div className="flex-grow-1">
                  <div className="small fw-semibold">{a.user?.username || 'User'}</div>
                  <div className="small text-muted">{a.action}</div>
                </div>
                <div className="small text-muted">{new Date(a.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

