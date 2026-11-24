import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { Alert, Empty, Modal, PageHeader, useTitle } from '../components/ui'
import { CATEGORIES, CATEGORY_INFO, categoryLabel, inCategory as isIn, type Product } from '../lib/shop'
import { useProducts } from '../lib/useProducts'

const SORTS = { featured: 'Featured', new: 'Newest', 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low', az: 'Name: A to Z' } as const
type Sort = keyof typeof SORTS
const PRICES = { under30: ['Under $30', 0, 30], '30to50': ['$30 – $50', 30, 50], over50: ['Over $50', 50, Infinity] } as const
type PriceKey = keyof typeof PRICES
const SIZE_ORDER = ['NEWBORN', '6M', '12M', '18M', '24M', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '3-4Y', '3-5Y', '5-6Y', '6-8Y', '7-8Y', '9-10Y', '9-12Y', '11-12Y']

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const category = CATEGORIES.find((c) => c === params.get('category')) ?? null
  const sort: Sort = (params.get('sort') ?? '') in SORTS ? (params.get('sort') as Sort) : 'featured'
  const q = params.get('q') ?? ''
  const colors = list(params.get('color'))
  const sizes = list(params.get('size'))
  const price = (params.get('price') ?? '') in PRICES ? (params.get('price') as PriceKey) : null
  const query = useDeferredValue(q.trim().toLowerCase())
  const { products, loading, error } = useProducts()
  const [filtersOpen, setFiltersOpen] = useState(false)
  useTitle(category ? categoryLabel(category) : q ? `Search: ${q}` : 'Shop all')

  const set = (key: string, value: string | null) =>
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
      return p
    }, { replace: true })
  const toggleIn = (key: 'color' | 'size', cur: string[], v: string) =>
    set(key, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',') || null)
  const clearAll = () => setParams((p) => { ['color', 'size', 'price', 'q'].forEach((k) => p.delete(k)); return p }, { replace: true })

  const inCategory = useMemo(() => (products ?? []).filter((p) => !category || isIn(p, category)), [products, category])

  // facets come from what's actually in this category
  const facets = useMemo(() => {
    const c = new Map<string, string>(), s = new Set<string>()
    for (const p of inCategory) for (const v of p.variants) { c.set(v.color, v.hex ?? '#ccc'); v.sizes.forEach((x) => s.add(x)) }
    const sz = [...s].sort((a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99))
    return { colors: [...c.entries()].sort(([a], [b]) => a.localeCompare(b)), sizes: sz }
  }, [inCategory])

  const shown = useMemo(() => {
    const out = inCategory.filter((p) =>
      (!query || [p.title, p.description, p.category, ...p.variants.map((v) => v.color)].join(' ').toLowerCase().includes(query)) &&
      (!colors.length || p.variants.some((v) => colors.includes(v.color))) &&
      (!sizes.length || p.variants.some((v) => v.sizes.some((s) => sizes.includes(s)))) &&
      (!price || (p.price >= PRICES[price][1] && p.price < PRICES[price][2])))
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      featured: (a, b) => Number(b.is_featured) - Number(a.is_featured) || b.created_at.localeCompare(a.created_at),
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      az: (a, b) => a.title.localeCompare(b.title),
    }
    return out.sort(by[sort])
  }, [inCategory, query, colors, sizes, price, sort])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of CATEGORIES) m[c] = (products ?? []).filter((p) => isIn(p, c)).length
    return m
  }, [products])

  const active = [
    ...(q ? [{ label: `“${q}”`, clear: () => set('q', null) }] : []),
    ...colors.map((c) => ({ label: c, clear: () => toggleIn('color', colors, c) })),
    ...sizes.map((s) => ({ label: `Size ${s}`, clear: () => toggleIn('size', sizes, s) })),
    ...(price ? [{ label: PRICES[price][0], clear: () => set('price', null) }] : []),
  ]

  const filters = (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-[13px] font-bold tracking-wider text-olive uppercase">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {facets.colors.map(([c, hex]) => (
            <button key={c} type="button" onClick={() => toggleIn('color', colors, c)} aria-pressed={colors.includes(c)}
              className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] transition ${colors.includes(c) ? 'border-olive bg-olive text-white' : 'border-sand bg-paper hover:border-olive-3'}`}>
              <span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: hex }} />{c}
            </button>
          ))}
        </div>
      </fieldset>
      {facets.sizes.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-[13px] font-bold tracking-wider text-olive uppercase">Size</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button key={s} type="button" onClick={() => toggleIn('size', sizes, s)} aria-pressed={sizes.includes(s)}
                className={`min-w-11 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition ${sizes.includes(s) ? 'border-olive bg-olive text-white' : 'border-sand bg-paper hover:border-olive-3'}`}>{s}</button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-3 text-[13px] font-bold tracking-wider text-olive uppercase">Price</legend>
        <div className="space-y-2">
          {(Object.keys(PRICES) as PriceKey[]).map((k) => (
            <label key={k} className="flex items-center gap-2.5 text-sm">
              <input type="radio" name="price" checked={price === k} onChange={() => set('price', k)} className="size-4 accent-orange" />{PRICES[k][0]}
            </label>
          ))}
          {price && <button type="button" onClick={() => set('price', null)} className="text-xs font-medium text-orange-2 underline">Any price</button>}
        </div>
      </fieldset>
    </div>
  )

  return (
    <>
      <PageHeader eyebrow={category ? 'Shop' : 'The collection'} title={category ? categoryLabel(category) : q ? `Results for “${q}”` : 'Shop all'}
        crumbs={category ? [['Shop', '/shop'], [categoryLabel(category)]] : [['Shop']]}>
        {category ? CATEGORY_INFO[category].blurb + '. ' : ''}Printed and embroidered to order, just for you.
      </PageHeader>

      <div className="container-x">
        <div role="tablist" aria-label="Category" className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
          {([[null, 'All'], ...CATEGORIES.map((c) => [c, categoryLabel(c)])] as [string | null, string][]).map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={category === value}
              onClick={() => setParams((p) => { if (value) p.set('category', value); else p.delete('category'); p.delete('color'); p.delete('size'); return p }, { replace: true })}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold tracking-wide uppercase transition ${category === value ? 'bg-orange text-white shadow-[0_6px_14px_-6px_rgb(252_91_19/0.6)]' : 'border border-sand bg-paper text-olive hover:border-orange hover:text-orange-2'}`}>
              {label}{products && <span className={`ml-1.5 text-[11px] ${category === value ? 'text-white/80' : 'text-muted'}`}>{value ? counts[value] ?? 0 : products.length}</span>}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-24">{filters}</div>
          </aside>

          <div>
            <div className="mb-4 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
              <button type="button" onClick={() => setFiltersOpen(true)} className="btn-ghost min-h-10 w-full py-2 sm:w-auto lg:hidden">
                <SlidersHorizontal className="size-4" aria-hidden /> Filters{active.length > 0 && ` (${active.length})`}
              </button>
              <label className="relative order-first col-span-2 min-w-0 sm:order-none sm:col-auto sm:flex-1 sm:max-w-xs">
                <span className="sr-only">Search in shop</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" value={q} onChange={(e) => set('q', e.target.value || null)} placeholder="Search products" className="input min-h-10 rounded-full py-2 pl-9" maxLength={80} />
              </label>
              <p className="ml-auto hidden text-sm text-muted sm:block" aria-live="polite">{!loading && `${shown.length} product${shown.length === 1 ? '' : 's'}`}</p>
              <label className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden text-muted sm:inline">Sort</span>
                <select value={sort} onChange={(e) => set('sort', e.target.value === 'featured' ? null : e.target.value)} className="input min-h-10 w-full py-2 pr-8 sm:w-auto" aria-label="Sort products">
                  {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>

            {active.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {active.map((a) => (
                  <button key={a.label} type="button" onClick={a.clear} className="flex items-center gap-1.5 rounded-full bg-olive py-1 pr-2 pl-3 text-xs font-medium text-white hover:bg-olive-2">
                    {a.label}<X className="size-3.5" aria-label="Remove filter" />
                  </button>
                ))}
                <button type="button" onClick={clearAll} className="text-xs font-semibold text-orange-2 underline">Clear all</button>
              </div>
            )}

            {error ? <Alert>We couldn’t load products right now. Please refresh the page.</Alert>
              : loading ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
              ) : shown.length ? (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
                  {shown.map((p, i) => <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}><ProductCard product={p} priority={i < 4} /></li>)}
                </ul>
              ) : (
                <Empty title={active.length ? 'Nothing matches those filters' : 'New designs are hatching'}>
                  {active.length ? <button type="button" onClick={clearAll} className="btn-primary mt-2">Clear filters</button> : 'Check back very soon. 🐣'}
                </Empty>
              )}
          </div>
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        {filters}
        <div className="sticky bottom-0 mt-6 flex gap-2 bg-paper pt-3">
          <button type="button" onClick={clearAll} className="btn-ghost flex-1">Clear</button>
          <button type="button" onClick={() => setFiltersOpen(false)} className="btn-primary flex-[2]">Show {shown.length} product{shown.length === 1 ? '' : 's'}</button>
        </div>
      </Modal>
    </>
  )
}
