import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import BodyPortal from '../components/BodyPortal'
import { useToastContext } from '../context/ToastContext'

type JarType = 'NEC' | 'FFA' | 'LTSS' | 'EDU' | 'PLAY' | 'GIVE'

interface JarBalance {
  jar_type: JarType | string
  balance?: number
  allocated_balance?: number
  net_transfers?: number
}

interface JarStrategy {
  id: number
  name: string
  nec: number
  ffa: number
  edu: number
  ltss: number
  play: number
  give: number
}

interface LedgerItem {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  jar_type?: JarType | string
  strategy_name?: string
  income_source?: string
}

const FALLBACK_TOTAL = 12540.75

const JARS: Array<{
  type: JarType
  label: string
  short: string
  percent: number
  color: string
  soft: string
  icon: string
}> = [
  { type: 'NEC', label: 'Necessities', short: 'Needs', percent: 55, color: '#09a66d', soft: '#e5f9ef', icon: 'bi-house-door-fill' },
  { type: 'FFA', label: 'Financial Freedom', short: 'Freedom', percent: 10, color: '#06a86d', soft: '#e8f8ef', icon: 'bi-cash-coin' },
  { type: 'LTSS', label: 'Long-term Savings', short: 'Savings', percent: 10, color: '#20a7b5', soft: '#e7f9fb', icon: 'bi-bullseye' },
  { type: 'EDU', label: 'Education', short: 'Learning', percent: 10, color: '#4a7cf7', soft: '#edf4ff', icon: 'bi-mortarboard-fill' },
  { type: 'PLAY', label: 'Play', short: 'Enjoyment', percent: 10, color: '#ff9d2e', soft: '#fff3e5', icon: 'bi-stars' },
  { type: 'GIVE', label: 'Give', short: 'Giving', percent: 5, color: '#f5578b', soft: '#fff0f6', icon: 'bi-gift-fill' },
]

