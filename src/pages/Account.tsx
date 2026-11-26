import { Eye, EyeOff, Heart, KeyRound, LayoutDashboard, LogOut, MapPin, Package, Pencil, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AddressBlock, OrderProgress, StatusBadge, TestBadge } from '../components/orders'
import { Alert, Breadcrumbs, Field, Spinner, toast, useTitle } from '../components/ui'
import { useAuth } from '../context/auth'
import { useCart } from '../context/cart'
import { useWishlist } from '../context/wishlist'
import type { Json, Tables } from '../lib/database.types'
import { asAddress, asItems, COUNTRIES, EMPTY_ADDRESS, formatDate, formatUsd, imgSrc, orderNumber, type Address } from '../lib/shop'
import { functionError, supabase } from '../lib/supabase'

const TABS = [
  { to: '/account', label: 'Overview', icon: LayoutDashboard },
  { to: '/orders', label: 'My orders', icon: Package },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/profile', label: 'Profile details', icon: UserRound },
  { to: '/account/password', label: 'Password', icon: KeyRound },
  { to: '/account/delete', label: 'Delete account', icon: Trash2 },
]

/** Shared frame for every account page: side menu on desktop, scrollable tabs on phones. */
export function AccountShell({ title, children, crumbs }: { title: string; children: ReactNode; crumbs?: [string, string?][] }) {
  const { pathname } = useLocation()
  const { session, profile, signOut } = useAuth()
  const isActive = (to: string) => (to === '/account' ? pathname === to : pathname.startsWith(to))
  return (
    <div className="container-x py-6 sm:py-8">
      <Breadcrumbs items={[['My account', '/account'], ...(crumbs ?? (pathname === '/account' ? [] : [[title] as [string]]))]} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="no-print">
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <span className="grid size-11 place-items-center rounded-full bg-orange font-display text-lg font-bold text-white">{(profile?.full_name || session?.user.email || '?')[0].toUpperCase()}</span>
            <div className="min-w-0"><p className="truncate font-semibold text-olive">{profile?.full_name || 'Welcome'}</p><p className="truncate text-xs text-muted">{session?.user.email}</p></div>
          </div>
          <nav aria-label="Account" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {TABS.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} aria-current={isActive(to) ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-3.5 py-2.5 text-[13px] font-medium transition ${isActive(to) ? 'bg-orange text-white' : 'text-ink hover:bg-orange-soft hover:text-orange-2'}`}>
                <Icon className="size-4" aria-hidden />{label}
              </Link>
            ))}
            <button type="button" onClick={signOut} className="flex shrink-0 items-center gap-2.5 rounded-md px-3.5 py-2.5 text-[13px] font-medium text-muted hover:bg-cream-2 hover:text-olive lg:mt-2 lg:border-t lg:border-line lg:pt-4">
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </nav>
        </aside>
        <section aria-labelledby="acc-title" className="min-w-0">
          <h1 id="acc-title" className="mb-6 text-3xl">{title}</h1>
          {children}
        </section>
      </div>
    </div>
  )
}

type Order = Tables<'orders'>
const LIST_COLS = 'id,created_at,status,total_amount,items,is_test,shipping_method,tracking_number'

export function Account() {
  useTitle('My account')
  const { session, profile } = useAuth()
  const { ids } = useWishlist()
  const [orders, setOrders] = useState<Order[] | null>(null)
  useEffect(() => {
    supabase.from('orders').select(LIST_COLS).neq('status', 'pending').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setOrders((data ?? []) as Order[]))
  }, [])
  const first = profile?.full_name?.split(' ')[0]
  const active = orders?.filter((o) => ['paid', 'processing', 'printing', 'shipped'].includes(o.status)).length ?? 0
  const latest = orders?.[0]
  const stats: [string, string | number, string][] = [
    ['Orders', orders?.length ?? '–', '/orders'],
    ['On the way', orders ? active : '–', '/orders?filter=active'],
    ['Wishlist', ids.length, '/wishlist'],
  ]

  return (
    <AccountShell title={`Hello${first ? `, ${first}` : ''}!`}>
      <p className="-mt-4 mb-6 text-muted">Signed in as {session?.user.email}. Here’s what’s happening with your orders.</p>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map(([label, value, to]) => (
          <Link key={label} to={to} className="card p-4 transition hover:shadow-[var(--shadow-lift)] sm:p-5">
            <p className="text-2xl font-semibold text-olive sm:text-3xl">{value}</p>
            <p className="text-xs text-muted sm:text-sm">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg">Latest order</h2>{latest && <Link to="/orders" className="btn-link">All orders</Link>}</div>
          {!orders ? <Spinner /> : !latest ? (
            <div className="py-6 text-center"><p className="text-muted">You haven’t ordered anything yet.</p><Link to="/shop" className="btn-primary mt-4">Start shopping</Link></div>
          ) : (
            <Link to={`/orders/${latest.id}`} className="block rounded-xl border border-line p-4 transition hover:border-sand hover:bg-cream/50">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold text-olive">{orderNumber(latest.id)}</p><p className="text-xs text-muted">{formatDate(latest.created_at)} · {formatUsd(latest.total_amount)}</p></div>
                <div className="flex gap-2">{latest.is_test && <TestBadge />}<StatusBadge status={latest.status} /></div>
              </div>
              <OrderProgress status={latest.status} compact />
              <div className="mt-4 flex -space-x-2">
                {asItems(latest.items).slice(0, 5).map((it, i) => { const img = imgSrc(it.image); return <span key={i} className="size-10 overflow-hidden rounded-full border-2 border-paper bg-cream-2">{img && <img src={img} alt="" className="size-full object-cover" />}</span> })}
              </div>
            </Link>
          )}
        </div>
        <div className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg">Default address</h2><Link to="/account/addresses" className="text-muted hover:text-orange-2" aria-label="Edit address"><Pencil className="size-4" aria-hidden /></Link></div>
          <AddressBlock value={profile?.default_address ?? null} />
          {!asAddress(profile?.default_address)?.line1 && <Link to="/account/addresses" className="btn-ghost mt-4 w-full">Add an address</Link>}
        </div>
      </div>
    </AccountShell>
  )
}

export function Addresses() {
  useTitle('Addresses')
  const { session, profile, refreshProfile } = useAuth()
  const saved = asAddress(profile?.default_address)
  const [editing, setEditing] = useState(!saved?.line1)
  const [a, setA] = useState<Address>(saved ?? { ...EMPTY_ADDRESS, name: profile?.full_name ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof Address) => (e: { target: { value: string } }) => setA((x) => ({ ...x, [k]: e.target.value }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const clean = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.trim()])) as Address
    const { error } = await supabase.from('profiles').update({ default_address: clean as unknown as Json }).eq('id', session!.user.id)
    setBusy(false)
    if (error) return setError('Could not save your address. Please try again.')
    await refreshProfile()
    setEditing(false)
    toast('Address saved')
  }
  const remove = async () => {
    await supabase.from('profiles').update({ default_address: null }).eq('id', session!.user.id)
    await refreshProfile()
    setA({ ...EMPTY_ADDRESS, name: profile?.full_name ?? '' })
    setEditing(true)
    toast('Address removed')
  }

  return (
    <AccountShell title="Addresses">
      <p className="-mt-4 mb-6 text-muted">Your default address is filled in for you at checkout.</p>
      {!editing && saved ? (
        <div className="card max-w-md p-6">
          <span className="mb-3 inline-block rounded-full bg-orange-soft px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-orange-2 uppercase">Default</span>
          <AddressBlock value={profile?.default_address ?? null} />
          <div className="mt-5 flex gap-2"><button type="button" onClick={() => setEditing(true)} className="btn-dark">Edit</button><button type="button" onClick={remove} className="btn-ghost">Remove</button></div>
        </div>
      ) : (
        <form onSubmit={save} className="card max-w-2xl space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Full name"><input className="input" required maxLength={120} autoComplete="name" value={a.name} onChange={set('name')} /></Field></div>
            <div className="sm:col-span-2"><Field label="Country"><select className="input" value={a.country} onChange={set('country')} autoComplete="country">{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></Field></div>
            <div className="sm:col-span-2"><Field label="Address"><input className="input" required maxLength={120} autoComplete="address-line1" value={a.line1} onChange={set('line1')} /></Field></div>
            <div className="sm:col-span-2"><Field label="Apartment, suite, etc." optional><input className="input" maxLength={120} autoComplete="address-line2" value={a.line2} onChange={set('line2')} /></Field></div>
            <Field label="City"><input className="input" required maxLength={80} autoComplete="address-level2" value={a.city} onChange={set('city')} /></Field>
            <Field label={a.country === 'US' ? 'State' : 'County / region'} optional><input className="input" maxLength={80} autoComplete="address-level1" value={a.state} onChange={set('state')} /></Field>
            <Field label={a.country === 'US' ? 'ZIP code' : 'Postcode'}><input className="input" required maxLength={12} autoComplete="postal-code" value={a.postal_code} onChange={set('postal_code')} /></Field>
            <Field label="Phone" optional><input className="input" type="tel" maxLength={20} autoComplete="tel" value={a.phone} onChange={set('phone')} /></Field>
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>{saved && <button type="button" onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>}</div>
        </form>
      )}
    </AccountShell>
  )
}

export function Profile() {
  useTitle('Profile details')
  const { session, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = name.trim() !== (profile?.full_name ?? '') || phone.trim() !== (profile?.phone ?? '')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', session!.user.id)
    setBusy(false)
    if (error) return setError('Could not save. Please try again.')
    await refreshProfile()
    toast('Profile updated')
  }
  const google = session?.user.app_metadata?.provider === 'google'
  return (
    <AccountShell title="Profile details">
      <form onSubmit={save} className="card max-w-xl space-y-4 p-6">
        <Field label="Full name"><input className="input" maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" hint={google ? 'You sign in with Google.' : 'Contact us if you need to change your email.'}><input className="input bg-cream-2/60" value={session?.user.email ?? ''} readOnly /></Field>
        <Field label="Phone" optional><input className="input" type="tel" maxLength={20} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <p className="text-xs text-muted">Member since {profile ? formatDate(profile.created_at) : '–'}</p>
        {error && <Alert>{error}</Alert>}
        <button className="btn-primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </AccountShell>
  )
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative block">
      <input {...props} type={show ? 'text' : 'password'} className="input pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-olive">
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </span>
  )
}

/** Used both for signed-in password change and after a reset-link sign-in. */
export function ChangePassword({ recovery = false }: { recovery?: boolean }) {
  useTitle(recovery ? 'Set a new password' : 'Change password')
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const strength = [pw.length >= 8, /[A-Z]/.test(pw) && /[a-z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) return setMsg({ tone: 'error', text: 'Passwords don’t match.' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg({ tone: 'error', text: error.message })
    setMsg({ tone: 'success', text: 'Password updated.' })
    setPw(''); setPw2('')
    if (recovery) setTimeout(() => navigate('/account'), 1200)
  }

  const form = (
    <form onSubmit={submit} className="card max-w-md space-y-4 p-6">
      <Field label="New password" hint="At least 8 characters. A mix of letters, numbers and symbols is strongest.">
        <PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      {pw && (
        <div aria-live="polite">
          <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < strength ? ['bg-red-400', 'bg-orange', 'bg-yolk', 'bg-leaf'][strength - 1] : 'bg-sand'}`} />)}</div>
          <p className="mt-1 text-xs text-muted">{['Too weak', 'Weak', 'Good', 'Strong'][Math.max(0, strength - 1)]}</p>
        </div>
      )}
      <Field label="Confirm new password" error={pw2 && pw !== pw2 ? 'Passwords don’t match' : null}>
        <PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
    </form>
  )
  if (recovery) return <div className="container-x py-10"><h1 className="mb-6 text-3xl">Set a new password</h1>{form}</div>
  return <AccountShell title="Change password">{form}</AccountShell>
}

