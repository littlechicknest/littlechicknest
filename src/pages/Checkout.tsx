import { CheckCircle2, ChevronLeft, CreditCard, FlaskConical, Lock, Mail, Package, ShieldCheck, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FreeShippingBar } from '../components/CartDrawer'
import { AddressBlock, ItemRow, OrderProgress, TestBadge } from '../components/orders'
import { Alert, Empty, Field, Spinner, useTitle } from '../components/ui'
import { useAuth } from '../context/auth'
import { useCart } from '../context/cart'
import type { Json, Tables } from '../lib/database.types'
import {
  asAddress, asItems, COUNTRIES, deliveryWindow, EMPTY_ADDRESS, formatMoney, formatUsd, orderNumber, productImage, shippingCost, type Address,
} from '../lib/shop'
import { functionError, supabase } from '../lib/supabase'
import { useCurrency } from '../lib/currency'
import { useShopConfig } from '../lib/useProducts'

type Method = 'standard' | 'express'
const REQUIRED: (keyof Address)[] = ['name', 'line1', 'city', 'postal_code', 'country']
// carriers need the state code in these countries (same rule as create-checkout-session)
const STATE_CODE = ['US', 'CA', 'AU']
const STEPS = ['Basket', 'Details', 'Payment', 'Done']

function Steps({ at }: { at: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs font-medium sm:gap-3" aria-label="Checkout steps">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2 sm:gap-3" aria-current={i === at ? 'step' : undefined}>
          <span className={`flex items-center gap-1.5 ${i <= at ? 'text-olive' : 'text-muted'}`}>
            <span className={`grid size-6 place-items-center rounded-full text-[11px] ${i < at ? 'bg-olive text-white' : i === at ? 'bg-orange text-white' : 'bg-sand/70'}`}>{i + 1}</span>
            <span className={i === at ? 'font-semibold' : 'hidden sm:inline'}>{s}</span>
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-sand sm:w-10" />}
        </li>
      ))}
    </ol>
  )
}

