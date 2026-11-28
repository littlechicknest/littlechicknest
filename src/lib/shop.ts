import { currency, usdRate } from './currency'
import type { Json } from './database.types'

export const CATEGORIES = ['Men', 'Women', 'Kids', 'Accessories'] as const
export type Category = (typeof CATEGORIES)[number]
/** "Men's", "Women's", "Kids'", "Accessories" */
export const categoryLabel = (c: string) => (c === 'Accessories' || c === 'Unisex' ? c : c.endsWith('s') ? `${c}'` : `${c}'s`)

/** Unisex products are listed under both Men and Women (see `Look`). */
export const inCategory = (p: { category: string }, c: string) =>
  p.category === c || (p.category === 'Unisex' && (c === 'Men' || c === 'Women'))

export const CATEGORY_INFO: Record<Category, { blurb: string }> = {
  Men: { blurb: 'Crew sweatshirts, hoodies, tees and caps' },
  Women: { blurb: 'Embroidered hoodies in nine soft colours' },
  Kids: { blurb: 'Little tees, gift sets and cosy scarves' },
  Accessories: { blurb: 'Caps, mugs, scarves and gift boxes' },
}

/** Which pictures of a Unisex product to show: worn by a man, or by a woman. */
export type Look = 'men' | 'women'
export const LOOKS: Record<Look, string> = { men: 'Men', women: 'Women' }
/** The look a shop category asks for: the Men page shows Unisex products on men. */
export const lookOf = (category: string | null | undefined): Look | undefined =>
  category === 'Men' ? 'men' : category === 'Women' ? 'women' : undefined
export const asLook = (v: string | null | undefined): Look | undefined => (v === 'men' || v === 'women' ? v : undefined)

/** Where a product's category links to. With the Unisex category hidden (admin setting), a Unisex product points to Men's / Women's instead. */
export const categoryLink = (category: string, showUnisex: boolean, look?: Look): { label: string; to: string } =>
  category !== 'Unisex' || showUnisex ? { label: categoryLabel(category), to: `/shop?category=${category}` }
    : look ? { label: categoryLabel(LOOKS[look]), to: `/shop?category=${LOOKS[look]}` }
    : { label: "Men's & Women's", to: '/shop' }

const LOOK_WORDS: Record<string, Look> = {
  men: 'men', man: 'men', mens: 'men', "men's": 'men', male: 'men', males: 'men', gents: 'men',
  women: 'women', woman: 'women', womens: 'women', "women's": 'women', female: 'women', females: 'women', ladies: 'women', lady: 'women',
}
/** "hoodie male" -> { look: 'men', rest: 'hoodie' }: a man / woman word in the search chooses whose pictures to show instead of being matched as text. */
export const lookInSearch = (query: string): { look?: Look; rest: string } => {
  const words = query.trim().split(/\s+/).filter(Boolean)
  return { look: words.map((w) => LOOK_WORDS[w.toLowerCase()]).find(Boolean), rest: words.filter((w) => !LOOK_WORDS[w.toLowerCase()]).join(' ') }
}

/** `option` names what `sizes` holds when it isn't sizes (e.g. a design choice); `by_option` holds the photos of each choice.
 *  `men` / `women`: the colour's photos with a man / a woman in them (and none of Gelato's plain mockup); only on Unisex products that have them. */
export type Variant = { color: string; hex?: string; option?: string; sizes: string[]; images: string[]; by_option?: Record<string, string[]>; men?: string[]; women?: string[] }

export type Product = {
  id: string
  title: string
  description: string
  category: string
  /** lowest price; prices holds every "colour|size" that differs */
  price: number
  prices: Record<string, number>
  variants: Variant[]
  images: string[]
  size_guide: string[][][]
  is_featured: boolean
  created_at: string
  rating_avg: number | null
  rating_count: number
  /** colour -> .glb 3D model link ('' = every colour) */
  models: Record<string, string>
}

