import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Alert, Field, useTitle } from '../components/ui'
import { useAuth } from '../context/auth'
import { appUrl, supabase } from '../lib/supabase'
import { PasswordInput } from './Account'

type Mode = 'signin' | 'signup' | 'forgot'

/** Only allow in-app paths as redirect targets (no //evil.com). */
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account')

const PERKS = ['Track every order from print room to door', 'Faster checkout with your saved address', 'Leave reviews on things you’ve bought']

export default function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  useTitle(mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in')

  if (session) return <Navigate to={next} replace />

  const switchTo = (m: Mode) => { setMode(m); setMsg(null) }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const mail = email.trim()
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (error) setMsg({ tone: 'error', text: error.message === 'Email not confirmed' ? 'Please confirm your email first. Check your inbox.' : 'That email and password don’t match. Try again or reset your password.' })
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: mail, password, options: { data: { full_name: name.trim() }, emailRedirectTo: appUrl() },
      })
      if (error) setMsg({ tone: 'error', text: error.message })
      else if (!data.session) setMsg({ tone: 'success', text: `Almost there! We’ve sent a confirmation link to ${mail}. Click it, then sign in.` })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: appUrl() })
      // same message either way so the form can't be used to discover accounts
      setMsg(error?.status === 429
        ? { tone: 'error', text: 'Too many attempts. Please wait a minute and try again.' }
        : { tone: 'success', text: 'If an account exists for that email, a reset link is on its way.' })
    }
    setBusy(false)
  }

  const google = async () => {
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } })
    if (error) setMsg({ tone: 'error', text: 'Google sign-in is not available yet. Please use email and password.' })
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-[var(--shadow-soft)] md:grid-cols-2">
        <div className="relative hidden md:block">
          <img src={`${import.meta.env.BASE_URL}banners/login-hoodie.webp`} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-olive/85 via-olive/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white">
            <p className="script text-3xl text-yolk">Welcome to the nest</p>
            <ul className="mt-3 space-y-2 text-sm">
              {PERKS.map((p) => <li key={p} className="flex items-center gap-2"><Check className="size-4 text-yolk" aria-hidden />{p}</li>)}
            </ul>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {mode !== 'forgot' && (
            <div role="tablist" className="mb-7 grid grid-cols-2 rounded-full bg-cream-2 p-1 text-[13px] font-semibold">
              {(['signin', 'signup'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchTo(m)}
                  className={`rounded-full py-2.5 transition ${mode === m ? 'bg-paper text-olive shadow-sm' : 'text-muted hover:text-olive'}`}>{m === 'signin' ? 'Sign in' : 'Create account'}</button>
              ))}
            </div>
          )}
          <h1 className="text-[1.9rem]">{mode === 'signup' ? 'Join our little nest' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">
            {mode === 'forgot' ? 'Enter your email and we’ll send you a link to choose a new password.' : mode === 'signup' ? 'It takes less than a minute.' : 'Sign in to track orders and check out faster.'}
          </p>

          {mode !== 'forgot' && (
            <>
              <button type="button" onClick={google} className="btn-ghost w-full normal-case tracking-normal">
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8.1z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8c.9-2.6 3.4-4.5 6.3-4.5z" /></svg>
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && <Field label="Full name"><input className="input" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>}
            <Field label="Email"><input className="input" type="email" required maxLength={254} autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {mode !== 'forgot' && (
              <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                <PasswordInput required minLength={mode === 'signup' ? 8 : 1} maxLength={72} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            )}
            {mode === 'signin' && <div className="-mt-1 text-right"><button type="button" onClick={() => switchTo('forgot')} className="text-[13px] font-medium text-olive underline underline-offset-2 hover:text-orange-2">Forgot password?</button></div>}
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>
          </form>

          {mode === 'forgot' && <p className="mt-5 text-center text-sm"><button type="button" onClick={() => switchTo('signin')} className="font-semibold text-orange-2 underline">Back to sign in</button></p>}
          {mode === 'signup' && (
            <p className="mt-5 text-center text-xs text-muted">
              By creating an account you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy-policy" className="underline">Privacy Policy</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
