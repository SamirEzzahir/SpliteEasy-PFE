import { useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import BodyPortal from './BodyPortal'
import { useAuth } from '../context/AuthContext'
import { useToastContext } from '../context/ToastContext'
import type { Group, GroupMember, Wallet } from '../types'

// ── constants ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'Food',          label: 'Food & Drinks',  icon: 'bi-cup-hot-fill',   color: '#f59e0b' },
  { value: 'Transport',     label: 'Transportation', icon: 'bi-car-front-fill', color: '#06b6d4' },
  { value: 'Shopping',      label: 'Shopping',       icon: 'bi-bag-fill',       color: '#ec4899' },
  { value: 'Entertainment', label: 'Entertainment',  icon: 'bi-controller',     color: '#8b5cf6' },
  { value: 'Travel',        label: 'Travel',         icon: 'bi-airplane-fill',  color: '#3b82f6' },
  { value: 'Utilities',     label: 'Utilities',      icon: 'bi-lightning-fill', color: '#10b981' },
  { value: 'Billing',       label: 'Billing',        icon: 'bi-receipt',        color: '#6b7280' },
  { value: 'Other',         label: 'Other',          icon: 'bi-grid-fill',      color: '#9ca3af' },
] as const

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'TND', 'SAR', 'AED', 'CAD']

type SplitMode = 'equal' | 'percentage' | 'share'

function avatarUrl(name: string, photo?: string) {
  if (photo) return photo
  return 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(name || 'x')
}

// ── props ───────────────────────────────────────────────────────────────────
export interface AddExpenseModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Pass the full groups list to show a group selector (ExpensesPage mode) */
  groups?: Group[]
  /** Pass a fixed group to lock it (GroupExpensesPage mode) */
  fixedGroup?: Group
  /** Pre-loaded members when fixedGroup is supplied */
  fixedMembers?: GroupMember[]
}

