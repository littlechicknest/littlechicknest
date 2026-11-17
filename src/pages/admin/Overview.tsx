import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Spinner, useTitle } from '../../components/ui'
import type { Tables } from '../../lib/database.types'
import { formatDate, formatMoney } from '../../lib/shop'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/orders'
import { AdminTitle } from './AdminLayout'

type Day = { day: string; revenue: number; orders: number }
type Recent = Pick<Tables<'orders'>, 'id' | 'created_at' | 'email' | 'total_amount' | 'status'>

const head = { count: 'exact' as const, head: true }

export default function Overview() {
  useTitle('Admin')
  const [days, setDays] = useState<Day[] | null>(null)
  const [recent, setRecent] = useState<Recent[]>([])
  const [counts, setCounts] = useState({ toFulfil: 0, problems: 0, reviews: 0, messages: 0 })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.rpc('admin_daily_sales', { p_days: 30 }),
      supabase.from('orders').select('id,created_at,email,total_amount,status').neq('status', 'pending').order('created_at', { ascending: false }).limit(6),
      supabase.from('orders').select('id', head).in('status', ['paid', 'processing', 'printing']),
      supabase.from('orders').select('id', head).not('fulfillment_error', 'is', null).neq('status', 'pending'),
      supabase.from('reviews').select('id', head).eq('is_approved', false),
      supabase.from('contact_messages').select('id', head).eq('is_read', false),
    ]).then(([sales, rec, f, p, r, m]) => {
      const err = [sales, rec, f, p, r, m].find((x) => x.error)?.error
      if (err) return setError(err.message)
      setDays((sales.data ?? []).map((d) => ({ ...d, revenue: Number(d.revenue) })))
      setRecent(rec.data ?? [])
      setCounts({ toFulfil: f.count ?? 0, problems: p.count ?? 0, reviews: r.count ?? 0, messages: m.count ?? 0 })
    })
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!days) return <Spinner />

  const revenue = days.reduce((n, d) => n + d.revenue, 0)
  const orders = days.reduce((n, d) => n + d.orders, 0)
  const tiles = [
    { label: 'Revenue · 30 days', value: formatMoney(revenue) },
    { label: 'Orders · 30 days', value: String(orders) },
    { label: 'Average order', value: formatMoney(orders ? revenue / orders : 0) },
    { label: 'In production', value: String(counts.toFulfil), to: '/admin/orders?status=active' },
  ]
  const todo = [
    counts.problems > 0 && { to: '/admin/orders?status=problem', text: `${counts.problems} order${counts.problems > 1 ? 's' : ''} failed to reach Inkthreadable`, urgent: true },
    counts.reviews > 0 && { to: '/admin/reviews', text: `${counts.reviews} review${counts.reviews > 1 ? 's' : ''} waiting for approval` },
    counts.messages > 0 && { to: '/admin/messages', text: `${counts.messages} unread message${counts.messages > 1 ? 's' : ''}` },
  ].filter(Boolean) as { to: string; text: string; urgent?: boolean }[]

  return (
    <>
      <AdminTitle title="Overview" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{t.label}</p>
              <p className="mt-1 font-display text-3xl text-olive tabular-nums">{t.value}</p>
            </>
          )
          return t.to ? <Link key={t.label} to={t.to} className="card p-5 hover:shadow-md">{body}</Link> : <div key={t.label} className="card p-5">{body}</div>
        })}
      </div>

      {todo.length > 0 && (
        <ul className="mt-4 space-y-2">
          {todo.map((t) => (
            <li key={t.to}><Link to={t.to} className={`block rounded-lg border px-4 py-3 text-sm font-bold hover:underline ${t.urgent ? 'border-red-200 bg-red-50 text-red-800' : 'border-yolk/50 bg-yolk/10 text-olive'}`}>{t.text} →</Link></li>
          ))}
        </ul>
      )}

      <section className="card mt-6 p-5">
        <h2 className="mb-1 text-xl">Daily revenue</h2>
        <p className="mb-4 text-sm text-muted">Paid orders, last 30 days</p>
        <RevenueChart days={days} />
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-xl">Latest orders</h2>
          <Link to="/admin/orders" className="text-sm font-bold text-orange-2 hover:underline">All orders</Link>
        </div>
        {recent.length === 0 ? <p className="px-5 pb-5 text-muted">No orders yet.</p> : (
          <ul className="divide-y divide-sand">
            {recent.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-cream-2/50">
                  <span className="font-mono text-sm font-bold">#{o.id.slice(0, 8).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{o.email}</span>
                  <span className="text-sm text-muted">{formatDate(o.created_at)}</span>
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right font-bold tabular-nums">{formatMoney(o.total_amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** Single-series bar chart: no legend (title names it), hover tooltip, sr-only table. */
function RevenueChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 220, pad = { l: 48, r: 8, t: 8, b: 24 }
  const max = Math.max(1, ...days.map((d) => d.revenue))
  const nice = niceMax(max)
  const bw = (W - pad.l - pad.r) / days.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice)
  const h = hover != null ? days[hover] : null
  const short = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily revenue bar chart for the last 30 days" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} stroke="#e6d9c2" strokeWidth={1} />
            <text x={pad.l - 6} y={y(nice * f) + 4} textAnchor="end" fontSize="11" fill="#6d6a5f">{compact(nice * f)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad.l + i * bw
          const top = y(d.revenue)
          const bh = Math.max(0, H - pad.b - top)
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${short(d.day)}: ${formatMoney(d.revenue)}, ${d.orders} orders`}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {bh > 0 && <path d={roundTop(x + 1, top, Math.max(1, bw - 2), bh, Math.min(4, (bw - 2) / 2, bh))} fill={hover === i ? '#a85209' : '#c96210'} />}
            </g>
          )
        })}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text key={i} x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#6d6a5f">{short(days[i].day)}</text>
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-sand bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `clamp(0px, calc(${((pad.l + hover! * bw) / W) * 100}% - 60px), calc(100% - 140px))` }}>
          <p className="font-bold text-olive">{short(h.day)}</p>
          <p className="tabular-nums">{formatMoney(h.revenue)} · {h.orders} order{h.orders === 1 ? '' : 's'}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Daily revenue</caption>
        <thead><tr><th>Day</th><th>Revenue</th><th>Orders</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.day}><td>{d.day}</td><td>{formatMoney(d.revenue)}</td><td>{d.orders}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

const niceMax = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? v
}
const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${Math.round(v)}`)
const roundTop = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
