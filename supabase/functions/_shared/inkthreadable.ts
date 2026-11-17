// Inkthreadable API client. Docs: help.inkthreadable.co.uk > Inkthreadable's API
// Signature = SHA1(<request body | query string without Signature> + secret key)
import { admin } from './util.ts'

const BASE = (Deno.env.get('INKTHREADABLE_API_BASE') ?? 'https://www.inkthreadable.co.uk/api').replace(/\/$/, '')
const APP_ID = Deno.env.get('INKTHREADABLE_APP_ID') ?? 'APP-00330383'
const SECRET = Deno.env.get('INKTHREADABLE_SECRET_KEY') ?? ''

export const inkConfigured = () => SECRET.length > 0

async function sha1(s: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function call(path: string, init: { method: 'GET' | 'POST'; query?: Record<string, string>; body?: unknown }) {
  if (!inkConfigured()) throw new Error('INKTHREADABLE_SECRET_KEY is not set')
  const qs = new URLSearchParams({ AppId: APP_ID, ...init.query }).toString()
  const body = init.body === undefined ? undefined : JSON.stringify(init.body)
  const signature = await sha1((body ?? qs) + SECRET)
  const res = await fetch(`${BASE}/${path}?${qs}&Signature=${signature}`, {
    method: init.method,
    headers: { Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }) },
    body,
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = null }
  if (!res.ok || !data) throw new Error(`Inkthreadable ${res.status}: ${text.slice(0, 300) || res.statusText}`)
  const err = (data as { error?: unknown; errors?: unknown }).error ?? (data as { errors?: unknown }).errors
  if (err) throw new Error(`Inkthreadable: ${JSON.stringify(err).slice(0, 300)}`)
  return data as Record<string, unknown>
}

type InkOrder = {
  id?: number | string
  status?: string
  deleted?: string | boolean
  shipping?: { trackingNumber?: string; shiped_at?: string }
}

export async function getInkOrder(id: string): Promise<InkOrder> {
  const data = await call('order.php', { method: 'GET', query: { id } })
  return ((data.order ?? data) as InkOrder)
}

const STEP = ['paid', 'processing', 'printing', 'shipped', 'delivered']

/** Maps an Inkthreadable order onto our status. Never moves an order backwards. */
export function mapStatus(current: string, ink: InkOrder): { status: string; tracking: string | null } {
  const tracking = ink.shipping?.trackingNumber?.trim() || null
  const s = (ink.status ?? '').toLowerCase()
  let next: string
  if (ink.deleted === true || ink.deleted === 'true') next = 'cancelled'
  else if (s === 'refunded') next = 'refunded'
  else if (tracking || ink.shipping?.shiped_at) next = 'shipped'
  else if (s === 'printing' || s === 'quality control') next = 'printing'
  else next = 'processing'
  const terminal = ['cancelled', 'refunded']
  if (terminal.includes(current)) return { status: current, tracking }
  if (!terminal.includes(next) && STEP.indexOf(next) < STEP.indexOf(current)) next = current
  return { status: next, tracking }
}

type Address = { name?: string; line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string; phone?: string }
type Item = { product_id: string; title: string; color: string | null; size: string | null; quantity: number; unit_price: number }

/**
 * Sends a paid order's Inkthreadable items for printing and stores the result on the order.
 * Safe to retry: skips orders that already have an Inkthreadable id.
 */
export async function submitOrder(orderId: string): Promise<string> {
  const { data: order, error } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (error || !order) throw new Error('Order not found')
  if (order.inkthreadable_order_id) return `Already sent (Inkthreadable #${order.inkthreadable_order_id})`
  if (order.is_test) return 'Test order: never sent to print'
  if (order.status !== 'paid') return `Order is ${order.status}, not sending`

  const items = order.items as Item[]
  const { data: products } = await admin.from('products')
    .select('id,source,external_product_id,variants,print_files')
    .in('id', items.map((i) => i.product_id))
  const byId = new Map((products ?? []).map((p) => [p.id, p]))

  const inkItems = items.flatMap((it) => {
    const p = byId.get(it.product_id)
    if (!p || p.source !== 'inkthreadable') return []
    const variant = (p.variants as { color: string; pn?: string }[]).find((v) => v.color === it.color)
    // codes may contain {size} / {color} placeholders when Inkthreadable uses one code per size
    const pn = (variant?.pn || p.external_product_id || '')
      .replaceAll('{size}', it.size ?? '').replaceAll('{color}', it.color ?? '')
    const files = (p.print_files ?? {}) as { front?: string; back?: string }
    return [{
      pn,
      quantity: it.quantity,
      retailPrice: it.unit_price,
      description: [it.title, it.color, it.size].filter(Boolean).join(' / '),
      designs: { ...(files.front && { front: files.front }), ...(files.back && { back: files.back }) },
    }]
  })

  if (inkItems.length === 0) {
    await admin.from('orders').update({ status: 'processing', fulfillment_status: 'manual fulfilment', fulfillment_error: null }).eq('id', orderId)
    return 'No Inkthreadable items: marked for manual fulfilment'
  }

  const a = (order.shipping_address ?? {}) as Address
  const [firstName, ...rest] = (a.name ?? '').trim().split(/\s+/)
  const payload = {
    external_id: order.id,
    ...(Deno.env.get('INKTHREADABLE_BRAND') && { brandName: Deno.env.get('INKTHREADABLE_BRAND') }),
    comment: `Little Chick Nest order ${order.id.slice(0, 8).toUpperCase()}`,
    shipping_address: {
      firstName: firstName || 'Customer', lastName: rest.join(' ') || '-', company: '',
      address1: a.line1 ?? '', address2: a.line2 ?? '', city: a.city ?? '', county: a.state ?? '',
      postcode: a.postal_code ?? '', country: a.country ?? '', phone1: a.phone ?? '',
    },
    shipping: { shippingMethod: Deno.env.get('INKTHREADABLE_SHIPPING_METHOD') ?? 'regular' },
    items: inkItems,
  }

  try {
    const res = await call('orders.php', { method: 'POST', body: payload })
    const ink = (res.order ?? res) as InkOrder
    if (ink.id == null) throw new Error(`Unexpected response: ${JSON.stringify(res).slice(0, 200)}`)
    const mixed = inkItems.length < items.length ? ' (+ manual items)' : ''
    await admin.from('orders').update({
      inkthreadable_order_id: String(ink.id), status: 'processing',
      fulfillment_status: (ink.status ?? 'received') + mixed, fulfillment_error: null,
    }).eq('id', orderId)
    return `Sent to Inkthreadable as #${ink.id}`
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await admin.from('orders').update({ fulfillment_error: message.slice(0, 500) }).eq('id', orderId)
    throw e
  }
}