export type OrderItem = {
  product_id: string
  title: string
  color: string | null
  size: string | null
  quantity: number
  unit_price: number
  image: string | null
}

export type Address = {
  name: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  phone: string
}
export const EMPTY_ADDRESS: Address = { name: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'US', phone: '' }

export const asAddress = (v: Json | null | undefined): Address | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, Json | undefined>
  const s = (k: keyof Address) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return { name: s('name'), line1: s('line1'), line2: s('line2'), city: s('city'), state: s('state'), postal_code: s('postal_code'), country: s('country') || 'US', phone: s('phone') }
}

// Same list as the create-checkout-session Edge Function
export const COUNTRIES: [string, string][] = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['NZ', 'New Zealand'], ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'], ['BE', 'Belgium'],
  ['ES', 'Spain'], ['IT', 'Italy'], ['PT', 'Portugal'], ['AT', 'Austria'], ['DK', 'Denmark'], ['SE', 'Sweden'],
  ['NO', 'Norway'], ['FI', 'Finland'], ['PL', 'Poland'], ['CH', 'Switzerland'],
]
export const countryName = (code: string) => COUNTRIES.find(([c]) => c === code)?.[1] ?? code

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
/** Always US dollars: what was or will be charged (orders, checkout). */
export const formatUsd = (n: number | string | null | undefined) => usd.format(Number(n ?? 0))
/** A USD amount in the shopper's chosen currency (see lib/currency). Components showing it call useCurrency(). */
export const formatMoney = (n: number | string | null | undefined) =>
  currency() === 'GBP' ? gbp.format(Number(n ?? 0) / usdRate('GBP')) : formatUsd(n)

/** Delivery prices for a group of countries (USD); `extra` is added for each item after the first. */
export type Zone = { name: string; countries: string[]; standard: number; express: number; extra: number }
export type ShopConfig = { zones: Zone[]; checkout_mode: 'test' | 'live'; site_images: Record<string, string>; show_unisex: boolean }
export const DEFAULT_CONFIG: ShopConfig = { zones: [], checkout_mode: 'live', site_images: {}, show_unisex: true }
/** The Unisex category is shown unless the owner hid it (and while the settings are still loading). */
export const showUnisex = (cfg: ShopConfig | null) => cfg?.show_unisex !== false

export const asZones = (v: unknown): Zone[] =>
  Array.isArray(v) ? v.flatMap((z) => {
    const n = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : NaN)
    const zone = { name: String(z?.name ?? ''), countries: Array.isArray(z?.countries) ? z.countries.map(String) : [], standard: n(z?.standard), express: n(z?.express), extra: n(z?.extra ?? 0) }
    return zone.countries.length && [zone.standard, zone.express, zone.extra].every(Number.isFinite) ? [zone] : []
  }) : []

export const zoneOf = (cfg: ShopConfig, country: string) => cfg.zones.find((z) => z.countries.includes(country.toUpperCase()))

/** Mirrors public.shipping_cost(): the destination's price, plus `extra` per item after the first. Null = no delivery there. */
export const shippingCost = (cfg: ShopConfig, country: string, items: number, method: 'standard' | 'express') => {
  const z = zoneOf(cfg, country)
  return z ? Math.round(((method === 'express' ? z.express : z.standard) + Math.max(items - 1, 0) * z.extra) * 100) / 100 : null
}

/** The cheapest standard delivery anywhere ("Delivery from …"). */
export const cheapestDelivery = (cfg: ShopConfig) => (cfg.zones.length ? Math.min(...cfg.zones.map((z) => z.standard)) : null)

/** Adds business days (skips Sat/Sun). */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from)
  while (days > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) days--
  }
  return d
}
const shortDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
/** Printing takes 2-4 working days, then delivery. */
export const deliveryWindow = (method: 'standard' | 'express', from = new Date()) => {
  const [a, b] = method === 'express' ? [4, 6] : [6, 11]
  return `${shortDate(addBusinessDays(from, a))} – ${shortDate(addBusinessDays(from, b))}`
}

