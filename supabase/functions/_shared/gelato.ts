// Gelato API client + order fulfilment. Docs: dashboard.gelato.com/docs
import type { GelatoProduct, GelatoVariant, Sku } from './catalog.ts'
import { admin, internalSecret } from './util.ts'

const STORE = Deno.env.get('GELATO_STORE_ID') ?? 'd75d8ab6-1250-405e-841b-b534d749e283'
const CATALOG = `https://ecommerce.gelatoapis.com/v1/stores/${STORE}/products`
const ORDERS = 'https://order.gelatoapis.com/v4/orders'

async function call<T>(url: string, body?: unknown, tries = 3): Promise<T> {
  const key = Deno.env.get('GELATO_API_KEY') || (await internalSecret('gelato_api_key'))
  if (!key) throw new Error('GELATO_API_KEY is not set')
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000), // Gelato sometimes hangs for 45s+; a retry is faster
      })
      const text = await res.text()
      if (!res.ok) throw Object.assign(new Error(`Gelato ${res.status}: ${text.slice(0, 300)}`), { final: res.status < 500 && res.status !== 429 })
      return JSON.parse(text) as T
    } catch (e) {
      if (i >= tries || (e as { final?: boolean }).final) throw e
      await new Promise((ok) => setTimeout(ok, 800 * i))
    }
  }
}

/* ------------------------------------------------------------ catalog */

export async function listProductIds(): Promise<string[]> {
  const ids: string[] = []
  for (let n = 100; n === 100;) {
    const { products } = await call<{ products: { id: string }[] }>(`${CATALOG}?limit=100&offset=${ids.length}`)
    n = products.length
    ids.push(...products.map((p) => p.id))
  }
  return ids
}

/** The list has no images or prices: images come from the product, costs from its variants. */
export async function loadProduct(id: string): Promise<[GelatoProduct, GelatoVariant[]]> {
  const [p, v] = await Promise.all([
    call<GelatoProduct>(`${CATALOG}/${id}`),
    call<{ productVariants: GelatoVariant[] }>(`${CATALOG}/${id}/variants`),
  ])
  return [p, v.productVariants]
}

/** Gelato's own exchange rate: the same item priced in both currencies. */
export async function usdRate(uid: string, currency: string): Promise<number> {
  if (currency === 'USD') return 1
  const price = async (c: string) =>
    (await call<{ price: number }[]>(`https://product.gelatoapis.com/v3/products/${uid}/prices?country=GB&currency=${c}`))[0]?.price
  const rate = (await price('USD')) / (await price(currency))
  if (!(rate > 0.1 && rate < 10)) throw new Error(`No usable ${currency} to USD rate from Gelato`)
  return rate
}

/* ------------------------------------------------------------ orders */

type GelatoOrder = {
  id: string
  fulfillmentStatus?: string
  shipment?: { packages?: { trackingCode?: string | null }[] } | null
  items?: { fulfillments?: { trackingCode?: string | null }[] }[]
}

const STEP = ['paid', 'processing', 'printing', 'shipped', 'delivered']
const TERMINAL = ['cancelled', 'refunded']

/** Maps a Gelato order onto our status. Never moves an order backwards. */
export function mapStatus(current: string, g: GelatoOrder): { status: string; tracking: string | null; error: string | null } {
  const tracking = [...(g.items ?? []).flatMap((i) => i.fulfillments ?? []), ...(g.shipment?.packages ?? [])]
    .map((x) => x.trackingCode?.trim()).find(Boolean) ?? null
  const s = (g.fulfillmentStatus ?? '').toLowerCase()
  let next = 'processing'
  if (s === 'canceled') next = 'cancelled'
  else if (s === 'delivered') next = 'delivered'
  else if (['shipped', 'in_transit'].includes(s)) next = 'shipped'
  else if (['in_production', 'printed'].includes(s)) next = 'printing'
  if (TERMINAL.includes(current)) next = current
  else if (!TERMINAL.includes(next) && STEP.indexOf(next) < STEP.indexOf(current)) next = current
  const error = s === 'not_connected' ? 'Gelato has not linked these items to a print design. Open the order in Gelato, or add print files to the product here.'
    : ['failed', 'on_hold', 'returned'].includes(s) ? `Gelato status: ${s}. Open the order in Gelato.` : null
  return { status: next, tracking, error }
}

type TrackedOrder = { id: string; status: string; gelato_order_id: string; tracking_number: string | null }

/** Re-reads an order from Gelato and stores its status and tracking. */
export async function refreshOrder(o: TrackedOrder): Promise<string> {
  const g = await call<GelatoOrder>(`${ORDERS}/${encodeURIComponent(o.gelato_order_id)}`)
  const { status, tracking, error } = mapStatus(o.status, g)
  const { error: dbError } = await admin.from('orders').update({
    fulfillment_status: g.fulfillmentStatus ?? null, fulfillment_error: error,
    ...(status !== o.status && { status }),
    ...(tracking && tracking !== o.tracking_number && { tracking_number: tracking }),
  }).eq('id', o.id)
  if (dbError) throw dbError
  return status !== o.status ? `Status: ${status}` : 'No change'
}

