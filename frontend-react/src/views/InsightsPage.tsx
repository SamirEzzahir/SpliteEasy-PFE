import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useToastContext } from '../context/ToastContext'
import type { Expense, Group } from '../types'

type DateRange = 'month' | 'last30' | 'all'

const categoryPalette = [
  '#6d4cff',
  '#2f8df7',
  '#37c16f',
  '#ff9f3d',
  '#f5577e',
  '#a4adbd',
]

const groupPalette = ['#764dff', '#2f8df7', '#50c16f', '#ff7d52', '#ffbd3d', '#31bfb5']

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function money(amount: number, currency = 'MAD') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${currency} 0.00`
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function compactDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function rangeLabel(range: DateRange, today: Date) {
  if (range === 'all') return 'All Time'
  const start = range === 'month' ? startOfMonth(today) : startOfDay(new Date(today.getTime() - 29 * 86400000))
  const end = range === 'month' ? endOfMonth(today) : endOfDay(today)
  return `${compactDate(start)} - ${compactDate(end)}, ${end.getFullYear()}`
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (value: unknown) => {
    const s = String(value ?? '')
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n')
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function categoryName(raw?: string) {
  const value = (raw || 'Other').trim()
  if (/food|drink|dining/i.test(value)) return 'Food & Dining'
  if (/transport|uber|taxi|bus|car/i.test(value)) return 'Transport'
  if (/shop|grocery|market/i.test(value)) return 'Shopping'
  if (/travel|trip|hotel|accommodation/i.test(value)) return 'Travel'
  return value || 'Other'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function DonutChart({ segments, total, currency }: { segments: Array<{ label: string; value: number; color: string }>; total: number; currency: string }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const safeTotal = total || 1
  let offset = 0

  return (
    <svg className="insights-donut" viewBox="0 0 120 120" role="img" aria-label="Expense categories chart">
      <g transform="translate(60 60) rotate(-90)">
        <circle r={radius} cx="0" cy="0" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="16" />
        {segments.map((segment) => {
          const length = (segment.value / safeTotal) * circumference
          const currentOffset = offset
          offset += length
          return (
            <circle
              key={segment.label}
              r={radius}
              cx="0"
              cy="0"
              fill="none"
              stroke={segment.color}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-currentOffset}
            />
          )
        })}
      </g>
      <text x="60" y="55" textAnchor="middle" className="insights-donut-currency">{currency}</text>
      <text x="60" y="72" textAnchor="middle" className="insights-donut-total">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text>
      <text x="60" y="88" textAnchor="middle" className="insights-donut-label">Total</text>
    </svg>
  )
}

function TrendChart({ points, currency }: { points: Array<{ label: string; value: number }>; currency: string }) {
  const width = 620
  const height = 260
  const left = 72
  const right = 22
  const top = 18
  const bottom = 38
  const innerW = width - left - right
  const innerH = height - top - bottom
  const max = Math.max(...points.map((p) => p.value), 1)
  const yTicks = [1, 0.8, 0.6, 0.4, 0.2, 0]
  const coords = points.map((point, idx) => {
    const x = left + (points.length === 1 ? 0 : (idx / (points.length - 1)) * innerW)
    const y = top + innerH - (point.value / max) * innerH
    return { ...point, x, y }
  })
  const path = coords.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = coords.length > 0 ? `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${top + innerH} L ${coords[0].x.toFixed(1)} ${top + innerH} Z` : ''
  const labelIndexes = new Set([0, Math.floor(points.length * 0.2), Math.floor(points.length * 0.4), Math.floor(points.length * 0.6), Math.floor(points.length * 0.8), points.length - 1])

  return (
    <svg className="insights-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily expenses trend">
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6d4cff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#6d4cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((tick) => {
        const y = top + innerH * (1 - tick)
        const value = max * tick
        return (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y} y2={y} stroke="rgba(15,23,42,0.08)" />
            <text x={left - 12} y={y + 4} textAnchor="end" className="insights-chart-axis">
              {currency} {Math.round(value).toLocaleString()}
            </text>
          </g>
        )
      })}
      {areaPath && <path d={areaPath} fill="url(#trendFill)" />}
      {path && <path d={path} fill="none" stroke="#6d4cff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {coords.map((point, idx) => (
        <g key={`${point.label}-${idx}`}>
          <circle cx={point.x} cy={point.y} r="4" fill="#6d4cff" stroke="#fff" strokeWidth="2" />
          {labelIndexes.has(idx) ? (
            <text x={point.x} y={height - 12} textAnchor="middle" className="insights-chart-axis">
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}

export default function InsightsPage() {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [compareWith, setCompareWith] = useState('previous30')
  const today = useMemo(() => new Date(), [])

  async function reload() {
    setLoading(true)
    try {
      const [expenseRes, groupRes] = await Promise.all([
        client.get<Expense[]>('/expenses/all'),
        client.get<Group[]>('/groups'),
      ])
      setExpenses(expenseRes.data || [])
      setGroups(groupRes.data || [])
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Failed to load insights'), 'danger')
      setExpenses([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groupById = useMemo(() => {
    const map = new Map<number, Group>()
    for (const group of groups) map.set(group.id, group)
    return map
  }, [groups])

  const filteredExpenses = useMemo(() => {
    if (dateRange === 'all') return expenses
    const start = dateRange === 'month' ? startOfMonth(today) : startOfDay(new Date(today.getTime() - 29 * 86400000))
    const end = dateRange === 'month' ? endOfMonth(today) : endOfDay(today)
    return expenses.filter((expense) => {
      const date = new Date(expense.created_at)
      return !Number.isNaN(date.getTime()) && date >= start && date <= end
    })
  }, [dateRange, expenses, today])

  const previousExpenses = useMemo(() => {
    const currentDays = dateRange === 'month' ? endOfMonth(today).getDate() : 30
    const currentStart = dateRange === 'month' ? startOfMonth(today) : startOfDay(new Date(today.getTime() - 29 * 86400000))
    const previousEnd = endOfDay(new Date(currentStart.getTime() - 86400000))
    const previousStart = startOfDay(new Date(previousEnd.getTime() - (currentDays - 1) * 86400000))
    return expenses.filter((expense) => {
      const date = new Date(expense.created_at)
      return !Number.isNaN(date.getTime()) && date >= previousStart && date <= previousEnd
    })
  }, [dateRange, expenses, today])

  const currency = filteredExpenses.find((expense) => expense.currency)?.currency || expenses.find((expense) => expense.currency)?.currency || 'MAD'
  const total = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const previousTotal = previousExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const average = filteredExpenses.length ? total / filteredExpenses.length : 0
  const previousAverage = previousExpenses.length ? previousTotal / previousExpenses.length : 0
  const highest = filteredExpenses.reduce((max, expense) => Math.max(max, Number(expense.amount || 0)), 0)
  const lowest = filteredExpenses.length ? filteredExpenses.reduce((min, expense) => Math.min(min, Number(expense.amount || 0)), Number(filteredExpenses[0].amount || 0)) : 0

  function pctChange(current: number, previous: number) {
    if (!previous && current) return 100
    if (!previous) return 0
    return ((current - previous) / previous) * 100
  }

  const totalChange = pctChange(total, previousTotal)
  const averageChange = pctChange(average, previousAverage)
  const highestChange = pctChange(highest, previousExpenses.reduce((max, expense) => Math.max(max, Number(expense.amount || 0)), 0))
  const previousLowest = previousExpenses.length ? previousExpenses.reduce((min, expense) => Math.min(min, Number(expense.amount || 0)), Number(previousExpenses[0].amount || 0)) : 0
  const lowestChange = pctChange(lowest, previousLowest)

  const groupTotals = useMemo(() => {
    const totals = new Map<number, number>()
    for (const expense of filteredExpenses) totals.set(expense.group_id, (totals.get(expense.group_id) || 0) + Number(expense.amount || 0))
    return Array.from(totals.entries())
      .map(([groupId, amount], idx) => {
        const group = groupById.get(groupId)
        const label = group?.title || filteredExpenses.find((expense) => expense.group_id === groupId)?.group_name || `Group #${groupId}`
        return {
          groupId,
          label,
          amount,
          color: groupPalette[idx % groupPalette.length],
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses, groupById])

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const expense of filteredExpenses) {
      const key = categoryName(expense.category)
      totals.set(key, (totals.get(key) || 0) + Number(expense.amount || 0))
    }
    return Array.from(totals.entries())
      .map(([label, value], idx) => ({ label, value, color: categoryPalette[idx % categoryPalette.length] }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  const trendPoints = useMemo(() => {
    if (dateRange === 'all' && filteredExpenses.length > 0) {
      const sorted = filteredExpenses.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const first = startOfDay(new Date(sorted[0].created_at))
      const last = endOfDay(new Date(sorted[sorted.length - 1].created_at))
      const dayCount = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86400000))
      const bucketCount = Math.min(30, dayCount)
      const buckets = Array.from({ length: bucketCount }, (_, idx) => ({ label: '', value: 0, start: new Date(first.getTime() + (idx / bucketCount) * (last.getTime() - first.getTime())) }))
      for (const expense of sorted) {
        const date = new Date(expense.created_at)
        const idx = Math.min(bucketCount - 1, Math.floor(((date.getTime() - first.getTime()) / Math.max(1, last.getTime() - first.getTime())) * bucketCount))
        buckets[idx].value += Number(expense.amount || 0)
      }
      return buckets.map((bucket) => ({ label: compactDate(bucket.start), value: bucket.value }))
    }

    const start = dateRange === 'month' ? startOfMonth(today) : startOfDay(new Date(today.getTime() - 29 * 86400000))
    const count = dateRange === 'month' ? endOfMonth(today).getDate() : 30
    const points = Array.from({ length: count }, (_, idx) => {
      const date = new Date(start)
      date.setDate(start.getDate() + idx)
      return { date, label: compactDate(date), value: 0 }
    })
    for (const expense of filteredExpenses) {
      const date = startOfDay(new Date(expense.created_at))
      const idx = Math.floor((date.getTime() - start.getTime()) / 86400000)
      if (idx >= 0 && idx < points.length) points[idx].value += Number(expense.amount || 0)
    }
    return points.map(({ label, value }) => ({ label, value }))
  }, [dateRange, filteredExpenses, today])

  function exportCsv() {
    const rows = filteredExpenses.map((expense) => ({
      description: expense.description,
      group: groupById.get(expense.group_id)?.title || expense.group_name || expense.group_id,
      category: categoryName(expense.category),
      payer: expense.payer_name || expense.payer_username || expense.payer_id,
      amount: expense.amount,
      currency: expense.currency,
      created_at: expense.created_at,
    }))
    downloadTextFile('spliteasy-insights.csv', toCsv(rows), 'text/csv')
    showToast('Insights CSV exported.', 'success')
  }

  return (
    <div className="insights-page">
      <div className="insights-heading">
        <div>
          <h1>Insights</h1>
          <p>Analyze your expenses and trends in detail.</p>
        </div>
        <div className="insights-controls">
          <label>
            <span>Date Range</span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}>
              <option value="month">{rangeLabel('month', today)}</option>
              <option value="last30">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </label>
          <label>
            <span>Compare With</span>
            <select value={compareWith} onChange={(event) => setCompareWith(event.target.value)}>
              <option value="previous30">Previous 30 Days</option>
              <option value="previousPeriod">Previous Period</option>
              <option value="none">No Comparison</option>
            </select>
          </label>
          <button className="btn btn-primary insights-export-main" type="button" onClick={exportCsv} disabled={loading || filteredExpenses.length === 0}>
            <i className="bi bi-download"></i>
            Export
            <i className="bi bi-chevron-down small"></i>
          </button>
        </div>
      </div>

      <div className="insights-kpis">
        {[
          { label: 'Total Expenses', value: money(total, currency), change: totalChange, icon: 'bi-currency-dollar', tone: 'violet' },
          { label: 'Average Expense', value: money(average, currency), change: averageChange, icon: 'bi-graph-up-arrow', tone: 'green' },
          { label: 'Highest Expense', value: money(highest, currency), change: highestChange, icon: 'bi-arrow-up-circle', tone: 'red' },
          { label: 'Lowest Expense', value: money(lowest, currency), change: -Math.abs(lowestChange), icon: 'bi-arrow-down-circle', tone: 'amber' },
        ].map((card) => (
          <div className="insights-kpi-card" key={card.label}>
            <div className={`insights-kpi-icon ${card.tone}`}>
              <i className={`bi ${card.icon}`}></i>
            </div>
            <div>
              <span>{card.label}</span>
              <strong>{loading ? 'Loading...' : card.value}</strong>
              {compareWith !== 'none' ? (
                <small className={card.change >= 0 ? 'positive' : 'negative'}>
                  <i className={`bi ${card.change >= 0 ? 'bi-arrow-up' : 'bi-arrow-down'}`}></i>
                  {Math.abs(card.change).toFixed(1)}% vs previous 30 days
                </small>
              ) : (
                <small className="neutral">Comparison disabled</small>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="insights-grid">
        <section className="insights-card">
          <div className="insights-card-title">
            <div><i className="bi bi-people"></i> Expenses per Group</div>
          </div>
          <div className="insights-table">
            <div className="insights-table-head">
              <span>Group</span>
              <span>Amount</span>
            </div>
            {loading ? (
              <div className="insights-empty">Loading group analytics...</div>
            ) : groupTotals.length === 0 ? (
              <div className="insights-empty">No expenses found for this period.</div>
            ) : (
              groupTotals.slice(0, 6).map((group) => {
                const pct = total ? (group.amount / total) * 100 : 0
                return (
                  <div className="insights-group-row" key={group.groupId}>
                    <span className="insights-group-avatar" style={{ background: group.color }}>{initials(group.label)}</span>
                    <strong>{group.label}</strong>
                    <span>{money(group.amount, currency)}</span>
                    <span>{pct.toFixed(1)}%</span>
                    <span className="insights-mini-bar">
                      <i style={{ width: `${Math.max(8, pct)}%`, background: group.color }}></i>
                    </span>
                  </div>
                )
              })
            )}
          </div>
          <button className="insights-link-button" type="button" onClick={() => showToast('Open Groups to view the full group list.', 'info')}>
            View all groups <i className="bi bi-chevron-right"></i>
          </button>
        </section>

        <section className="insights-card">
          <div className="insights-card-title">
            <div><i className="bi bi-graph-up"></i> Daily Expenses Trend</div>
            <select aria-label="Trend granularity">
              <option>Daily</option>
              <option>Weekly</option>
            </select>
          </div>
          <TrendChart points={trendPoints} currency={currency} />
        </section>

        <section className="insights-card">
          <div className="insights-card-title">
            <div><i className="bi bi-pie-chart"></i> Expense Categories</div>
          </div>
          <div className="insights-categories">
            <DonutChart segments={categoryTotals.slice(0, 6)} total={total} currency={currency} />
            <div className="insights-category-list">
              {(categoryTotals.length ? categoryTotals : [{ label: 'No data', value: 0, color: '#a4adbd' }]).slice(0, 6).map((category) => {
                const pct = total ? (category.value / total) * 100 : 0
                return (
                  <div className="insights-category-row" key={category.label}>
                    <span style={{ background: category.color }}></span>
                    <strong>{category.label}</strong>
                    <em>{money(category.value, currency)}</em>
                    <small>{pct.toFixed(1)}%</small>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="insights-card">
          <div className="insights-card-title">
            <div><i className="bi bi-download"></i> Export Statistics</div>
          </div>
          <p className="insights-export-copy">Download your insights report in the format you prefer.</p>
          <div className="insights-export-actions">
            <button className="btn btn-outline-danger" type="button" onClick={() => showToast('PDF export is coming next.', 'info')}>
              <i className="bi bi-filetype-pdf"></i> Export PDF
            </button>
            <button className="btn btn-outline-success" type="button" onClick={exportCsv} disabled={filteredExpenses.length === 0}>
              <i className="bi bi-file-earmark-spreadsheet"></i> Export CSV
            </button>
            <button className="btn btn-outline-primary" type="button" onClick={() => window.print()}>
              <i className="bi bi-printer"></i> Print
            </button>
          </div>
        </section>
      </div>

      <div className="insights-tip">
        <span><i className="bi bi-lightbulb"></i></span>
        <div>
          <strong>Tip</strong>
          <p>Use filters to analyze specific time periods and groups for better insights.</p>
        </div>
      </div>
    </div>
  )
}
