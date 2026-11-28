import { ArrowUpRight, ChevronDown, Search } from 'lucide-react'
import { isValidElement, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { MAIN_SITE, TrustBadges } from '../components/Layout'
import { PageHeader, useTitle } from '../components/ui'
import { SiteImg } from '../lib/siteImages'

const EMAIL = 'info.littlechicknest@gmail.com'
const UPDATED = 'November 17, 2026'
const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
/** Plain text of an FAQ answer, including text inside links, so search finds it. */
const textOf = (n: ReactNode): string =>
  n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n)
    : Array.isArray(n) ? n.map(textOf).join(' ')
    : isValidElement(n) ? (n.type === Mail ? EMAIL : textOf((n.props as { children?: ReactNode }).children)) : ''

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useTitle(title)
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="The small print" title={title} crumbs={[[title]]}>Last updated {UPDATED}</PageHeader>
      <article className="container-x"><div className="card prose-legal p-6 sm:p-10">{children}</div></article>
    </div>
  )
}

export function About() {
  useTitle('Our story')
  return (
    <>
      <PageHeader eyebrow="Happy, healthy hens" title="Our story" crumbs={[['Our story']]}>
        Little Chick Nest is a family of chicks and hens you can watch live, 24/7. This shop is its official home for clothing and gifts.
      </PageHeader>
      <div className="container-x space-y-8">
        <section className="grid items-center gap-8 overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-[var(--shadow-soft)] md:grid-cols-2">
          <SiteImg slot="about-top" alt="Little Chick Nest mug on a wooden shelf" loading="lazy" className="aspect-[4/3] size-full object-cover" />
          <div className="space-y-4 p-6 text-ink/85 sm:p-10">
            <h2 className="text-2xl sm:text-3xl">A calm little corner of the internet</h2>
            <p>We started Little Chick Nest so families could slow down and watch our chicks grow from day one: eating, sleeping, exploring and growing up.</p>
            <p>This shop brings that cosy feeling into everyday life. Every piece is <strong>made to order</strong> by our print partner, so we only make what’s ordered. That means less waste and more care.</p>
            <p className="script text-2xl">Profits help feed, house and care for our flock.</p>
            <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer" className="btn-primary">Meet the chicks <ArrowUpRight className="size-4" aria-hidden /></a>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {([
            ['about-1', 'Thoughtful materials', 'Organic cotton tees, brushed-fleece hoodies and stoneware mugs, chosen to last.'],
            ['about-2', 'Embroidered with care', 'Our little chick is stitched, not stuck on, so it looks as good on day 100 as day one.'],
            ['about-3', 'Made for gifting', 'Sets and gift boxes for every age, packed in kraft boxes that are easy to recycle.'],
          ] as const).map(([slot, title, text]) => (
            <div key={title} className="card overflow-hidden">
              <SiteImg slot={slot} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="p-5"><h3 className="text-lg">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>
            </div>
          ))}
        </section>
        <TrustBadges />
      </div>
    </>
  )
}

const FAQS: [string, string, ReactNode][] = [
  ['Orders', 'How long will my order take?', 'Every item is made just for you. Printing and embroidery take 2–4 working days, then standard delivery is usually 3–7 working days (express 2–3). Your order page shows an estimated delivery date.'],
  ['Orders', 'How do I track my order?', <>Sign in and open <Link to="/orders">My orders</Link>. You’ll see each step from the print room to your door, and a tracking number once your parcel ships.</>],
  ['Orders', 'Can I change or cancel my order?', <>Because items are made to order, we can only change or cancel before production starts. Email <Mail /> as soon as possible with your order number.</>],
  ['Delivery', 'How much is delivery?', 'Standard delivery is a small flat rate, and free once your basket reaches the free-delivery amount shown in your basket. Express delivery is available at checkout. Prices are always shown before you pay.'],
  ['Delivery', 'Where do you deliver?', 'We deliver to the US, UK, Ireland, Canada, Australia, New Zealand and most of Europe. You’ll see the full list at checkout.'],
  ['Returns', 'What if my item arrives damaged or wrong?', <>We’re sorry! Email <Mail /> within 30 days with your order number and a photo, and we’ll send a free replacement or a refund. See <Link to="/shipping-returns">Shipping & returns</Link>.</>],
  ['Products', 'How do sizes fit?', 'Our hoodies and sweatshirts have a relaxed, unisex fit. Each product page has a size guide. If you’re between sizes, size up for a cosier fit.'],
  ['Products', 'How should I wash my items?', 'Wash inside out at 30°C with similar colours. Don’t tumble dry or iron over the print or embroidery. Mugs are dishwasher and microwave safe.'],
  ['Payments', 'Which payment methods do you accept?', 'Payments are handled securely by Stripe. We accept major credit and debit cards, plus Apple Pay and Google Pay where available. We never see or store your card details.'],
  ['Account', 'How do I delete my account?', <>Go to <Link to="/account/delete">Delete account</Link> while signed in. It’s instant.</>],
]

