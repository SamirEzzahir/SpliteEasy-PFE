import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useToastContext } from '../context/ToastContext'
import BodyPortal from '../components/BodyPortal'
import type { Wallet } from '../types'

// ── types ──────────────────────────────────────────────
interface Transaction {
  id: number
  description: string
  sub: string
  amount: number
  date: string
  type: 'income' | 'expense' | 'transfer'
}

// ── constants ──────────────────────────────────────────
const WALLET_CATEGORIES = ['Cash', 'Bank', 'Credit Card', 'Savings', 'Investment', 'Other']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'TND', 'SAR', 'AED', 'CAD']

const PALETTE = ['#4a5cff', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6']

const CAT_GRADIENT: Record<string, string> = {
  cash:          'linear-gradient(135deg,#10b981,#059669)',
  bank:          'linear-gradient(135deg,#4a5cff,#7c4dff)',
  'credit card': 'linear-gradient(135deg,#ef4444,#dc2626)',
  savings:       'linear-gradient(135deg,#f59e0b,#d97706)',
  investment:    'linear-gradient(135deg,#06b6d4,#0891b2)',
  other:         'linear-gradient(135deg,#6b7280,#4b5563)',
}
const CAT_ICON: Record<string, string> = {
  cash: 'bi-cash-stack', bank: 'bi-bank', 'credit card': 'bi-credit-card-fill',
  savings: 'bi-piggy-bank-fill', investment: 'bi-graph-up-arrow', other: 'bi-wallet2',
}

function gradFor(cat: string) { return CAT_GRADIENT[cat.toLowerCase()] || CAT_GRADIENT.other }
function iconFor(cat: string) { return CAT_ICON[cat.toLowerCase()]     || CAT_ICON.other   }

function money(v: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(v) || 0)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── SVG Donut Chart ────────────────────────────────────
function DonutChart({ wallets, total }: { wallets: Wallet[]; total: number }) {
  const R = 70; const CX = 90; const CY = 90; const STROKE = 22
  const C = 2 * Math.PI * R

  if (!wallets.length || total === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: 180 }}>
        <p className="text-muted small">No wallets yet</p>
      </div>
    )
  }

  let offset = 0
  const slices = wallets.map((w, i) => {
    const pct  = Math.max(Number(w.balance || 0) / total, 0)
    const dash = pct * C
    const gap  = C - dash
    const el = (
      <circle key={w.id}
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={PALETTE[i % PALETTE.length]}
        strokeWidth={STROKE}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset * C + C / 4}
        style={{ transition: 'stroke-dasharray .4s' }}
      />
    )
    offset += pct
    return el
  })

  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      {/* track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
      {slices}
      {/* center text */}
      <text x={CX} y={CY - 8} textAnchor="middle" fill="#1f2937" fontSize={15} fontWeight={700}>
        {money(total).replace(/\.00$/, '')}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fill="#6b7280" fontSize={11}>
        Total
      </text>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────
