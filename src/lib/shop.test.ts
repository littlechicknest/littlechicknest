import { describe, expect, it } from 'vitest'
import { addBusinessDays, asVariants, asZones, cheapestDelivery, categoryLabel, categoryLink, colorFamily, DEFAULT_CONFIG, imgSrc, inCategory, lookColor, lookInSearch, matchesSearch, matchVariant, modelLink, priceLabel, priceOf, productImages, safeUrl, searchFor, shippingCost, sizeText, wantedColors } from './shop'

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
  it('matches the server shipping rules: by country and number of items, never free', () => {
    const cfg = { ...DEFAULT_CONFIG, zones: asZones([
      { name: 'UK', countries: ['GB'], standard: 5.95, express: 12.95, extra: 1.5 },
      { name: 'Far', countries: ['AU', 'NZ'], standard: '14.95', express: 29.95, extra: 3.5 },
      { name: 'Broken', countries: ['XX'], standard: 'abc', express: 1 },
    ]) }
    expect(cfg.zones).toHaveLength(2)
    expect(shippingCost(cfg, 'GB', 1, 'standard')).toBe(5.95)
    expect(shippingCost(cfg, 'gb', 3, 'standard')).toBe(8.95)
    expect(shippingCost(cfg, 'NZ', 2, 'express')).toBe(33.45)
    expect(shippingCost(cfg, 'JP', 1, 'standard')).toBeNull()
    expect(cheapestDelivery(cfg)).toBe(5.95)
    expect(cheapestDelivery(DEFAULT_CONFIG)).toBeNull()
  })
  it('skips weekends when adding business days', () => {
    const fri = new Date('2026-11-20T12:00:00')
    expect(addBusinessDays(fri, 1).getDay()).toBe(1)
  })
})

describe('Unisex pictures on men / women', () => {
  const v = { color: 'Black', sizes: ['S'], images: ['https://x/gelato.webp', 'https://x/man.webp', 'https://x/woman.webp', 'https://x/flat.webp'], men: ['https://x/man.webp', 'https://x/flat.webp'], women: ['https://x/woman.webp', 'https://x/flat.webp'] }
  const p = { category: 'Unisex', images: [], variants: [v, { color: 'Red', sizes: ['S'], images: ['https://x/red.webp'] }] }
  it('shows only the chosen look, without Gelato’s picture', () => {
    expect(productImages(p, 'Black')).toEqual(v.images)
    expect(productImages(p, 'Black', null, 'men')).toEqual(v.men)
    expect(productImages(p, 'Black', null, 'women')).toEqual(v.women)
  })
  it('falls back to every picture when the colour has none of people, or the product is not Unisex', () => {
    expect(productImages(p, 'Red', null, 'men')).toEqual(['https://x/red.webp'])
    expect(productImages({ ...p, category: 'Men' }, 'Black', null, 'women')).toEqual(v.images)
  })
  it('cards on men / women open in a colour that has those pictures', () => {
    expect(lookColor({ ...p, variants: [p.variants[1], v] }, 'men')).toBe('Black')
    expect(lookColor({ ...p, category: 'Men' }, 'men')).toBeUndefined()
    expect(lookColor(p, undefined)).toBeUndefined()
  })
  it('reads man / woman words in a search', () => {
    expect(lookInSearch('Hoodie MALE')).toEqual({ look: 'men', rest: 'Hoodie' })
    expect(lookInSearch("women's tee")).toEqual({ look: 'women', rest: 'tee' })
    expect(lookInSearch('female')).toEqual({ look: 'women', rest: '' })
    expect(lookInSearch('mug')).toEqual({ look: undefined, rest: 'mug' })
    const s = searchFor('hoodie female')
    const item = (category: string) => ({ title: 'Cosy Hoodie', description: '', category, variants: [] })
    expect(['Unisex', 'Women', 'Men', 'Kids'].map((c) => s.test(item(c)))).toEqual([true, true, false, false])
  })
  it('only shows .glb models from our storage', () => {
    const glb = 'https://abc.supabase.co/storage/v1/object/public/product-models/1/a.glb'
    expect(modelLink({ models: { Black: glb } }, 'Black')).toBe(glb)
    expect(modelLink({ models: { '': glb } }, 'White')).toBe(glb)
    expect(modelLink({ models: { Black: '', '': glb } }, 'Black')).toBe(glb)
    expect(modelLink({ models: { Black: 'https://evil.example/storage/v1/object/public/product-models/a.glb' } }, 'Black')).toBeNull()
    expect(modelLink({ models: { Black: 'https://preflight.live.gelato.tech/p' } }, 'Black')).toBeNull()
    expect(modelLink({ models: {} }, 'Black')).toBeNull()
  })
})

describe('hidden Unisex category', () => {
  it('points Unisex products to Men / Women when hidden', () => {
    expect(categoryLink('Unisex', true)).toEqual({ label: 'Unisex', to: '/shop?category=Unisex' })
    expect(categoryLink('Unisex', false, 'women')).toEqual({ label: "Women's", to: '/shop?category=Women' })
    expect(categoryLink('Unisex', false)).toEqual({ label: "Men's & Women's", to: '/shop' })
    expect(categoryLink('Kids', false)).toEqual({ label: "Kids'", to: '/shop?category=Kids' })
  })
})
