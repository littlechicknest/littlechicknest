import { ArrowRight, ArrowUpRight, Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../context/auth'
import { useCart } from '../context/cart'
import { useWishlist } from '../context/wishlist'
import { CURRENCIES, setCurrency, useCurrency, type Currency } from '../lib/currency'
import { categoryLabel, matchesSearch, matchVariant, priceLabel, productImage, wantedColors } from '../lib/shop'
import { SiteImg } from '../lib/siteImages'
import { supabase } from '../lib/supabase'
import { useProducts, useRates } from '../lib/useProducts'
import { CartDrawer } from './CartDrawer'
import { Toaster, useOverlay } from './ui'

const YEAR = new Date().getFullYear()
export const MAIN_SITE = 'https://littlechicknest.com'

type NavItem = { to: string; label: string; match: (path: string, cat: string | null) => boolean }
const NAV: NavItem[] = [
  { to: '/', label: 'Shop', match: (p) => p === '/' },
  { to: '/shop?category=Men', label: "Men's", match: (p, c) => p === '/shop' && c === 'Men' },
  { to: '/shop?category=Women', label: "Women's", match: (p, c) => p === '/shop' && c === 'Women' },
  { to: '/shop?category=Kids', label: "Kids'", match: (p, c) => p === '/shop' && c === 'Kids' },
  { to: '/shop?category=Accessories', label: 'Accessories', match: (p, c) => p === '/shop' && c === 'Accessories' },
  { to: '/shop', label: 'Shop all', match: (p, c) => p === '/shop' && !c },
]
const NAV_2: NavItem[] = [
  { to: '/orders', label: 'Track my order', match: (p) => p.startsWith('/orders') },
  { to: '/faq', label: 'Help & FAQ', match: (p) => p === '/faq' },
  { to: '/contact', label: 'Contact us', match: (p) => p === '/contact' },
  { to: '/about', label: 'Our story', match: (p) => p === '/about' },
]

export const Logo = ({ className = 'h-14' }: { className?: string }) => (
  <SiteImg slot="logo" alt="Little Chick Nest" width={480} height={390} className={`${className} w-auto`} />
)

function useNavState() {
  const { pathname, search } = useLocation()
  return { pathname, cat: new URLSearchParams(search).get('category') }
}

function NavList({ items, onPick }: { items: NavItem[]; onPick?: () => void }) {
  const { pathname, cat } = useNavState()
  return (
    <ul className="space-y-1">
      {items.map((n) => {
        const active = n.match(pathname, cat)
        return (
          <li key={n.label}>
            <Link to={n.to} onClick={onPick} aria-current={active ? 'page' : undefined}
              className={`block rounded-md px-4 py-2.5 text-[13px] font-semibold tracking-wide uppercase transition-colors ${active ? 'bg-orange text-white shadow-[0_6px_14px_-6px_rgb(252_91_19/0.6)]' : 'text-ink hover:bg-orange-soft hover:text-orange-2'}`}>
              {n.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Desktop horizontal nav bar under the header row. */
function DesktopNav() {
  const { pathname, cat } = useNavState()
  const link = (n: NavItem, small = false) => {
    const active = n.match(pathname, cat)
    return (
      <li key={n.label}>
        <Link to={n.to} aria-current={active ? 'page' : undefined}
          className={`block rounded-md px-3 py-2 font-semibold tracking-wide uppercase transition-colors ${small ? 'text-[12px]' : 'text-[13px]'} ${active ? 'bg-orange text-white' : small ? 'text-muted hover:text-orange-2' : 'text-ink hover:bg-orange-soft hover:text-orange-2'}`}>
          {n.label}
        </Link>
      </li>
    )
  }
  return (
    <nav aria-label="Shop" className="hidden border-t border-line lg:block">
      <div className="container-x flex items-center justify-between gap-4 py-1.5">
        <ul className="flex items-center gap-1">{NAV.map((n) => link(n))}</ul>
        <ul className="flex items-center gap-1">{NAV_2.map((n) => link(n, true))}</ul>
      </div>
    </nav>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useOverlay(open, onClose)
  const { session } = useAuth()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" tabIndex={-1} aria-label="Close menu" className="absolute inset-0 animate-fade-in bg-olive/40" onClick={onClose} />
      <div ref={(el) => { ref.current = el }} className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs animate-slide-in-left flex-col overflow-y-auto bg-cream-2 px-4 pt-4 pb-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <Logo className="h-14" />
          <button type="button" onClick={onClose} className="rounded-full p-2 text-olive hover:bg-white" aria-label="Close menu"><X className="size-6" aria-hidden /></button>
        </div>
        <nav aria-label="Shop"><NavList items={NAV} onPick={onClose} /><div className="my-3 border-t border-sand" /><NavList items={NAV_2} onPick={onClose} /></nav>
        <div className="mt-auto space-y-2 pt-6">
          <Link to={session ? '/account' : '/login'} onClick={onClose} className="btn-dark w-full"><User className="size-4" aria-hidden /> {session ? 'My account' : 'Sign in'}</Link>
          <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">littlechicknest.com <ArrowUpRight className="size-4" aria-hidden /></a>
        </div>
      </div>
    </div>
  )
}

const POPULAR = ['Hoodie', 'Cap', 'Mug', 'Gift', 'Kids']
function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useOverlay(open, onClose)
  useCurrency()
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim().toLowerCase())
  const { products } = useProducts()
  const navigate = useNavigate()
  const results = useMemo(() => !query ? [] : (products ?? []).filter((p) => matchesSearch({ ...p, description: '' }, query)).slice(0, 6), [products, query])

  if (!open) return null
  const submit = (e: FormEvent) => { e.preventDefault(); onClose(); navigate(`/shop?q=${encodeURIComponent(q.trim())}`) }
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Search the shop">
      <button type="button" tabIndex={-1} aria-label="Close search" className="absolute inset-0 animate-fade-in bg-olive/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={(el) => { ref.current = el }} className="relative mx-auto mt-0 w-full max-w-2xl animate-fade-up bg-paper p-4 shadow-2xl sm:mt-20 sm:rounded-2xl sm:p-5">
        <form onSubmit={submit} className="flex items-center gap-3 border-b border-line pb-3">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <input id="site-search" data-autofocus type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} autoComplete="off"
            placeholder="Search hoodies, caps, mugs…" className="min-h-11 flex-1 bg-transparent text-lg outline-none placeholder:text-muted/60" />
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs font-semibold text-muted uppercase hover:bg-cream">Esc</button>
        </form>
        {!query ? (
          <div className="pt-4">
            <p className="label-caps mb-2">Popular</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((t) => <button key={t} type="button" onClick={() => setQ(t)} className="rounded-full border border-sand px-3.5 py-1.5 text-sm hover:border-orange hover:text-orange-2">{t}</button>)}
            </div>
          </div>
        ) : results.length ? (
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto pt-2">
            {results.map((p) => {
              const color = matchVariant(p, wantedColors([], query))?.color
              const img = productImage(p, color)
              return (
                <li key={p.id}>
                  <Link to={`/product/${p.id}${color ? `?color=${encodeURIComponent(color)}` : ''}`} onClick={onClose} className="flex items-center gap-4 rounded-lg px-2 py-2.5 hover:bg-cream">
                    <span className="size-14 shrink-0 overflow-hidden rounded-md bg-cream-2">{img && <img src={img} alt="" className="size-full object-cover" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.title}</span><span className="text-xs text-muted">{categoryLabel(p.category)}</span></span>
                    <span className="font-semibold text-olive">{priceLabel(p)}</span>
                  </Link>
                </li>
              )
            })}
            <li className="pt-3"><button type="button" onClick={submit} className="btn-link">See all results for “{q.trim()}” <ArrowRight className="size-3.5" aria-hidden /></button></li>
          </ul>
        ) : <p className="py-8 text-center text-muted">No products match “{q.trim()}”. Try “hoodie” or “mug”.</p>}
      </div>
    </div>
  )
}

const MESSAGES = [
  'Free standard delivery on orders over $75',
  'Every order helps care for our little flock',
  'Printed to order in 2–4 working days, less waste',
]
function AnnouncementBar() {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 4000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="bg-olive text-center text-[12px] font-medium tracking-wide text-white/95">
      <p key={i} className="container-x animate-fade-in py-2">{MESSAGES[i]}</p>
    </div>
  )
}

/** USD / GBP price display. Hidden until the pound rate has loaded. */
function CurrencySwitch() {
  const cur = useCurrency()
  const ready = useRates()
  if (!ready) return null
  return (
    <label className="relative grid h-11 place-items-center rounded-full px-1 text-olive hover:bg-orange-soft">
      <span className="sr-only">Show prices in</span>
      <select value={cur} onChange={(e) => setCurrency(e.target.value as Currency)}
        className="h-11 cursor-pointer appearance-none bg-transparent px-2 text-sm font-semibold outline-none">
        {CURRENCIES.map((c) => <option key={c} value={c}>{c === 'GBP' ? '£ GBP' : '$ USD'}</option>)}
      </select>
    </label>
  )
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { session, profile } = useAuth()
  const { count, setOpen: openCart } = useCart()
  const { ids } = useWishlist()
  const first = profile?.full_name?.split(' ')[0]
  const iconBtn = 'relative grid size-11 place-items-center rounded-full text-olive transition-colors hover:bg-orange-soft hover:text-orange-2'
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur-md">
      <div className="container-x flex h-16 items-center gap-2 lg:h-[76px] lg:gap-6">
        <button type="button" onClick={onMenu} className={`${iconBtn} -ml-2 lg:hidden`} aria-label="Open menu"><Menu className="size-6" aria-hidden /></button>
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Little Chick Nest Shop home">
          <Logo className="h-12 lg:h-16" />
          <span className="script hidden text-2xl lg:block">Shop</span>
        </Link>

        <button type="button" onClick={onSearch} className="mx-auto hidden h-11 w-full max-w-sm items-center gap-3 rounded-full border border-sand bg-paper px-4 text-left text-sm text-muted transition hover:border-olive-3 md:flex">
          <Search className="size-4" aria-hidden /> <span className="flex-1">Search hoodies, caps, mugs…</span>
          <kbd className="rounded border border-sand px-1.5 text-[11px] font-sans">/</kbd>
        </button>

        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          <CurrencySwitch />
          <button type="button" onClick={onSearch} className={`${iconBtn} md:hidden`} aria-label="Search"><Search className="size-5" aria-hidden /></button>
          <Link to={session ? '/account' : '/login'} className={`${iconBtn} sm:flex sm:w-auto sm:gap-2 sm:rounded-full sm:px-3`} aria-label={session ? 'My account' : 'Sign in'}>
            <User className="size-5" aria-hidden /><span className="hidden text-sm font-medium sm:inline">{session ? (first ? `Hi, ${first}` : 'My account') : 'Sign in'}</span>
          </Link>
          <Link to="/wishlist" className={`${iconBtn} hidden sm:grid`} aria-label={`Wishlist, ${ids.length} saved`}>
            <Heart className="size-5" aria-hidden />
            {ids.length > 0 && <span className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-olive px-1 text-[10px] font-semibold text-white">{ids.length}</span>}
          </Link>
          <button type="button" onClick={() => openCart(true)} className={iconBtn} aria-label={`Basket, ${count} item${count === 1 ? '' : 's'}`}>
            <ShoppingBag className="size-5" aria-hidden />
            {count > 0 && <span key={count} className="absolute top-1 right-0.5 grid min-w-[18px] animate-pop place-items-center rounded-full bg-orange px-1 text-[10px] font-semibold text-white">{count}</span>}
          </button>
        </div>
      </div>
      <DesktopNav />
    </header>
  )
}

export function TrustBadges() {
  const items = [
    ['Ok', '100% secure payment'],
    ['2–4', 'Days to print'],
    ['Safe', 'Privacy protected'],
    ['Hi', 'Support that matters'],
  ]
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Why shop with us">
      {items.map(([badge, text]) => (
        <li key={text} className="card flex items-center gap-3 rounded-full px-3 py-2.5">
          <span className="grid h-9 min-w-9 place-items-center rounded-full bg-[#fdf0c8] px-2 text-xs font-bold text-olive">{badge}</span>
          <span className="text-[13px] font-medium text-ink">{text}</span>
        </li>
      ))}
    </ul>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('busy')
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() })
    // 23505 = already subscribed; treat as success so we never reveal who is on the list
    setState(!error || error.code === '23505' ? 'done' : 'error')
  }
  return (
    <div className="card grid grid-cols-1 items-center gap-6 px-6 py-7 sm:px-8 md:grid-cols-[auto_minmax(0,1fr)_1.4fr_auto]">
      <SiteImg slot="chick" alt="" width={84} height={55} className="hidden w-[84px] md:block" />
      <div>
        <p className="font-display text-lg font-bold text-olive">Join our little nest</p>
        <p className="text-sm text-muted">New designs, chick news and the odd treat. No spam.</p>
      </div>
      {state === 'done' ? (
        <p role="status" className="font-medium text-olive">Thank you! You’re on the list. 🐣</p>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="nl-email" className="sr-only">Email address</label>
          <input id="nl-email" type="email" required maxLength={254} autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input rounded-full" />
          <button className="btn-primary rounded-full" disabled={state === 'busy'}>{state === 'busy' ? 'Joining…' : 'Subscribe'}</button>
        </form>
      )}
      <p className="script text-2xl md:text-right">Made with love <span className="text-olive">for you.</span></p>
      {state === 'error' && <p role="alert" className="text-sm text-red-700 md:col-span-4">Could not subscribe. Please check your email and try again.</p>}
    </div>
  )
}

