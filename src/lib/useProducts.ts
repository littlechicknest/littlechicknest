import { setRates, usdRate } from './currency'
import { useEffect, useState } from 'react'
import { asModels, asPrices, asVariants, safeUrl, type Product, type ShopConfig } from './shop'
import { supabase } from './supabase'

// shortcut: loads the whole active catalog once per page load; move to paginated RPC past ~500 products
let cache: Promise<Product[]> | null = null

function load(): Promise<Product[]> {
  cache ??= Promise.resolve(supabase.rpc('shop_products')).then(({ data, error }) => {
    if (error) {
      cache = null
      throw error
    }
    const list = (data ?? []).map((p) => ({ ...p, price: Number(p.price), prices: asPrices(p.prices), variants: asVariants(p.variants), size_guide: p.size_guide as unknown as string[][][], models: asModels(p.models) }))
    loaded.forEach((f) => f(list)) // a retry that succeeds also reaches hooks whose first load failed (e.g. the cart)
    return list
  })
  return cache
}
const loaded = new Set<(p: Product[]) => void>()

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const ok = (p: Product[]) => { if (active) { setProducts(p); setError(null) } }
    loaded.add(ok)
    load().then(ok, (e: Error) => active && setError(e.message || 'Could not load products'))
    return () => { active = false; loaded.delete(ok) }
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
let configCache: Promise<ShopConfig | null> | null = null
const configLoaded = new Set<(c: ShopConfig) => void>()
/** The shop's real settings, or null until they load. Never guessed: checkout needs the same delivery prices and
 *  payment mode as the server, so it waits (a later successful load reaches every mounted hook). */
export function useShopConfig() {
  const [cfg, setCfg] = useState<ShopConfig | null>(latest)
  useEffect(() => {
    let active = true
    const ok = (c: ShopConfig | null) => { if (active && c) setCfg(c) }
    configLoaded.add(ok)
    configCache ??= Promise.resolve(supabase.rpc('shop_config')).then(({ data }) => {
      const r = data?.[0]
      if (!r) { configCache = null; return latest }
      latest = {
        shipping_flat: Number(r.shipping_flat), free_shipping_over: Number(r.free_shipping_over),
        express_shipping: Number(r.express_shipping), checkout_mode: r.checkout_mode === 'live' ? 'live' : 'test',
        site_images: Object.fromEntries(Object.entries(r.site_images ?? {}).filter(([, u]) => safeUrl(u))),
      }
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(latest)) } catch { /* storage blocked */ }
      const fresh = latest
      configLoaded.forEach((f) => f(fresh))
      return latest
    }, () => { configCache = null; return latest })
    configCache.then(ok)
    return () => { active = false; configLoaded.delete(ok) }
  }, [])
  return cfg
}
