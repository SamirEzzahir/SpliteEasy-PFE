import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useToastContext } from '../context/ToastContext'
import BodyPortal from '../components/BodyPortal'
import type { Income, IncomeType, Wallet } from '../types'

function money(v: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v) || 0)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORY_ICONS: Record<string, string> = {
  salary:     'bi-briefcase-fill',
  freelance:  'bi-laptop-fill',
  investment: 'bi-graph-up-arrow',
  gift:       'bi-gift-fill',
  business:   'bi-building-fill',
  rental:     'bi-house-fill',
  other:      'bi-cash-stack',
}
const CATEGORY_COLORS: Record<string, string> = {
  salary:     '#4a5cff',
  freelance:  '#8b5cf6',
  investment: '#10b981',
  gift:       '#ec4899',
  business:   '#f59e0b',
  rental:     '#06b6d4',
  other:      '#6b7280',
}

function cleanupModalArtifacts() {
  window.setTimeout(() => {
    document.querySelectorAll('.modal-backdrop').forEach((node) => node.remove())
    document.body.classList.remove('modal-open')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')
  }, 0)
}

export default function IncomePage() {
  const { showToast } = useToastContext()
  const [incomes, setIncomes]         = useState<Income[]>([])
  const [wallets, setWallets]         = useState<Wallet[]>([])
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editIncome, setEditIncome]   = useState<Income | null>(null)

  // form
  const [fAmount, setFAmount]         = useState('')
  const [fDate, setFDate]             = useState(new Date().toISOString().slice(0, 10))
  const [fNote, setFNote]             = useState('')
  const [fWalletId, setFWalletId]     = useState('')
  const [fTypeId, setFTypeId]         = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setLoading(true)
    try {
      const [incRes, walRes, typRes] = await Promise.all([
        client.get<Income[]>('/income'),
        client.get<Wallet[]>('/wallets'),
        client.get<IncomeType[]>('/income/types'),
      ])
      setIncomes(incRes.data || [])
      setWallets(walRes.data || [])
      setIncomeTypes(typRes.data || [])
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed to load'), 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  function openCreate() {
    setEditIncome(null)
    setFAmount(''); setFDate(new Date().toISOString().slice(0, 10)); setFNote(''); setFWalletId(''); setFTypeId('')
    setModalOpen(true)
    setTimeout(() => amountRef.current?.focus(), 80)
  }

  function openEdit(inc: Income) {
    setEditIncome(inc)
    setFAmount(String(inc.amount)); setFDate(inc.date?.slice(0, 10) || ''); setFNote(inc.note || '')
    setFWalletId(String(inc.wallet_id)); setFTypeId(String(inc.income_type_id))
    setModalOpen(true)
    setTimeout(() => amountRef.current?.focus(), 80)
  }

  function closeModal(force = false) {
    if (!force && saving) return
    setModalOpen(false)
    cleanupModalArtifacts()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fAmount || !fWalletId || !fTypeId) { showToast('Please fill all required fields', 'warning'); return }
    setSaving(true)
    try {
      const payload = { amount: parseFloat(fAmount), date: fDate, note: fNote, wallet_id: parseInt(fWalletId), income_type_id: parseInt(fTypeId) }
      if (editIncome) {
        await client.put(`/income/${editIncome.id}`, payload)
        showToast('Income updated', 'success')
      } else {
        await client.post('/income', payload)
        showToast('Income added', 'success')
      }
      closeModal(true)
      await reload()
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed to save'), 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function deleteIncome(id: number) {
    if (!confirm('Delete this income record?')) return
    try {
      await client.delete(`/income/${id}`)
      showToast('Income deleted', 'warning')
      await reload()
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed'), 'danger')
    }
  }

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0)

  const byCategory = incomes.reduce<Record<string, number>>((acc, i) => {
    const k = (i.category_name || 'other').toLowerCase()
    acc[k] = (acc[k] || 0) + Number(i.amount || 0)
    return acc
  }, {})

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">Income</h2>
          <p className="text-muted mb-0">Track your income sources and history</p>
        </div>
        <button className="btn btn-primary px-4" type="button" onClick={openCreate}
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 12 }}>
          <i className="bi bi-plus-lg me-2"></i>Add Income
        </button>
      </div>

      {/* Summary */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 16 }}>
            <div className="card-body p-4 text-white">
              <div className="small opacity-75 mb-1">Total Income</div>
              <div className="fw-bold" style={{ fontSize: 28 }}>{money(totalIncome)}</div>
              <div className="small opacity-75 mt-1">{incomes.length} record{incomes.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        {Object.entries(byCategory).slice(0, 2).map(([cat, total]) => (
          <div className="col-md-4" key={cat}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4 d-flex align-items-center gap-3">
                <div className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 48, height: 48, background: (CATEGORY_COLORS[cat] || '#6b7280') + '18', color: CATEGORY_COLORS[cat] || '#6b7280', fontSize: 20 }}>
                  <i className={'bi ' + (CATEGORY_ICONS[cat] || CATEGORY_ICONS.other)}></i>
                </div>
                <div>
                  <div className="text-muted small text-capitalize">{cat}</div>
                  <div className="fw-bold" style={{ fontSize: 20 }}>{money(total)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Income list */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border text-success" role="status"></div></div>
          ) : incomes.length ? (
            <div className="d-flex flex-column gap-2">
              {incomes.map(inc => {
                const cat   = (inc.category_name || 'other').toLowerCase()
                const icon  = CATEGORY_ICONS[cat]  || CATEGORY_ICONS.other
                const color = CATEGORY_COLORS[cat] || '#6b7280'
                return (
                  <div key={inc.id} className="d-flex align-items-center gap-3 p-3 rounded-3"
                    style={{ border: '1px solid #f3f4f6' }}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 44, height: 44, background: color + '18', color, fontSize: 18 }}>
                      <i className={'bi ' + icon}></i>
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate" style={{ fontSize: 14 }}>
                        {inc.category_name || 'Income'}
                      </div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {inc.wallet_name} &bull; {fmtDate(inc.date)}
                        {inc.note && <> &bull; {inc.note}</>}
                      </div>
                    </div>
                    <div className="fw-bold flex-shrink-0 text-success" style={{ fontSize: 16 }}>
                      +{money(inc.amount)}
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0">
                      <button className="btn btn-sm btn-light" type="button" style={{ borderRadius: 8 }} onClick={() => openEdit(inc)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-light text-danger" type="button" style={{ borderRadius: 8 }} onClick={() => deleteIncome(inc.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center text-muted py-5">
              <i className="bi bi-cash-stack fs-1 d-block mb-2 opacity-25"></i>
              No income records yet. Add your first income!
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <BodyPortal>
          <div
            className="app-modal-layer income-modal-layer"
            role="presentation"
            onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 20 }}>

                <div className="modal-header border-0 px-4 pt-4 pb-2"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: '20px 20px 0 0' }}>
                  <div className="text-white">
                    <h5 className="fw-bold mb-0">{editIncome ? 'Edit Income' : 'Add Income'}</h5>
                    <div className="small opacity-75">Record an income transaction</div>
                  </div>
                  <button type="button" className="btn-close btn-close-white" onClick={() => closeModal()}></button>
                </div>

                <form onSubmit={submit}>
                  <div className="modal-body px-4 py-4">

                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Amount *</label>
                        <input ref={amountRef} type="number" className="form-control" placeholder="0.00" step="0.01" min="0"
                          value={fAmount} onChange={e => setFAmount(e.target.value)} required />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Date *</label>
                        <input type="date" className="form-control" value={fDate} onChange={e => setFDate(e.target.value)} required />
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Wallet *</label>
                        <select className="form-select" value={fWalletId} onChange={e => setFWalletId(e.target.value)} required>
                          <option value="">Select wallet</option>
                          {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Category *</label>
                        <select className="form-select" value={fTypeId} onChange={e => setFTypeId(e.target.value)} required>
                          <option value="">Select type</option>
                          {incomeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Note (optional)</label>
                      <input className="form-control" placeholder="Add a note..."
                        value={fNote} onChange={e => setFNote(e.target.value)} />
                    </div>

                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
                    <button type="button" className="btn btn-light px-4 fw-semibold" style={{ borderRadius: 10 }} onClick={() => closeModal()}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-success px-4 fw-semibold" disabled={saving}
                      style={{ borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none' }}>
                      {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</> : (editIncome ? 'Update Income' : 'Add Income')}
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
