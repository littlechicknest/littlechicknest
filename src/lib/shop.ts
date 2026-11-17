import type { Json } from './database.types'

export const CATEGORIES = ['Men', 'Women', 'Kids', 'Accessories'] as const
export type Category = (typeof CATEGORIES)[number]
/** "Men's", "Women's", "Kids'", "Accessories" */
export const categoryLabel = (c: string) => (c === 'Accessories' ? c : c.endsWith('s') ? `${c}'` : `${c}'s`)

export const CATEGORY_INFO: Record<Category, { blurb: string; image: string }> = {
  Men: { blurb: 'Crew sweatshirts, hoodies, tees and caps', image: 'products/man-olive-cap.webp' },
  Women: { blurb: 'Embroidered hoodies in nine soft colours', image: 'products/hoodie-beige.webp' },
  Kids: { blurb: 'Little tees, gift sets and cosy scarves', image: 'products/set-classic.webp' },
  Accessories: { blurb: 'Caps, mugs, scarves and gift boxes', image: 'products/mug-olive.webp' },
}

export type Variant = { color: string; hex?: string; pn?: string; sizes: string[]; images: string[] }

export type Product = {
  id: string
  title: string
  description: string
  category: string
  price: number
  variants: Variant[]
  images: string[]
  is_featured: boolean
  created_at: string
  rating_avg: number | null
  rating_count: number
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

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatMoney = (n: number | string | null | undefined) => money.format(Number(n ?? 0))

/** Same formula as public.product_price() in SQL; used only for the admin live preview. */
export const marginPrice = (base: number, marginPercent: number) =>
  Math.round(base * (1 + marginPercent / 100) * 100) / 100

export type ShopConfig = { shipping_flat: number; free_shipping_over: number; express_shipping: number; checkout_mode: 'test' | 'live' }
export const DEFAULT_CONFIG: ShopConfig = { shipping_flat: 4.95, free_shipping_over: 75, express_shipping: 12.95, checkout_mode: 'test' }

/** Mirrors public.shipping_cost() so totals shown match what the server charges. */
export const shippingCost = (cfg: ShopConfig, subtotal: number, method: 'standard' | 'express') =>
  method === 'express' ? cfg.express_shipping
    : cfg.free_shipping_over > 0 && subtotal >= cfg.free_shipping_over ? 0 : cfg.shipping_flat

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

export const asVariants = (v: Json): Variant[] =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return []
        const o = x as Record<string, Json | undefined>
        if (typeof o.color !== 'string' || !o.color) return []
        return [{
          color: o.color,
          hex: typeof o.hex === 'string' ? o.hex : undefined,
          pn: typeof o.pn === 'string' ? o.pn : undefined,
          sizes: Array.isArray(o.sizes) ? o.sizes.filter((s): s is string => typeof s === 'string') : [],
          images: Array.isArray(o.images) ? o.images.filter((s): s is string => typeof s === 'string') : [],
        }]
      })
    : []

export const asItems = (v: Json): OrderItem[] => (Array.isArray(v) ? (v as unknown as OrderItem[]) : [])

/** First image to show for a product, optionally for a given colour. */
export const productImage = (p: Pick<Product, 'images' | 'variants'>, color?: string | null) =>
  p.variants.find((v) => v.color === color)?.images[0] ?? p.images[0] ?? p.variants[0]?.images[0] ?? null

/** All distinct images of a product, first colour first. */
export const productImages = (p: Pick<Product, 'images' | 'variants'>, color?: string | null) => {
  const v = p.variants.find((x) => x.color === color) ?? p.variants[0]
  return [...new Set([...(v?.images ?? []), ...p.images])].map(imgSrc).filter((u): u is string => !!u)
}

// Customer-facing order steps; Inkthreadable statuses are mapped to these server-side.
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
export const ALL_STATUSES = Object.keys(STATUS_LABEL)
export const orderNumber = (id: string) => `LCN-${id.slice(0, 8).toUpperCase()}`

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

/** Only allow http(s) URLs into src/href attributes. */
export const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null)

/** Image source: full http(s) URLs, or a path to a file shipped with the site (e.g. "products/cap.webp"). */
export const imgSrc = (u: string | null | undefined) =>
  safeUrl(u) ?? (u && /^[a-z0-9][\w\-/]*\.(webp|png|jpe?g|avif)$/i.test(u) ? import.meta.env.BASE_URL + u : null)