// ── component ───────────────────────────────────────────────────────────────
export default function AddExpenseModal({
  open, onClose, onSuccess,
  groups = [],
  fixedGroup,
  fixedMembers,
}: AddExpenseModalProps) {
  const { user }      = useAuth()
  const { showToast } = useToastContext()

  // form fields
  const [expTitle,    setExpTitle]    = useState('')
  const [expAmount,   setExpAmount]   = useState('')
  const [expCurrency, setExpCurrency] = useState(fixedGroup?.currency || 'USD')
  const [expGroupId,  setExpGroupId]  = useState<number | ''>(fixedGroup?.id ?? '')
  const [expPayerId,  setExpPayerId]  = useState<number | ''>('')
  const [expCategory, setExpCategory] = useState<typeof CATEGORIES[number]['value']>('Food')
  const [expDate,     setExpDate]     = useState(new Date().toISOString().slice(0, 10))
  const [expNote,     setExpNote]     = useState('')
  const [splitMode,   setSplitMode]   = useState<SplitMode>('equal')
  const [showDetails, setShowDetails] = useState(false)
  const [expWalletId, setExpWalletId] = useState<number | ''>('')

  // dynamic members (used when no fixedMembers)
  const [dynMembers,  setDynMembers]  = useState<GroupMember[]>([])
  const [loadingMem,  setLoadingMem]  = useState(false)

  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set())
  const [customShares, setCustomShares] = useState<Record<number, string>>({})
  const [wallets,     setWallets]       = useState<Wallet[]>([])
  const [saving,      setSaving]        = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  // resolved members: fixed (from parent) or dynamically loaded
  const members = fixedMembers ?? dynMembers

  // ── reset & open ──
  useEffect(() => {
    if (!open) return
    setExpTitle(''); setExpAmount(''); setExpNote('')
    setSplitMode('equal'); setCustomShares({}); setShowDetails(false); setExpWalletId('')
    setExpDate(new Date().toISOString().slice(0, 10))

    if (fixedGroup) {
      setExpGroupId(fixedGroup.id)
      setExpCurrency(fixedGroup.currency || 'USD')
    } else {
      setExpGroupId(''); setExpCurrency('USD')
      setDynMembers([])
    }

    // load wallets once
    client.get<Wallet[]>('/wallets').then(r => setWallets(r.data || [])).catch(() => {})

    setTimeout(() => titleRef.current?.focus(), 80)
  }, [open])

  // sync selection when members arrive
  useEffect(() => {
    if (!members.length) return
    setSelectedIds(new Set(members.map(m => m.user_id)))
    const me = members.find(m => m.user_id === user?.id)
    setExpPayerId(me ? me.user_id : (members[0]?.user_id ?? ''))
  }, [members, user?.id])

  // load members when group selector changes
  async function onGroupChange(gid: number | '') {
    setExpGroupId(gid)
    setDynMembers([])
    setSelectedIds(new Set())
    setExpPayerId('')
    if (!gid) return
    setLoadingMem(true)
    try {
      const g = groups.find(x => x.id === gid)
      if (g?.currency) setExpCurrency(g.currency)
      const res = await client.get<GroupMember[]>(`/groups/${gid}/members`)
      setDynMembers(res.data || [])
    } catch { /* ignore */ }
    finally { setLoadingMem(false) }
  }

  // ── split maths ──
  const totalAmt = useMemo(() => {
    const n = parseFloat(expAmount); return Number.isFinite(n) && n > 0 ? n : 0
  }, [expAmount])

  const selList = members.filter(m => selectedIds.has(m.user_id))

  const splitAmounts = useMemo(() => {
    const out: Record<number, number> = {}
    if (!selList.length || totalAmt === 0) return out
    if (splitMode === 'equal') {
      const each = Math.round((totalAmt / selList.length) * 100) / 100
      selList.forEach((m, i) => {
        out[m.user_id] = i === 0
          ? Math.round((totalAmt - each * (selList.length - 1)) * 100) / 100
          : each
      })
    } else {
      const totalCustom = selList.reduce((s, m) => s + (parseFloat(customShares[m.user_id] || '0') || 0), 0)
      selList.forEach(m => {
        const v = parseFloat(customShares[m.user_id] || '0') || 0
        out[m.user_id] = totalCustom > 0 ? Math.round((totalAmt * (v / totalCustom)) * 100) / 100 : 0
      })
    }
    return out
  }, [selList, totalAmt, splitMode, customShares])

  // ── submit ──
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!expTitle.trim())      { showToast('Title is required', 'warning'); return }
    if (!totalAmt)             { showToast('Enter a valid amount', 'warning'); return }
    if (!expGroupId)           { showToast('Select a group', 'warning'); return }
    if (!expPayerId)           { showToast('Select who paid', 'warning'); return }
    if (!selList.length)       { showToast('Select at least one member', 'warning'); return }

    setSaving(true)
    try {
      await client.post('/expenses', {
        group_id:    expGroupId,
        payer_id:    expPayerId,
        description: expTitle.trim(),
        amount:      totalAmt,
        currency:    expCurrency,
        category:    expCategory,
        split_type:  splitMode,
        note:        expNote.trim() || undefined,
        created_at:  new Date(expDate).toISOString(),
        wallet_id:   expWalletId || undefined,
        splits:      selList.map(m => ({ user_id: m.user_id, share_amount: splitAmounts[m.user_id] ?? 0 })),
      })
      showToast('Expense added!', 'success')
      onClose()
      onSuccess()
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed'), 'danger')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const catObj = CATEGORIES.find(c => c.value === expCategory) || CATEGORIES[0]
  const isFixed = !!fixedGroup

  return (
    <BodyPortal>
      <div className="modal fade show d-block" tabIndex={-1}
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-dialog modal-lg modal-dialog-centered" style={{ maxWidth: 580 }}>
          {/*
            Key layout: modal-content is a flex column with fixed max-height.
            Header  → flex-shrink: 0  (never scrolls away)
            Body    → flex: 1, overflow-y: auto  (scrolls when content is tall)
            Footer  → flex-shrink: 0  (always visible)
          */}
          <form onSubmit={submit}
            className="modal-content border-0 shadow-lg d-flex flex-column"
            style={{ borderRadius: 20, maxHeight: '92vh', overflow: 'hidden' }}>

            {/* ── Header (white, matches screenshot) ── */}
            <div className="d-flex align-items-center justify-content-between px-4 pt-4 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid #f3f4f6' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                  style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#ede9fe,#c7d2fe)' }}>
                  <i className="bi bi-currency-dollar fs-3" style={{ color: '#4a5cff' }}></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold" style={{ color: '#111827' }}>Add New Expense</h5>
                  <div className="small text-muted">Enter expense details and split it with group members</div>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="px-4 py-4" style={{ overflowY: 'auto', flex: 1 }}>

                {/* Row 1: Title + Amount */}
                <div className="row g-3 mb-3">
                  <div className="col-7">
                    <label className="form-label fw-semibold small">Expense Title</label>
                    <div className="input-group" style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <span className="input-group-text bg-white border-0 text-muted"><i className="bi bi-receipt"></i></span>
                      <input ref={titleRef} className="form-control border-0 shadow-none"
                        placeholder="e.g. Dinner at Bella Italia"
                        value={expTitle} onChange={e => setExpTitle(e.target.value)} required />
                    </div>
                  </div>
                  <div className="col-5">
                    <label className="form-label fw-semibold small">Amount</label>
                    <div className="input-group" style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <span className="input-group-text bg-white border-0 text-muted"><i className="bi bi-currency-dollar"></i></span>
                      <input className="form-control border-0 shadow-none" type="number" step="0.01" min="0.01"
                        placeholder="0.00"
                        value={expAmount} onChange={e => setExpAmount(e.target.value)} required />
                      <select className="form-select border-0 shadow-none bg-white" style={{ maxWidth: 80, fontSize: 13 }}
                        value={expCurrency} onChange={e => setExpCurrency(e.target.value)}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 2: Group + Paid By */}
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Group</label>
                    <div className="input-group" style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <span className="input-group-text bg-white border-0 text-muted"><i className="bi bi-people-fill"></i></span>
                      {isFixed ? (
                        <input className="form-control border-0 shadow-none bg-light" readOnly
                          value={fixedGroup.title} />
                      ) : (
                        <select className="form-select border-0 shadow-none"
                          value={expGroupId} required
                          onChange={e => onGroupChange(e.target.value ? Number(e.target.value) : '')}>
                          <option value="">Select a group…</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Paid By</label>
                    <div className="input-group" style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <span className="input-group-text bg-white border-0 text-muted"><i className="bi bi-person-fill"></i></span>
                      <select className="form-select border-0 shadow-none"
                        value={expPayerId === '' ? '' : String(expPayerId)} required
                        disabled={!members.length}
                        onChange={e => setExpPayerId(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">Who paid?</option>
                        {members.map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.username}{m.user_id === user?.id ? ' (You)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 3: Category + Date */}
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Category</label>
                    <div className="input-group" style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <span className="input-group-text bg-white border-0" style={{ color: catObj.color }}>
                        <i className={'bi ' + catObj.icon}></i>
                      </span>
                      <select className="form-select border-0 shadow-none"
                        value={expCategory} onChange={e => setExpCategory(e.target.value as any)}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Date</label>
                    <div className="input-group" style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <span className="input-group-text bg-white border-0 text-muted"><i className="bi bi-calendar3"></i></span>
                      <input type="date" className="form-control border-0 shadow-none"
                        value={expDate} onChange={e => setExpDate(e.target.value)} required />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="form-label fw-semibold small">
                    Description <span className="text-muted fw-normal">(Optional)</span>
                  </label>
                  <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div className="d-flex align-items-start gap-2 px-3 pt-2">
                      <i className="bi bi-card-text text-muted mt-1" style={{ fontSize: 14 }}></i>
                      <textarea className="form-control border-0 shadow-none p-0" rows={2}
                        maxLength={200}
                        placeholder="Add a note about this expense..."
                        value={expNote} onChange={e => setExpNote(e.target.value)} />
                    </div>
                    <div className="text-end text-muted px-3 pb-2" style={{ fontSize: 11 }}>{expNote.length}/200</div>
                  </div>
                </div>

                {/* Split Expense With */}
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2 fw-semibold" style={{ fontSize: 14 }}>
                    <i className="bi bi-bar-chart-fill" style={{ color: '#4a5cff' }}></i>
                    Split Expense With
                  </div>
                  <select className="form-select form-select-sm fw-semibold"
                    style={{ width: 'auto', border: '1.5px solid #e5e7eb', borderRadius: 8, color: '#4a5cff', fontSize: 13 }}
                    value={splitMode} onChange={e => setSplitMode(e.target.value as SplitMode)}>
                    <option value="equal">Split Equally</option>
                    <option value="percentage">By Percentage</option>
                    <option value="share">By Share</option>
                  </select>
                </div>

                {/* Member list */}
                {loadingMem ? (
                  <div className="text-center text-muted py-3" style={{ fontSize: 13 }}>
                    <span className="spinner-border spinner-border-sm me-2"></span>Loading members…
                  </div>
                ) : !members.length ? (
                  <div className="text-center text-muted py-3 rounded-3"
                    style={{ border: '1.5px dashed #e5e7eb', fontSize: 13 }}>
                    {expGroupId ? 'No members found' : 'Select a group first'}
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2 mb-3">
                    {members.map(m => {
                      const isSelected = selectedIds.has(m.user_id)
                      const isPayer    = m.user_id === (expPayerId === '' ? user?.id : expPayerId)
                      const amt        = splitAmounts[m.user_id] ?? 0
                      const pct        = totalAmt > 0 ? Math.round((amt / totalAmt) * 100) : 0
                      return (
                        <div key={m.user_id}
                          className="d-flex align-items-center gap-3 p-2 rounded-3"
                          style={{
                            border: '1px solid ' + (isSelected ? '#e0e7ff' : '#f3f4f6'),
                            background: isSelected ? '#fafbff' : '#fff',
                          }}>
                          <input type="checkbox" className="form-check-input flex-shrink-0 m-0"
                            style={{ width: 20, height: 20, accentColor: '#4a5cff', cursor: 'pointer', borderRadius: 6 }}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                if (next.has(m.user_id)) next.delete(m.user_id)
                                else next.add(m.user_id)
                                return next
                              })
                            }} />
                          <img src={avatarUrl(m.username, m.profile_photo)} alt={m.username}
                            className="rounded-circle flex-shrink-0"
                            style={{ width: 36, height: 36, objectFit: 'cover' }} />
                          <div className="flex-grow-1 d-flex align-items-center gap-2 min-w-0">
                            <span className="fw-semibold text-truncate" style={{ fontSize: 14 }}>
                              {m.username}{m.user_id === user?.id ? ' (You)' : ''}
                            </span>
                            {isPayer && (
                              <span className="badge flex-shrink-0"
                                style={{ background: '#ede9fe', color: '#7c4dff', fontSize: 11, borderRadius: 6 }}>
                                Paid
                              </span>
                            )}
                          </div>
                          {isSelected && splitMode !== 'equal' ? (
                            <input type="number" className="form-control form-control-sm text-center flex-shrink-0"
                              style={{ width: 72, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13 }}
                              placeholder={splitMode === 'percentage' ? '%' : 'share'}
                              value={customShares[m.user_id] || ''}
                              onChange={e => setCustomShares(p => ({ ...p, [m.user_id]: e.target.value }))} />
                          ) : (
                            <span className="fw-semibold flex-shrink-0"
                              style={{ fontSize: 14, minWidth: 64, textAlign: 'right', color: isSelected ? '#1f2937' : '#9ca3af' }}>
                              {isSelected ? '$' + amt.toFixed(2) : '—'}
                            </span>
                          )}
                          <span className="text-muted flex-shrink-0" style={{ fontSize: 13, minWidth: 36, textAlign: 'right' }}>
                            {isSelected ? pct + '%' : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add More Details */}
                <div className="rounded-3 overflow-hidden" style={{ border: '1.5px dashed #e5e7eb' }}>
                  <button type="button" className="btn w-100 d-flex align-items-center gap-2 px-3 py-3"
                    style={{ background: 'none', fontSize: 14, color: '#6b7280', fontWeight: 600 }}
                    onClick={() => setShowDetails(v => !v)}>
                    <i className="bi bi-plus-circle" style={{ color: '#4a5cff' }}></i>
                    <span>Add More Details</span>
                    <span className="text-muted fw-normal" style={{ fontSize: 12 }}>Add receipt, location and other details</span>
                    <i className={'bi ms-auto ' + (showDetails ? 'bi-chevron-up' : 'bi-chevron-down')} style={{ fontSize: 12 }}></i>
                  </button>
                  {showDetails && (
                    <div className="px-3 pb-3 border-top" style={{ background: '#fafafa' }}>
                      <label className="form-label fw-semibold small mt-3">Wallet (optional)</label>
                      <select className="form-select"
                        value={expWalletId === '' ? '' : String(expWalletId)}
                        onChange={e => setExpWalletId(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">No wallet</option>
                        {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}
                      </select>
                    </div>
                  )}
                </div>

            </div>{/* end scrollable body */}

            {/* ── Footer — always visible, never scrolls ── */}
            <div className="d-flex align-items-center justify-content-end gap-3 px-4 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid #f3f4f6' }}>
              <button type="button" className="btn btn-light fw-semibold px-4" style={{ borderRadius: 10 }} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary fw-semibold px-4 d-flex align-items-center gap-2"
                disabled={saving}
                style={{ borderRadius: 10, background: 'linear-gradient(135deg,#4a5cff,#7c4dff)', border: 'none', minWidth: 140 }}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm"></span> Adding…</>
                  : <><i className="bi bi-plus-lg"></i> Add Expense</>}
              </button>
            </div>

          </form>{/* form = modal-content */}
        </div>
      </div>
    </BodyPortal>
  )
}
