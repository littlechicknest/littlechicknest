import { describe, expect, it } from 'vitest'
import { addBusinessDays, asVariants, categoryLabel, colorFamily, DEFAULT_CONFIG, imgSrc, inCategory, matchesSearch, matchVariant, priceLabel, priceOf, productImages, safeUrl, shippingCost, sizeText, wantedColors } from './shop'

describe('colours', () => {
  const p = { title: 'Hoodie', description: '', category: 'Men', images: [], variants: [
    { color: 'White', sizes: [], images: ['w.webp'] }, { color: 'Cardinal Red', sizes: [], images: [] }, { color: 'Cherry Red', sizes: [], images: ['r.webp'] }] }
  it('groups shades', () => {
    expect(['Cherry Red', 'Garnet', 'Dark Heather', 'Heather Dust Blue', 'Navy', 'Ceramic Pink', 'Zzz'].map(colorFamily)).toEqual(['Red', 'Red', 'Grey', 'Blue', 'Navy', 'Pink', 'Zzz'])
  })
  it('shows the colour that was filtered or searched, preferring one with photos', () => {
    expect(matchVariant(p, ['Red'])?.color).toBe('Cherry Red')
    expect(matchVariant(p, wantedColors([], 'red hoodie'))?.color).toBe('Cherry Red')
    expect(matchVariant(p, [])).toBeUndefined()
    expect([matchesSearch(p, 'red hoodie'), matchesSearch(p, 'red mug')]).toEqual([true, false])
  })
  it('shows the photo of the chosen colour + design option', () => {
    const cap = { images: [], variants: [{ color: 'White', option: 'Design', sizes: ['A', 'B'], images: ['a.webp', 'b.webp'], by_option: { A: ['a.webp'] } }] }
    expect(productImages(cap, 'White', 'A').map((u) => u.slice(-6))).toEqual(['a.webp'])
    expect(productImages(cap, 'White', 'B')).toHaveLength(2)
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