function money(amount: number, currency = 'MAD') {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0
  return `${currency} ${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso?: string) {
  if (!iso) return 'Today'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Today'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function cleanupModalArtifacts() {
  window.setTimeout(() => {
    document.querySelectorAll('.modal-backdrop').forEach((node) => node.remove())
    document.body.classList.remove('modal-open')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')
  }, 0)
}

function strategyPercent(strategy: JarStrategy | undefined, jar: JarType, fallback: number) {
  if (!strategy) return fallback
  const value = Number(strategy[jar.toLowerCase() as keyof JarStrategy])
  if (!Number.isFinite(value)) return fallback
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

function Donut({
  segments,
  total,
  label,
}: {
  segments: Array<{ key: string; value: number; color: string }>
  total: number
  label: string
}) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const safeTotal = Math.max(total, 1)
  let offset = 0

  return (
    <svg className="econome-donut" viewBox="0 0 140 140" role="img" aria-label={label}>
      <g transform="translate(70 70) rotate(-90)">
        <circle r={radius} cx="0" cy="0" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="20" />
        {segments.map((segment) => {
          const value = Math.max(segment.value, 0)
          const length = (value / safeTotal) * circumference
          const dashOffset = offset
          offset += length
          return (
            <circle
              key={segment.key}
              r={radius}
              cx="0"
              cy="0"
              fill="none"
              stroke={segment.color}
              strokeWidth="20"
              strokeLinecap="butt"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-dashOffset}
            />
          )
        })}
      </g>
      <text x="70" y="65" textAnchor="middle" className="econome-donut-small">MAD</text>
      <text x="70" y="82" textAnchor="middle" className="econome-donut-total">
        {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </text>
      <text x="70" y="99" textAnchor="middle" className="econome-donut-label">Total in Jars</text>
    </svg>
  )
}

export default function EconomePage() {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<JarBalance[]>([])
  const [strategies, setStrategies] = useState<JarStrategy[]>([])
  const [ledger, setLedger] = useState<LedgerItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeSource, setIncomeSource] = useState('Salary')
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | ''>('')
  const [savingIncome, setSavingIncome] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const [balanceRes, strategyRes, ledgerRes] = await Promise.all([
        client.get<JarBalance[]>('/econome/balances').catch(() => ({ data: [] as JarBalance[] })),
        client.get<JarStrategy[]>('/econome/strategies').catch(() => ({ data: [] as JarStrategy[] })),
        client.get<LedgerItem[]>('/econome/ledger').catch(() => ({ data: [] as LedgerItem[] })),
      ])
      setBalances(balanceRes.data || [])
      setStrategies(strategyRes.data || [])
      setLedger(ledgerRes.data || [])
      const firstStrategy = (strategyRes.data || [])[0]
      if (firstStrategy) setSelectedStrategyId((current) => current || firstStrategy.id)
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed to load jars'), 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedStrategyId) || strategies[0],
    [selectedStrategyId, strategies],
  )

  const balanceByJar = useMemo(() => {
    const map = new Map<string, JarBalance>()
    for (const balance of balances) map.set(String(balance.jar_type).toUpperCase(), balance)
    return map
  }, [balances])

  const jarCards = useMemo(() => {
    const data = JARS.map((jar) => {
      const balance = balanceByJar.get(jar.type)
      const percent = strategyPercent(activeStrategy, jar.type, jar.percent)
      const allocated = Number(balance?.allocated_balance || 0)
      const current = Number(balance?.balance || 0)
      const target = allocated > 0 ? allocated : (FALLBACK_TOTAL * percent) / 100
      const amount = balances.length ? current : target
      const spent = Math.max(target - Math.max(amount, 0), 0)
      const progress = target > 0 ? Math.max(0, Math.min(100, (Math.max(amount, 0) / target) * 100)) : 0
      return { ...jar, percent, target, amount, spent, left: amount, progress }
    })
    return data
  }, [activeStrategy, balanceByJar, balances.length])

  const totalInJars = useMemo(() => {
    const total = jarCards.reduce((sum, jar) => sum + Math.max(jar.amount, 0), 0)
    return total > 0 ? total : FALLBACK_TOTAL
  }, [jarCards])

  const monthlyIncome = useMemo(() => {
    const income = ledger
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    return income > 0 ? income : totalInJars
  }, [ledger, totalInJars])

  const health = useMemo(() => {
    const avg = jarCards.reduce((sum, jar) => sum + jar.progress, 0) / Math.max(jarCards.length, 1)
    return Math.round(Math.max(0, Math.min(100, avg || 78)))
  }, [jarCards])

  const recentTransactions = useMemo(() => {
    if (ledger.length) return ledger.slice(0, 6)
    return [
      { id: 1, type: 'expense' as const, description: 'Grocery Shopping', jar_type: 'NEC', amount: 76.8, date: '2026-05-29T12:00:00Z' },
      { id: 2, type: 'expense' as const, description: 'Stock Investment', jar_type: 'FFA', amount: 50, date: '2026-05-28T12:00:00Z' },
      { id: 3, type: 'expense' as const, description: 'Online Course', jar_type: 'EDU', amount: 120, date: '2026-05-28T12:00:00Z' },
      { id: 4, type: 'expense' as const, description: 'Movie Night', jar_type: 'PLAY', amount: 45, date: '2026-05-27T12:00:00Z' },
      { id: 5, type: 'expense' as const, description: 'Charity Donation', jar_type: 'GIVE', amount: 30, date: '2026-05-27T12:00:00Z' },
      { id: 6, type: 'income' as const, description: 'Salary May 2026', amount: 12540.75, income_source: 'Salary', date: '2026-05-26T12:00:00Z' },
    ]
  }, [ledger])

  async function submitIncome(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(incomeAmount)
    const strategyId = Number(selectedStrategyId || activeStrategy?.id)
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid income amount', 'warning')
      return
    }
    if (!strategyId) {
      showToast('No jar strategy found yet', 'warning')
      return
    }
    setSavingIncome(true)
    try {
      await client.post('/econome/distribute', null, {
        params: {
          amount,
          strategy_id: strategyId,
          income_source: incomeSource.trim() || 'Income',
          description: `${incomeSource.trim() || 'Income'} distribution`,
        },
      })
      showToast('Income distributed across jars', 'success')
      setIncomeAmount('')
      setModalOpen(false)
      cleanupModalArtifacts()
      await reload()
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed to distribute income'), 'danger')
    } finally {
      setSavingIncome(false)
    }
  }

  function closeIncomeModal(force = false) {
    if (!force && savingIncome) return
    setModalOpen(false)
    cleanupModalArtifacts()
  }

  return (
    <>
      <div className="econome-page">
        <div className="econome-mobile-header">
          <button className="econome-icon-button" type="button" aria-label="Open menu">
            <i className="bi bi-list"></i>
          </button>
          <h1>Econome (Jars)</h1>
          <button className="econome-floating-plus" type="button" onClick={() => setModalOpen(true)} aria-label="Log income">
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>

        <header className="econome-heading">
          <div>
            <h1>Econome (Jars)</h1>
            <p>Manage your money using the 6-jar system.</p>
          </div>
          <div className="econome-heading-actions">
            <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>
              <i className="bi bi-plus-lg me-2"></i>Log Income
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => showToast('Strategy editor coming next.', 'info')}>
              <i className="bi bi-box-arrow-up-right me-2"></i>Manage Strategy
            </button>
          </div>
        </header>

        <section className="econome-mobile-hero">
          <div>
            <span>Monthly Income</span>
            <strong>{money(monthlyIncome)}</strong>
            <small>Auto-distributed across 6 jars</small>
          </div>
          <div className="econome-jar-illustration" aria-hidden="true">
            <span></span>
            <i></i>
          </div>
        </section>

        <section className="econome-summary-grid">
          <article className="econome-summary-card">
            <div>
              <span>Monthly Income</span>
              <strong>{money(monthlyIncome)}</strong>
              <small>Auto-distributed across 6 jars</small>
            </div>
            <button className="econome-pill" type="button">This Month <i className="bi bi-chevron-down"></i></button>
          </article>
          <article className="econome-summary-card econome-health-card">
            <div className="econome-health-ring" style={{ '--health': `${health}%` } as React.CSSProperties}>
              <span>{health}%</span>
            </div>
            <div>
              <span>Overall Health</span>
              <strong>Good</strong>
              <small>You're on track. Keep going.</small>
            </div>
          </article>
          <article className="econome-summary-card">
            <div>
              <span>Total in Jars</span>
              <strong>{money(totalInJars)}</strong>
              <small>100% distributed</small>
            </div>
            <div className="econome-stack-illustration" aria-hidden="true"></div>
          </article>
        </section>

        <section className="econome-health-mobile">
          <div className="econome-section-title">
            <h2>Overall Health</h2>
            <span>Good <i></i></span>
          </div>
          <div className="econome-health-mobile-body">
            <div className="econome-health-ring" style={{ '--health': `${health}%` } as React.CSSProperties}>
              <span>{health}%</span>
            </div>
            <div>
              <strong>You're on track! Keep going</strong>
              <p>Your jars are well balanced.</p>
            </div>
          </div>
        </section>

        <div className="econome-section-title econome-jars-title">
          <h2>Your Jars</h2>
          <button type="button">Strategy: {activeStrategy?.name || 'Default'} <i className="bi bi-chevron-down"></i></button>
        </div>

        <section className="econome-jars-grid" aria-busy={loading}>
          {jarCards.map((jar) => (
            <article className="econome-jar-card" key={jar.type}>
              <div className="econome-jar-head">
                <span style={{ background: jar.soft, color: jar.color }}>
                  <i className={`bi ${jar.icon}`}></i>
                </span>
                <div>
                  <strong>{jar.label}</strong>
                  <small>{jar.percent}%</small>
                </div>
              </div>
              <strong className="econome-jar-amount">{money(jar.amount)}</strong>
              <p>of {money(jar.target)}</p>
              <div className="econome-progress"><i style={{ width: `${jar.progress}%`, background: jar.color }}></i></div>
              <div className="econome-jar-meta">
                <span>Spent<br /><b>{money(jar.spent)}</b></span>
                <span>Left<br /><b>{money(jar.left)}</b></span>
                <em>{Math.round(jar.progress)}%</em>
              </div>
            </article>
          ))}
        </section>

        <section className="econome-lower-grid">
          <article className="econome-panel">
            <div className="econome-panel-title">
              <h2>Recent Transactions</h2>
              <button type="button" onClick={() => showToast('More transactions coming next.', 'info')}>View All</button>
            </div>
            <div className="econome-transactions">
              {recentTransactions.map((transaction) => {
                const jar = JARS.find((item) => item.type === transaction.jar_type)
                const isIncome = transaction.type === 'income'
                return (
                  <div className="econome-transaction-row" key={`${transaction.type}-${transaction.id}`}>
                    <span>Date<br /><b>{formatDate(transaction.date)}</b></span>
                    <span>Description<br /><b>{transaction.description}</b></span>
                    <span>Jar<br /><b>{isIncome ? 'All Jars' : jar?.label || transaction.jar_type || 'Jar'}</b></span>
                    <span>Type<br /><b className={isIncome ? 'positive' : ''}>{isIncome ? 'Income' : 'Expense'}</b></span>
                    <strong className={isIncome ? 'positive' : 'negative'}>
                      {isIncome ? '+' : '-'}{money(transaction.amount)}
                    </strong>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="econome-panel">
            <div className="econome-panel-title">
              <h2>Jars Distribution</h2>
            </div>
            <div className="econome-distribution">
              <Donut
                total={totalInJars}
                label="Jars distribution"
                segments={jarCards.map((jar) => ({ key: jar.type, value: Math.max(jar.amount, 0), color: jar.color }))}
              />
              <div className="econome-distribution-list">
                {jarCards.map((jar) => (
                  <div key={jar.type}>
                    <span style={{ background: jar.color }}></span>
                    <b>{jar.label} ({jar.percent}%)</b>
                    <em>{money(jar.amount)}</em>
                  </div>
                ))}
              </div>
            </div>
            <p className="econome-distribution-note">100% of your income is distributed</p>
          </article>
        </section>

        <aside className="econome-tip">
          <span><i className="bi bi-shield-check"></i></span>
          <div>
            <strong>Tip</strong>
            <p>Log your income regularly to keep your jars balanced and stay on track with your goals.</p>
          </div>
          <button type="button" aria-label="Close tip"><i className="bi bi-x-lg"></i></button>
        </aside>

        <button className="econome-mobile-log" type="button" onClick={() => setModalOpen(true)}>
          <i className="bi bi-plus-lg"></i>Log Income
        </button>

        <nav className="mobile-bottom-nav econome-mobile-nav" aria-label="Mobile navigation">
          <span><i className="bi bi-house"></i>Home</span>
          <span><i className="bi bi-people"></i>Groups</span>
          <button type="button" onClick={() => setModalOpen(true)}><i className="bi bi-plus-lg"></i></button>
          <span className="active"><i className="bi bi-wallet2"></i>Jars</span>
          <span><i className="bi bi-three-dots"></i>More</span>
        </nav>
      </div>

      {modalOpen ? (
        <BodyPortal>
          <div
            className="econome-modal-layer econome-income-modal"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeIncomeModal()
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <form className="modal-content" onSubmit={submitIncome}>
                <div className="modal-header border-0">
                  <div>
                    <h5 className="modal-title fw-bold">Log Income</h5>
                    <p className="text-muted small mb-0">Distribute income automatically across your jars.</p>
                  </div>
                  <button className="btn-close" type="button" onClick={() => closeIncomeModal()} aria-label="Close"></button>
                </div>
                <div className="modal-body pt-0">
                  <label className="form-label fw-semibold">Amount</label>
                  <input
                    className="form-control form-control-lg"
                    type="number"
                    min="0"
                    step="0.01"
                    value={incomeAmount}
                    onChange={(event) => setIncomeAmount(event.target.value)}
                    placeholder="12540.75"
                  />
                  <label className="form-label fw-semibold mt-3">Income Source</label>
                  <input
                    className="form-control"
                    value={incomeSource}
                    onChange={(event) => setIncomeSource(event.target.value)}
                    placeholder="Salary"
                  />
                  <label className="form-label fw-semibold mt-3">Strategy</label>
                  <select
                    className="form-select"
                    value={selectedStrategyId}
                    onChange={(event) => setSelectedStrategyId(Number(event.target.value))}
                  >
                    {strategies.map((strategy) => (
                      <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-footer border-0">
                  <button className="btn btn-light" type="button" onClick={() => closeIncomeModal()}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={savingIncome || !strategies.length}>
                    {savingIncome ? 'Saving...' : 'Distribute Income'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </BodyPortal>
      ) : null}
    </>
  )
}
