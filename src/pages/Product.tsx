import { Box, ChevronLeft, ChevronRight, Heart, Images, RotateCcw, Ruler, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ProductCarousel } from '../components/Carousel'
import { Accordion, Alert, Breadcrumbs, Field, Modal, QtyStepper, Spinner, Stars, useTitle } from '../components/ui'
import { useAuth } from '../context/auth'
import { useCart } from '../context/cart'
import { useWishlist } from '../context/wishlist'
import { useCurrency } from '../lib/currency'
import { asLook, categoryLabel, deliveryWindow, formatDate, formatMoney, hasLooks, LOOKS, modelLink, priceLabel, priceOf, productImages, type Look, type Product as P } from '../lib/shop'
import { supabase } from '../lib/supabase'
import { useProducts, useShopConfig } from '../lib/useProducts'
import NotFound from './NotFound'

type Review = { id: string; author_name: string; rating: number; body: string; created_at: string }

export default function Product() {
  const { id } = useParams()
  const { products, loading, error } = useProducts()
  const [params] = useSearchParams()
  const product = products?.find((p) => p.id === id)
  useTitle(product?.title ?? 'Product')

  if (loading) return <Spinner />
  if (error) return <div className="container-x py-10"><Alert>Could not load this product. Please refresh.</Alert></div>
  if (!product) return <NotFound />
  const related = (products ?? []).filter((p) => p.category === product.category && p.id !== product.id)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured)).slice(0, 8)
  return (
    <>
      <ProductView key={product.id} product={product} />
      {related.length > 0 && (
        <div className="container-x">
          <ProductCarousel id="related" title="You may also like" subtitle={`More from ${categoryLabel(product.category).toLowerCase()}`} products={related} autoplay={false} look={asLook(params.get('look'))}
            viewMore={{ to: `/shop?category=${product.category}`, label: `All ${categoryLabel(product.category).toLowerCase()}` }} />
        </div>
      )}
    </>
  )
}

/** Splits a plain-text description into paragraphs and "- " bullet lists. */
function Description({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => { if (bullets.length) blocks.push(<ul key={blocks.length} className="mb-3 list-disc space-y-1 pl-5 marker:text-orange">{bullets.map((b) => <li key={b}>{b}</li>)}</ul>); bullets = [] }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('- ') || t.startsWith('• ')) bullets.push(t.slice(2))
    else { flush(); if (t) blocks.push(<p key={blocks.length} className="mb-3">{t}</p>) }
  }
  flush()
  return <>{blocks}</>
}