export default function FinancePage() {
  const { showToast } = useToastContext()
  const [wallets, setWallets]         = useState<Wallet[]>([])
  const [loading, setLoading]         = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [secureCard, setSecureCard]   = useState(true)
  const [saving, setSaving]           = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editWallet, setEditWallet]   = useState<Wallet | null>(null)
  const [walletMenuId, setWalletMenuId] = useState<number | null>(null)

  // form
  const [fName, setFName]         = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fBalance, setFBalance]   = useState('')
  const [fCurrency, setFCurrency] = useState('USD')
  const [fCategory, setFCategory] = useState('Bank')
  const nameRef = useRef<HTMLInputElement>(null)

  // mock recent transactions derived from wallets
  const [txns] = useState<Transaction[]>([
    { id: 1, description: 'Added Money',              sub: 'Main Wallet',     amount: 200,   date: '2025-05-29', type: 'income'   },
    { id: 2, description: 'Paid to Ahmed Khaled',     sub: 'Dinner at Bella Italia', amount: -45.60, date: '2025-05-28', type: 'expense' },
    { id: 3, description: 'Grocery Shopping',         sub: 'Personal Wallet', amount: -76.80, date: '2025-05-27', type: 'expense' },
    { id: 4, description: 'Transferred to Travel Wallet', sub: 'From Main Wallet', amount: -150, date: '2025-05-26', type: 'transfer' },
    { id: 5, description: 'Refund Received',          sub: 'Uber to Airport', amount: 28,    date: '2025-05-26', type: 'income'   },
    { id: 6, description: 'ATM Withdrawal',           sub: 'Personal Wallet', amount: -50,   date: '2025-05-25', type: 'expense' },
  ])

  async function reload() {
    setLoading(true)
    try {
      const res = await client.get<Wallet[]>('/wallets')
      setWallets(res.data || [])
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed to load'), 'danger')
    } finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  function openCreate() {
    setEditWallet(null)
    setFName(''); setFDesc(''); setFBalance(''); setFCurrency('USD'); setFCategory('Bank')
    setModalOpen(true)
    setTimeout(() => nameRef.current?.focus(), 80)
  }
  function openEdit(w: Wallet) {
    setWalletMenuId(null)
    setEditWallet(w)
    setFName(w.name); setFDesc(''); setFBalance(String(w.balance)); setFCurrency(w.currency); setFCategory(w.category)
    setModalOpen(true)
    setTimeout(() => nameRef.current?.focus(), 80)
  }
  function closeModal() { setModalOpen(false) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fName.trim()) { showToast('Wallet name is required', 'warning'); return }
    setSaving(true)
    try {
      const payload = { name: fName.trim(), balance: parseFloat(fBalance) || 0, currency: fCurrency, category: fCategory }
      if (editWallet) {
        await client.put(`/wallets/${editWallet.id}`, payload)
        showToast('Wallet updated', 'success')
      } else {
        await client.post('/wallets', payload)
        showToast('Wallet created', 'success')
      }
      closeModal(); await reload()
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed'), 'danger')
    } finally { setSaving(false) }
  }

  async function deleteWallet(id: number) {
    setWalletMenuId(null)
    if (!confirm('Delete this wallet?')) return
    try { await client.delete(`/wallets/${id}`); showToast('Wallet deleted', 'warning'); await reload() }
    catch (err: any) { showToast(String(err?.response?.data?.detail || err?.message || 'Failed'), 'danger') }
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0)

  function txnIcon(type: Transaction['type']) {
    if (type === 'income')   return { icon: 'bi-arrow-down-left', bg: '#dcfce7', color: '#16a34a' }
    if (type === 'transfer') return { icon: 'bi-arrow-left-right', bg: '#dbeafe', color: '#2563eb' }
    return { icon: 'bi-arrow-up-right', bg: '#fee2e2', color: '#dc2626' }
  }

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1280, padding: '28px 28px 40px' }}>

      {/* ── Header ── */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ fontSize: 26 }}>My Wallets</h2>
          <p className="text-muted mb-0" style={{ fontSize: 14 }}>Manage your money, track balances and view transactions.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2 px-4 fw-semibold"
          type="button" onClick={openCreate}
          style={{ background: 'linear-gradient(135deg,#4a5cff,#7c4dff)', border: 'none', borderRadius: 12, height: 44 }}>
          <i className="bi bi-plus-lg"></i>Add Wallet
        </button>
      </div>

      {/* ── Hero: Total Balance ── */}
      <div className="card border-0 mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg,#4a5cff 0%,#7c4dff 60%,#6366f1 100%)', borderRadius: 20 }}>
        <div className="card-body p-4 p-md-5 d-flex align-items-center justify-content-between">
          <div className="text-white">
            <div className="small opacity-75 mb-2 fw-semibold" style={{ letterSpacing: 1 }}>Total Balance</div>
            <div className="d-flex align-items-center gap-3 mb-2">
              <span className="fw-bold" style={{ fontSize: 42, letterSpacing: -1 }}>
                {balanceVisible ? money(totalBalance) : '••••••'}
              </span>
              <button className="btn btn-link p-0 text-white opacity-75" type="button"
                onClick={() => setBalanceVisible(v => !v)} style={{ fontSize: 20 }}>
                <i className={'bi ' + (balanceVisible ? 'bi-eye' : 'bi-eye-slash')}></i>
              </button>
            </div>
            <div className="small opacity-90">
              <span className="text-success fw-semibold" style={{ color: '#4ade80 !important' }}>
                <i className="bi bi-arrow-up me-1"></i>12.5%
              </span>
              <span className="ms-1 opacity-75">vs last month</span>
            </div>
          </div>
          <div className="d-none d-md-block" style={{ fontSize: 100, opacity: 0.25 }}>
            <i className="bi bi-wallet2 text-white"></i>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* ── Left column ── */}
        <div className="d-flex flex-column gap-4">

          {/* Your Wallets */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h6 className="fw-bold mb-0" style={{ fontSize: 16 }}>Your Wallets</h6>
                <button className="btn btn-link p-0 text-primary text-decoration-none fw-semibold" style={{ fontSize: 13 }} type="button">
                  Manage Wallets
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
              ) : wallets.length ? (
                <div className="d-flex flex-column gap-1">
                  {wallets.map((w, idx) => (
                    <div key={w.id} className="d-flex align-items-center gap-3 py-3"
                      style={{ borderBottom: idx < wallets.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      {/* Icon */}
                      <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white"
                        style={{ width: 48, height: 48, background: gradFor(w.category), fontSize: 20 }}>
                        <i className={'bi ' + iconFor(w.category)}></i>
                      </div>
                      {/* Name + desc */}
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-semibold" style={{ fontSize: 15 }}>{w.name}</span>
                          {idx === 0 && (
                            <span className="badge" style={{ background: '#ede9fe', color: '#7c4dff', fontSize: 11, borderRadius: 6 }}>Primary</span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{w.category} wallet &bull; {w.currency}</div>
                      </div>
                      {/* Balance */}
                      <div className="fw-bold flex-shrink-0" style={{ fontSize: 16 }}>{money(w.balance, w.currency)}</div>
                      {/* Menu */}
                      <div className="dropdown flex-shrink-0">
                        <button
                          className="btn btn-link p-1 text-muted"
                          type="button"
                          aria-expanded={walletMenuId === w.id}
                          onClick={() => setWalletMenuId((current) => current === w.id ? null : w.id)}
                        >
                          <i className="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul className={`dropdown-menu dropdown-menu-end shadow-sm border-0 ${walletMenuId === w.id ? 'show' : ''}`} style={{ borderRadius: 12 }}>
                          <li><button className="dropdown-item" type="button" onClick={() => openEdit(w)}><i className="bi bi-pencil me-2"></i>Edit</button></li>
                          <li><button className="dropdown-item text-danger" type="button" onClick={() => deleteWallet(w.id)}><i className="bi bi-trash me-2"></i>Delete</button></li>
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted py-3" style={{ fontSize: 13 }}>No wallets yet.</div>
              )}

              {/* Create New Wallet button */}
              <button className="btn w-100 mt-3 fw-semibold d-flex align-items-center justify-content-center gap-2"
                type="button" onClick={openCreate}
                style={{ border: '1.5px dashed #c7d2fe', borderRadius: 12, color: '#4a5cff', background: '#fafbff', height: 52 }}>
                <i className="bi bi-plus-circle"></i>Create New Wallet
              </button>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h6 className="fw-bold mb-0" style={{ fontSize: 16 }}>Recent Transactions</h6>
                <button className="btn btn-link p-0 text-primary text-decoration-none fw-semibold" style={{ fontSize: 13 }} type="button">
                  View All
                </button>
              </div>
              <div className="d-flex flex-column gap-1">
                {txns.map((t, idx) => {
                  const { icon, bg, color } = txnIcon(t.type)
                  return (
                    <div key={t.id} className="d-flex align-items-center gap-3 py-3"
                      style={{ borderBottom: idx < txns.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: 44, height: 44, background: bg, color, fontSize: 18 }}>
                        <i className={'bi ' + icon}></i>
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold text-truncate" style={{ fontSize: 14 }}>{t.description}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{t.sub}</div>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <div className="fw-bold" style={{ fontSize: 14, color: t.amount > 0 ? '#16a34a' : '#dc2626' }}>
                          {t.amount > 0 ? '+' : ''}{money(t.amount)}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{fmtDate(t.date)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>

        {/* ── Right sidebar ── */}
        <div className="d-flex flex-column gap-4">

          {/* Balance Overview donut */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-4" style={{ fontSize: 15 }}>Balance Overview</h6>
              <div className="d-flex justify-content-center mb-3">
                {loading
                  ? <div className="spinner-border text-primary" role="status"></div>
                  : <DonutChart wallets={wallets} total={totalBalance} />
                }
              </div>
              {/* Legend */}
              <div className="d-flex flex-column gap-2">
                {wallets.map((w, i) => {
                  const pct = totalBalance > 0 ? Math.round((Number(w.balance) / totalBalance) * 100) : 0
                  return (
                    <div key={w.id} className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle flex-shrink-0"
                          style={{ width: 10, height: 10, background: PALETTE[i % PALETTE.length] }}></div>
                        <span style={{ fontSize: 13 }}>{w.name}</span>
                      </div>
                      <div className="text-end">
                        <span className="fw-semibold" style={{ fontSize: 13 }}>{pct}%</span>
                        <div className="text-muted" style={{ fontSize: 11 }}>{money(w.balance, w.currency)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3" style={{ fontSize: 15 }}>Quick Actions</h6>
              <div className="d-flex flex-column gap-2">
                {[
                  { icon: 'bi-plus-circle-fill', label: 'Add Money',       color: '#10b981', bg: '#dcfce7' },
                  { icon: 'bi-arrow-left-right', label: 'Transfer Money',  color: '#4a5cff', bg: '#ede9fe' },
                  { icon: 'bi-dash-circle-fill', label: 'Withdraw Money',  color: '#f59e0b', bg: '#fef3c7' },
                  { icon: 'bi-gear-fill',        label: 'Wallet Settings', color: '#6b7280', bg: '#f3f4f6' },
                ].map(a => (
                  <button key={a.label} type="button"
                    className="btn d-flex align-items-center gap-3 text-start fw-semibold"
                    style={{ borderRadius: 10, border: '1px solid #f3f4f6', padding: '10px 14px', fontSize: 14 }}
                    onClick={() => showToast(a.label + ' coming soon', 'info')}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 36, height: 36, background: a.bg, color: a.color, fontSize: 16 }}>
                      <i className={'bi ' + a.icon}></i>
                    </div>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Secure Your Wallet promo */}
          {secureCard && (
            <div className="card border-0 shadow-sm position-relative" style={{ borderRadius: 16, background: 'linear-gradient(135deg,#f0f4ff,#faf5ff)' }}>
              <button type="button" className="btn-close position-absolute" style={{ top: 12, right: 12, fontSize: 10 }}
                onClick={() => setSecureCard(false)}></button>
              <div className="card-body p-4 text-center">
                <div className="mb-3" style={{ fontSize: 48 }}>
                  <i className="bi bi-shield-lock-fill" style={{ color: '#7c4dff' }}></i>
                </div>
                <h6 className="fw-bold mb-2">Secure Your Wallet</h6>
                <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                  Enable 2FA to keep your wallets and transactions extra secure.
                </p>
                <button className="btn btn-primary fw-semibold w-100" style={{ borderRadius: 10, background: 'linear-gradient(135deg,#4a5cff,#7c4dff)', border: 'none' }}
                  type="button" onClick={() => showToast('2FA setup coming soon', 'info')}>
                  <i className="bi bi-shield-check me-2"></i>Enable 2FA
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Add / Edit Wallet Modal ── */}
      {modalOpen && (
        <BodyPortal>
          <div className="modal fade show d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 20 }}>

                <div className="modal-header border-0 px-4 pt-4 pb-2"
                  style={{ background: 'linear-gradient(135deg,#4a5cff,#7c4dff)', borderRadius: '20px 20px 0 0' }}>
                  <div className="text-white">
                    <h5 className="fw-bold mb-0">{editWallet ? 'Edit Wallet' : 'Create New Wallet'}</h5>
                    <div className="small opacity-75">{editWallet ? 'Update your wallet details' : 'Add a wallet to track your money'}</div>
                  </div>
                  <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
                </div>

                <form onSubmit={submit}>
                  <div className="modal-body px-4 py-4">

                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Wallet Name *</label>
                      <input ref={nameRef} className="form-control" placeholder="e.g. Main Bank Account"
                        value={fName} onChange={e => setFName(e.target.value)} required />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Description (optional)</label>
                      <input className="form-control" placeholder="e.g. Default wallet for all transactions"
                        value={fDesc} onChange={e => setFDesc(e.target.value)} />
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Initial Balance</label>
                        <input type="number" className="form-control" placeholder="0.00" step="0.01"
                          value={fBalance} onChange={e => setFBalance(e.target.value)} />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Currency</label>
                        <select className="form-select" value={fCurrency} onChange={e => setFCurrency(e.target.value)}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Category</label>
                      <div className="d-flex flex-wrap gap-2">
                        {WALLET_CATEGORIES.map(cat => (
                          <button key={cat} type="button"
                            className={'btn btn-sm fw-semibold ' + (fCategory === cat ? 'btn-primary' : 'btn-outline-secondary')}
                            style={{ borderRadius: 10 }}
                            onClick={() => setFCategory(cat)}>
                            <i className={'bi ' + iconFor(cat) + ' me-1'}></i>{cat}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
                    <button type="button" className="btn btn-light px-4 fw-semibold" style={{ borderRadius: 10 }} onClick={closeModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={saving}
                      style={{ borderRadius: 10, background: 'linear-gradient(135deg,#4a5cff,#7c4dff)', border: 'none' }}>
                      {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</> : (editWallet ? 'Update Wallet' : 'Create Wallet')}
                    </button>
                  </div>
                </form>

              </div>
            </div>
          </div>
        </BodyPortal>
      )}
    </div>
  )
}
