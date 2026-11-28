import { setRates, usdRate } from './currency'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { asModels, asPrices, asVariants, asZones, safeUrl, type Product, type ShopConfig } from './shop'
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

const CONFIG_KEY = 'lcn-config-v2'
function storedConfig(): ShopConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null')
    return c?.site_images && Array.isArray(c.zones) ? c : null
  } catch { return null }
}
type ConfigState = {
  /** last known settings: fresh from the server, or remembered from an earlier visit (fine for display) */
  cfg: ShopConfig | null
  /** loaded from the server during this page load: required before anything depends on the payment mode or prices */
  fresh: boolean
  /** the last request failed (a later mount retries) */
  failed: boolean
}
let cfgState: ConfigState = { cfg: storedConfig(), fresh: false, failed: false }
const cfgSubs = new Set<() => void>()
const setCfgState = (s: ConfigState) => { cfgState = s; cfgSubs.forEach((f) => f()) }
const subscribeCfg = (f: () => void) => { cfgSubs.add(f); return () => { cfgSubs.delete(f) } }
let cfgLoading = false

function loadConfig() {
  if (cfgLoading || cfgState.fresh) return
  cfgLoading = true
  Promise.resolve(supabase.rpc('shop_config')).then(({ data, error }) => {
    const r = data?.[0]
    if (error || !r) return setCfgState({ ...cfgState, failed: true })
    const cfg: ShopConfig = {
      zones: asZones(r.shipping_zones), checkout_mode: r.checkout_mode === 'live' ? 'live' : 'test',
      site_images: Object.fromEntries(Object.entries(r.site_images ?? {}).filter(([, u]) => safeUrl(u))),
    }
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch { /* storage blocked */ }
    setCfgState({ cfg, fresh: true, failed: false })
  }, () => setCfgState({ ...cfgState, failed: true })).finally(() => { cfgLoading = false })
}

/** Shop settings with their load status. Every mounted hook sees a later successful load. */
export function useShopConfigState(): ConfigState {
  const s = useSyncExternalStore(subscribeCfg, () => cfgState)
  useEffect(loadConfig, [])
  return s
}
/** Shop settings for display (may be remembered from an earlier visit until fresh ones arrive). */
export const useShopConfig = () => useShopConfigState().cfg
