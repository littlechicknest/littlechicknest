import { useEffect, useState } from 'react'
import { asVariants, DEFAULT_CONFIG, type Product, type ShopConfig } from './shop'
import { supabase } from './supabase'

// shortcut: loads the whole active catalog once per page load; move to paginated RPC past ~500 products
let cache: Promise<Product[]> | null = null

function load(): Promise<Product[]> {
  cache ??= Promise.resolve(supabase.rpc('shop_products')).then(({ data, error }) => {
    if (error) {
      cache = null
      throw error
    }
    return (data ?? []).map((p) => ({ ...p, price: Number(p.price), variants: asVariants(p.variants) }))
  })
  return cache
}

/** Call after admin edits so the storefront picks up changes without a reload. */
export const invalidateProducts = () => { cache = null; configCache = null }

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    load().then(
      (p) => active && setProducts(p),
      (e: Error) => active && setError(e.message || 'Could not load products'),
    )
    return () => { active = false }
  }, [])

  return { products, error, loading: !products && !error }
}

let configCache: Promise<ShopConfig> | null = null
export function useShopConfig() {
  const [cfg, setCfg] = useState<ShopConfig | null>(null)
  useEffect(() => {
    let active = true
    configCache ??= Promise.resolve(supabase.rpc('shop_config')).then(({ data }) => {
      const r = data?.[0]
      if (!r) { configCache = null; return DEFAULT_CONFIG }
      return {
        shipping_flat: Number(r.shipping_flat), free_shipping_over: Number(r.free_shipping_over),
        express_shipping: Number(r.express_shipping), checkout_mode: r.checkout_mode === 'live' ? 'live' : 'test',
      }
    })
    configCache.then((c) => active && setCfg(c))
    return () => { active = false }
  }, [])
  return cfg
}
