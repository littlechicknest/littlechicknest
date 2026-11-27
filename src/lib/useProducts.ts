import { setRates, usdRate } from './currency'
import { useEffect, useState } from 'react'
import { asModels, asPrices, asVariants, DEFAULT_CONFIG, safeUrl, type Product, type ShopConfig } from './shop'
import { supabase } from './supabase'

// shortcut: loads the whole active catalog once per page load; move to paginated RPC past ~500 products
let cache: Promise<Product[]> | null = null

function load(): Promise<Product[]> {
  cache ??= Promise.resolve(supabase.rpc('shop_products')).then(({ data, error }) => {
    if (error) {
      cache = null
      throw error
    }
    return (data ?? []).map((p) => ({ ...p, price: Number(p.price), prices: asPrices(p.prices), variants: asVariants(p.variants), size_guide: p.size_guide as unknown as string[][][], models: asModels(p.models) }))
  })
  return cache
}

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

let ratesLoad: Promise<boolean> | null = null
/** Loads the currency rates once per page load; true once GBP prices can be shown. */
export function useRates() {
  const [ok, setOk] = useState(() => usdRate('GBP') > 0)
  useEffect(() => {
    let active = true
    ratesLoad ??= Promise.resolve(supabase.rpc('shop_rates')).then(({ data }) => { setRates(data); return usdRate('GBP') > 0 }, () => usdRate('GBP') > 0)
    ratesLoad.then((v) => active && setOk(v))
    return () => { active = false }
  }, [])
  return ok
}

const CONFIG_KEY = 'lcn-config-v1'
function storedConfig(): ShopConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null')
    return c?.site_images ? c : null
  } catch { return null }
}
let latest = storedConfig()
let configCache: Promise<ShopConfig> | null = null
export function useShopConfig() {
  const [cfg, setCfg] = useState<ShopConfig | null>(latest)
  useEffect(() => {
    let active = true
    configCache ??= Promise.resolve(supabase.rpc('shop_config')).then(({ data }) => {
      const r = data?.[0]
      if (!r) { configCache = null; return latest ?? DEFAULT_CONFIG }
      latest = {
        shipping_flat: Number(r.shipping_flat), free_shipping_over: Number(r.free_shipping_over),
        express_shipping: Number(r.express_shipping), checkout_mode: r.checkout_mode === 'live' ? 'live' : 'test',
        site_images: Object.fromEntries(Object.entries(r.site_images ?? {}).filter(([, u]) => safeUrl(u))),
      }
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(latest)) } catch { /* storage blocked */ }
      return latest
    })
    configCache.then((c) => active && setCfg(c))
    return () => { active = false }
  }, [])
  return cfg
}
