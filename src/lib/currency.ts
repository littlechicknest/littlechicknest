import { useSyncExternalStore } from 'react'

// Display currency. Prices are stored and charged in USD; GBP is shown with Gelato's own rate,
// saved by the product sync, so a price set in pounds in Gelato shows back exactly.
export type Currency = 'USD' | 'GBP'
export const CURRENCIES: Currency[] = ['USD', 'GBP']

const KEY = 'lcn-currency'
const RATES_KEY = 'lcn-rates-v1'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage blocked */ } }

let chosen: Currency = read(KEY) === 'GBP' ? 'GBP' : 'USD'
/** USD per 1 unit of each currency, e.g. { GBP: 1.41 } */
let rates: Partial<Record<Currency, number>> = (() => { try { return JSON.parse(read(RATES_KEY) ?? '{}') ?? {} } catch { return {} } })()

const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

/** The currency prices are shown in: GBP only once its rate is known. */
export const currency = (): Currency => (chosen === 'GBP' && (rates.GBP ?? 0) > 0 ? 'GBP' : 'USD')
export const usdRate = (c: Currency) => (c === 'USD' ? 1 : rates[c] ?? 0)

export function setCurrency(c: Currency) {
  chosen = c
  write(KEY, c)
  emit()
}

export function setRates(r: unknown) {
  const gbp = Number((r as Record<string, unknown> | null)?.GBP)
  if (!(gbp > 0.1 && gbp < 10) || gbp === rates.GBP) return
  rates = { ...rates, GBP: gbp }
  write(RATES_KEY, JSON.stringify(rates))
  emit()
}

// the snapshot includes the rate, so a new rate re-renders prices even when the currency stays the same
const snapshot = () => `${currency()}:${rates.GBP ?? 0}`
/** Re-renders the calling component when the shown currency or its rate changes. */
export const useCurrency = (): Currency => {
  useSyncExternalStore(subscribe, snapshot, () => 'USD:0')
  return currency()
}