/** Photos, plus Gelato's 3D preview of the colour when there is one: `in3d` lives in the page so it stays on while the colour changes. */
function Gallery({ images, alt, model, in3d, set3d }: { images: string[]; alt: string; model: string | null; in3d: boolean; set3d: (on: boolean) => void }) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState<string | null>(null)
  const track = useRef<HTMLDivElement>(null)
  const i = Math.min(active, Math.max(0, images.length - 1))

  const go = (n: number) => {
    const next = (n + images.length) % images.length
    setActive(next)
    const el = track.current
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  const show3d = !!model && (in3d || !images.length)
  // the photo track remounts at the first photo after 3D view: scroll it back to the selected one
  useEffect(() => {
    const el = track.current
    if (!show3d && el) el.scrollLeft = i * el.clientWidth
  }, [show3d]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!images.length && !model) return <div className="grid aspect-square place-items-center rounded-[var(--radius-card)] bg-cream-2 text-muted">Image coming soon</div>
  return (
    <div className="lg:sticky lg:top-24">
      <div className="group relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
        {show3d ? (
          <iframe key={model} src={model} title={`${alt}, 3D preview`} allow="fullscreen; xr-spatial-tracking" className="block aspect-square w-full bg-white" />
        ) : <div ref={track} onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="no-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto">
          {images.map((src, n) => (
            <div key={src} className="relative size-full shrink-0 snap-center overflow-hidden"
              onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`) }}
              onMouseLeave={() => setZoom(null)}>
              <img src={src} alt={n === 0 ? alt : `${alt}, view ${n + 1}`} loading={n === 0 ? 'eager' : 'lazy'} fetchPriority={n === 0 ? 'high' : undefined}
                style={zoom && n === i ? { transformOrigin: zoom, transform: 'scale(1.8)' } : undefined}
                className="size-full cursor-zoom-in object-cover transition-transform duration-200 ease-out" />
            </div>
          ))}
        </div>}
        {model && images.length > 0 && (
          <button type="button" onClick={() => set3d(!show3d)} aria-pressed={show3d}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-olive px-3.5 py-2 text-[13px] font-semibold text-white shadow-md transition hover:bg-olive-2">
            {show3d ? <><Images className="size-4" aria-hidden /> Photos</> : <><Box className="size-4" aria-hidden /> 3D view</>}
          </button>
        )}
        {show3d && <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[12px] font-medium text-olive shadow-sm">Drag to turn it around</p>}
        {!show3d && images.length > 1 && (
          <>
            <button type="button" onClick={() => go(i - 1)} aria-label="Previous image" className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-olive opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><ChevronLeft className="size-5" aria-hidden /></button>
            <button type="button" onClick={() => go(i + 1)} aria-label="Next image" className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-olive opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><ChevronRight className="size-5" aria-hidden /></button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
              {images.map((src, n) => <span key={src} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-orange' : 'w-1.5 bg-white/80'}`} />)}
            </div>
          </>
        )}
      </div>
      {(images.length > 1 || (model && images.length > 0)) && (
        <div className="mt-3 hidden flex-wrap gap-3 sm:flex">
          {images.map((g, n) => (
            <button key={g} type="button" onClick={() => { set3d(false); requestAnimationFrame(() => go(n)) }} aria-label={`Show image ${n + 1}`} aria-current={!show3d && n === i}
              className={`size-20 overflow-hidden rounded-lg border-2 bg-paper transition ${!show3d && n === i ? 'border-orange' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={g} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
          {model && (
            <button type="button" onClick={() => set3d(true)} aria-label="Show 3D preview" aria-current={show3d}
              className={`grid size-20 place-items-center rounded-lg border-2 bg-cream-2 text-olive transition ${show3d ? 'border-orange' : 'border-transparent hover:border-sand'}`}>
              <span className="flex flex-col items-center gap-0.5 text-[12px] font-bold"><Box className="size-6 text-orange" aria-hidden />3D</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const ADULT_GUIDE = [['XS', '34–36', '27'], ['S', '36–38', '28'], ['M', '38–40', '29'], ['L', '40–42', '30'], ['XL', '42–44', '31'], ['2XL', '44–46', '32']]
const KIDS_GUIDE = [['3-4Y', '39–41', '98–104'], ['3-5Y', '39–43', '98–110'], ['5-6Y', '41–45', '110–116'], ['6-8Y', '45–50', '116–128'], ['7-8Y', '45–50', '122–128'], ['9-10Y', '50–55', '134–140'], ['9-12Y', '50–60', '134–152'], ['11-12Y', '55–60', '146–152']]
function SizeGuide({ sizes, tables: raw }: { sizes: string[]; tables: string[][][] }) {
  // stored JSON is unchecked: skip tables without a header row so a bad one can't crash the page
  const tables = (Array.isArray(raw) ? raw : []).filter((t) => Array.isArray(t) && t.length > 0 && t.every((r) => Array.isArray(r) && r.length > 0 && r.every((c) => typeof c === 'string' || typeof c === 'number')))
  if (tables.length) return (
    <div className="space-y-5">
      {tables.map((t, i) => (
        <div key={i} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-2 text-olive"><tr>{t[0].map((h, n) => <th key={n} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{t.slice(1).map((r) => <tr key={r[0]}>{r.map((c, n) => <td key={n} className={`px-3 py-2.5 ${n === 0 ? 'font-semibold' : ''}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ))}
    </div>
  )
  const kids = sizes.some((s) => s.endsWith('Y'))
  const rows = (kids ? KIDS_GUIDE : ADULT_GUIDE).filter(([s]) => sizes.includes(s))
  return (
    <>
      <p className="mb-4 text-sm text-muted">{kids ? 'Measurements in centimetres. If between sizes, choose the larger one so there is room to grow.' : 'Chest measured around the fullest part, in inches. Our fit is relaxed; size down for a closer fit.'}</p>
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-2 text-olive"><tr>{(kids ? ['Age', 'Chest (cm)', 'Height (cm)'] : ['Size', 'Chest (in)', 'Length (in)']).map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r[0]}>{r.map((c, n) => <td key={n} className={`px-4 py-2.5 ${n === 0 ? 'font-semibold' : ''}`}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

function ProductView({ product }: { product: P }) {
  const { add } = useCart()
  const { has, toggle } = useWishlist()
  const cfg = useShopConfig()
  useCurrency()
  const [params] = useSearchParams()
  const [color, setColor] = useState((product.variants.find((v) => v.color === params.get('color')) ?? product.variants[0])?.color ?? null)
  const variant = product.variants.find((v) => v.color === color)
  const sizes = variant?.sizes ?? []
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [needSize, setNeedSize] = useState(false)
  const [guide, setGuide] = useState(false)
  const [showBar, setShowBar] = useState(false)
  const buyRef = useRef<HTMLDivElement>(null)
  const looks = hasLooks(product)
  const [look, setLook] = useState<Look | undefined>(() => (looks ? asLook(params.get('look')) : undefined))
  const images = useMemo(() => productImages(product, color, size, look), [product, color, size, look])
  const model = modelLink(product, color)
  const [in3d, set3d] = useState(false)
  const saved = has(product.id)
  const noPhotos = !!variant && !variant.images.length && !product.images.length && images.length > 0
  const option = variant?.option ?? 'Size'
  const price = size || !sizes.length ? formatMoney(priceOf(product, color, size)) : priceLabel({
    price: Math.min(...sizes.map((s) => priceOf(product, color, s))),
    prices: Object.fromEntries(sizes.map((s) => [s, priceOf(product, color, s)])),
  })

  // sticky add-to-basket bar on phones once the main button scrolls away
  useEffect(() => {
    const el = buyRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const pickColor = (c: string) => {
    setColor(c)
    // keep the chosen size only if the new colour offers it
    if (size && !product.variants.find((v) => v.color === c)?.sizes.includes(size)) setSize(null)
  }

  const addToCart = () => {
    if (sizes.length && !size) {
      setNeedSize(true)
      buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    add({ product_id: product.id, color, size: sizes.length ? size : null, quantity: qty })
  }

  return (
    <div className="container-x pt-6 pb-4">
      <Breadcrumbs items={[[categoryLabel(product.category), `/shop?category=${product.category}`], [product.title]]} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          {looks && (
            <div role="group" aria-label="See it worn by" className="mb-3 flex items-center gap-2 text-[13px]">
              <span className="text-muted">See it on</span>
              {([[undefined, 'Everyone'], ...Object.entries(LOOKS)] as [Look | undefined, string][]).map(([k, label]) => (
                <button key={label} type="button" onClick={() => { setLook(k); set3d(false) }} aria-pressed={look === k}
                  className={`rounded-full border px-3.5 py-1.5 font-semibold transition ${look === k ? 'border-olive bg-olive text-white' : 'border-sand bg-paper text-olive hover:border-olive'}`}>{label}</button>
              ))}
            </div>
          )}
          <Gallery key={`${look}${images[0]}`} images={images} alt={`${product.title}${color && !noPhotos ? ` in ${color}` : ''}`} model={model} in3d={in3d} set3d={set3d} />
          {noPhotos && <p className="mt-3 text-center text-[13px] text-muted">Photo shows another colour. Yours will be made in <strong className="text-olive">{color}</strong>.</p>}
        </div>

        <div className="min-w-0">
          <Link to={`/shop?category=${product.category}`} className="label-caps hover:text-orange-2">{categoryLabel(product.category)}</Link>
          <h1 className="mt-2 text-[1.9rem] leading-tight sm:text-[2.3rem]">{product.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-2xl font-semibold text-olive">{price}</p>
            {product.rating_count > 0 && product.rating_avg != null && (
              <button type="button" title="Jump to reviews" onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-1.5 text-sm text-muted hover:text-olive"><Stars value={product.rating_avg} /> {product.rating_count} review{product.rating_count === 1 ? '' : 's'}</button>
            )}
          </div>
          {cfg && cfg.free_shipping_over > 0 && <p className="mt-1 text-[13px] text-muted">Free standard delivery on orders over {formatMoney(cfg.free_shipping_over)}</p>}

          {/* a product sold in sizes only has one "Standard" colour: nothing to choose */}
          {product.variants.length > 0 && !(product.variants.length === 1 && product.variants[0].color === 'Standard') && (
            <fieldset className="mt-7">
              <legend className="mb-3 text-sm text-ink">Colour: <span className="font-semibold text-olive">{color}</span></legend>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((v) => (
                  <button key={v.color} type="button" onClick={() => pickColor(v.color)} aria-pressed={v.color === color} aria-label={v.color} title={v.color}
                    className={`grid size-11 place-items-center rounded-full border-2 transition ${v.color === color ? 'border-olive' : 'border-transparent hover:border-sand'}`}>
                    <span className="size-8 rounded-full ring-1 ring-black/10" style={{ background: v.hex ?? '#ddd' }} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {sizes.length > 0 && (
            <fieldset className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <legend className="text-sm text-ink">{option === 'Size' ? 'Size' : 'Option'}: <span className="font-semibold text-olive">{size ?? (option === 'Size' ? 'Choose a size' : option)}</span></legend>
                {option === 'Size' && <button type="button" onClick={() => setGuide(true)} className="flex items-center gap-1.5 text-[13px] font-medium text-olive underline underline-offset-2 hover:text-orange-2"><Ruler className="size-4" aria-hidden /> Size guide</button>}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button key={s} type="button" onClick={() => { setSize(s); setNeedSize(false) }} aria-pressed={s === size}
                    className={`min-h-11 overflow-hidden rounded-md border text-sm ${variant?.by_option?.[s]?.[0] ? 'w-28 sm:w-32' : 'min-w-14 px-3'} font-medium transition ${s === size ? 'border-olive bg-olive text-white' : needSize ? 'border-red-300 bg-paper' : 'border-sand bg-paper hover:border-olive'}`}>
                    {variant?.by_option?.[s]?.[0] && <img src={variant.by_option[s][0]} alt="" className="aspect-square w-full bg-cream-2 object-cover" />}
                    <span className="block py-2">{s}</span>
                  </button>
                ))}
              </div>
              {needSize && <p role="alert" className="mt-2 text-sm font-medium text-red-700">Please choose {option === 'Size' ? 'a size' : 'an option'} first.</p>}
            </fieldset>
          )}

          <div ref={buyRef} className="mt-7 flex gap-2 sm:gap-3">
            <QtyStepper value={qty} onChange={setQty} />
            <button type="button" onClick={addToCart} className="btn-primary min-w-0 flex-1 px-3 sm:px-5"><ShoppingBag className="hidden size-4 sm:block" aria-hidden /> Add to basket</button>
            <button type="button" onClick={() => toggle(product.id, product.title)} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
              className={`grid size-11 shrink-0 place-items-center rounded-md border transition ${saved ? 'border-orange bg-orange-soft text-orange' : 'border-sand bg-paper text-olive hover:border-orange hover:text-orange'}`}>
              <Heart className={`size-5 ${saved ? 'fill-orange' : ''}`} aria-hidden />
            </button>
          </div>

          <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-paper text-[13px]">
            <li className="flex gap-3 p-4"><Truck className="size-5 shrink-0 text-orange" aria-hidden /><span><strong className="font-semibold text-olive">Estimated delivery {deliveryWindow('standard')}</strong><br /><span className="text-muted">Printed for you in 2–4 working days, then shipped with tracking.</span></span></li>
            <li className="flex gap-3 p-4"><RotateCcw className="size-5 shrink-0 text-orange" aria-hidden /><span className="text-muted"><strong className="font-semibold text-olive">Faulty or wrong item?</strong> We’ll replace or refund it within 30 days.</span></li>
            <li className="flex gap-3 p-4"><ShieldCheck className="size-5 shrink-0 text-orange" aria-hidden /><span className="text-muted"><strong className="font-semibold text-olive">Secure checkout.</strong> Payments are processed by Stripe. We never see your card.</span></li>
          </ul>

          <div className="mt-6">
            <Accordion title="Description" defaultOpen>{product.description ? <Description text={product.description} /> : <p>Made to order with care.</p>}</Accordion>
            <Accordion title="Delivery & returns">
              <p className="mb-2">Standard delivery {cfg ? `${formatMoney(cfg.shipping_flat)}, free over ${formatMoney(cfg.free_shipping_over)}` : ''} · Express {cfg ? formatMoney(cfg.express_shipping) : ''}.</p>
              <p>Because every item is made for you, we can’t accept returns for change of mind, but if anything arrives damaged, faulty or wrong we’ll put it right. <Link to="/shipping-returns" className="font-medium text-orange-2 underline">Read the full policy</Link>.</p>
            </Accordion>
            <Accordion title="Care">
              <p>Wash inside out at 30°C with similar colours. Do not tumble dry or iron over the print or embroidery. Mugs are dishwasher and microwave safe.</p>
            </Accordion>
          </div>
        </div>
      </div>

      <Reviews productId={product.id} />

      <Modal open={guide} onClose={() => setGuide(false)} title="Size guide"><SizeGuide sizes={sizes} tables={product.size_guide} /></Modal>

      <div aria-hidden={!showBar} className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.2)] backdrop-blur transition-transform duration-300 lg:hidden ${showBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{product.title}</p><p className="text-sm font-semibold text-olive">{price}{size && <span className="font-normal text-muted"> · {size}</span>}</p></div>
          <button type="button" tabIndex={showBar ? 0 : -1} onClick={addToCart} className="btn-primary">{sizes.length && !size ? (option === 'Size' ? 'Choose size' : 'Choose option') : 'Add to basket'}</button>
        </div>
      </div>
    </div>
  )
}

function Reviews({ productId }: { productId: string }) {
  const { session } = useAuth()
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [reviewsFailed, setReviewsFailed] = useState(false)
  const [reviewsTry, setReviewsTry] = useState(0)
  const [writing, setWriting] = useState(false)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setReviewsFailed(false)
    supabase.rpc('product_reviews', { p_product_id: productId }).then(({ data, error }) => (error ? setReviewsFailed(true) : setReviews(data ?? [])))
  }, [productId, reviewsTry])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.from('reviews').insert({ product_id: productId, rating, body: body.trim() })
    setBusy(false)
    if (!error) {
      setBody('')
      return setMsg({ tone: 'success', text: 'Thank you! Your review will appear once our team has checked it.' })
    }
    setMsg({
      tone: 'error',
      text: error.code === '23505' ? 'You’ve already reviewed this product.'
        : error.code === '42501' ? 'Only customers who bought this product can review it.'
        : 'Could not post your review. Please try again.',
    })
  }

  const avg = reviews?.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-14 scroll-mt-24 border-t border-line pt-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div>
          <h2 id="reviews-title" className="text-2xl">Customer reviews</h2>
          {reviews && reviews.length > 0 && <p className="mt-2 flex items-center gap-2"><Stars value={avg} /> <span className="text-sm text-muted">{avg.toFixed(1)} out of 5 · {reviews.length} review{reviews.length === 1 ? '' : 's'}</span></p>}
          <p className="mt-2 text-sm text-muted">Reviews come from verified buyers and are checked by our team.</p>
          {!writing && (session
            ? <button type="button" onClick={() => setWriting(true)} className="btn-ghost mt-4">Write a review</button>
            : <Link to={`/login?next=/product/${productId}`} className="btn-ghost mt-4">Sign in to review</Link>)}
          {writing && (
            <form onSubmit={submit} className="card mt-4 space-y-4 p-5">
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-olive">Your rating</legend>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n === rating}
                      className={`text-3xl leading-none transition ${n <= rating ? 'text-yolk' : 'text-sand hover:text-yolk/60'}`}>★</button>
                  ))}
                </div>
              </fieldset>
              <Field label="Your review"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} placeholder="How does it fit and feel?" className="input" /></Field>
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
              <div className="flex gap-2"><button className="btn-dark flex-1" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button><button type="button" onClick={() => setWriting(false)} className="btn-ghost">Cancel</button></div>
            </form>
          )}
        </div>
        <div>
          {reviewsFailed ? <p className="text-muted">Reviews couldn’t load. <button type="button" onClick={() => setReviewsTry((n) => n + 1)} className="font-semibold text-orange-2 underline">Try again</button></p> : !reviews ? <Spinner label="Loading reviews" /> : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand p-8 text-center text-muted">No reviews yet. Bought this? Be the first to share how you like it.</div>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="card p-5">
                  <div className="flex items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-muted">{formatDate(r.created_at)}</span></div>
                  {r.body && <p className="mt-2 whitespace-pre-line text-ink/85">{r.body}</p>}
                  <p className="mt-2 text-sm font-semibold text-olive">{r.author_name} <span className="font-normal text-muted">· Verified buyer</span></p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