const strings = (v: Json | undefined) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])

export const asVariants = (v: Json): Variant[] =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return []
        const o = x as Record<string, Json | undefined>
        if (typeof o.color !== 'string' || !o.color) return []
        return [{
          color: o.color,
          hex: typeof o.hex === 'string' ? o.hex : undefined,
          option: typeof o.option === 'string' ? o.option : undefined,
          sizes: strings(o.sizes),
          images: strings(o.images),
          ...(Array.isArray(o.men) && { men: strings(o.men) }),
          ...(Array.isArray(o.women) && { women: strings(o.women) }),
          ...(o.by_option && typeof o.by_option === 'object' && !Array.isArray(o.by_option)
            && { by_option: Object.fromEntries(Object.entries(o.by_option).map(([k, x]) => [k, strings(x)])) }),
        }]
      })
    : []

export const asPrices = (v: Json): Record<string, number> =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, n]) => [k, Number(n)])) : {}

/** Price of one colour/size, as the server will charge it. */
export const priceOf = (p: Pick<Product, 'price' | 'prices'>, color?: string | null, size?: string | null) =>
  p.prices[`${color ?? ''}|${size ?? ''}`] ?? p.price

/** "From $10.28" when the price depends on the colour or size. */
export const priceLabel = (p: Pick<Product, 'price' | 'prices'>) =>
  (Object.values(p.prices).some((n) => n !== p.price) ? 'From ' : '') + formatMoney(p.price)

/** "Size XL", but a design choice like "Design Option 1" already reads well on its own. */
export const sizeText = (s: string) => (/^[\w-]{1,7}$/.test(s) ? `Size ${s}` : s)

export const asItems = (v: Json): OrderItem[] => (Array.isArray(v) ? (v as unknown as OrderItem[]) : [])

/** True when a Unisex product has pictures of men or women to choose between. */
export const hasLooks = (p: Pick<Product, 'category' | 'variants'>) =>
  p.category === 'Unisex' && p.variants.some((v) => v.men?.length || v.women?.length)

/** The first colour of a Unisex product with pictures of a man (or a woman), so its card shows one of those and not Gelato's plain mockup. */
export const lookColor = (p: Pick<Product, 'category' | 'variants'>, look?: Look) =>
  look && p.category === 'Unisex' ? p.variants.find((v) => v[look]?.length)?.color : undefined

/** Photos of one colour (and design option); falls back to the colour, then to the first colour that has photos.
 *  With a `look`, a Unisex product shows only the photos of a man or of a woman (when that colour has them). */
export const productImages = (p: Pick<Product, 'images' | 'variants'> & { category?: string }, color?: string | null, size?: string | null, look?: Look) => {
  const v = p.variants.find((x) => x.color === color) ?? p.variants[0]
  const worn = look && p.category === 'Unisex' ? v?.[look] : undefined
  if (worn?.length) return [...new Set(worn)].map(imgSrc).filter((u): u is string => !!u)
  const opt = v?.by_option?.[size ?? '']
  const own = opt?.length ? opt : v?.images ?? []
  // a colour without photos borrows another colour's
  const borrowed = own.length || p.images.length ? [] : p.variants.find((x) => x.images.length)?.images ?? []
  return [...new Set([...own, ...p.images, ...borrowed])].map(imgSrc).filter((u): u is string => !!u)
}
export const productImage = (...args: Parameters<typeof productImages>) => productImages(...args)[0] ?? null

