import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert, Field, Spinner, useTitle } from '../../components/ui'
import type { Tables } from '../../lib/database.types'
import { ALL_STATUSES, asItems, formatDate, formatMoney, imgSrc, STATUS_LABEL } from '../../lib/shop'
import { functionError, supabase } from '../../lib/supabase'
import { StatusBadge, TestBadge } from '../../components/orders'
import { AdminTitle } from './AdminLayout'

type Order = Tables<'orders'>
const PAGE = 50
const FILTERS: Record<string, string> = { all: 'All', active: 'In production', problem: 'Needs attention', ...STATUS_LABEL }

export function AdminOrders() {
  useTitle('Orders')
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'all'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Order[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let query = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (status === 'active') query = query.in('status', ['paid', 'processing', 'printing'])
    else if (status === 'problem') query = query.not('fulfillment_error', 'is', null).neq('status', 'pending')
    else if (status !== 'all') query = query.eq('status', status)
    else query = query.neq('status', 'pending')
    const term = q.trim()
    // ilike on email only; ids are matched exactly (pasting a full order id)
    if (term) query = /^[0-9a-f-]{36}$/i.test(term) ? query.eq('id', term) : query.ilike('email', `%${term.replace(/[%_\\]/g, '\\$&')}%`)
    const t = setTimeout(() => {
      query.range(page * PAGE, page * PAGE + PAGE - 1).then(({ data, count, error }) => {
        if (error) return setError(error.message)
        setRows(data)
        setTotal(count ?? 0)
      })
    }, term ? 300 : 0)
    return () => clearTimeout(t)
  }, [status, q, page])

  return (
    <>
      <AdminTitle title="Orders" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="sm:w-60"><span className="sr-only">Status</span>
          <select className="input" value={status} onChange={(e) => { setPage(0); setParams(e.target.value === 'all' ? {} : { status: e.target.value }) }}>
            {Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex-1"><span className="sr-only">Search</span>
          <input className="input" type="search" placeholder="Search by customer email or full order id" value={q} onChange={(e) => { setPage(0); setQ(e.target.value) }} />
        </label>
      </div>
      {error && <Alert>{error}</Alert>}
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="card p-8 text-center text-muted">No orders match.</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-sand text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-cream-2/50">
                  <td className="p-3"><Link to={`/admin/orders/${o.id}`} className="font-mono font-bold text-orange-2 hover:underline">#{o.id.slice(0, 8).toUpperCase()}</Link>
                    {o.fulfillment_error && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs font-bold text-red-800">!</span>}</td>
                  <td className="p-3 whitespace-nowrap">{formatDate(o.created_at)}</td>
                  <td className="max-w-56 truncate p-3">{o.email ?? <span className="text-muted">deleted account</span>}</td>
                  <td className="p-3">{asItems(o.items).reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1"><StatusBadge status={o.status} />{o.is_test && <TestBadge />}</div></td>
                  <td className="p-3 text-right font-bold tabular-nums">{formatMoney(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost py-2" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button type="button" className="btn-ghost py-2" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  )
}

type Note = Tables<'order_notes'>

export function AdminOrderDetail() {
  const { id } = useParams()
  useTitle('Order')
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [notes, setNotes] = useState<Note[]>([])
  const [status, setStatus] = useState('')
  const [tracking, setTracking] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [tick, setTick] = useState(0)
  const load = () => setTick((t) => t + 1)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('orders').select('*').eq('id', id!).maybeSingle(),
      supabase.from('order_notes').select('*').eq('order_id', id!).order('created_at'),
    ]).then(([o, n]) => {
      if (!active) return
      setOrder(o.data)
      setStatus(o.data?.status ?? '')
      setTracking(o.data?.tracking_number ?? '')
      setNotes(n.data ?? [])
    })
    return () => { active = false }
  }, [id, tick])

  if (order === undefined) return <Spinner />
  if (!order) return <Alert>Order not found.</Alert>

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('orders').update({ status, tracking_number: tracking.trim() || null }).eq('id', order.id)
    setMsg(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Order updated.' })
    if (!error) load()
  }

  const addNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    const { error } = await supabase.from('order_notes').insert({ order_id: order.id, body: note.trim() })
    if (error) return setMsg({ tone: 'error', text: error.message })
    setNote('')
    load()
  }

  const sync = async () => {
    setSyncing(true)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke<{ message: string }>('sync-order-status', { body: { order_id: order.id } })
    setSyncing(false)
    setMsg(error ? { tone: 'error', text: await functionError(error) } : { tone: 'success', text: data?.message ?? 'Synced.' })
    load()
  }

  const items = asItems(order.items)
  const addr = (order.shipping_address ?? {}) as Record<string, string | undefined>

  return (
    <>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-olive hover:underline"><ChevronLeft className="size-4" aria-hidden /> Orders</Link>
      {order.is_test && <div className="mb-4"><Alert tone="info">This is a <strong>test order</strong> placed while checkout was in test mode. No payment was taken and it is never sent to Inkthreadable. You can still change its status to preview what customers see.</Alert></div>}
      <AdminTitle title={`Order #${order.id.slice(0, 8).toUpperCase()}`}>
        <button type="button" onClick={sync} disabled={syncing || order.status === 'pending'} className="btn-dark py-2">
          <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
          {order.inkthreadable_order_id ? 'Sync from Inkthreadable' : 'Send to Inkthreadable'}
        </button>
      </AdminTitle>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {order.fulfillment_error && <div className="mb-4"><Alert>Fulfilment problem: {order.fulfillment_error}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <h2 className="p-5 pb-2 text-xl">Items</h2>
            <ul className="divide-y divide-sand">
              {items.map((it, i) => {
                const img = imgSrc(it.image)
                return (
                  <li key={i} className="flex items-center gap-4 px-5 py-3">
                    <div className="size-14 shrink-0 overflow-hidden rounded bg-cream-2">{img && <img src={img} alt="" className="size-full object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/products/${it.product_id}`} className="font-bold text-olive hover:underline">{it.title}</Link>
                      <p className="text-xs text-muted">{[it.color, it.size].filter(Boolean).join(' · ')} · Qty {it.quantity} × {formatMoney(it.unit_price)}</p>
                    </div>
                    <p className="font-bold tabular-nums">{formatMoney(it.unit_price * it.quantity)}</p>
                  </li>
                )
              })}
            </ul>
            <dl className="space-y-1 border-t border-sand p-5 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(order.shipping_amount)}</dd></div>
              <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{formatMoney(order.total_amount)}</dd></div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-xl">Internal notes</h2>
            {notes.length === 0 ? <p className="mb-3 text-sm text-muted">No notes yet. Notes are only visible to admins.</p> : (
              <ul className="mb-4 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-cream-2/60 p-3 text-sm">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addNote} className="flex gap-2">
              <label className="flex-1"><span className="sr-only">New note</span>
                <textarea className="input" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
              </label>
              <button className="btn-dark self-end py-2">Add</button>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <form onSubmit={save} className="card space-y-4 p-5">
            <h2 className="text-xl">Status</h2>
            <Field label="Order status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="Tracking number"><input className="input" maxLength={100} value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
            <button className="btn-primary w-full">Save changes</button>
          </form>

          <section className="card space-y-3 p-5 text-sm">
            <h2 className="text-xl">Customer</h2>
            <p>{order.email ? <a className="text-orange-2 underline" href={`mailto:${order.email}`}>{order.email}</a> : <span className="text-muted">Account deleted</span>}</p>
            {addr.line1 && (
              <address className="not-italic text-muted">
                {addr.name}<br />{addr.line1}<br />{addr.line2 && <>{addr.line2}<br /></>}
                {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}<br />{addr.country}{addr.phone && <><br />{addr.phone}</>}
              </address>
            )}
          </section>

          <section className="card space-y-2 p-5 text-sm">
            <h2 className="text-xl">References</h2>
            <p>Placed: {new Date(order.created_at).toLocaleString()}</p>
            <p>Inkthreadable: <strong>{order.inkthreadable_order_id ?? '—'}</strong>{order.fulfillment_status && ` (${order.fulfillment_status})`}</p>
            <p className="break-all">Stripe: {order.stripe_payment_intent_id ?? '—'}</p>
          </section>
        </div>
      </div>
    </>
  )
}
