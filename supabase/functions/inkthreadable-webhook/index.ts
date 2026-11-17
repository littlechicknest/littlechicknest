// Inkthreadable webhook: https://<project>.supabase.co/functions/v1/inkthreadable-webhook?token=<inkthreadable_webhook_token>
// Inkthreadable doesn't sign webhooks, so the payload is only used to find the order;
// the actual status is re-read from the signed API, so a forged call can't change data.
import { getInkOrder, mapStatus } from '../_shared/inkthreadable.ts'
import { admin, internalSecret, safeEqual } from '../_shared/util.ts'

const reply = (status: number, body: string) => new Response(body, { status })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed')
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const expected = await internalSecret('inkthreadable_webhook_token')
  if (!expected || !safeEqual(token, expected)) return reply(401, 'Unauthorized')

  const raw = await req.text()
  if (raw.length > 100_000) return reply(413, 'Payload too large')
  let payload: Record<string, unknown>
  try { payload = JSON.parse(raw) } catch { return reply(400, 'Expected JSON') }

  const o = (payload.order ?? payload) as { id?: unknown; external_id?: unknown }
  const inkId = o.id != null ? String(o.id).slice(0, 40) : null
  const externalId = typeof o.external_id === 'string' && /^[0-9a-f-]{36}$/i.test(o.external_id) ? o.external_id : null
  if (!inkId && !externalId) return reply(200, 'ignored')

  let q = admin.from('orders').select('id,status,inkthreadable_order_id,tracking_number')
  q = inkId ? q.eq('inkthreadable_order_id', inkId) : q.eq('id', externalId!)
  const { data: order } = await q.maybeSingle()
  if (!order?.inkthreadable_order_id) return reply(200, 'unknown order')

  try {
    const ink = await getInkOrder(order.inkthreadable_order_id)
    const { status, tracking } = mapStatus(order.status, ink)
    await admin.from('orders').update({
      fulfillment_status: ink.status ?? null,
      ...(status !== order.status && { status }),
      ...(tracking && tracking !== order.tracking_number && { tracking_number: tracking }),
    }).eq('id', order.id)
  } catch (e) {
    console.error('webhook sync', order.id, e instanceof Error ? e.message : e)
    return reply(502, 'sync failed') // let Inkthreadable retry
  }
  return reply(200, 'ok')
})
