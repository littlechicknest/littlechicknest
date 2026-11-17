import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2'

export const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://littlechicknest.github.io/littlechicknest/').replace(/\/?$/, '/')

const ALLOWED_ORIGINS = new Set([
  new URL(SITE_URL).origin,
  'http://localhost:5173',
  'http://localhost:4173',
  ...(Deno.env.get('EXTRA_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
])

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : new URL(SITE_URL).origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })

export const fail = (req: Request, status: number, error: string) => json(req, { error }, status)

/** Service-role client: bypasses RLS, so only use it after authorising the caller. */
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export async function getUser(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user ?? null
}

export async function isAdminUser(user: User | null): Promise<boolean> {
  if (!user) return false
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin'
}

/** Constant-time string compare for shared-secret tokens. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

export async function internalSecret(name: 'cron_secret' | 'inkthreadable_webhook_token'): Promise<string | null> {
  const { data, error } = await admin.rpc('internal_secret', { p_name: name })
  if (error) console.error('internal_secret', error.message)
  return (data as string | null) ?? null
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Same formula as public.product_price() in SQL. */
export const productPrice = (p: { source: string; base_price: number | null; manual_price: number | null }, margin: number) =>
  p.source === 'manual' ? round2(Number(p.manual_price)) : round2(Number(p.base_price) * (1 + margin / 100))
