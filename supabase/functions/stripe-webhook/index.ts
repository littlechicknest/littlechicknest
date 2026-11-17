// Stripe -> marks orders paid (then sends them to Inkthreadable), handles expiry and refunds.
import Stripe from 'npm:stripe@17.7.0'
import { submitOrder } from '../_shared/inkthreadable.ts'
import { admin } from '../_shared/util.ts'

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const stripe = new Stripe(STRIPE_KEY || 'sk_unset', { httpClient: Stripe.createFetchHttpClient() })
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const reply = (status: number, body: string) => new Response(body, { status })

async function markPaid(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id
  if (!orderId || session.payment_status !== 'paid') return
  // newer API versions use collected_information.shipping_details, older ones shipping_details
  type Ship = { name?: string; address?: Stripe.Address }
  const loose = session as unknown as { collected_information?: { shipping_details?: Ship }; shipping_details?: Ship }
  const ship = loose.collected_information?.shipping_details ?? loose.shipping_details
  const addr = ship?.address
  // the status guard makes this idempotent: Stripe may deliver the same event more than once
  const { data, error } = await admin.from('orders').update({
    status: 'paid',
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    email: session.customer_details?.email ?? undefined,
    // the shop's own checkout page collects the address; only take Stripe's if it collected one
    ...(addr && { shipping_address: {
      name: ship?.name ?? session.customer_details?.name ?? '', line1: addr.line1, line2: addr.line2, city: addr.city,
      state: addr.state, postal_code: addr.postal_code, country: addr.country, phone: session.customer_details?.phone ?? '',
    } }),
    shipping_amount: (session.total_details?.amount_shipping ?? 0) / 100,
    total_amount: (session.amount_total ?? 0) / 100,
  }).eq('id', orderId).eq('stripe_session_id', session.id).eq('status', 'pending').select('id')
  if (error) throw error
  if (!data?.length) return // already processed or unknown session

  try {
    console.log(orderId, await submitOrder(orderId))
  } catch (e) {
    // payment is safe; the error is stored on the order and the hourly sync retries it
    console.error('inkthreadable submit failed', orderId, e instanceof Error ? e.message : e)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed')
  if (!STRIPE_KEY || !WEBHOOK_SECRET) return reply(503, 'Stripe not configured')
  const signature = req.headers.get('Stripe-Signature')
  if (!signature) return reply(400, 'Missing signature')

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, WEBHOOK_SECRET, undefined, cryptoProvider)
  } catch {
    return reply(400, 'Invalid signature')
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await markPaid(event.data.object)
        break
      case 'checkout.session.expired': {
        const s = event.data.object
        if (s.metadata?.order_id) await admin.from('orders').delete().eq('id', s.metadata.order_id).eq('status', 'pending')
        break
      }
      case 'charge.refunded': {
        const c = event.data.object
        const pi = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id
        if (pi && c.refunded) await admin.from('orders').update({ status: 'refunded' }).eq('stripe_payment_intent_id', pi)
        break
      }
    }
  } catch (e) {
    console.error('webhook handler', event.type, e instanceof Error ? e.message : e)
    return reply(500, 'Handler error') // Stripe retries
  }
  return reply(200, 'ok')
})
