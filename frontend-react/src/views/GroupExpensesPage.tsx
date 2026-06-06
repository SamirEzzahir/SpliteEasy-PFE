import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import AddExpenseModal from '../components/AddExpenseModal'
import { useAuth } from '../context/AuthContext'
import { useToastContext } from '../context/ToastContext'
import type { Expense, Group, GroupMember } from '../types'

type ExpensesResponse = {
  expenses: Expense[]
  total: number
  offset: number
  limit: number
  has_more: boolean
}

type BalanceItem = {
  user_id: number
  username: string
  net: number
}

type PageTab = 'expenses' | 'analytics'

const categoryMeta: Record<string, { icon: string; tone: string; label: string }> = {
  Food: { icon: 'bi-cup-hot-fill', tone: 'food', label: 'Food' },
  Transport: { icon: 'bi-car-front-fill', tone: 'transport', label: 'Transport' },
  Shopping: { icon: 'bi-cart-fill', tone: 'shopping', label: 'Shopping' },
  Entertainment: { icon: 'bi-controller', tone: 'entertainment', label: 'Entertainment' },
  Travel: { icon: 'bi-airplane-fill', tone: 'travel', label: 'Travel' },
  Accommodation: { icon: 'bi-building-fill', tone: 'accommodation', label: 'Accommodation' },
  Utilities: { icon: 'bi-lightning-fill', tone: 'utilities', label: 'Utilities' },
  Billing: { icon: 'bi-receipt', tone: 'billing', label: 'Billing' },
  Other: { icon: 'bi-grid-fill', tone: 'other', label: 'Other' },
}

function money(amount: number, currency = 'USD') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `0.00 ${currency}`
  return `${n.toFixed(2)} ${currency}`
}

