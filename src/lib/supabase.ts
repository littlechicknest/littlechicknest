import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.')

// PKCE puts auth results in ?code= instead of the URL hash, which HashRouter owns.
export const supabase = createClient<Database>(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Absolute URL of the app root, used for auth email / OAuth redirects. */
export const appUrl = () => window.location.origin + import.meta.env.BASE_URL

/** Edge Function errors carry the JSON body in `context`; surface its message. */
export async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
    } catch { /* not JSON */ }
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
