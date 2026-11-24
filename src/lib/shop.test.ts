import { describe, expect, it } from 'vitest'
import { addBusinessDays, asVariants, categoryLabel, DEFAULT_CONFIG, imgSrc, inCategory, marginPrice, priceLabel, priceOf, productImages, safeUrl, shippingCost, sizeText } from './shop'

describe('marginPrice', () => {
  it('matches the client examples', () => {
    expect(marginPrice(15, 100)).toBe(30)
    expect(marginPrice(15, 50)).toBe(22.5)
    expect(marginPrice(9.99, 1)).toBe(10.09)
    expect(marginPrice(20.35, 50)).toBe(30.53) // half-cent, must round like Postgres
  })
})

describe('guards', () => {
  it('rejects non-http urls', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('https://x.y/a.png')).toBe('https://x.y/a.png')
  })
  it('drops malformed variants', () => {
    expect(asVariants([{ color: 'Red', sizes: ['M', 3] }, { nope: 1 }, 'x'])).toEqual([
      { color: 'Red', hex: undefined, option: undefined, sizes: ['M'], images: [] },
    ])
  })
})

describe('storefront helpers', () => {
  it('prices each colour and size', () => {
    const p = { price: 10, prices: { 'Navy|S': 10, 'Navy|XL': 14 } }
    expect(priceOf(p, 'Navy', 'XL')).toBe(14)
    expect(priceOf({ price: 8, prices: {} }, null, null)).toBe(8)
    expect(priceLabel(p)).toBe('From $10.00')
    expect(priceLabel({ price: 8, prices: { '|': 8 } })).toBe('$8.00')
  })
  it('shows only the chosen colour, or the first colour when it has no photos', () => {
    const p = { images: [], variants: [{ color: 'White', sizes: [], images: ['a.webp'] }, { color: 'Navy', sizes: [], images: ['b.webp', 'c.webp'] }, { color: 'Red', sizes: [], images: [] }] }
    expect(productImages(p, 'Navy')).toHaveLength(2)
    expect(productImages(p, 'Red')).toEqual(productImages(p, 'White'))
  })
  it('lists unisex products under men and women only', () => {
    expect(['Men', 'Women', 'Kids'].map((c) => inCategory({ category: 'Unisex' }, c))).toEqual([true, true, false])
  })
  it('labels sizes and design options', () => {
    expect([sizeText('2XL'), sizeText('Design Option 1')]).toEqual(['Size 2XL', 'Design Option 1'])
  })
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