export function DeleteAccount() {
  useTitle('Delete account')
  const { session } = useAuth()
  const { clear } = useCart()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.functions.invoke('delete-user-account', { method: 'POST' })
    if (error) {
      setError(await functionError(error))
      return setBusy(false)
    }
    clear()
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/', { replace: true })
  }

  return (
    <AccountShell title="Delete your account">
      <div className="max-w-xl space-y-5">
        <div className="card p-6 text-sm text-ink/85">
          <p className="mb-3 font-semibold text-olive">What happens when you delete your account</p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-orange">
            <li>Your login, profile, saved address and reviews are permanently deleted.</li>
            <li>You’ll be signed out on this device straight away.</li>
            <li>We keep a minimal record of past orders, without your account link, because tax law requires it.</li>
            <li>This can’t be undone. You’re welcome to create a new account later.</li>
          </ul>
        </div>
        <form onSubmit={submit} className="card space-y-4 border-red-200 p-6">
          <p className="text-sm">Signed in as <strong>{session?.user.email}</strong></p>
          <Field label='Type "DELETE" to confirm'><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
          {error && <Alert>{error}</Alert>}
          <button className="btn w-full bg-red-700 text-white hover:bg-red-800" disabled={busy || confirm !== 'DELETE'}>{busy ? 'Deleting…' : 'Permanently delete my account'}</button>
        </form>
      </div>
    </AccountShell>
  )
}
