import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToastContext } from '../context/ToastContext'
import type { ActivityLog, Group } from '../types'

type BalanceItem = {
  user_id: number
  username: string
  net: number
  original_net?: number | null
  global_adjustment?: number | null
}

type SettlementStatus = 'pending' | 'accepted' | 'rejected'

type SettlementApiRow = {
  id?: number
  group_id?: number
  from_user_id: number
  from_username: string
  to_user_id: number
  to_username: string
  amount: number
  status: SettlementStatus
  message?: string
  created_at?: string
}

type SettlementRow = SettlementApiRow & {
  source: 'group' | 'global'
  groupName?: string
}

type TabKey = 'group' | 'global' | 'history'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'group', label: 'Group Settlements' },
  { key: 'global', label: 'Global Settlements' },
  { key: 'history', label: 'History' },
]

const groupVisuals = [
  { icon: 'bi-buildings', tone: 'violet' },
  { icon: 'bi-house-fill', tone: 'green' },
  { icon: 'bi-people-fill', tone: 'orange' },
  { icon: 'bi-briefcase-fill', tone: 'blue' },
  { icon: 'bi-mortarboard-fill', tone: 'purple' },
  { icon: 'bi-cart-fill', tone: 'green' },
]

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(Number(value) || 0))
}

function dateLabel(value?: string) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function avatarFor(name: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'SplitEasy')}`
}

function normalizeSettlement(row: SettlementApiRow, source: 'group' | 'global', groupName?: string): SettlementRow {
  return {
    ...row,
    source,
    groupName,
    amount: Number(row.amount || 0),
    status: row.status || 'pending',
  }
}

export default function GlobalSettlePage() {
  const { user } = useAuth()
  const { showToast } = useToastContext()

  const [activeTab, setActiveTab] = useState<TabKey>('group')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupBalances, setGroupBalances] = useState<Record<number, BalanceItem[]>>({})
  const [globalBalances, setGlobalBalances] = useState<BalanceItem[]>([])
  const [groupSuggestions, setGroupSuggestions] = useState<SettlementRow[]>([])
  const [globalSuggestions, setGlobalSuggestions] = useState<SettlementRow[]>([])
  const [groupHistory, setGroupHistory] = useState<SettlementRow[]>([])
  const [globalHistory, setGlobalHistory] = useState<SettlementRow[]>([])
  const [pendingGroup, setPendingGroup] = useState<SettlementRow[]>([])
  const [pendingGlobal, setPendingGlobal] = useState<SettlementRow[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])

  const currentUserId = user?.id

  async function loadSettlements() {
    setLoading(true)
    try {
      const [groupsRes, globalBalanceRes, globalSuggestionRes, globalHistoryRes, activityRes] =
        await Promise.all([
          client.get<Group[]>('/groups'),
          client.get<BalanceItem[]>('/settle/global/balances'),
          client.get<SettlementApiRow[]>('/settle/global/settlements'),
          client.get<SettlementApiRow[]>('/settle/global/history'),
          client.get<ActivityLog[]>('/activity').catch(() => ({ data: [] as ActivityLog[] })),
        ])

      const nextGroups = groupsRes.data || []
      const visibleGroups = nextGroups.slice(0, 8)
      const [balanceResults, suggestionResults, historyResults, groupPendingRes, globalPendingRes] =
        await Promise.all([
          Promise.allSettled(
            visibleGroups.map((group) =>
              client.get<BalanceItem[]>(`/settle/${group.id}/balances`).then((res) => [group.id, res.data] as const),
            ),
          ),
          Promise.allSettled(
            visibleGroups.map((group) =>
              client
                .get<SettlementApiRow[]>(`/settle/${group.id}/settlements`)
                .then((res) => res.data.map((row) => normalizeSettlement(row, 'group', group.title))),
            ),
          ),
          Promise.allSettled(
            visibleGroups.map((group) =>
              client
                .get<SettlementApiRow[]>(`/settle/${group.id}/history`)
                .then((res) => res.data.map((row) => normalizeSettlement(row, 'group', group.title))),
            ),
          ),
          client.get<SettlementApiRow[]>('/settle/pending').catch(() => ({ data: [] as SettlementApiRow[] })),
          client.get<SettlementApiRow[]>('/settle/global/pending').catch(() => ({ data: [] as SettlementApiRow[] })),
        ])

      const nextBalances: Record<number, BalanceItem[]> = {}
      balanceResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [groupId, balances] = result.value
          nextBalances[groupId] = balances || []
        }
      })

      setGroups(nextGroups)
      setGlobalBalances(globalBalanceRes.data || [])
      setGroupBalances(nextBalances)
      setGlobalSuggestions((globalSuggestionRes.data || []).map((row) => normalizeSettlement(row, 'global')))
      setGlobalHistory((globalHistoryRes.data || []).map((row) => normalizeSettlement(row, 'global')))
      setGroupSuggestions(
        suggestionResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
      )
      setGroupHistory(historyResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])))
      setPendingGroup(
        (groupPendingRes.data || []).map((row) =>
          normalizeSettlement(row, 'group', nextGroups.find((group) => group.id === row.group_id)?.title),
        ),
      )
      setPendingGlobal((globalPendingRes.data || []).map((row) => normalizeSettlement(row, 'global')))
      setActivity(activityRes.data || [])
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Unable to load settlements right now.'
      showToast(String(message), 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettlements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groupCards = useMemo(
    () =>
      groups.slice(0, 6).map((group, index) => {
        const currentBalance = groupBalances[group.id]?.find((balance) => balance.user_id === currentUserId)
        const net = Number(currentBalance?.net || 0)
        return {
          ...group,
          net,
          memberCount: group.members_usernames?.length || 0,
          visual: groupVisuals[index % groupVisuals.length],
        }
      }),
    [currentUserId, groupBalances, groups],
  )

  const activeSuggestions = activeTab === 'global' ? globalSuggestions : groupSuggestions
  const activeHistory = activeTab === 'global' ? globalHistory : groupHistory
  const activePending = activeTab === 'global' ? pendingGlobal : pendingGroup
  const pendingRows = (activePending.length ? activePending : activeSuggestions).slice(0, 5)

  const summary = useMemo(() => {
    const groupNet = Object.values(groupBalances)
      .flat()
      .filter((balance) => balance.user_id === currentUserId)
      .reduce((total, balance) => total + Number(balance.net || 0), 0)
    const globalNet = globalBalances.reduce((total, balance) => total + Number(balance.net || 0), 0)
    const sourceNet = activeTab === 'global' ? globalNet : groupNet
    const settled = [...groupHistory, ...globalHistory]
      .filter((row) => row.status === 'accepted')
      .reduce((total, row) => total + row.amount, 0)

    return {
      owed: Math.max(sourceNet, 0),
      owe: Math.abs(Math.min(sourceNet, 0)),
      settled,
      net: sourceNet,
    }
  }, [activeTab, currentUserId, globalBalances, globalHistory, groupBalances, groupHistory])

  const recentActivity = useMemo(() => {
    if (activity.length) {
      return activity.slice(0, 4).map((item) => ({
        id: `activity-${item.id}`,
        message: `${item.user?.username || 'Someone'} ${item.action.replace(/_/g, ' ')}`,
        detail: item.target_type || 'SplitEasy',
        amount: 0,
        created_at: item.created_at,
        positive: item.action.includes('settle') || item.action.includes('paid'),
      }))
    }

    return [...globalHistory, ...groupHistory].slice(0, 4).map((row) => ({
      id: `settlement-${row.source}-${row.id ?? row.created_at ?? row.amount}`,
      message:
        row.status === 'accepted'
          ? `${row.from_username} settled with ${row.to_username}`
          : `${row.from_username} pays ${row.to_username}`,
      detail: row.groupName || (row.source === 'global' ? 'Global balance' : 'Group balance'),
      amount: row.amount,
      created_at: row.created_at,
      positive: row.to_user_id === currentUserId,
    }))
  }, [activity, currentUserId, globalHistory, groupHistory])

  async function handleSettlementAction(row: SettlementRow) {
    if (!currentUserId) return
    const rowKey = settlementKey(row)
    setSavingKey(rowKey)

    try {
      if (row.id && row.to_user_id === currentUserId) {
        const url = row.source === 'global' ? `/settle/global/${row.id}/accept` : `/settle/${row.id}/accept`
        await client.post(url)
        showToast('Settlement accepted', 'success')
      } else if (row.from_user_id === currentUserId) {
        if (row.source === 'group' && !row.group_id) {
          showToast('This group settlement is missing a group id from the API.', 'warning')
          return
        }
        await client.post(row.source === 'global' ? '/settle/global/record' : `/settle/${row.group_id}/record`, {
          to_user_id: row.to_user_id,
          amount: row.amount,
          message: 'Recorded from React settlements page',
        })
        showToast('Settlement recorded', 'success')
      } else {
        showToast('This payment is owed to you.', 'info')
        return
      }

      await loadSettlements()
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Could not update this settlement.'
      showToast(String(message), 'danger')
    } finally {
      setSavingKey(null)
    }
  }

  function renderAction(row: SettlementRow) {
    const rowKey = settlementKey(row)
    if (row.status === 'accepted') return <button className="settle-status-button settled">Settled</button>
    if (row.to_user_id === currentUserId && row.id) {
      return (
        <button className="btn btn-primary settle-row-button" disabled={savingKey === rowKey} onClick={() => handleSettlementAction(row)}>
          {savingKey === rowKey ? 'Saving...' : 'Accept'}
        </button>
      )
    }
    if (row.from_user_id === currentUserId) {
      return (
        <button className="btn btn-primary settle-row-button" disabled={savingKey === rowKey} onClick={() => handleSettlementAction(row)}>
          {savingKey === rowKey ? 'Saving...' : 'Settle Up'}
        </button>
      )
    }
    return <button className="settle-status-button muted">Request</button>
  }

  return (
    <div className="settlements-page">
      <div className="settlements-layout">
        <main className="settlements-main">
          <div className="page-heading settlement-heading">
            <div>
              <h1>Settlements</h1>
              <p>Settle up with your friends and groups easily.</p>
            </div>
            <button className="btn btn-soft settlement-pref-button">
              <i className="bi bi-gear me-2"></i>
              Settlement Preferences
            </button>
          </div>

          <div className="settlement-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`settlement-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'history' ? (
            <section className="card pending-settlements-card">
              <div className="section-title-row">
                <div>
                  <h2>Settlement History</h2>
                  <p>Completed and rejected settlement records.</p>
                </div>
              </div>
              <div className="settlement-list">
                {activeHistory.length ? (
                  activeHistory.slice(0, 8).map((row) => (
                    <SettlementListRow
                      key={`history-${settlementKey(row)}`}
                      row={row}
                      currentUserId={currentUserId}
                      action={<button className={`settle-status-button ${row.status}`}>{row.status}</button>}
                    />
                  ))
                ) : (
                  <EmptyState message="No settlement history yet." />
                )}
              </div>
            </section>
          ) : (
            <>
              <section className="card settlement-overview-card">
                <div className="section-title-row">
                  <div>
                    <h2>Group Overview</h2>
                    <p>Balances from your most active groups.</p>
                  </div>
                  <button className="link-button" type="button">View all groups</button>
                </div>

                <div className="settlement-group-strip">
                  {groupCards.length ? (
                    groupCards.map((group) => (
                      <article className="settlement-group-card" key={group.id}>
                        <div className={`settle-group-icon ${group.visual.tone}`}>
                          <i className={`bi ${group.visual.icon}`}></i>
                        </div>
                        <h3>{group.title}</h3>
                        <p className={group.net < 0 ? 'danger-text' : 'success-text'}>
                          {group.net < 0 ? 'You owe' : 'You are owed'}
                        </p>
                        <strong>{money(group.net)}</strong>
                        <span>
                          <i className="bi bi-people me-1"></i>
                          {group.memberCount} members
                        </span>
                      </article>
                    ))
                  ) : (
                    <EmptyState message="No groups yet. Create a group to start settling." />
                  )}
                </div>
              </section>

              <section className="card pending-settlements-card">
                <div className="section-title-row">
                  <div>
                    <h2>Pending Settlements</h2>
                    <p>People you need to settle up with.</p>
                  </div>
                  <div className="settlement-actions">
                    <button className="link-button" type="button">
                      <i className="bi bi-stars me-1"></i>
                      Optimize Settlements
                    </button>
                    <button className="btn btn-light" type="button">
                      <i className="bi bi-filter me-1"></i>
                      Filter
                    </button>
                  </div>
                </div>

                <div className="settlement-list">
                  {loading ? (
                    <EmptyState message="Loading settlements..." />
                  ) : pendingRows.length ? (
                    pendingRows.map((row) => (
                      <SettlementListRow
                        key={settlementKey(row)}
                        row={row}
                        currentUserId={currentUserId}
                        action={renderAction(row)}
                      />
                    ))
                  ) : (
                    <EmptyState message="You're all settled up. Tiny confetti, very responsible." />
                  )}
                </div>
                <button className="link-button settlement-footer-link" type="button">View all settlements</button>
              </section>
            </>
          )}
        </main>

        <aside className="settlements-side">
          <section className="card settlement-summary-card">
            <h2>Settlement Summary</h2>
            <div className="settlement-summary-content">
              <div className="settlement-donut" style={donutStyle(summary)}>
                <div>
                  <span>Net Balance</span>
                  <strong>{money(summary.net)}</strong>
                  <small className={summary.net < 0 ? 'danger-text' : 'success-text'}>
                    {summary.net < 0 ? 'You owe' : 'You are owed'}
                  </small>
                </div>
              </div>
              <div className="settlement-legend">
                <LegendItem label="You are owed" value={summary.owed} color="green" />
                <LegendItem label="You owe" value={summary.owe} color="red" />
                <LegendItem label="Settled" value={summary.settled} color="blue" />
              </div>
            </div>
          </section>

          <section className="card optimal-payments-card">
            <h2>
              Suggested Optimal Payments <span>Info</span>
            </h2>
            <p>We calculated the simplest way to settle all debts in one go.</p>
            <div className="optimal-payment-list">
              {activeSuggestions.length ? (
                activeSuggestions.slice(0, 4).map((row) => (
                  <div className="optimal-payment" key={`suggested-${settlementKey(row)}`}>
                    <div className={`settlement-mini-icon ${row.from_user_id === currentUserId ? 'orange' : 'green'}`}>
                      <i className={`bi ${row.source === 'global' ? 'bi-cash-stack' : 'bi-people-fill'}`}></i>
                    </div>
                    <div>
                      <strong>{row.from_user_id === currentUserId ? row.to_username : row.from_username}</strong>
                      <span>{row.from_user_id === currentUserId ? 'You pay' : 'Pays you'}</span>
                    </div>
                    <b>{money(row.amount)}</b>
                  </div>
                ))
              ) : (
                <EmptyState message="No payment suggestions right now." compact />
              )}
            </div>
            <button className="btn btn-primary w-100" type="button">Apply Suggestions</button>
          </section>

          <section className="card recent-settlement-card">
            <div className="section-title-row">
              <h2>Recent Activity</h2>
              <button className="link-button" type="button">View all</button>
            </div>
            <div className="recent-settle-list">
              {recentActivity.length ? (
                recentActivity.map((item) => (
                  <div className="recent-settle-item" key={item.id}>
                    <span className={`recent-settle-icon ${item.positive ? 'green' : 'red'}`}>
                      <i className={`bi ${item.positive ? 'bi-check-lg' : 'bi-arrow-up'}`}></i>
                    </span>
                    <div>
                      <strong>{item.message}</strong>
                      <span>{item.detail} · {dateLabel(item.created_at)}</span>
                    </div>
                    {item.amount > 0 ? (
                      <b className={item.positive ? 'success-text' : 'danger-text'}>
                        {item.positive ? '+' : '-'}
                        {money(item.amount)}
                      </b>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState message="No activity yet." compact />
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function SettlementListRow({
  row,
  currentUserId,
  action,
}: {
  row: SettlementRow
  currentUserId?: number
  action: ReactNode
}) {
  const isOwed = row.to_user_id === currentUserId
  const isOwing = row.from_user_id === currentUserId
  const counterparty = isOwing ? row.to_username : row.from_username
  const direction = isOwed ? 'You are owed' : isOwing ? 'You owe' : `${row.from_username} pays`

  return (
    <article className="settlement-row">
      <div className="settlement-person">
        <img src={avatarFor(counterparty)} alt="" />
        <div>
          <strong>{counterparty || 'SplitEasy friend'}</strong>
          <span>{row.groupName || (row.source === 'global' ? 'Global balance' : 'Group settlement')}</span>
        </div>
      </div>
      <div className="settlement-row-amount">
        <span className={isOwing ? 'danger-text' : 'success-text'}>{direction}</span>
        <strong className={isOwing ? 'danger-text' : 'success-text'}>{money(row.amount)}</strong>
      </div>
      <div className="settlement-row-date">{dateLabel(row.created_at)}</div>
      <div className="settlement-row-actions">
        {action}
        <button className="settle-icon-button" type="button">
          <i className="bi bi-chat-dots"></i>
        </button>
        <button className="settle-menu-button" type="button">
          <i className="bi bi-three-dots-vertical"></i>
        </button>
      </div>
    </article>
  )
}

function LegendItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="settlement-legend-item">
      <span className={`legend-dot ${color}`} />
      <p>{label}</p>
      <strong>{money(value)}</strong>
    </div>
  )
}

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return <div className={`settlement-empty ${compact ? 'compact' : ''}`}>{message}</div>
}

function settlementKey(row: SettlementRow) {
  return `${row.source}-${row.id ?? `${row.group_id ?? 'global'}-${row.from_user_id}-${row.to_user_id}-${row.amount}`}`
}

function donutStyle(summary: { owed: number; owe: number; settled: number }): CSSProperties {
  const total = summary.owed + summary.owe + summary.settled || 1
  const owed = (summary.owed / total) * 100
  const owe = (summary.owe / total) * 100
  return {
    background: `conic-gradient(#35c893 0 ${owed}%, #ff5570 ${owed}% ${owed + owe}%, #4a5cff ${owed + owe}% 100%)`,
  }
}
