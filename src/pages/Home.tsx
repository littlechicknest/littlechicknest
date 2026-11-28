import { ArrowRight, Heart, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ProductCarousel } from '../components/Carousel'
import { MAIN_SITE, TrustBadges } from '../components/Layout'
import { Alert, useTitle } from '../components/ui'
import { CATEGORIES, CATEGORY_INFO, categoryLabel, inCategory, lookOf, type Category, type Product } from '../lib/shop'
import { SiteImg } from '../lib/siteImages'
import { useProducts } from '../lib/useProducts'

const categorySlot = (c: Category) => `category-${c.toLowerCase() as Lowercase<Category>}` as const

const SLIDES = [
  {
    kicker: 'New season hoodies',
    title: 'Wear the nest.',
    accent: 'Cosy hoodies in soft, earthy colours.',
    text: 'Heavyweight fleece with our little chick embroidered on the chest. Made to order, so nothing goes to waste.',
    cta: ['/shop?category=Women', "Shop women's"], cta2: ['/shop?category=Men', "Shop men's"],
    image: 'hero-1', alt: 'Woman wearing a cream Little Chick Nest hoodie with the chick logo embroidered on the chest', pos: 'object-[50%_30%]',
  },
  {
    kicker: 'Embroidered caps',
    title: 'Little caps,',
    accent: 'big smiles.',
    text: 'Washed cotton twill, a brass buckle and our chick stitched in mustard and olive. One size fits most.',
    cta: ['/shop?category=Accessories', 'Shop accessories'], cta2: ['/shop?category=Kids', "Kids' caps"],
    image: 'hero-2', alt: 'Cream cap embroidered with the Little Chick Nest logo', pos: 'object-center',
  },
  {
    kicker: 'For slow mornings',
    title: 'Sip. Smile.',
    accent: 'Support our flock.',
    text: 'Stoneware mugs and gift boxes for anyone who loves our chicks. Every order helps feed and care for them.',
    cta: ['/shop?q=mug', 'Shop mugs'], cta2: ['/shop?q=gift', 'Gift ideas'],
    image: 'hero-3', alt: 'Cream Little Chick Nest mug on a wooden table', pos: 'object-center',
  },
] as const