function Footer() {
  const cols: [string, [string, string][]][] = [
    ['Shop', [['/shop?category=Men', "Men's"], ['/shop?category=Women', "Women's"], ['/shop?category=Kids', "Kids'"], ['/shop?category=Accessories', 'Accessories'], ['/shop', 'Shop all']]],
    ['Help', [['/orders', 'Track my order'], ['/shipping-returns', 'Shipping & returns'], ['/faq', 'Help & FAQ'], ['/contact', 'Contact us']]],
    ['Account', [['/account', 'My account'], ['/wishlist', 'Wishlist'], ['/account/addresses', 'Addresses'], ['/account/delete', 'Delete my account']]],
  ]
  return (
    <footer className="mt-12">
      <div className="container-x"><Newsletter /></div>
      <div className="mt-10 bg-cream-2">
        <div className="container-x grid grid-cols-1 gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-3">
            <Logo className="h-24" />
            <p className="max-w-xs text-sm text-muted">The official shop of Little Chick Nest. Wear it. Love it. Support our flock.</p>
            <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-2 hover:text-orange">Visit littlechicknest.com <ArrowUpRight className="size-4" aria-hidden /></a>
          </div>
          {cols.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <p className="mb-3 text-[13px] font-bold tracking-wider text-olive uppercase">{title}</p>
              <ul className="space-y-2 text-sm">
                {links.map(([to, label]) => <li key={to}><Link to={to} className="text-ink/75 hover:text-orange-2">{label}</Link></li>)}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-sand/70">
          <div className="container-x flex flex-col items-center justify-between gap-3 py-5 text-[13px] text-ink/70 md:flex-row">
            <p>© All Rights Reserved {YEAR} | Little Chick Nest</p>
            <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <Link to="/terms" className="hover:text-orange-2">Terms &amp; Conditions</Link>
              <Link to="/privacy-policy" className="hover:text-orange-2">Privacy Policy</Link>
              <Link to="/cookie-policy" className="hover:text-orange-2">Cookie Policy</Link>
            </nav>
            <p className="inline-flex items-center gap-1.5 rounded-md border border-sand bg-paper px-2.5 py-1 text-[11px] font-medium text-muted" aria-label="Secure payments powered by Stripe">
              Powered by <span className="font-sans text-[15px] leading-none font-bold tracking-tight text-[#635bff]">stripe</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

const COOKIE_KEY = 'lcn-cookie-notice'
function CookieNotice() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(COOKIE_KEY) !== '1' } catch { return false }
  })
  if (!show) return null
  const dismiss = () => {
    try { localStorage.setItem(COOKIE_KEY, '1') } catch { /* ignore */ }
    setShow(false)
  }
  return (
    <div role="region" aria-label="Cookie notice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg animate-fade-up rounded-xl border border-line bg-paper p-4 shadow-[var(--shadow-lift)] sm:flex sm:items-center sm:gap-4">
      <p className="text-sm text-ink/85">
        We only use essential storage to keep you signed in and remember your basket. No tracking or ads.{' '}
        <Link to="/cookie-policy" className="font-semibold text-orange-2 underline">Learn more</Link>
      </p>
      <button type="button" onClick={dismiss} className="btn-dark mt-3 w-full shrink-0 sm:mt-0 sm:w-auto">Got it</button>
    </div>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const closeMenu = useCallback(() => setMenu(false), [])
  const closeSearch = useCallback(() => setSearch(false), [])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  // "/" opens search, like most shops
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); setMenu(false); setSearch(true) }
    }
    document.addEventListener('keydown', on)
    return () => document.removeEventListener('keydown', on)
  }, [])

  return (
    <>
      {/* a button, not href="#main": the URL hash belongs to the router */}
      <button type="button" onClick={() => document.getElementById('main')?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[90] focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</button>
      <AnnouncementBar />
      <TopBar onMenu={() => setMenu(true)} onSearch={() => setSearch(true)} />
      <main id="main" tabIndex={-1} className="min-h-[60vh] focus:outline-none"><Outlet /></main>
      <Footer />
      <MobileMenu open={menu} onClose={closeMenu} />
      <SearchDialog open={search} onClose={closeSearch} />
      <CartDrawer />
      <CookieNotice />
      <Toaster />
    </>
  )
}