type Address = { name?: string; line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string; phone?: string }
type Item = { product_id: string; title: string; color: string | null; size: string | null; quantity: number }

/**
 * Is this colour/size out of stock for delivery to this address? Stock differs per region, so Gelato is asked with the real address.
 * If Gelato doesn't answer, the sale goes ahead: the order is sent later and any problem shows on the admin order page.
 */
export async function isOutOfStock(sku: Sku, quantity: number, a: Address, email: string): Promise<boolean> {
  try {
    const { quotes } = await call<{ quotes: { shipmentMethods: { shipmentMethodUid: string }[] }[] }>(`${ORDERS}:quote`, {
      orderReferenceId: 'stock-check', customerReferenceId: 'stock-check', currency: 'USD', allowMultipleQuotes: true,
      recipient: { firstName: 'Stock', lastName: 'Check', addressLine1: a.line1, city: a.city, state: a.state, postCode: a.postal_code, country: a.country, email },
      products: [{ itemReferenceId: '1', storeProductVariantId: sku.variant_id, productUid: sku.uid, quantity }],
    }, 1)
    return quotes.some((q) => q.shipmentMethods.some((m) => m.shipmentMethodUid === 'api_out_of_stock'))
  } catch (e) {
    console.error('stock check', e instanceof Error ? e.message : e)
    return false
  }
}

/** Sends a paid order's Gelato items for printing and stores the result. Safe to retry. */
export async function submitOrder(orderId: string): Promise<string> {
  // claim the order so the Stripe webhook and the timed sync can't both send it
  const stale = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: order, error } = await admin.from('orders').update({ fulfillment_status: 'sending' })
    .eq('id', orderId).eq('status', 'paid').eq('is_test', false).is('gelato_order_id', null)
    .or(`fulfillment_status.is.null,fulfillment_status.neq.sending,updated_at.lt.${stale}`).select('*').maybeSingle()
  if (error) throw error
  if (!order) return 'Nothing to send (already sent, being sent, not paid, or a test order)'

  try {
    const items = order.items as Item[]
    const { data: products, error: pErr } = await admin.from('products').select('id,source,skus,print_files').in('id', items.map((i) => i.product_id))
    if (pErr) throw pErr
    const byId = new Map((products ?? []).map((p) => [p.id, p]))
    const lines = items.flatMap((it, n) => {
      const p = byId.get(it.product_id)
      if (!p) throw new Error(`"${it.title}" was deleted from the shop: place this order in Gelato by hand`)
      if (p.source !== 'gelato') return []
      const sku = (p.skus as Sku[]).find((s) => s.color === it.color && s.size === it.size)
      if (!sku) throw new Error(`Gelato no longer offers ${it.title} in ${[it.color, it.size].filter(Boolean).join(' / ')}`)
      const f = (p.print_files ?? {}) as { front?: string; back?: string }
      // a print file set in the admin wins; otherwise Gelato uses the design saved in its store
      const what = f.front || f.back
        ? { productUid: sku.uid, files: [...(f.front ? [{ type: 'default', url: f.front }] : []), ...(f.back ? [{ type: 'back', url: f.back }] : [])] }
        : { storeProductVariantId: sku.variant_id }
      return [{ itemReferenceId: String(n + 1), quantity: it.quantity, ...what }]
    })
    if (!lines.length) {
      await admin.from('orders').update({ status: 'processing', fulfillment_status: 'manual fulfilment', fulfillment_error: null }).eq('id', orderId)
      return 'No Gelato items: marked for manual fulfilment'
    }

    const a = (order.shipping_address ?? {}) as Address
    const [first, ...rest] = (a.name ?? '').trim().split(/\s+/)
    // an earlier attempt may have reached Gelato even though its reply never arrived
    const found = await call<{ orders: GelatoOrder[] }>(`${ORDERS}:search`, { orderReferenceId: order.id })
    const g = found.orders[0] ?? await call<GelatoOrder>(ORDERS, {
      orderType: 'order', orderReferenceId: order.id, customerReferenceId: order.user_id ?? order.id, currency: 'USD',
      items: lines, shipmentMethodUid: order.shipping_method === 'express' ? 'express' : 'standard',
      shippingAddress: {
        firstName: first || 'Customer', lastName: rest.join(' ') || first || '-', addressLine1: a.line1 ?? '', addressLine2: a.line2 ?? '', city: a.city ?? '',
        state: a.state ?? '', postCode: a.postal_code ?? '', country: a.country ?? '', email: order.email ?? '', phone: a.phone ?? '',
      },
    }, 1) // never auto-retry a create: the search above makes the next attempt safe
    const { error: saveErr } = await admin.from('orders').update({
      gelato_order_id: g.id, status: 'processing', fulfillment_error: mapStatus('paid', g).error,
      fulfillment_status: (g.fulfillmentStatus ?? 'created') + (lines.length < items.length ? ' (+ manual items)' : ''),
    }).eq('id', orderId)
    if (saveErr) throw saveErr
    return `Sent to Gelato (${g.id})`
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await admin.from('orders').update({ fulfillment_status: null, fulfillment_error: message.slice(0, 500) }).eq('id', orderId)
    throw e
  }
}
