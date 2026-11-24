// Pulls order status/tracking from Gelato. Called every 15 minutes by pg_cron (Bearer cron_secret)
// or by an admin from the dashboard (user JWT). Also retries paid orders that never reached Gelato.
import { refreshOrder, submitOrder } from '../_shared/gelato.ts'
import { connectStripe } from '../_shared/stripe.ts'
import { admin, cors, fail, isCronOrAdmin, json } from '../_shared/util.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = { id: string; status: string; gelato_order_id: string | null; tracking_number: string | null }
const syncOne = async (o: Row) =>
  o.gelato_order_id ? refreshOrder({ ...o, gelato_order_id: o.gelato_order_id })
    : o.status === 'paid' ? submitOrder(o.id) : 'Not a Gelato order'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return fail(req, 405, 'Method not allowed')

  if (!(await isCronOrAdmin(req))) return fail(req, 403, 'Forbidden')
  await connectStripe().catch((e) => console.error('stripe setup', e instanceof Error ? e.message : e))

  const body = (await req.json().catch(() => ({}))) as { order_id?: unknown }
  const cols = 'id,status,gelato_order_id,tracking_number'

  if (body.order_id !== undefined) {
    if (typeof body.order_id !== 'string' || !UUID.test(body.order_id)) return fail(req, 400, 'Bad order id')
    const { data: o } = await admin.from('orders').select(cols).eq('id', body.order_id).maybeSingle()
    if (!o) return fail(req, 404, 'Order not found')
    try {
      return json(req, { message: await syncOne(o) })
    } catch (e) {
      return fail(req, 502, e instanceof Error ? e.message : 'Sync failed')
    }
  }

  // shortcut: 200 orders per run, oldest-updated first; page through if volume grows beyond that per run
  const { data: orders, error } = await admin.from('orders').select(cols)
    .in('status', ['paid', 'processing', 'printing', 'shipped'])
    .or('gelato_order_id.not.is.null,status.eq.paid') // manual-fulfilment orders have nothing to sync
    .eq('is_test', false) // test-mode orders are moved along by hand in the admin
    .order('updated_at').limit(200)
  if (error) return fail(req, 500, error.message)

  let ok = 0, failed = 0
  for (const o of orders ?? []) {
    try { await syncOne(o); ok++ } catch (e) {
      failed++
      console.error('sync', o.id, e instanceof Error ? e.message : e)
    }
  }
  // abandoned checkouts never paid: clear them out after 2 days
  await admin.from('orders').delete().eq('status', 'pending').lt('created_at', new Date(Date.now() - 2 * 864e5).toISOString())
  await admin.from('store_settings').update({ last_api_sync: new Date().toISOString() }).eq('id', 1)

  return json(req, { message: `Synced ${ok} order${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed (see order page)` : ''}.` })
})