export function Faq() {
  useTitle('Help & FAQ')
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState<string | null>(null)
  const topics = [...new Set(FAQS.map(([t]) => t))]
  const shown = FAQS.filter(([t, question, a]) => (!topic || t === topic) &&
    (!q.trim() || (question + ' ' + textOf(a)).toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <>
      <PageHeader eyebrow="We’re happy to help" title="Help & FAQ" crumbs={[['Help & FAQ']]}>Quick answers to common questions. Can’t find yours? <Link to="/contact" className="font-semibold text-orange-2 underline">Contact us</Link>.</PageHeader>
      <div className="container-x max-w-3xl">
        <label className="relative mb-4 block">
          <span className="sr-only">Search help</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for delivery, sizing, returns…" className="input min-h-12 rounded-full pl-12" />
        </label>
        <div className="mb-6 flex flex-wrap gap-2">
          {[null, ...topics].map((t) => (
            <button key={t ?? 'all'} type="button" onClick={() => setTopic(t)} aria-pressed={topic === t}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${topic === t ? 'bg-orange text-white' : 'border border-sand bg-paper hover:border-orange'}`}>{t ?? 'All'}</button>
          ))}
        </div>
        <div className="space-y-3">
          {shown.map(([, question, a]) => (
            <details key={question} className="card group p-5 [&_a]:font-semibold [&_a]:text-orange-2 [&_a]:underline">
              <summary className="flex list-none items-center justify-between gap-4 font-semibold text-olive [&::-webkit-details-marker]:hidden">
                {question}<ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-3 text-ink/85">{a}</div>
            </details>
          ))}
          {!shown.length && <p className="rounded-xl border border-dashed border-sand p-8 text-center text-muted">No answers match. <Link to="/contact" className="font-semibold text-orange-2 underline">Ask us directly</Link>.</p>}
        </div>
      </div>
    </>
  )
}

export function ShippingReturns() {
  useTitle('Shipping & returns')
  return (
    <LegalPage title="Shipping & returns">
      <h2>Made to order</h2>
      <p>Every item is printed or embroidered on demand by our print partner once you order. Production usually takes 2–4 working days.</p>
      <h2>Delivery</h2>
      <ul>
        <li><strong>Standard:</strong> usually 3–7 working days after production. Free once your basket reaches the free-delivery amount shown in your basket.</li>
        <li><strong>Express:</strong> usually 2–3 working days after production.</li>
      </ul>
      <p>Exact prices are shown at checkout before you pay. Delivery times are estimates and may be longer at busy times or because of customs. Any import duties or taxes charged by your country are your responsibility.</p>
      <h2>Returns</h2>
      <p>Personalised and made-to-order items can’t be returned just because you changed your mind, unless your local law says otherwise. This does not affect your statutory rights.</p>
      <h2>Faulty, damaged or wrong items</h2>
      <p>If something arrives faulty, damaged or not what you ordered, email <Mail /> within 30 days of delivery with your order number and photos. We’ll send a free replacement or a full refund.</p>
      <h2>Lost parcels</h2>
      <p>If your tracking hasn’t updated for 10 working days, <Link to="/contact">contact us</Link> and we’ll investigate with the courier.</p>
    </LegalPage>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>These terms apply when you use this website and buy from the Little Chick Nest shop ("we", "us"). By placing an order you agree to them.</p>
      <h2>1. About us</h2>
      <p>This shop is operated by Little Chick Nest. You can contact us at <Mail />.</p>
      <h2>2. Accounts</h2>
      <p>You are responsible for keeping your login details safe and for activity on your account. You must be 18 or over, or have a parent or guardian's permission, to place an order. You can delete your account at any time from your account page.</p>
      <h2>3. Products and prices</h2>
      <ul>
        <li>Products are printed on demand. Colours on screen may differ slightly from the finished item.</li>
        <li>You pay in US dollars (USD). You can choose to see prices in pounds (GBP) as a guide; the amount charged is always the US dollar total shown at checkout, together with shipping and any applicable taxes, before you pay.</li>
        <li>If we make an obvious pricing error, we may cancel the order and refund you in full.</li>
      </ul>
      <h2>4. Orders and payment</h2>
      <p>Your order is an offer to buy. A contract is formed when we confirm your payment. Payments are processed by Stripe. We do not see or store your full card details.</p>
      <h2>5. Production and delivery</h2>
      <p>Items are made to order by our print partner and shipped to the address you give at checkout. Delivery times are estimates. Risk passes to you on delivery. See <Link to="/shipping-returns">Shipping & returns</Link>.</p>
      <h2>6. Cancellations and returns</h2>
      <p>Because items are personalised and made to order, the usual right to cancel may not apply once production has started. Faulty, damaged or incorrect items will be replaced or refunded. Nothing in these terms affects your statutory rights.</p>
      <h2>7. Reviews and content</h2>
      <p>Reviews must be honest and must not be unlawful, offensive or contain personal data. We may moderate or remove reviews.</p>
      <h2>8. Intellectual property</h2>
      <p>The Little Chick Nest name, logo, designs and site content belong to us. You may not copy or reuse them without permission.</p>
      <h2>9. Liability</h2>
      <p>We are not liable for losses that were not foreseeable, or for business losses. We do not limit liability for death or personal injury caused by negligence, for fraud, or where the law doesn't allow it.</p>
      <h2>10. Changes and governing law</h2>
      <p>We may update these terms from time to time. The version on this page when you order applies. These terms are governed by the laws of England and Wales, and you may also have rights under the law where you live.</p>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This policy explains what personal data the Little Chick Nest shop collects, why, and your rights. We act as data controller. Contact: <Mail />.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email address and password (stored hashed by our authentication provider), or your Google profile name and email if you sign in with Google.</li>
        <li><strong>Order data:</strong> items ordered, amounts, shipping name, address and phone number, and order status.</li>
        <li><strong>Payment data:</strong> handled by Stripe. We receive only a payment reference, never your full card number.</li>
        <li><strong>Messages and reviews:</strong> anything you send through our contact form or post as a review.</li>
        <li><strong>Newsletter:</strong> your email address if you subscribe.</li>
      </ul>
      <h2>Why we use it (legal basis)</h2>
      <ul>
        <li>To create your account and fulfil orders (contract).</li>
        <li>To keep financial records (legal obligation).</li>
        <li>To prevent fraud and keep the site secure (legitimate interests).</li>
        <li>To send our newsletter (consent; unsubscribe any time).</li>
      </ul>
      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Supabase</strong>: database, authentication and hosting of our backend.</li>
        <li><strong>Stripe</strong>: payment processing.</li>
        <li><strong>Gelato</strong>: our print partner, who receives your shipping details to make and send your order.</li>
        <li><strong>Couriers</strong>: to deliver your parcel.</li>
        <li><strong>Google</strong>: only if you choose "Continue with Google".</li>
      </ul>
      <p>Some providers may process data outside the UK/EEA under appropriate safeguards such as standard contractual clauses. We never sell your data.</p>
      <h2>How long we keep it</h2>
      <p>Account data is kept until you delete your account. Order records are kept for up to 6 years for tax and accounting purposes, then deleted. Contact messages are deleted when no longer needed.</p>
      <h2>Your rights</h2>
      <p>You can access, correct, delete, restrict or object to the use of your data, and ask for a copy (portability). You can delete your account yourself at <Link to="/account/delete">Delete account</Link>, or email us. You may also complain to your data protection authority (in the UK, the ICO).</p>
      <h2>Cookies</h2>
      <p>See our <Link to="/cookie-policy">Cookie Policy</Link>.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit. Access is restricted by row-level security, so customers can only see their own orders and only authorised staff can see shop data.</p>
    </LegalPage>
  )
}

export function Cookies() {
  return (
    <LegalPage title="Cookie Policy">
      <p>We keep it simple. This shop uses <strong>only strictly necessary storage</strong>. No advertising or analytics cookies are used.</p>
      <h2>What we store on your device</h2>
      <ul>
        <li><strong>Sign-in session</strong> (local storage, set by Supabase): keeps you signed in.</li>
        <li><strong>Basket</strong> (local storage, <code>lcn-cart-v1</code>): remembers the items in your basket.</li>
        <li><strong>Wishlist</strong> (local storage, <code>lcn-wishlist-v1</code>): remembers the items you've saved.</li>
        <li><strong>Cookie notice</strong> (local storage, <code>lcn-cookie-notice</code>): remembers that you've dismissed the notice.</li>
        <li><strong>Stripe</strong>: when you check out on Stripe's secure page, Stripe sets cookies needed for payment and fraud prevention.</li>
      </ul>
      <h2>Managing storage</h2>
      <p>You can clear site data in your browser settings at any time. You'll be signed out and your basket will be emptied.</p>
    </LegalPage>
  )
}

export function NotFoundContent() {
  useTitle('Page not found')
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-12 text-center">
      <div>
        <SiteImg slot="chick" alt="" width={110} height={72} className="mx-auto w-[110px]" />
        <p className="script mt-4 text-3xl">Oops, 404</p>
        <h1 className="mt-1 text-3xl">This chick has wandered off</h1>
        <p className="mt-2 text-muted">We couldn’t find that page. It may have moved, or the link may be wrong.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-primary">Go home</Link>
          <Link to="/shop" className="btn-ghost">Browse the shop</Link>
        </div>
      </div>
    </div>
  )
}
