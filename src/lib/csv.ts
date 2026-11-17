import { CATEGORIES, safeUrl, type Variant } from './shop'

export const CSV_HEADERS = [
  'code', 'title', 'description', 'category', 'base_price',
  'color', 'color_hex', 'variant_code', 'sizes', 'images', 'design_front', 'design_back',
] as const

export const CSV_TEMPLATE =
  CSV_HEADERS.join(',') + '\n' +
  'PRO-TEE-UNISEX,Little Chick Tee,"Soft cotton tee with our chick logo",Men,15.00,Olive,#4d5536,,S|M|L|XL,https://example.com/olive-front.jpg,https://example.com/print-front.png,\n' +
  'PRO-TEE-UNISEX,,,,,Cream,#efe5d3,,S|M|L|XL,https://example.com/cream-front.jpg,,\n'

export type ImportProduct = {
  source: 'inkthreadable'
  external_product_id: string
  title: string
  description: string
  category: string
  base_price: number
  variants: Variant[]
  images: string[]
  print_files: { front?: string; back?: string }
}
export type ImportError = { row: number; message: string }

const list = (s: string | undefined) => (s ?? '').split('|').map((x) => x.trim()).filter(Boolean)

/**
 * Turns CSV rows (one row per colour) into Inkthreadable products keyed by product code.
 * Row numbers in errors are 1-based spreadsheet rows (header = row 1).
 */
export function parseProductRows(rows: Record<string, string | undefined>[]) {
  const byCode = new Map<string, ImportProduct>()
  const errors: ImportError[] = []

  rows.forEach((raw, i) => {
    const row = i + 2
    const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), (v ?? '').trim()]))
    const code = r.code
    if (!code) return errors.push({ row, message: 'Missing product code' })

    let p = byCode.get(code)
    if (!p) {
      const price = Number(r.base_price)
      const category = CATEGORIES.find((c) => c.toLowerCase() === (r.category ?? '').toLowerCase())
      if (!r.title) return errors.push({ row, message: `First row for ${code} needs a title` })
      if (!category) return errors.push({ row, message: `Category must be one of ${CATEGORIES.join(', ')}` })
      if (!r.base_price || !Number.isFinite(price) || price < 0) return errors.push({ row, message: 'base_price must be a positive number' })
      if (r.title.length > 200) return errors.push({ row, message: 'Title is longer than 200 characters' })
      const front = safeUrl(r.design_front) ?? undefined
      const back = safeUrl(r.design_back) ?? undefined
      p = {
        source: 'inkthreadable', external_product_id: code, title: r.title, description: r.description ?? '',
        category, base_price: Math.round(price * 100) / 100, variants: [], images: [],
        print_files: { ...(front && { front }), ...(back && { back }) },
      }
      byCode.set(code, p)
    }

    const images = list(r.images)
    const bad = images.find((u) => !safeUrl(u))
    if (bad) return errors.push({ row, message: `Image is not an http(s) URL: ${bad}` })
    if (r.color_hex && !/^#[0-9a-f]{3,8}$/i.test(r.color_hex)) return errors.push({ row, message: 'color_hex must look like #4d5536' })

    if (r.color) {
      if (p.variants.some((v) => v.color.toLowerCase() === r.color!.toLowerCase()))
        return errors.push({ row, message: `Colour ${r.color} listed twice for ${code}` })
      p.variants.push({
        color: r.color, sizes: list(r.sizes), images,
        ...(r.color_hex && { hex: r.color_hex }), ...(r.variant_code && { pn: r.variant_code }),
      })
    } else {
      p.images.push(...images)
    }
  })

  return { products: [...byCode.values()], errors }
}
