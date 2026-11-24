import Stripe from 'npm:stripe@17.7.0'
import { admin, internalSecret } from './util.ts'

export const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
/** Test keys (sk_test_…) take no real money, so their orders must never be printed. */
export const isLiveKey = /^[sr]k_live_/.test(STRIPE_KEY)
export const stripe = new Stripe(STRIPE_KEY || 'sk_unset', { httpClient: Stripe.createFetchHttpClient() })

const SECRET_NAME = isLiveKey ? 'stripe_webhook_live' : 'stripe_webhook_test'
export const webhookSecret = async () => Deno.env.get('STRIPE_WEBHOOK_SECRET') || (await internalSecret(SECRET_NAME))

/**
 * First run after STRIPE_SECRET_KEY is added: registers the webhook with Stripe and switches checkout to live.
 * Runs once per key type, so an admin can still switch back to test mode afterwards.
 * shortcut: a key from a different Stripe account reuses the old webhook secret; delete it from Vault to re-register.
 */
export async function connectStripe(): Promise<void> {
  if (!STRIPE_KEY || (await webhookSecret())) return
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`
  // a half-finished earlier attempt leaves an endpoint whose secret can't be read again
  for (const w of (await stripe.webhookEndpoints.list({ limit: 100 })).data) if (w.url === url) await stripe.webhookEndpoints.del(w.id)
  const hook = await stripe.webhookEndpoints.create({
    url, enabled_events: ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired', 'charge.refunded'],
  })
  const { error } = await admin.rpc('store_internal_secret', { p_name: SECRET_NAME, p_value: hook.secret })
  if (error) throw error
  await admin.from('store_settings').update({ checkout_mode: 'live' }).eq('id', 1)
}
