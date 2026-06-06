import { useEffect, useState } from 'react'
import client from '../api/client'
import { useToastContext } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import type { Expense, Group } from '../types'

interface DashboardSummary {
  total_income: number
  total_expense: number
  net_balance: number
  recent_expenses: Expense[]
}

interface BalanceItem {
  user_id: number
  username: string
  net: number
}

function money(v: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(v))
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 36e5)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const CATEGORY_ICONS: Record<string, string> = {
  food: 'bi-cup-hot-fill',
  transport: 'bi-car-front-fill',
  entertainment: 'bi-controller',
  shopping: 'bi-bag-fill',
  utilities: 'bi-lightning-fill',
  health: 'bi-heart-pulse-fill',
  travel: 'bi-airplane-fill',
  other: 'bi-grid-fill',
}

const CATEGORY_COLORS: Record<string, string> = {
  food: '#f59e0b',
  transport: '#06b6d4',
  entertainment: '#8b5cf6',
  shopping: '#ec4899',
  utilities: '#10b981',
  health: '#ef4444',
  travel: '#3b82f6',
  other: '#6b7280',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [summary, setSummary]   = useState<DashboardSummary | null>(null)
  const [groups, setGroups]     = useState<Group[]>([])
  const [balances, setBalances] = useState<BalanceItem[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [sumRes, grpRes, balRes] = await Promise.all([
          client.get<DashboardSummary>('/dashboard/summary').catch(() => ({ data: null })),
          client.get<Group[]>('/groups').catch(() => ({ data: [] as Group[] })),
          client.get<BalanceItem[]>('/settle/global/balances').catch(() => ({ data: [] as BalanceItem[] })),
        ])
        setSummary(sumRes.data)
        setGroups((grpRes.data || []).slice(0, 4))
        setBalances((balRes.data || []).slice(0, 5))
      } catch (err: any) {
        showToast(String(err?.message || 'Failed to load dashboard'), 'danger')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalIncome  = summary?.total_income  || 0
  const totalExpense = summary?.total_expense  || 0
  const netBalance   = summary?.net_balance    || 0
  const recentExp    = summary?.recent_expenses || []

  const owedToMe = balances.filter(b => b.net > 0).reduce((s, b) => s + b.net, 0)
  const iOwe     = balances.filter(b => b.net < 0).reduce((s, b) => s + Math.abs(b.net), 0)

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1200 }}>
      {/* Greeting */}
      <div className="mb-4">
        <h2 className="fw-bold mb-1">
          {loading ? 'Loading…' : `Welcome back, ${user?.first_name || user?.username || 'there'} \u{1F44B}`}
        </h2>
        <p className="text-muted mb-0">Here's what's happening with your finances today.</p>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Income',    value: totalIncome,  icon: 'bi-arrow-down-circle-fill', color: '#10b981', bg: '#d1fae5' },
          { label: 'Total Expenses',  value: totalExpense, icon: 'bi-arrow-up-circle-fill',   color: '#ef4444', bg: '#fee2e2' },
          { label: 'Net Balance',     value: netBalance,   icon: 'bi-wallet2',                color: netBalance >= 0 ? '#4a5cff' : '#f59e0b', bg: netBalance >= 0 ? '#ede9fe' : '#fef3c7' },
          { label: 'You Are Owed',    value: owedToMe,     icon: 'bi-people-fill',            color: '#06b6d4', bg: '#e0f2fe' },
        ].map(card => (
          <div className="col-sm-6 col-xl-3" key={card.label}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted small fw-semibold">{card.label}</span>
                  <div className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 40, height: 40, background: card.bg, color: card.color, fontSize: 18 }}>
                    <i className={'bi ' + card.icon}></i>
                  </div>
                </div>
                {loading
                  ? <div className="placeholder-glow"><span className="placeholder col-8 rounded" style={{ height: 32 }}></span></div>
                  : <div className="fw-bold" style={{ fontSize: 26, color: card.color }}>{money(card.value)}</div>
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* Recent Expenses */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">Recent Expenses</h6>
              <a href="/expenses" className="text-primary small text-decoration-none">View all</a>
            </div>
            <div className="card-body px-4 pb-4 pt-3">
              {loading
                ? <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
                : recentExp.length
                  ? (
                    <div className="d-flex flex-column gap-2">
                      {recentExp.slice(0, 8).map(exp => {
                        const cat   = exp.category?.toLowerCase() || 'other'
                        const icon  = CATEGORY_ICONS[cat]  || CATEGORY_ICONS.other
                        const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other
                        return (
                          <div key={exp.id} className="d-flex align-items-center gap-3 p-2 rounded-3"
                            style={{ border: '1px solid #f3f4f6' }}>
                            <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 40, height: 40, background: color + '18', color, fontSize: 16 }}>
                              <i className={'bi ' + icon}></i>
                            </div>
                            <div className="flex-grow-1 min-w-0">
                              <div className="fw-semibold text-truncate" style={{ fontSize: 14 }}>{exp.description}</div>
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                {exp.group_name || 'Personal'} &bull; {timeAgo(exp.created_at)}
                              </div>
                            </div>
                            <div className="fw-bold flex-shrink-0" style={{ color: '#ef4444', fontSize: 15 }}>
                              -{money(exp.amount, exp.currency)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                  : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-receipt fs-1 d-block mb-2 opacity-25"></i>
                      No recent expenses yet.
                    </div>
                  )
              }
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-lg-5 d-flex flex-column gap-4">

          {/* Balances */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">Who owes who</h6>
              <a href="/global-settle" className="text-primary small text-decoration-none">Settle up</a>
            </div>
            <div className="card-body px-4 pb-4 pt-3">
              {loading
                ? <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary" role="status"></div></div>
                : balances.length
                  ? (
                    <div className="d-flex flex-column gap-2">
                      {balances.map(b => (
                        <div key={b.user_id} className="d-flex align-items-center gap-2">
                          <img
                            src={'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(b.username)}
                            alt={b.username}
                            className="rounded-circle flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          />
                          <span className="flex-grow-1 fw-semibold" style={{ fontSize: 13 }}>{b.username}</span>
                          <span className={'fw-bold ' + (b.net > 0 ? 'text-success' : 'text-danger')} style={{ fontSize: 13 }}>
                            {b.net > 0 ? '+' : '-'}{money(b.net)}
                          </span>
                        </div>
                      ))}
                      <div className="d-flex justify-content-between pt-2 mt-1 border-top">
                        <span className="text-success small fw-semibold">Owed to you: {money(owedToMe)}</span>
                        <span className="text-danger small fw-semibold">You owe: {money(iOwe)}</span>
                      </div>
                    </div>
                  )
                  : <div className="text-center text-muted py-3" style={{ fontSize: 13 }}>All settled up!</div>
              }
            </div>
          </div>

          {/* Groups */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">Your Groups</h6>
              <a href="/groups" className="text-primary small text-decoration-none">View all</a>
            </div>
            <div className="card-body px-4 pb-4 pt-3">
              {loading
                ? <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary" role="status"></div></div>
                : groups.length
                  ? (
                    <div className="d-flex flex-column gap-2">
                      {groups.map(g => (
                        <a key={g.id} href={'/groups/' + g.id + '/expenses'}
                          className="d-flex align-items-center gap-3 p-2 rounded-3 text-decoration-none text-dark"
                          style={{ border: '1px solid #f3f4f6' }}>
                          <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 fw-bold text-white"
                            style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#4a5cff,#7c4dff)', fontSize: 16 }}>
                            {g.title.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold text-truncate" style={{ fontSize: 14 }}>{g.title}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {g.members_usernames?.length || 0} members &bull; {g.expenses_count || 0} expenses
                            </div>
                          </div>
                          {g.has_unsettled_balance && (
                            <span className="badge rounded-pill" style={{ background: '#fee2e2', color: '#ef4444', fontSize: 11 }}>Unsettled</span>
                          )}
                        </a>
                      ))}
                    </div>
                  )
                  : (
                    <div className="text-center text-muted py-3" style={{ fontSize: 13 }}>
                      No groups yet. <a href="/groups">Create one!</a>
                    </div>
                  )
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
