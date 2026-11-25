import { Clock, Mail, MapPin, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Breadcrumbs, Field, useTitle } from '../components/ui'
import { useAuth } from '../context/auth'
import { SiteImg } from '../lib/siteImages'
import { supabase } from '../lib/supabase'

const EMAIL = 'info.littlechicknest@gmail.com'
const TOPICS = ['An order', 'Sizing & products', 'Returns or a problem', 'Something else']

export default function Contact() {
  useTitle('Contact us')
  const [params] = useSearchParams()
  const order = params.get('order')?.replace(/[^A-Z0-9-]/gi, '').slice(0, 20) ?? ''
  const { session, profile } = useAuth()
  const [form, setForm] = useState({
    name: profile?.full_name ?? '', email: session?.user.email ?? '', topic: order ? TOPICS[0] : TOPICS[3],
    message: order ? `Order ${order}: ` : '', website: '',
  })
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.website) return setState('done') // honeypot: bots fill hidden fields
    setState('busy')
    const { error } = await supabase.from('contact_messages').insert({
      name: form.name.trim(), email: form.email.trim(), message: `[${form.topic}] ${form.message.trim()}`,
    })
    setState(error ? 'error' : 'done')
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="container-x pt-6">
      <Breadcrumbs items={[['Contact us']]} />
      <section className="relative overflow-hidden rounded-[1.25rem] border border-line bg-[#fffaf0]">
        <SiteImg slot="contact-top" alt="" className="h-48 w-full object-cover object-[50%_15%] md:absolute md:inset-y-0 md:right-0 md:h-full md:w-[55%] md:object-[20%_20%]" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#fffaf0] from-45% to-[#fffaf0]/0 to-62% md:block" />
        <div className="relative max-w-md px-6 py-10 sm:px-12 md:py-16 lg:max-w-lg">
          <p className="text-sm font-bold tracking-widest text-olive uppercase">Get in touch</p>
          <h1 className="mt-2 text-3xl sm:text-[2.6rem] sm:leading-tight">We’d love to hear from you!</h1>
          <p className="mt-3 text-ink/80">A question about an order, sizing, or just want to say hello? Our small team reads every message.</p>
          <p className="script mt-5 text-3xl">Little questions. Big conversations. ♡</p>
        </div>
      </section>

      <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2">
        <div className="card p-6 sm:p-8">
          <h2 className="text-2xl">Contact information</h2>
          <p className="mt-1 text-sm text-muted">You can reach us through any of these.</p>
          <ul className="mt-6 space-y-5">
            <li className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-olive text-white"><Mail className="size-5" aria-hidden /></span>
              <div><p className="font-display font-bold text-olive">Email us</p><a href={`mailto:${EMAIL}`} className="font-semibold break-all hover:text-orange-2">{EMAIL}</a><p className="text-sm text-muted">We usually reply within 24 hours.</p></div></li>
            <li className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-olive text-white"><Clock className="size-5" aria-hidden /></span>
              <div><p className="font-display font-bold text-olive">Opening hours</p><p className="text-sm">Mon – Fri, 9:00 – 17:00 (GMT)</p><p className="text-sm text-muted">Messages sent at weekends are answered on Monday.</p></div></li>
            <li className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-olive text-white"><MapPin className="size-5" aria-hidden /></span>
              <div><p className="font-display font-bold text-olive">Our nest</p><p className="text-sm">London, United Kingdom</p><p className="text-sm text-muted">We’re a small family-run nest.</p></div></li>
          </ul>
          <p className="script mt-8 text-center text-2xl text-olive">Follow our journey</p>
          <p className="mt-1 text-center text-sm"><a href="https://littlechicknest.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-2 underline">Watch the chicks live</a></p>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-2xl">Send us a message</h2>
          <p className="mt-1 mb-6 text-sm text-muted">Fill in the form and we’ll get back to you as soon as possible.</p>
          {state === 'done' ? (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-14 animate-pop place-items-center rounded-full bg-[#eef6e6] text-2xl">🐣</span>
              <p className="mt-4 font-display text-xl font-bold text-olive">Message sent!</p>
              <p className="mt-1 text-sm text-muted">Thank you, {form.name.split(' ')[0] || 'friend'}. We’ll reply to {form.email} soon.</p>
              <Link to="/shop" className="btn-ghost mt-5">Back to the shop</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Name"><input className="input" required maxLength={120} autoComplete="name" placeholder="Your name" value={form.name} onChange={set('name')} /></Field>
              <Field label="Email"><input className="input" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} /></Field>
              <Field label="What’s it about?"><select className="input" value={form.topic} onChange={set('topic')}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Message"><textarea className="input" required rows={5} maxLength={4900} placeholder="How can we help you?" value={form.message} onChange={set('message')} /></Field>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={set('website')} />
              {state === 'error' && <Alert>Could not send your message. Please check your details and try again.</Alert>}
              <button className="btn-primary w-full" disabled={state === 'busy'}><Send className="size-4" aria-hidden /> {state === 'busy' ? 'Sending…' : 'Send'}</button>
            </form>
          )}
        </div>
      </div>

      <section className="relative mx-auto mt-8 max-w-5xl overflow-hidden rounded-[1.25rem] border border-line">
        <SiteImg slot="contact-bottom" alt="" loading="lazy" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf0] via-[#fffaf0] to-[#fffaf0]/0" />
        <div className="relative max-w-lg px-6 py-10 sm:px-10">
          <h2 className="text-3xl">Before you reach out…</h2>
          <p className="font-display text-2xl font-bold text-orange">We’re happy to help!</p>
          <p className="mt-2 text-ink/80">You might find the answer to your question in our FAQ.</p>
          <Link to="/faq" className="btn-primary mt-5">Need help</Link>
        </div>
      </section>
    </div>
  )
}