function Hero() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false) // keyboard users must not have slides change under them
  useEffect(() => {
    if (!playing || hover || focused) return
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 6000)
    return () => clearTimeout(t)
  }, [i, playing, hover, focused])

  return (
    <section aria-roledescription="carousel" aria-label="Featured collections" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}
      className="relative overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-1 md:min-h-[480px] md:grid-cols-[minmax(0,1fr)_1.1fr]">
        {/* every slide's text sits in the same grid cell, so the box is always as tall as the longest slide: no jump between slides.
            pb-20 keeps the dots + pause button clear of the buttons */}
        <div className="relative z-10 order-2 grid px-6 pt-2 pb-20 sm:px-10 md:order-1 md:pt-10 lg:px-12">
          {SLIDES.map((sl, n) => (
            <div key={sl.kicker} aria-hidden={n !== i} className={`flex flex-col justify-center [grid-area:1/1] ${n === i ? 'animate-fade-up' : 'invisible'}`}>
              <p className="script text-2xl">{sl.kicker}</p>
              <h1 className="mt-1 text-[2.4rem] leading-[1.08] sm:text-5xl xl:text-[3.4rem]">
                {sl.title}<br /><span className="text-orange">{sl.accent}</span>
              </h1>
              <p className="mt-4 max-w-md text-[15px] text-ink/80">{sl.text}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to={sl.cta[0]} className="btn-primary">{sl.cta[1]} <ArrowRight className="size-4" aria-hidden /></Link>
                <Link to={sl.cta2[0]} className="btn-ghost">{sl.cta2[1]}</Link>
              </div>
              <p className="mt-6 flex items-center gap-2 text-[13px] text-muted"><Heart className="size-4 fill-orange text-orange" aria-hidden /> Thank you for supporting our flock!</p>
            </div>
          ))}
        </div>
        <div className="relative order-1 aspect-[4/3] overflow-hidden sm:aspect-[3/2] md:order-2 md:aspect-auto">
          {SLIDES.map((sl, n) => (
            <SiteImg key={sl.image} slot={sl.image} alt={n === i ? sl.alt : ''} aria-hidden={n !== i}
              fetchPriority={n === 0 ? 'high' : 'low'} loading={n === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 size-full object-cover ${sl.pos} transition-opacity duration-1000 ${n === i ? 'opacity-100' : 'opacity-0'}`} />
          ))}
          {/* soft fade into the text column, like the main site's hero */}
          <div className="absolute inset-y-0 left-0 hidden w-40 bg-gradient-to-r from-white to-transparent md:block" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent md:hidden" />
        </div>
      </div>
      <div className="absolute bottom-5 left-6 z-20 flex items-center gap-3 sm:left-10 lg:left-12">
        {SLIDES.map((sl, n) => (
          <button key={sl.kicker} type="button" onClick={() => setI(n)} aria-label={`Show slide ${n + 1}: ${sl.kicker}`} aria-current={n === i}
            className="group py-2"><span className={`block h-1 rounded-full transition-all duration-300 ${n === i ? 'w-8 bg-orange' : 'w-4 bg-sand group-hover:bg-olive-3'}`} /></button>
        ))}
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} className="ml-1 rounded-full p-1.5 text-muted hover:bg-cream hover:text-olive">
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
      </div>
    </section>
  )
}

function CategoryCircles({ counts }: { counts: Record<string, number> }) {
  return (
    <section aria-labelledby="cats" className="pt-10 pb-2 sm:pt-12">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-3">
        <h2 id="cats" className="section-title">Shop by category</h2>
        <p className="text-[13px] text-muted">Something for everyone in the nest.</p>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <li key={c}>
            <Link to={`/shop?category=${c}`} className="group flex flex-col items-center text-center">
              <span className="relative size-32 overflow-hidden rounded-full border-4 border-paper shadow-[var(--shadow-soft)] ring-1 ring-line transition duration-300 group-hover:shadow-[var(--shadow-lift)] group-hover:ring-orange sm:size-40">
                <SiteImg slot={categorySlot(c)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
              </span>
              <span className="mt-3 font-display text-lg font-bold text-olive group-hover:text-orange-2">{categoryLabel(c)}</span>
              <span className="text-xs text-muted">{counts[c] ? `${counts[c]} products` : CATEGORY_INFO[c].blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StoryBanner() {
  const pics = [['story-1', 'Cream hoodie with the chick logo'], ['story-2', 'Embroidered cap'], ['story-3', 'Mug with the chick logo']] as const
  return (
    <section className="my-6 grid grid-cols-1 items-center gap-6 overflow-hidden rounded-[1.25rem] border border-line bg-[#fffaf2] p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
      <div className="px-2 py-4 sm:px-4">
        <p className="script text-[1.7rem] text-olive">Wear it · Love it · Support our flock</p>
        <h2 className="mt-1 text-3xl text-orange sm:text-4xl">Every order helps our flock</h2>
        <p className="mt-3 max-w-lg text-ink/80">Little Chick Nest began as live cameras so families could watch chicks grow from day one. Profits from this shop go straight back into feeding, housing and caring for them.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/about" className="btn-primary">Our story</Link>
          <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer" className="btn-ghost">Watch them live</a>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {pics.map(([slot, alt], n) => (
          <SiteImg key={slot} slot={slot} alt={alt} loading="lazy" className={`aspect-[3/4] w-full rounded-xl object-cover shadow-[var(--shadow-soft)] ${n === 1 ? 'translate-y-4' : ''}`} />
        ))}
      </div>
    </section>
  )
}

const WHY = [
  ['Soft', 'Made to last', 'Heavyweight cotton and tidy embroidery that gets better with every wash.'],
  ['Less', 'Printed to order', 'Each piece is made when you order it, so there is no overstock or waste.'],
  ['Gift', 'Easy gifting', 'Gift boxes and sets for every age, ready to wrap.'],
  ['Hi', 'Real people', 'A small family team who will help with sizing, orders and returns.'],
]
function Why() {
  return (
    <section aria-labelledby="why" className="my-8 grid grid-cols-1 items-center gap-8 overflow-hidden rounded-[1.25rem] border border-line bg-paper p-4 shadow-[var(--shadow-soft)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_1.15fr]">
      <SiteImg slot="why" alt="Little Chick Nest gift box with a cap, tee and mug" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
      <div className="px-2 pb-4 lg:pr-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="why" className="text-2xl sm:text-3xl">Why families love our shop</h2>
          <SiteImg slot="chick" alt="" width={96} height={63} className="hidden h-16 w-auto sm:block" />
        </div>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {WHY.map(([badge, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#fdf0c8] text-xs font-bold text-olive">{badge}</span>
              <div><p className="font-semibold text-olive">{title}</p><p className="text-sm text-muted">{text}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const SECTIONS: { cat: Category; title: string; subtitle: string }[] = [
  { cat: 'Men', title: "Men's collection", subtitle: 'Crews, hoodies, tees and caps for everyday.' },
  { cat: 'Women', title: "Women's collection", subtitle: 'Embroidered hoodies in soft, earthy colours.' },
  { cat: 'Kids', title: "Kids' corner", subtitle: 'Little tees, gift sets and cosy scarves.' },
  { cat: 'Accessories', title: 'Accessories', subtitle: 'Caps, mugs, scarves and gift boxes.' },
]

export default function Home() {
  useTitle('')
  const { products, error } = useProducts()
  const byCat = useMemo(() => {
    const out: Record<string, Product[]> = {}
    for (const c of CATEGORIES) out[c] = (products ?? []).filter((p) => inCategory(p, c))
    // bestsellers first, then newest
    for (const k in out) out[k].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || b.created_at.localeCompare(a.created_at))
    return out
  }, [products])
  const counts = Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.length]))

  const carousel = (s: (typeof SECTIONS)[number]) => products && !byCat[s.cat]?.length ? null : (
    <ProductCarousel key={s.cat} id={`c-${s.cat}`} title={s.title} subtitle={s.subtitle} look={lookOf(s.cat)}
      products={products ? (byCat[s.cat] ?? []).slice(0, 6) : null}
      viewMore={{ to: `/shop?category=${s.cat}`, label: `All ${categoryLabel(s.cat).toLowerCase()}`, image: categorySlot(s.cat) }} />
  )

  return (
    <div className="container-x pt-4 sm:pt-6">
      <Hero />
      {error && <div className="mt-6"><Alert>We couldn’t load products right now. Please refresh the page.</Alert></div>}
      <CategoryCircles counts={counts} />
      {SECTIONS.slice(0, 2).map(carousel)}
      <StoryBanner />
      {SECTIONS.slice(2).map(carousel)}
      <Why />
      <TrustBadges />
    </div>
  )
}
