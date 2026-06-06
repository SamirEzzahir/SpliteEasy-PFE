import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useToastContext } from '../context/ToastContext'
import AddExpenseModal from '../components/AddExpenseModal'
import type { Expense, Group } from '../types'

const CATEGORIES = ['All', 'Food', 'Transport', 'Shopping', 'Entertainment', 'Travel', 'Accommodation', 'Utilities', 'Billing', 'Other']

function money(v: number, currency = '') {
  return `${Number(v).toFixed(2)}${currency ? ' ' + currency : ''}`
}

export default function ExpensesPage() {
  const { showToast } = useToastContext()
  const [groups, setGroups] = useState<Group[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const [filterGroup, setFilterGroup] = useState<number | ''>('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [search, setSearch] = useState('')

  const loadGroups = async () => {
    const { data } = await client.get<Group[]>('/groups/')
    setGroups(data)
    return data
  }

  const loadExpenses = async (gs: Group[]) => {
    const all: Expense[] = []
    await Promise.allSettled(
      gs.map(async (g) => {
        const { data } = await client.get<Expense[]>(`/expenses/${g.id}?page=1&page_size=100`)
        all.push(...data)
      })
    )
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setExpenses(all)
  }

  const load = async () => {
    try {
      setLoading(true)
      const gs = await loadGroups()
      await loadExpenses(gs)
    } catch {
      showToast('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    try {
      await client.delete(`/expenses/${id}`)
      showToast('Expense deleted')
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch {
      showToast('Failed to delete expense')
    }
  }

  const visible = useMemo(() => {
    return expenses.filter((e) => {
      if (filterGroup !== '' && e.group_id !== filterGroup) return false
      if (filterCategory !== 'All' && e.category !== filterCategory) return false
      if (filterFrom && new Date(e.created_at) < new Date(filterFrom)) return false
      if (filterTo && new Date(e.created_at) > new Date(filterTo + 'T23:59:59')) return false
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [expenses, filterGroup, filterCategory, filterFrom, filterTo, search])

  const total = visible.reduce((s, e) => s + e.amount, 0)

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
        <div className="spinner-border" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-muted small">Expenses</div>
          <h1 className="h4 mb-0">
            {visible.length} expense{visible.length !== 1 ? 's' : ''} — total {money(total)}
          </h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-lg" /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-3">
        <div className="d-flex flex-wrap gap-2">
          <input
            className="form-control"
            style={{ minWidth: 180, flex: 1 }}
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ minWidth: 140, flex: '0 0 auto' }}
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select
            className="form-select"
            style={{ minWidth: 130, flex: '0 0 auto' }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="date" className="form-control" style={{ flex: '0 0 auto' }} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <input type="date" className="form-control" style={{ flex: '0 0 auto' }} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card p-5 text-center">
          <i className="bi bi-receipt" style={{ fontSize: 48, opacity: 0.3 }} />
          <h3 className="mt-3">No expenses found</h3>
          <p className="text-muted">Try adjusting your filters or add a new expense.</p>
        </div>
      ) : (
        <div className="card">
          {visible.map((e, idx) => {
            const groupName = groups.find((g) => g.id === e.group_id)?.title ?? 'Unknown group'
            return (
              <div
                key={e.id}
                className="d-flex align-items-center gap-3 px-3 py-3"
                style={{ borderBottom: idx < visible.length - 1 ? '1px solid rgba(15,23,42,0.07)' : undefined }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg,#f59e0b,#fb7185)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                  <i className="bi bi-receipt" />
                </div>
                <div className="flex-grow-1 overflow-hidden">
                  <div className="fw-semibold text-truncate">{e.description}</div>
                  <div className="text-muted small">{groupName} · {e.category} · paid by {e.payer_username}</div>
                </div>
                <div className="text-muted small" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(e.created_at).toLocaleDateString()}
                </div>
                <div className="fw-semibold" style={{ whiteSpace: 'nowrap' }}>
                  {money(e.amount, e.currency)}
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  style={{ flexShrink: 0 }}
                  onClick={() => handleDelete(e.id)}
                  title="Delete"
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <AddExpenseModal
        open={showAdd}
        groups={groups}
        onClose={() => setShowAdd(false)}
        onSuccess={() => { setShowAdd(false); load() }}
      />
    </>
  )
}
