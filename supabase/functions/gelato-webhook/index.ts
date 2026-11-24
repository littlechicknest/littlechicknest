// Gelato webhook: https://<project>.supabase.co/functions/v1/gelato-webhook?token=<gelato_webhook_token>
// The payload is only used to find the order; the status is re-read from Gelato, so a forged call can't change data.
import { refreshOrder } from '../_shared/gelato.ts'
import { admin, internalSecret, safeEqual } from '../_shared/util.ts'

const reply = (status: number, body: string) => new Response(body, { status })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed')
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const expected = await internalSecret('gelato_webhook_token')
  if (!expected || !safeEqual(token, expected)) return reply(401, 'Unauthorized')

  const raw = await req.text()
  if (raw.length > 100_000) return reply(413, 'Payload too large')
  let id: unknown
  try { id = JSON.parse(raw)?.orderId } catch { return reply(400, 'Expected JSON') }
  if (typeof id !== 'string') return reply(200, 'ignored')

  const { data: order } = await admin.from('orders').select('id,status,gelato_order_id,tracking_number').eq('gelato_order_id', id.slice(0, 60)).maybeSingle()
  if (!order) return reply(200, 'unknown order')
  try {
    await refreshOrder(order)
  } catch (e) {
    console.error('webhook sync', order.id, e instanceof Error ? e.message : e)
    return reply(502, 'sync failed') // let Gelato retry
  }
  return reply(200, 'ok')
})