function dateLabel(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function avatarFor(name: string, photo?: string) {
  if (photo) return photo
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'SplitEasy')}`
}

function groupIcon(type?: string) {
  const normalized = (type || '').toLowerCase()
  if (normalized.includes('trip')) return 'bi-briefcase-fill'
  if (normalized.includes('home')) return 'bi-house-fill'
  if (normalized.includes('work')) return 'bi-building-fill'
  if (normalized.includes('couple')) return 'bi-heart-fill'
  return 'bi-people-fill'
}

export default function GroupExpensesPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToastContext()

  const gid = Number(groupId)
  const [tab, setTab] = useState<PageTab>('expenses')
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [balances, setBalances] = useState<BalanceItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const limit = 20

  async function loadHeader() {
    const [groupRes, membersRes, balanceRes] = await Promise.all([
      client.get<Group>(`/groups/${gid}`),
      client.get<GroupMember[]>(`/groups/${gid}/members`),
      client.get<BalanceItem[]>(`/settle/${gid}/balances`).catch(() => ({ data: [] as BalanceItem[] })),
    ])
    setGroup(groupRes.data)
    setMembers(membersRes.data || [])
    setBalances(balanceRes.data || [])
  }

  async function loadExpenses(nextOffset: number, replace = false) {
    const res = await client.get<ExpensesResponse>(`/expenses/${gid}`, {
      params: { limit, offset: nextOffset },
    })
    const data = res.data
    setHasMore(!!data.has_more)
    setOffset(data.offset + data.expenses.length)
    setExpenses((current) => (replace ? data.expenses : [...current, ...data.expenses]))
  }

  async function reloadAll() {
    if (!gid) return
    setLoading(true)
    try {
      await loadHeader()
      setExpenses([])
      setHasMore(true)
      setOffset(0)
      await loadExpenses(0, true)
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to load group expenses'
      showToast(String(message), 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!gid || Number.isNaN(gid)) {
      showToast('Invalid group id', 'danger')
      navigate('/app/groups', { replace: true })
      return
    }
    reloadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid])

  const meId = user?.id ?? null
  const currency = group?.currency || 'USD'
  const expensesWithShare = useMemo(
    () =>
      expenses.map((expense) => ({
        ...expense,
        _myShare: meId ? (expense.splits?.find((split) => split.user_id === meId)?.share_amount ?? null) : null,
      })),
    [expenses, meId],
  )

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  )

  const yourShare = useMemo(
    () => expensesWithShare.reduce((sum, expense) => sum + Number(expense._myShare || 0), 0),
    [expensesWithShare],
  )

  const myBalance = balances.find((balance) => balance.user_id === meId)?.net ?? 0
  const youOwe = Math.max(0, -Number(myBalance || 0))

  const totalsByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of expenses) {
      const category = expense.category || 'Other'
      map.set(category, (map.get(category) || 0) + Number(expense.amount || 0))
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [expenses])

  async function downloadExpenses() {
    try {
      const response = await client.get<Blob>(`/expenses/${gid}/download`, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${group?.title || 'group'}-expenses.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to download expenses'
      showToast(String(message), 'danger')
    }
  }

  return (
    <div className="group-expenses-page">
      <div className="group-expenses-topline">
        <button className="group-back-link" onClick={() => navigate('/app/groups')} type="button">
          <i className="bi bi-arrow-left"></i>
          Back to Groups
        </button>
      </div>

      <section className="group-expenses-hero">
        <div className="group-hero-title">
          <div className="group-hero-icon">
            <i className={`bi ${groupIcon(group?.type)}`}></i>
          </div>
          <div>
            <h1>{loading ? 'Loading...' : group?.title || 'Group'}</h1>
            <p>
              {members.length} members
              {group?.created_at ? ` • Created ${dateLabel(group.created_at)}` : ''}
            </p>
          </div>
          {group?.type ? <span className="group-type-pill">{group.type}</span> : null}
        </div>

        <div className="group-hero-actions">
          <div className="group-summary-strip">
            <SummaryItem label="Total Expenses" value={money(totalExpenses, currency)} />
            <SummaryItem label="Your Share" value={money(yourShare, currency)} tone="primary" />
            <SummaryItem label="You Owe" value={money(youOwe, currency)} tone="success" />
          </div>
          <button className="btn btn-primary group-add-expense-btn" type="button" onClick={() => setModalOpen(true)}>
            <i className="bi bi-plus-lg"></i>
            Add Expense
          </button>
          <button className="group-download-btn" type="button" onClick={downloadExpenses} aria-label="Download expenses">
            <i className="bi bi-download"></i>
          </button>
        </div>
      </section>

      <div className="group-expense-tabs">
        <button className={tab === 'expenses' ? 'active' : ''} type="button" onClick={() => setTab('expenses')}>
          Expenses
        </button>
        <button className={tab === 'analytics' ? 'active' : ''} type="button" onClick={() => setTab('analytics')}>
          Analytics
        </button>
      </div>

      {tab === 'expenses' ? (
        <section className="group-expense-table-wrap">
          <div className="table-responsive">
            <table className="group-expense-table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Group</th>
                  <th>Paid by</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="group-expense-empty">
                        <span className="spinner-border spinner-border-sm"></span>
                        Loading expenses...
                      </div>
                    </td>
                  </tr>
                ) : expensesWithShare.length ? (
                  expensesWithShare.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      group={group}
                      members={members}
                      currency={currency}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="group-expense-empty">
                        <i className="bi bi-receipt"></i>
                        No expenses yet
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="group-expense-footer">
            <span>
              Showing 1 to {expensesWithShare.length} of {expensesWithShare.length} expenses
            </span>
            {hasMore ? (
              <button
                className="btn btn-outline-primary"
                type="button"
                onClick={async () => {
                  try {
                    await loadExpenses(offset)
                  } catch (error: any) {
                    const message = error?.response?.data?.detail || error?.message || 'Failed to load more expenses'
                    showToast(String(message), 'danger')
                  }
                }}
              >
                Load more
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="group-analytics-panel">
          <div>
            <h2>Spending by category</h2>
            <p>{money(totalExpenses, currency)} tracked in this group</p>
          </div>
          <div className="group-category-bars">
            {totalsByCategory.length ? (
              totalsByCategory.map(([category, value]) => {
                const meta = categoryMeta[category] || categoryMeta.Other
                const pct = totalExpenses ? Math.max(6, (value / totalExpenses) * 100) : 0
                return (
                  <div className="group-category-bar" key={category}>
                    <span className={`expense-category-icon ${meta.tone}`}>
                      <i className={`bi ${meta.icon}`}></i>
                    </span>
                    <strong>{meta.label}</strong>
                    <div><span style={{ width: `${pct}%` }} /></div>
                    <b>{money(value, currency)}</b>
                  </div>
                )
              })
            ) : (
              <div className="group-expense-empty">No analytics yet</div>
            )}
          </div>
        </section>
      )}

      <AddExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={reloadAll}
        fixedGroup={group ?? undefined}
        fixedMembers={members}
      />
    </div>
  )
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'success' }) {
  return (
    <div className="group-summary-item">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
    </div>
  )
}

function ExpenseRow({
  expense,
  group,
  members,
  currency,
}: {
  expense: Expense & { _myShare?: number | null }
  group: Group | null
  members: GroupMember[]
  currency: string
}) {
  const meta = categoryMeta[expense.category || 'Other'] || categoryMeta.Other
  const payerName = expense.payer_name || expense.payer_username || 'You'
  const participants = expense.splits
    ?.map((split) => members.find((member) => member.user_id === split.user_id))
    .filter(Boolean) as GroupMember[]
  const visibleParticipants = participants.slice(0, 4)
  const extraCount = Math.max(0, participants.length - visibleParticipants.length)

  return (
    <tr>
      <td>
        <div className="expense-name-cell">
          <span className={`expense-category-icon ${meta.tone}`}>
            <i className={`bi ${meta.icon}`}></i>
          </span>
          <div>
            <strong>{expense.description}</strong>
            <span>{expense.note || meta.label}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="expense-group-cell">
          <strong>{group?.title || expense.group_name || 'Group'}</strong>
          <div className="member-avatar-stack">
            {visibleParticipants.map((member) => (
              <img src={avatarFor(member.username, member.profile_photo)} alt="" key={member.user_id} />
            ))}
            {extraCount ? <span>+{extraCount}</span> : null}
          </div>
        </div>
      </td>
      <td>
        <div className="expense-payer-cell">
          <img src={avatarFor(payerName)} alt="" />
          <strong>{payerName}</strong>
        </div>
      </td>
      <td>
        <div className="expense-amount-cell">
          <strong>{money(Number(expense.amount || 0), expense.currency || currency)}</strong>
          <span className={`expense-pill ${meta.tone}`}>{meta.label}</span>
        </div>
      </td>
      <td>
        <div className="expense-date-cell">
          <strong>{dateLabel(expense.created_at)}</strong>
          <span>{timeLabel(expense.created_at)}</span>
        </div>
      </td>
      <td className="text-end">
        <button className="expense-row-action" type="button" aria-label="Expense actions">
          <i className="bi bi-three-dots-vertical"></i>
        </button>
      </td>
    </tr>
  )
}