// Shades shoppers would look for under one name; "Cherry Red" and "Garnet" both show up under Red.
const FAMILIES: Record<string, string> = {
  White: 'white', Black: 'black', Grey: 'grey gray charcoal ash heather silver graphite', Cream: 'cream natural sand beige ivory oat', Brown: 'brown chocolate tan',
  Red: 'red garnet maroon cardinal burgundy', Pink: 'pink azalea rose', Purple: 'purple lilac violet lavender', Navy: 'navy', Blue: 'blue royal sky teal indigo',
  Green: 'green olive sage forest mint', Yellow: 'yellow gold mustard', Orange: 'orange',
}
const FAMILY_OF = new Map(Object.entries(FAMILIES).flatMap(([f, words]) => words.split(' ').map((w) => [w, f] as const)))
/** Filter name of a colour: its last word that means a colour ("Heather Dust Blue" -> Blue, "Dark Heather" -> Grey). */
export const colorFamily = (color: string) => color.toLowerCase().split(/[^a-z]+/).reverse().map((w) => FAMILY_OF.get(w)).find(Boolean) ?? color

/** The colours a shopper asked for: filter names plus any colour typed in the search. */
export const wantedColors = (families: string[], query: string) =>
  [...families, ...query.toLowerCase().split(/\s+/).map((w) => FAMILY_OF.get(w)).filter((f): f is string => !!f)]

/** The product's colour to show for those names, preferring one that has photos. */
export const matchVariant = (p: Pick<Product, 'variants'>, wanted: string[]) => {
  const hits = p.variants.filter((v) => wanted.includes(colorFamily(v.color)))
  return hits.find((v) => v.images.length) ?? hits[0]
}

/** Every word of the search must appear, in any order ("red hoodie"). */
export const matchesSearch = (p: Pick<Product, 'title' | 'description' | 'category' | 'variants'>, query: string) => {
  const text = [p.title, p.description, p.category, ...p.variants.flatMap((v) => [v.color, colorFamily(v.color)])].join(' ').toLowerCase()
  return query.toLowerCase().split(/\s+/).every((w) => text.includes(w))
}

/** What a search finds: with a man / woman word, only Men's (or Women's) and Unisex products, and `look` says whose pictures to show. */
export const searchFor = (query: string) => {
  const { look, rest } = lookInSearch(query)
  const test = (p: Pick<Product, 'title' | 'description' | 'category' | 'variants'>) =>
    (!look || inCategory(p, look === 'men' ? 'Men' : 'Women')) && (!rest || matchesSearch(p, rest))
  return { look, rest, test }
}

// Customer-facing order steps; Gelato statuses are mapped to these server-side.
export const ORDER_STEPS = ['paid', 'processing', 'printing', 'shipped', 'delivered'] as const
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  paid: 'Order placed',
  processing: 'Processing',
  printing: 'Printing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}
export const STATUS_HINT: Record<string, string> = {
  paid: 'We have your order and it is queued for our print partner.',
  processing: 'Your order is with our print partner and being prepared.',
  printing: 'Your items are being printed and embroidered right now.',
  shipped: 'Your parcel is on its way.',
  delivered: 'Your parcel has been delivered. Enjoy!',
  cancelled: 'This order was cancelled.',
  refunded: 'This order was refunded.',
  pending: 'Payment has not been completed.',
}
export const orderNumber = (id: string) => `LCN-${id.slice(0, 8).toUpperCase()}`

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

/** The colour's 3D model (a .glb the admin uploaded), else the one for every colour; only files from our storage. */
export const modelLink = (p: Pick<Product, 'models'>, color?: string | null) => {
  const u = p.models[color ?? ''] || p.models['']
  try {
    const url = new URL(u ?? '')
    return url.protocol === 'https:' && /\.supabase\.co$/i.test(url.hostname) && /^\/storage\/v1\/object\/public\/product-models\/.+\.glb$/i.test(url.pathname) ? url.toString() : null
  } catch { return null }
}

export const asModels = (v: Json): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {}

/** Only allow http(s) URLs into src/href attributes. */
export const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null)

/** Image source: full http(s) URLs, or a path to a file shipped with the site (e.g. "products/cap.webp"). */
export const imgSrc = (u: string | null | undefined) =>
  safeUrl(u) ?? (u && /^[a-z0-9][\w\-/]*\.(webp|png|jpe?g|avif)$/i.test(u) ? import.meta.env.BASE_URL + u : null)
