import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { CSV_TEMPLATE, parseProductRows } from './csv'
import { addBusinessDays, asVariants, categoryLabel, DEFAULT_CONFIG, imgSrc, marginPrice, safeUrl, shippingCost } from './shop'

describe('marginPrice', () => {
  it('matches the client examples', () => {
    expect(marginPrice(15, 100)).toBe(30)
    expect(marginPrice(15, 50)).toBe(22.5)
    expect(marginPrice(9.99, 1)).toBe(10.09)
  })
})

describe('parseProductRows', () => {
  it('groups template rows into one product with two colours', () => {
    const rows = Papa.parse<Record<string, string>>(CSV_TEMPLATE, { header: true, skipEmptyLines: true }).data
    const { products, errors } = parseProductRows(rows)
    expect(errors).toEqual([])
    expect(products).toHaveLength(1)
    expect(products[0].variants.map((v) => v.color)).toEqual(['Olive', 'Cream'])
    expect(products[0].variants[0].sizes).toEqual(['S', 'M', 'L', 'XL'])
    expect(products[0].print_files).toEqual({ front: 'https://example.com/print-front.png' })
  })

  it('reports bad rows without dropping good ones', () => {
    const { products, errors } = parseProductRows([
      { code: 'A', title: 'Ok', category: 'kids', base_price: '10' },
      { code: 'B', title: 'Bad cat', category: 'Pets', base_price: '10' },
      { code: 'C', title: 'Bad price', category: 'Men', base_price: '-1' },
      { code: 'A', color: 'Red', images: 'javascript:alert(1)' },
      { title: 'no code' },
    ])
    expect(products.map((p) => p.external_product_id)).toEqual(['A'])
    expect(products[0].category).toBe('Kids')
    expect(errors.map((e) => e.row)).toEqual([3, 4, 5, 6])
  })
})

describe('guards', () => {
  it('rejects non-http urls', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('https://x.y/a.png')).toBe('https://x.y/a.png')
  })
  it('drops malformed variants', () => {
    expect(asVariants([{ color: 'Red', sizes: ['M', 3] }, { nope: 1 }, 'x'])).toEqual([
      { color: 'Red', hex: undefined, pn: undefined, sizes: ['M'], images: [] },
    ])
  })
})

describe('storefront helpers', () => {
  it('labels categories', () => {
    expect(categoryLabel('Men')).toBe("Men's")
    expect(categoryLabel('Kids')).toBe("Kids'")
    expect(categoryLabel('Accessories')).toBe('Accessories')
  })
  it('resolves site images and blocks anything odd', () => {
    expect(imgSrc('products/cap.webp')).toBe(`${import.meta.env.BASE_URL}products/cap.webp`)
    expect(imgSrc('https://x.y/a.png')).toBe('https://x.y/a.png')
    expect(imgSrc('../secret.webp')).toBeNull()
    expect(imgSrc('javascript:alert(1)')).toBeNull()
    expect(imgSrc('//evil.com/a.png')).toBeNull()
  })
  it('matches the server shipping rules', () => {
    const cfg = { ...DEFAULT_CONFIG, shipping_flat: 4.95, free_shipping_over: 75, express_shipping: 12.95 }
    expect(shippingCost(cfg, 50, 'standard')).toBe(4.95)
    expect(shippingCost(cfg, 75, 'standard')).toBe(0)
    expect(shippingCost(cfg, 200, 'express')).toBe(12.95)
    expect(shippingCost({ ...cfg, free_shipping_over: 0 }, 500, 'standard')).toBe(4.95)
  })
  it('skips weekends when adding business days', () => {
    const fri = new Date('2026-11-20T12:00:00')
    expect(addBusinessDays(fri, 1).getDay()).toBe(1)
  })
})
