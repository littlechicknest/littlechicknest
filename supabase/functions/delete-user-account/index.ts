// Self-service account deletion. Deleting the auth user cascades to profiles and reviews;
// orders keep their accounting record with user_id set to null.
import { admin, cors, fail, getUser, json } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return fail(req, 405, 'Method not allowed')

  const user = await getUser(req)
  if (!user) return fail(req, 401, 'Please sign in again.')

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role === 'admin') return fail(req, 403, 'Admin accounts must be removed by another admin in Supabase.')

  if (user.email) await admin.from('newsletter_subscribers').delete().eq('email', user.email.toLowerCase())
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('delete user', error.message)
    return fail(req, 500, 'Could not delete your account. Please contact us.')
  }
  return json(req, { ok: true })
})
