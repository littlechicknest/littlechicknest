import { ChevronRight, Copy, LifeBuoy, Printer, RotateCcw, Search, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { AccountShell } from './Account'
import { AddressBlock, ItemRow, OrderProgress, StatusBadge, TestBadge } from '../components/orders'
import { Alert, Empty, Spinner, toast, useTitle } from '../components/ui'
import { useCart } from '../context/cart'
import type { Tables } from '../lib/database.types'
import { asItems, deliveryWindow, formatDate, formatMoney, imgSrc, orderNumber, STATUS_HINT } from '../lib/shop'
import { supabase } from '../lib/supabase'
import { useProducts } from '../lib/useProducts'

type Order = Tables<'orders'>
const FILTERS = {
  all: ['All', () => true],
  active: ['In progress', (s: string) => ['paid', 'processing', 'printing', 'shipped'].includes(s)],
  delivered: ['Delivered', (s: string) => s === 'delivered'],
  closed: ['Cancelled', (s: string) => ['cancelled', 'refunded'].includes(s)],
} as const
type FilterKey = keyof typeof FILTERS

export function Orders() {
  useTitle('My orders')
  const [params, setParams] = useSearchParams()
  const filter: FilterKey = (params.get('filter') ?? '') in FILTERS ? (params.get('filter') as FilterKey) : 'all'
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    // RLS limits this to the signed-in customer's own orders
    supabase.from('orders').select('*').neq('status', 'pending').order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => (error ? setError(true) : setOrders(data as Order[])))
  }, [])

  const shown = useMemo(() => (orders ?? []).filter((o) => FILTERS[filter][1](o.status) &&
    (!q.trim() || orderNumber(o.id).toLowerCase().includes(q.trim().toLowerCase()) ||
      asItems(o.items).some((i) => i.title.toLowerCase().includes(q.trim().toLowerCase())))), [orders, filter, q])

  return (
    <AccountShell title="My orders">
      {error ? <Alert>Could not load your orders. Please refresh.</Alert> : !orders ? <Spinner /> : orders.length === 0 ? (
        <Empty title="No orders yet"><p>When you place an order, you’ll be able to follow it here from the print room to your door.</p><Link to="/shop" className="btn-primary mt-4">Start shopping</Link></Empty>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter orders">
              {(Object.keys(FILTERS) as FilterKey[]).map((k) => {
                const n = orders.filter((o) => FILTERS[k][1](o.status)).length
                return (
                  <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setParams(k === 'all' ? {} : { filter: k }, { replace: true })}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${filter === k ? 'bg-olive text-white' : 'border border-sand bg-paper hover:border-olive-3'}`}>
                    {FILTERS[k][0]} <span className="opacity-70">{n}</span>
                  </button>
                )
              })}
            </div>
            <label className="relative ml-auto w-full sm:w-60">
              <span className="sr-only">Search orders</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number or item" className="input min-h-10 rounded-full py-2 pl-9" />
            </label>
          </div>
          {shown.length === 0 ? <p className="rounded-xl border border-dashed border-sand p-8 text-center text-muted">No orders match.</p> : (
            <ul className="space-y-4">
              {shown.map((o) => {
                const items = asItems(o.items)
                return (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`} className="card block p-5 transition hover:shadow-[var(--shadow-lift)]">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-olive">{orderNumber(o.id)}</p>
                          <p className="text-[13px] text-muted">{formatDate(o.created_at)} · {items.reduce((n, i) => n + i.quantity, 0)} item{items.length === 1 && items[0]?.quantity === 1 ? '' : 's'} · {formatMoney(o.total_amount)}</p>
                        </div>
                        <div className="flex items-center gap-2">{o.is_test && <TestBadge />}<StatusBadge status={o.status} /><ChevronRight className="size-4 text-muted" aria-hidden /></div>
                      </div>
                      <OrderProgress status={o.status} compact />
                      <div className="mt-4 flex items-center gap-3">
                        <span className="flex -space-x-2">
                          {items.slice(0, 4).map((it, i) => { const img = imgSrc(it.image); return <span key={i} className="size-11 overflow-hidden rounded-full border-2 border-paper bg-cream-2">{img && <img src={img} alt="" className="size-full object-cover" loading="lazy" />}</span> })}
                        </span>
                        <span className="truncate text-[13px] text-muted">{items.map((i) => i.title).join(', ')}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </AccountShell>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  useTitle('Order details')
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const { add } = useCart()
  const { products } = useProducts()

  useEffect(() => {
    supabase.from('orders').select('*').eq('id', id!).maybeSingle().then(({ data }) => setOrder(data as Order | null))
  }, [id])

  if (order === undefined) return <Spinner />
  if (!order) return <AccountShell title="Order not found"><Empty title="We couldn’t find that order"><Link to="/orders" className="btn-primary mt-2">Back to my orders</Link></Empty></AccountShell>

  const items = asItems(order.items)
  const live = new Set((products ?? []).map((p) => p.id))
  const buyAgain = () => {
    const ok = items.filter((it) => live.has(it.product_id))
    ok.forEach((it) => add({ product_id: it.product_id, color: it.color, size: it.size, quantity: it.quantity }))
    if (ok.length < items.length) toast(`${items.length - ok.length} item${items.length - ok.length > 1 ? 's are' : ' is'} no longer available`)
  }
  const num = orderNumber(order.id)

  return (
    <AccountShell title={num} crumbs={[['My orders', '/orders'], [num]]}>
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-muted">Placed {formatDate(order.created_at)}</p>
        {order.is_test && <TestBadge />}
        <StatusBadge status={order.status} />
        <div className="no-print ml-auto flex gap-2">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(num); toast('Order number copied') }} className="btn-ghost min-h-9 px-3 py-1.5 normal-case tracking-normal"><Copy className="size-4" aria-hidden /> Copy number</button>
          <button type="button" onClick={() => window.print()} className="btn-ghost min-h-9 px-3 py-1.5 normal-case tracking-normal"><Printer className="size-4" aria-hidden /> Receipt</button>
        </div>
      </div>

      <div className="card mb-6 p-5 sm:p-6">
        <OrderProgress status={order.status} />
        <p className="mt-5 text-center text-sm text-ink/80">{STATUS_HINT[order.status]}</p>
        {['paid', 'processing', 'printing'].includes(order.status) && (
          <p className="mt-1 text-center text-[13px] text-muted"><Truck className="mr-1 inline size-4" aria-hidden />Estimated delivery {deliveryWindow(order.shipping_method === 'express' ? 'express' : 'standard', new Date(order.created_at))}</p>
        )}
        {order.tracking_number && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-cream-2 p-3 text-sm">
            Tracking number <strong className="select-all text-olive">{order.tracking_number}</strong>
            <a href={`https://parcelsapp.com/en/tracking/${encodeURIComponent(order.tracking_number)}`} target="_blank" rel="noopener noreferrer" className="btn-link ml-2">Track parcel</a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card px-5 sm:px-6">
          <div className="flex items-center justify-between border-b border-line py-4">
            <h2 className="text-lg">Items</h2>
            <button type="button" onClick={buyAgain} className="btn-link no-print"><RotateCcw className="size-3.5" aria-hidden /> Buy again</button>
          </div>
          <ul className="divide-y divide-line">
            {items.map((it, i) => (
              <ItemRow key={i} it={it}>
                {order.status === 'delivered' && <Link to={`/product/${it.product_id}#reviews`} className="no-print mt-1 inline-block text-xs font-medium text-orange-2 underline">Write a review</Link>}
              </ItemRow>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-lg">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery ({order.shipping_method})</dt><dd>{Number(order.shipping_amount) ? formatMoney(order.shipping_amount) : 'Free'}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-olive"><dt>Total</dt><dd>{formatMoney(order.total_amount)}</dd></div>
            </dl>
          </div>
          <div className="card p-5"><h2 className="mb-3 text-lg">Shipping to</h2><AddressBlock value={order.shipping_address} /></div>
          <Link to={`/contact?order=${num}`} className="card no-print flex items-center gap-3 p-5 transition hover:shadow-[var(--shadow-lift)]">
            <LifeBuoy className="size-6 text-orange" aria-hidden />
            <span><span className="block font-semibold text-olive">Need help with this order?</span><span className="text-[13px] text-muted">We usually reply within a day.</span></span>
          </Link>
        </div>
      </div>
    </AccountShell>
  )
}