export default function Checkout() {
  useTitle('Checkout')
  const { session, profile, refreshProfile, loading: authLoading } = useAuth()
  const { rows, subtotal, clear, setOpen } = useCart()
  const cfg = useShopConfig()
  const cur = useCurrency()
  const navigate = useNavigate()
  const [addr, setAddr] = useState<Address>(EMPTY_ADDRESS)
  const [touched, setTouched] = useState<Partial<Record<keyof Address, boolean>>>({})
  const [method, setMethod] = useState<Method>('standard')
  const [save, setSave] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefilled = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  // prefill from the saved address, otherwise the last order's address
  useEffect(() => {
    if (!session || prefilled.current || authLoading) return
    prefilled.current = true
    const saved = asAddress(profile?.default_address)
    if (saved?.line1) { setAddr({ ...saved, phone: saved.phone || profile?.phone || '' }); return }
    setAddr((a) => ({ ...a, name: profile?.full_name ?? '', phone: profile?.phone ?? '' }))
    supabase.from('orders').select('shipping_address').eq('user_id', session.user.id).not('shipping_address', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { const a = asAddress(data?.shipping_address); if (a?.line1) setAddr(a) })
  }, [session, profile, authLoading])

  const shipping = cfg ? shippingCost(cfg, subtotal, method) : 0
  const total = subtotal + shipping
  const errors = useMemo(() => {
    const e: Partial<Record<keyof Address, string>> = {}
    for (const k of REQUIRED) if (!addr[k].trim()) e[k] = 'Required'
    if (addr.postal_code && !/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}$/.test(addr.postal_code.trim())) e.postal_code = 'Check your postcode'
    if (STATE_CODE.includes(addr.country) && !/^[A-Za-z]{2,3}$/.test(addr.state.trim())) e.state = 'Use the short code, e.g. CA or NSW'
    if (addr.phone && !/^[+()\d\s-]{6,20}$/.test(addr.phone.trim())) e.phone = 'Check your phone number'
    return e
  }, [addr])

  const set = (k: keyof Address) => (e: { target: { value: string } }) => setAddr((a) => ({ ...a, [k]: e.target.value }))
  const blur = (k: keyof Address) => () => setTouched((t) => ({ ...t, [k]: true }))
  const err = (k: keyof Address) => (touched[k] ? errors[k] : undefined)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (Object.keys(errors).length) {
      setTouched(Object.fromEntries(Object.keys(addr).map((k) => [k, true])))
      const first = (Object.keys(errors) as (keyof Address)[])[0]
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    if (!cfg) return
    setBusy(true)
    const clean = Object.fromEntries(Object.entries(addr).map(([k, v]) => [k, v.trim()])) as Address
    if (save) {
      await supabase.from('profiles').update({ default_address: clean as unknown as Json, phone: clean.phone || null }).eq('id', session!.user.id)
      void refreshProfile()
    }
    const items = rows.map(({ product_id, color, size, quantity }) => ({ product_id, color, size, quantity }))

    if (cfg.checkout_mode === 'test') {
      const { data, error } = await supabase.rpc('place_test_order', { p_items: items as unknown as Json, p_address: clean as unknown as Json, p_shipping_method: method })
      if (error || !data) { setBusy(false); return setError(error?.message ?? 'Could not place your order.') }
      clear()
      navigate(`/checkout/success?order=${data}`, { replace: true })
      return
    }
    const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout-session', { body: { items, address: clean, shipping_method: method } })
    if (error || !data?.url) { setBusy(false); return setError(error ? await functionError(error) : 'Could not start checkout.') }
    // only ever leave the site for Stripe's hosted checkout
    if (!/^https:\/\/checkout\.stripe\.com\//.test(data.url)) { setBusy(false); return setError('Unexpected checkout address.') }
    window.location.assign(data.url)
  }

  if (!rows.length && !busy) {
    return (
      <div className="container-x py-10">
        <Steps at={0} />
        <Empty title="Your basket is empty"><p>Add something you love and come back here to check out.</p><Link to="/shop" className="btn-primary mt-4">Start shopping</Link></Empty>
      </div>
    )
  }

  const summary = (
    <aside className="lg:sticky lg:top-24" aria-label="Order summary">
      <div className="card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg">Order summary</h2>
          <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-medium text-orange-2 underline underline-offset-2">Edit basket</button>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const img = productImage(r.product, r.color, r.size)
            return (
              <li key={r.key} className="flex items-center gap-3 py-3">
                <span className="relative size-16 shrink-0 rounded-lg border border-line bg-paper">
                  {img && <img src={img} alt="" className="size-full rounded-lg object-cover" />}
                  <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-olive text-[10px] font-semibold text-white">{r.quantity}</span>
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.product.title}</span><span className="text-xs text-muted">{[r.color, r.size].filter(Boolean).join(' · ')}</span></span>
                <span className="text-sm font-semibold">{formatUsd(r.price * r.quantity)}</span>
              </li>
            )
          })}
        </ul>
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatUsd(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Delivery ({method})</dt><dd>{shipping === 0 ? <span className="font-semibold text-leaf">Free</span> : formatUsd(shipping)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-olive"><dt>Total</dt><dd className="text-right">{formatUsd(total)} <span className="text-xs font-normal text-muted">USD</span>{cur === 'GBP' && <span className="block text-xs font-normal text-muted">about {formatMoney(total)}</span>}</dd></div>
        </dl>
        {method === 'standard' && <div className="mt-4 rounded-lg bg-cream-2 p-3"><FreeShippingBar subtotal={subtotal} /></div>}
      </div>
      <ul className="mt-4 space-y-2 px-1 text-[13px] text-muted">
        <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-olive" aria-hidden /> Secure, encrypted checkout by Stripe</li>
        <li className="flex items-center gap-2"><Package className="size-4 text-olive" aria-hidden /> Printed to order, less waste</li>
        <li className="flex items-center gap-2"><Mail className="size-4 text-olive" aria-hidden /> Questions? <Link to="/contact" className="underline">Contact us</Link></li>
      </ul>
    </aside>
  )

  return (
    <div className="container-x py-6 sm:py-8">
      <Link to="/shop" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-olive hover:text-orange-2"><ChevronLeft className="size-4" aria-hidden /> Continue shopping</Link>
      <h1 className="mb-4 text-3xl sm:text-4xl">Checkout</h1>
      <Steps at={1} />
      {cfg?.checkout_mode === 'test' && (
        <div className="mb-6"><Alert tone="info"><strong>Preview mode.</strong> Card payments aren’t switched on yet, so orders placed here are test orders. No money is taken and nothing is sent to print.</Alert></div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div className="order-2 lg:order-1">
          {authLoading ? <Spinner /> : !session ? (
            <div className="card p-6 sm:p-8">
              <p className="script text-2xl">Almost there</p>
              <h2 className="text-2xl">Sign in to check out</h2>
              <p className="mt-2 text-muted">An account lets you track your order from the print room to your door, and saves your address for next time. It takes under a minute.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login?next=/checkout" className="btn-primary">Sign in</Link>
                <Link to="/login?next=/checkout&mode=signup" className="btn-ghost">Create an account</Link>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} noValidate className="space-y-6">
              <section className="card p-5 sm:p-6" aria-labelledby="h-contact">
                <h2 id="h-contact" className="mb-4 flex items-center gap-2 text-lg"><span className="grid size-7 place-items-center rounded-full bg-olive font-sans text-xs text-white">1</span> Contact</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" hint="Your receipt and updates go here."><input className="input bg-cream-2/60" value={session.user.email ?? ''} readOnly /></Field>
                  <Field label="Phone" optional hint="Only used by the courier if needed." error={err('phone')}>
                    <input name="phone" className="input" type="tel" autoComplete="tel" maxLength={20} value={addr.phone} onChange={set('phone')} onBlur={blur('phone')} aria-invalid={!!err('phone')} />
                  </Field>
                </div>
              </section>

              <section className="card p-5 sm:p-6" aria-labelledby="h-ship">
                <h2 id="h-ship" className="mb-4 flex items-center gap-2 text-lg"><span className="grid size-7 place-items-center rounded-full bg-olive font-sans text-xs text-white">2</span> Shipping address</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label="Full name" error={err('name')}><input name="name" className="input" autoComplete="name" maxLength={120} value={addr.name} onChange={set('name')} onBlur={blur('name')} aria-invalid={!!err('name')} /></Field></div>
                  <div className="sm:col-span-2"><Field label="Country" error={err('country')}>
                    <select name="country" className="input" autoComplete="country" value={addr.country} onChange={set('country')}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
                  </Field></div>
                  <div className="sm:col-span-2"><Field label="Address" error={err('line1')}><input name="line1" className="input" autoComplete="address-line1" maxLength={120} placeholder="Street and house number" value={addr.line1} onChange={set('line1')} onBlur={blur('line1')} aria-invalid={!!err('line1')} /></Field></div>
                  <div className="sm:col-span-2"><Field label="Apartment, suite, etc." optional><input name="line2" className="input" autoComplete="address-line2" maxLength={120} value={addr.line2} onChange={set('line2')} /></Field></div>
                  <Field label="City" error={err('city')}><input name="city" className="input" autoComplete="address-level2" maxLength={80} value={addr.city} onChange={set('city')} onBlur={blur('city')} aria-invalid={!!err('city')} /></Field>
                  <Field label={STATE_CODE.includes(addr.country) ? 'State' : 'County / region'} optional={!STATE_CODE.includes(addr.country)} error={err('state')}><input name="state" className="input" autoComplete="address-level1" maxLength={80} value={addr.state} onChange={set('state')} onBlur={blur('state')} aria-invalid={!!err('state')} /></Field>
                  <Field label={addr.country === 'US' ? 'ZIP code' : 'Postcode'} error={err('postal_code')}><input name="postal_code" className="input" autoComplete="postal-code" maxLength={12} value={addr.postal_code} onChange={set('postal_code')} onBlur={blur('postal_code')} aria-invalid={!!err('postal_code')} /></Field>
                </div>
                <label className="mt-4 flex items-center gap-2.5 text-sm"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-4 accent-orange" /> Save as my default address</label>
              </section>

              <section className="card p-5 sm:p-6" aria-labelledby="h-del">
                <h2 id="h-del" className="mb-4 flex items-center gap-2 text-lg"><span className="grid size-7 place-items-center rounded-full bg-olive font-sans text-xs text-white">3</span> Delivery</h2>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="h-del">
                  {(['standard', 'express'] as Method[]).map((m) => {
                    const cost = cfg ? shippingCost(cfg, subtotal, m) : 0
                    return (
                      <label key={m} className={`relative flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition ${method === m ? 'border-orange bg-orange-soft/40' : 'border-line bg-paper hover:border-sand'}`}>
                        <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="mt-1 size-4 accent-orange" />
                        <span className="flex-1">
                          <span className="flex justify-between font-semibold text-olive"><span>{m === 'standard' ? 'Standard' : 'Express'}</span><span>{cost === 0 ? 'Free' : formatUsd(cost)}</span></span>
                          <span className="mt-0.5 block text-[13px] text-muted"><Truck className="mr-1 inline size-3.5" aria-hidden />Arrives {deliveryWindow(m)}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </section>

              <section className="card p-5 sm:p-6" aria-labelledby="h-pay">
                <h2 id="h-pay" className="mb-4 flex items-center gap-2 text-lg"><span className="grid size-7 place-items-center rounded-full bg-olive font-sans text-xs text-white">4</span> Payment</h2>
                {cfg?.checkout_mode === 'test' ? (
                  <div className="rounded-xl border border-dashed border-yolk/60 bg-[#fffaeb] p-4">
                    <p className="flex items-center gap-2 font-semibold text-olive"><FlaskConical className="size-4" aria-hidden /> Test payment</p>
                    <p className="mt-1 text-sm text-ink/75">No card needed. Your order is saved as a test order so you can follow it in your account. Once Stripe is connected, this step becomes a secure card payment.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-cream-2/50 p-4">
                    <p className="flex items-center gap-2 font-semibold text-olive"><CreditCard className="size-4" aria-hidden /> Card, Apple Pay or Google Pay</p>
                    <p className="mt-1 text-sm text-ink/75">You’ll pay on Stripe’s secure page and come straight back here. We never see your card details.</p>
                  </div>
                )}
                <div className="mt-3 flex gap-1.5" aria-hidden>{['VISA', 'MC', 'AMEX', 'Pay', 'G Pay'].map((c) => <span key={c} className="rounded border border-sand bg-paper px-1.5 py-0.5 text-[10px] font-bold text-olive">{c}</span>)}</div>
              </section>

              {error && <Alert>{error}</Alert>}
              <button className="btn-primary w-full text-sm" disabled={busy || !cfg}>
                <Lock className="size-4" aria-hidden />
                {busy ? 'Placing your order…' : cfg?.checkout_mode === 'live' ? `Continue to secure payment · ${formatUsd(total)}` : `Place test order · ${formatUsd(total)}`}
              </button>
              <p className="text-center text-xs text-muted">By placing your order you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy-policy" className="underline">Privacy Policy</Link>.</p>
            </form>
          )}
        </div>
        <div className="order-1 lg:order-2">{summary}</div>
      </div>
    </div>
  )
}

type Order = Tables<'orders'>
export function CheckoutSuccess() {
  useTitle('Thank you!')
  const [params] = useSearchParams()
  const id = params.get('order')
  const { clear } = useCart()
  const [order, setOrder] = useState<Order | null | undefined>(id ? undefined : null)

  useEffect(() => { clear() }, [clear])
  useEffect(() => {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return
    let tries = 0
    // after Stripe the webhook may land a moment after the redirect, so poll briefly
    const load = () => supabase.from('orders').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data?.status === 'pending' && tries++ < 6) { setTimeout(load, 1500); return }
      setOrder(data as Order | null)
    })
    load()
  }, [id])

  if (order === undefined) return <Spinner label="Confirming your order" />
  const items = order ? asItems(order.items) : []
  const name = asAddress(order?.shipping_address)?.name.split(' ')[0]
  return (
    <div className="container-x py-8">
      <Steps at={3} />
      <div className="mx-auto max-w-3xl">
        <div className="card overflow-hidden">
          <div className="bg-cream-2 px-6 py-8 text-center sm:px-10">
            <CheckCircle2 className="mx-auto size-14 animate-pop text-leaf" aria-hidden />
            <p className="script mt-3 text-2xl">Thank you{name ? `, ${name}` : ''}!</p>
            <h1 className="text-3xl">Your order is in the nest</h1>
            {order && <p className="mt-2 text-muted">Order <strong className="text-olive select-all">{orderNumber(order.id)}</strong> · You can follow it any time from your account.</p>}
            {order?.is_test && <p className="mt-3"><TestBadge /> <span className="ml-1 text-xs text-muted">No payment was taken.</span></p>}
          </div>
          {order ? (
            <div className="space-y-6 p-6 sm:p-8">
              <OrderProgress status={order.status} />
              <div className="rounded-xl bg-orange-soft/50 p-4 text-sm"><Truck className="mr-2 inline size-4 text-orange-2" aria-hidden />Estimated delivery <strong>{deliveryWindow(order.shipping_method === 'express' ? 'express' : 'standard', new Date(order.created_at))}</strong></div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_220px]">
                <ul className="divide-y divide-line">{items.map((it, i) => <ItemRow key={i} it={it} />)}</ul>
                <div className="space-y-4">
                  <div><p className="label-caps mb-1">Shipping to</p><AddressBlock value={order.shipping_address} /></div>
                  <dl className="space-y-1 border-t border-line pt-3 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatUsd(order.subtotal)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{Number(order.shipping_amount) ? formatUsd(order.shipping_amount) : 'Free'}</dd></div>
                    <div className="flex justify-between font-semibold text-olive"><dt>Total</dt><dd>{formatUsd(order.total_amount)}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
          ) : <p className="p-8 text-center text-muted">Your payment went through. Your order will appear in your account in a moment.</p>}
          <div className="flex flex-wrap justify-center gap-3 border-t border-line p-6">
            <Link to={order ? `/orders/${order.id}` : '/orders'} className="btn-primary">Track my order</Link>
            <Link to="/shop" className="btn-ghost">Continue shopping</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
