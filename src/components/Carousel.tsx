import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Look, Product } from '../lib/shop'
import { SiteImg, type Slot } from '../lib/siteImages'
import { ProductCard, ProductCardSkeleton } from './ProductCard'

const AUTOPLAY_MS = 4500
const ITEM = 'shrink-0 snap-start w-[calc((100%-16px)/2)] sm:w-[calc((100%-40px)/3)] lg:w-[calc((100%-60px)/4)]'

type Props = {
  id: string
  title: string
  subtitle?: string
  products: Product[] | null
  viewMore?: { to: string; label: string; image?: Slot }
  autoplay?: boolean
  /** shows Unisex products on a man or a woman */
  look?: Look
}

/** Swipeable product row that gently rotates on its own until someone touches it. */
export function ProductCarousel({ id, title, subtitle, products, viewMore, autoplay = true, look }: Props) {
  const track = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const paused = useRef(false)
  const idleUntil = useRef(0)
  const visible = useRef(false)

  const measure = useCallback(() => {
    const el = track.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0')
    const per = Math.max(1, Math.round(el.clientWidth / step))
    const total = Math.max(1, el.children.length - per + 1)
    setPages(total)
    setPage(Math.min(total - 1, Math.round(el.scrollLeft / step)))
  }, [])

  const go = useCallback((dir: 1 | -1 | number, absolute = false) => {
    const el = track.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0')
    const cur = Math.round(el.scrollLeft / step)
    const max = Math.max(0, el.children.length - Math.round(el.clientWidth / step))
    let next = absolute ? dir : cur + dir
    if (next > max) next = 0 // loop back to the start
    if (next < 0) next = max
    el.scrollTo({ left: next * step, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting }, { threshold: 0.4 })
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect() }
  }, [measure, products])

  useEffect(() => {
    if (!autoplay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      if (paused.current || !visible.current || document.hidden || Date.now() < idleUntil.current) return
      go(1)
    }, AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [autoplay, go])

  const userTouched = () => { idleUntil.current = Date.now() + 10_000 }
  const count = products?.length ?? 0

  return (
    <section aria-labelledby={`${id}-title`} aria-roledescription="carousel" className="py-8 sm:py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={`${id}-title`} className="section-title">{title}</h2>
          {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {viewMore && <Link to={viewMore.to} className="btn-link mr-1 hidden sm:inline-flex">View more <ArrowRight className="size-3.5" aria-hidden /></Link>}
          <button type="button" onClick={() => { userTouched(); go(-1) }} aria-controls={`${id}-track`} aria-label={`Previous ${title}`}
            className="grid size-9 place-items-center rounded-full border border-sand bg-paper text-olive transition hover:border-orange hover:text-orange"><ChevronLeft className="size-4" aria-hidden /></button>
          <button type="button" onClick={() => { userTouched(); go(1) }} aria-controls={`${id}-track`} aria-label={`Next ${title}`}
            className="grid size-9 place-items-center rounded-full border border-sand bg-paper text-olive transition hover:border-orange hover:text-orange"><ChevronRight className="size-4" aria-hidden /></button>
        </div>
      </div>

      <ul
        id={`${id}-track`} ref={track} aria-live="off"
        onScroll={measure} onPointerDown={userTouched} onWheel={userTouched}
        onMouseEnter={() => { paused.current = true }} onMouseLeave={() => { paused.current = false }}
        onFocus={() => { paused.current = true }} onBlur={() => { paused.current = false }}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto scroll-smooth px-1 pb-2 sm:gap-5"
      >
        {!products ? Array.from({ length: 4 }, (_, i) => <li key={i} className={ITEM}><ProductCardSkeleton /></li>)
          : products.map((p, i) => (
            <li key={p.id} className={ITEM} aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              <ProductCard product={p} look={look} />
            </li>
          ))}
        {products && viewMore && (
          <li className={ITEM}>
            <Link to={viewMore.to} className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-card)] bg-olive p-6 text-center text-white">
              {viewMore.image && <SiteImg slot={viewMore.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-25 transition duration-700 group-hover:scale-105 group-hover:opacity-35" />}
              <span className="relative script text-2xl text-yolk">See them all</span>
              <span className="relative font-display text-xl font-bold">{viewMore.label}</span>
              <span className="relative grid size-11 place-items-center rounded-full bg-orange transition-transform group-hover:translate-x-1"><ArrowRight className="size-5" aria-hidden /></span>
            </Link>
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-hidden>
          {pages > 1 && Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" tabIndex={-1} onClick={() => { userTouched(); go(i, true) }}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === page ? 'w-6 bg-orange' : 'w-1.5 bg-sand hover:bg-olive-3'}`} />
          ))}
        </div>
        {viewMore && <Link to={viewMore.to} className="btn-link sm:hidden">View more <ArrowRight className="size-3.5" aria-hidden /></Link>}
      </div>
    </section>
  )
}
