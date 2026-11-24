// Turns a Gelato store product into a row of public.products. Pure, so src/lib/catalog.test.ts can cover it.

export type GelatoImage = { id: string; fileUrl: string; isPrimary: boolean; productVariantIds: string[] }
export type GelatoProduct = { id: string; title: string; description: string | null; productImages: GelatoImage[]; productVariantOptions: { name: string; values: string[] }[] }
export type GelatoVariant = {
  id: string; productUid: string; cost: number; currency: string; position: number; isHidden: boolean; isDeprecated: boolean
  variantOptions: { name: string; value: string }[]
}
export type Sku = { color: string | null; size: string | null; variant_id: string; uid: string; cost: number }

const isColor = (name: string) => /^colou?r$/i.test(name)

// Gelato sends colour names only. Unknown names fall back to their last known word ("Heather Dust Blue" -> blue).
const HEX: Record<string, string> = {
  white: '#ffffff', black: '#161616', navy: '#1b2545', natural: '#f3ead7', cream: '#f5ecd7', sand: '#d8cbb3', beige: '#d9c7a8', brown: '#6b4a32',
  red: '#c8202f', 'cherry red': '#b1182f', 'cardinal red': '#8c1c32', garnet: '#7a1f35', maroon: '#5c1f2d', burgundy: '#5e1b2d', pink: '#f7b6c8',
  'light pink': '#f9cfdb', azalea: '#f573ae', purple: '#4b2e83', lilac: '#c3b1e1', royal: '#224d8f', blue: '#2f5fb3', 'light blue': '#a9c8e8',
  'carolina blue': '#7ba7dc', green: '#3b8a4f', 'irish green': '#00a05a', 'forest green': '#233f2b', 'military green': '#5e6344', olive: '#5b5f3a',
  sage: '#a9b59a', yellow: '#f6c945', gold: '#f0b94a', orange: '#f0692b', grey: '#a5a5a5', gray: '#a5a5a5', 'sport grey': '#a8a8a8', ash: '#d5d5d2',
  charcoal: '#4b4c50', 'charcoal heather': '#4b4c50', 'dark heather': '#45484d', heather: '#9a9a9a', silver: '#c9c9c9',
}
export const hexFor = (color: string) => {
  const c = color.toLowerCase()
  return HEX[c] ?? c.split(/\s+/).reverse().map((w) => HEX[w]).find(Boolean)
}

const SIZES = ['NEWBORN', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL']
const sizeRank = (s: string) => (/^\d+M$/i.test(s) ? parseInt(s) / 100 : SIZES.indexOf(s.toUpperCase()))

const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const plain = (html: string) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** Gelato descriptions are HTML with size and care tables; the shop shows plain text with "- " bullets and a size guide. */
export function parseDescription(html: string, title: string): { description: string; size_guide: string[][][] } {
  const size_guide: string[][][] = []
  const care: string[] = []
  const body = html.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(([tr]) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => plain(m[1])))
    if (rows.some((r) => /\((cm|in|inches)\)/i.test(r[0] ?? ''))) size_guide.push(rows)
    else care.push(...rows.filter((r) => r.length === 2).map(([k, v]) => `- ${k}: ${v}`))
    return ''
  })
  const lines = decode(body.replace(/\s+/g, ' ').replace(/<li[^>]*>/gi, '\n- ').replace(/<br\s*\/?>|<\/(p|h\d|div|li|ul|ol)>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n').map((l) => l.trim()).filter((l) => l && l !== '-' && l !== title && !/^(size guide|care instructions):?$/i.test(l))
  let description = ''
  for (const l of [...lines, ...(care.length ? ['Care instructions', ...care] : [])]) {
    if (description.length + l.length + 1 > 5000) break // column limit
    description += (description && '\n') + l
  }
  return { description, size_guide }
}

function categoryOf(uid: string): string {
  const cut = uid.match(/_gcu_([a-z-]+)/)?.[1]
  if (!cut || /_gca_(hat|cap|headwear|beanie|accessor)|^(hat|cap|headwear)/.test(uid)) return 'Accessories'
  if (/kid|baby|toddler|youth|infant/.test(cut)) return 'Kids'
  return /^wom/.test(cut) ? 'Women' : /^men/.test(cut) ? 'Men' : 'Unisex'
}

/** `urls` maps Gelato image ids to their permanent URL (the same picture always has the same URL). `fx` converts Gelato's currency to USD. */
export function toProduct(p: GelatoProduct, all: GelatoVariant[], urls: Record<string, string>, fx: number) {
  const live = all.filter((v) => !v.isHidden && !v.isDeprecated && v.cost > 0).sort((a, b) => a.position - b.position)
  if (!live.length || !p.productImages.length) return null // still being created in Gelato

  const opts = (v: GelatoVariant) => {
    const color = v.variantOptions.find((o) => isColor(o.name))?.value ?? null
    const size = v.variantOptions.filter((o) => !isColor(o.name)).map((o) => o.value).join(' / ') || null
    return { color: color ?? (size ? 'Standard' : null), size }
  }
  const skus: Sku[] = live.map((v) => ({ ...opts(v), variant_id: v.id, uid: v.productUid, cost: Math.round(v.cost * fx * 100) / 100 }))
  const colorById = new Map(skus.map((s) => [s.variant_id, s.color]))

  // Untagged images are extra scenes of the primary image's colour; the primary is a copy of one of the tagged images.
  const pics = p.productImages.map((i) => ({ url: urls[i.id], primary: i.isPrimary, ids: i.productVariantIds })).filter((i) => i.url)
  const primary = pics.find((i) => i.primary)
  const mainColor = pics.filter((i) => i.url === primary?.url).flatMap((i) => i.ids.map((id) => colorById.get(id))).find((c) => c != null) ?? skus[0].color
  const imagesOf = (color: string | null) => [...new Set(pics
    .filter((i) => (i.ids.length ? i.ids.some((id) => colorById.get(id) === color) : color === mainColor))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.ids.length - a.ids.length).map((i) => i.url))]

  const option = p.productVariantOptions.find((o) => !isColor(o.name) && !/size/i.test(o.name))?.name
  const order = p.productVariantOptions.find((o) => isColor(o.name))?.values ?? []
  const colors = [...new Set(skus.map((s) => s.color))].filter((c): c is string => c != null)
    .sort((a, b) => Number(b === mainColor) - Number(a === mainColor) || order.indexOf(a) - order.indexOf(b)) // main colour first: it has photos
  const variants = colors.map((color) => {
    const sizes = [...new Set(skus.filter((s) => s.color === color).map((s) => s.size))].filter((s): s is string => s != null)
    if (sizes.every((s) => sizeRank(s) >= 0)) sizes.sort((a, b) => sizeRank(a) - sizeRank(b))
    const hex = hexFor(color)
    return { color, ...(hex && { hex }), ...(option && { option }), sizes, images: imagesOf(color) }
  })

  const title = p.title.replace(/\s+/g, ' ').trim().slice(0, 200)
  return {
    source: 'gelato' as const, external_product_id: p.id, title, ...parseDescription(p.description ?? '', title),
    category: categoryOf(live[0].productUid), base_price: Math.min(...skus.map((s) => s.cost)),
    variants, images: colors.length ? [] : imagesOf(null), skus,
  }
}
