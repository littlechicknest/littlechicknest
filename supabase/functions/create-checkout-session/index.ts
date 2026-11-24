// Creates a pending order priced from the database (never from the browser) and a Stripe Checkout Session.
import { isLiveKey, stripe, STRIPE_KEY, webhookSecret } from '../_shared/stripe.ts'
import { admin, cors, fail, getUser, json, round2, SITE_URL, skuPrice } from '../_shared/util.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// shortcut: fixed list of destinations; extend when Gelato shipping to more countries is confirmed
const COUNTRIES = ['US', 'GB', 'IE', 'CA', 'AU', 'NZ', 'DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'PT', 'AT', 'DK', 'SE', 'NO', 'FI', 'PL', 'CH'] as const

type In = { product_id: string; color: string | null; size: string | null; quantity: number }

function parseItems(body: unknown): In[] | null {
  const items = (body as { items?: unknown })?.items
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return null
  const out: In[] = []
  for (const raw of items) {
    const i = raw as Record<string, unknown>
    const str = (v: unknown, max: number) => (v == null ? null : typeof v === 'string' && v.length <= max ? v : undefined)
    const color = str(i.color, 60), size = str(i.size, 80)
    if (typeof i.product_id !== 'string' || !UUID.test(i.product_id) || color === undefined || size === undefined) return null
    if (!Number.isInteger(i.quantity) || (i.quantity as number) < 1 || (i.quantity as number) > 20) return null
    out.push({ product_id: i.product_id, color, size, quantity: i.quantity as number })
  }
  return out
}

type Address = { name: string; line1: string; line2: string; city: string; state: string; postal_code: string; country: string; phone: string }

function parseAddress(body: unknown): Address | null {
  const a = (body as { address?: Record<string, unknown> })?.address
  if (!a || typeof a !== 'object') return null
  const s = (k: string) => (typeof a[k] === 'string' ? (a[k] as string).trim().slice(0, 120) : '')
  const out = { name: s('name'), line1: s('line1'), line2: s('line2'), city: s('city'), state: s('state'), postal_code: s('postal_code'), country: s('country').toUpperCase(), phone: s('phone') }
  if (!out.name || !out.line1 || !out.city || !out.postal_code || !(COUNTRIES as readonly string[]).includes(out.country)) return null
  if (['US', 'CA', 'AU'].includes(out.country) && !/^[A-Za-z]{2,3}$/.test(out.state)) return null // carriers need the state code
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return fail(req, 405, 'Method not allowed')
  if (!STRIPE_KEY || !(await webhookSecret())) return fail(req, 503, 'Online payments are being set up. Please check back very soon!')

  const user = await getUser(req)
  if (!user) return fail(req, 401, 'Please sign in to check out.')

  const body = await req.json().catch(() => null)
  const items = parseItems(body)
  if (!items) return fail(req, 400, 'Your basket looks invalid. Please refresh and try again.')
  const address = parseAddress(body)
  if (!address) return fail(req, 400, 'Please complete your shipping address.')
  const method = (body as { shipping_method?: unknown })?.shipping_method === 'express' ? 'express' : 'standard'

  const [{ data: products, error }, { data: settings }] = await Promise.all([
    admin.from('products').select('id,title,source,manual_price,skus,variants,images,is_active').in('id', [...new Set(items.map((i) => i.product_id))]),
    admin.from('store_settings').select('global_margin_percent,checkout_mode').eq('id', 1).single(),
  ])
  if (error || !settings) return fail(req, 500, 'Could not load products.')
  if (settings.checkout_mode !== 'live') return fail(req, 409, 'The shop is in test mode. Card payments are switched on from Admin > Settings.')
  const byId = new Map((products ?? []).map((p) => [p.id, p]))

  const lines = []
  for (const it of items) {
    const p = byId.get(it.product_id)
    if (!p || !p.is_active) return fail(req, 409, 'An item in your basket is no longer available. Please remove it and try again.')
    const variants = (p.variants ?? []) as { color: string; sizes: string[]; images: string[] }[]
    const variant = variants.find((v) => v.color === it.color)
    if (variants.length && !variant) return fail(req, 409, `Please choose a colour for ${p.title}.`)
    if (!variants.length && it.color) return fail(req, 400, 'Invalid colour.')
    const sizes = variant?.sizes ?? []
    if (sizes.length ? !it.size || !sizes.includes(it.size) : it.size) return fail(req, 409, `Please choose a valid size for ${p.title}.`)
    const unit = skuPrice(p, it.color, it.size, settings.global_margin_percent)
    if (!(unit > 0)) return fail(req, 409, `${p.title} is no longer available in that option. Please remove it and try again.`)
    const image = variant?.images?.[0] ?? (p.images as string[])[0] ?? variants[0]?.images?.[0] ?? null
    lines.push({ product_id: p.id, title: p.title, color: it.color, size: it.size, quantity: it.quantity, unit_price: unit, image })
  }

  const subtotal = round2(lines.reduce((n, l) => n + l.unit_price * l.quantity, 0))
  const { data: shipCost, error: shipErr } = await admin.rpc('shipping_cost', { p_subtotal: subtotal, p_method: method })
  if (shipErr) return fail(req, 500, 'Could not work out shipping.')
  const shipping = round2(Number(shipCost))
  const { data: order, error: insErr } = await admin.from('orders').insert({
    user_id: user.id, email: user.email, items: lines, subtotal, shipping_amount: shipping, shipping_method: method,
    shipping_address: address, total_amount: round2(subtotal + shipping), currency: 'usd', status: 'pending', is_test: !isLiveKey,
  }).select('id').single()
  if (insErr || !order) return fail(req, 500, 'Could not create your order.')

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: order.id,
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } },
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(l.unit_price * 100),
          product_data: {
            name: l.title,
            ...([l.color, l.size].some(Boolean) && { description: [l.color, l.size].filter(Boolean).join(' / ') }),
            ...(l.image?.startsWith('https://') && { images: [l.image] }),
          },
        },
      })),
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: method === 'express' ? 'Express delivery' : shipping > 0 ? 'Standard delivery' : 'Free standard delivery',
          fixed_amount: { amount: Math.round(shipping * 100), currency: 'usd' },
        },
      }],
      success_url: `${SITE_URL}#/checkout/success?order=${order.id}`,
      cancel_url: `${SITE_URL}#/checkout`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    }, { idempotencyKey: `checkout-${order.id}` })

    await admin.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)
    return json(req, { url: session.url })
  } catch (e) {
    console.error('stripe', e instanceof Error ? e.message : e)
    await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')
    return fail(req, 502, 'Could not start secure checkout. Please try again.')
  }
})
