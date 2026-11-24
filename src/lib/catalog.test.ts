import { describe, expect, it } from 'vitest'
import { hexFor, parseDescription, toProduct, type GelatoProduct, type GelatoVariant } from '../../supabase/functions/_shared/catalog'

const variant = (id: string, color: string, size: string, cost: number, extra: Partial<GelatoVariant> = {}): GelatoVariant => ({
  id, productUid: 'apparel_product_gca_hoodie_gsc_pullover_gcu_unisex_gsi_s', cost, currency: 'GBP', position: 1, isHidden: false, isDeprecated: false,
  variantOptions: [{ name: 'Color', value: color }, { name: 'Size', value: size }], ...extra,
})
const product: GelatoProduct = {
  id: 'p1', title: ' Nest   Hoodie ', description: '', productVariantOptions: [{ name: 'Color', values: ['White', 'Navy', 'Red'] }, { name: 'Size', values: ['XL', 'S'] }],
  productImages: [
    { id: 'primary', fileUrl: '', isPrimary: true, productVariantIds: [] }, // copy of the navy photo
    { id: 'back', fileUrl: '', isPrimary: false, productVariantIds: [] }, // extra scene, so also navy
    { id: 'navy', fileUrl: '', isPrimary: false, productVariantIds: ['n'] },
    { id: 'white', fileUrl: '', isPrimary: false, productVariantIds: ['w'] },
  ],
}
const urls = { primary: 'navy.jpg', navy: 'navy.jpg', back: 'back.jpg', white: 'white.jpg' }

describe('toProduct', () => {
  const variants = [variant('w', 'White', 'XL', 12), variant('w2', 'White', 'S', 10), variant('n', 'Navy', 'S', 10), variant('r', 'Red', 'S', 11), variant('h', 'Red', 'XL', 9, { isHidden: true })]
  const p = toProduct(product, variants, urls, 1.5)!

  it('gives each colour its own photos, main colour first, without duplicates', () => {
    expect(p.variants.map((v) => [v.color, v.images])).toEqual([['Navy', ['navy.jpg', 'back.jpg']], ['White', ['white.jpg']], ['Red', []]])
  })
  it('sorts sizes and skips hidden variants', () => {
    expect(p.variants.find((v) => v.color === 'White')!.sizes).toEqual(['S', 'XL'])
    expect(p.variants.find((v) => v.color === 'Red')!.sizes).toEqual(['S'])
  })
  it('converts costs to USD and lists from the lowest', () => {
    expect(p.skus.find((s) => s.variant_id === 'w')!.cost).toBe(18)
    expect(p.base_price).toBe(15)
  })
  it('cleans the title, picks a category and waits for unfinished products', () => {
    expect([p.title, p.category]).toEqual(['Nest Hoodie', 'Unisex'])
    expect(toProduct({ ...product, productImages: [] }, variants, {}, 1)).toBeNull()
    expect(toProduct(product, [], urls, 1)).toBeNull()
  })
  it('handles products with no options', () => {
    const mug = toProduct({ ...product, productVariantOptions: [] }, [variant('m', '', '', 5, { productUid: 'mug_product', variantOptions: [] })], urls, 1)!
    expect([mug.variants, mug.category, mug.skus[0].color]).toEqual([[], 'Accessories', null])
    expect(mug.images[0]).toBe('navy.jpg')
  })
})

it('splits a description into text, care and size tables', () => {
  const d = parseDescription('<h1>Nest Hoodie</h1><p>Soft &amp; warm<br/>- Cotton</p><ul><li>Pocket</li></ul><p><strong>Size guide</strong></p><table><tr><td> </td><td>S</td></tr><tr><td>Length (cm)</td><td>50</td></tr></table><p>Care instructions</p><table><tr><td>Wash</td><td>Cold</td></tr></table>', 'Nest Hoodie')
  expect(d.description).toBe('Soft & warm\n- Cotton\n- Pocket\nCare instructions\n- Wash: Cold')
  expect(d.size_guide).toEqual([[['', 'S'], ['Length (cm)', '50']]])
})

it('finds swatches for unknown colour names by their last known word', () => {
  expect([hexFor('Ceramic Red'), hexFor('Heather Yellow Gold'), hexFor('Zzz')]).toEqual(['#c8202f', '#f0b94a', undefined])
})
