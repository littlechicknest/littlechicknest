import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useProducts } from '../lib/useProducts'
import { priceOf, type Product } from '../lib/shop'

/** Cart keeps only keys + quantity; prices always come from the live catalog. */
export type CartLine = { product_id: string; color: string | null; size: string | null; quantity: number }
export type CartRow = CartLine & { key: string; product: Product; price: number }

const STORAGE_KEY = 'lcn-cart-v1'
const MAX_QTY = 20
const lineKey = (l: Omit<CartLine, 'quantity'>) => `${l.product_id}|${l.color ?? ''}|${l.size ?? ''}`

function readStored(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(raw)
      ? raw.filter((l) => l && typeof l.product_id === 'string' && Number.isInteger(l.quantity) && l.quantity > 0)
      : []
  } catch {
    return []
  }
}

type CartState = {
  rows: CartRow[]
  /** rows are only final once the catalog is 'ready'; until then an empty basket may just be loading */
  catalog: 'loading' | 'error' | 'ready'
  count: number
  subtotal: number
  open: boolean
  setOpen: (o: boolean) => void
  add: (line: CartLine) => void
  setQuantity: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStored)
  const [open, setOpen] = useState(false)
  const { products, error } = useProducts()
  const clear = useCallback(() => setLines([]), [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)) } catch { /* storage blocked */ }
  }, [lines])

  // lines whose product or option is no longer sold silently drop out once the catalog has loaded
  const rows = useMemo(() => {
    if (!products) return []
    const byId = new Map(products.map((p) => [p.id, p]))
    return lines.flatMap((l) => {
      const product = byId.get(l.product_id)
      if (!product) return []
      const v = product.variants.find((x) => x.color === l.color)
      if (product.variants.length && (!v || (v.sizes.length > 0 && !v.sizes.includes(l.size ?? '')))) return []
      return [{ ...l, key: lineKey(l), product, price: priceOf(product, l.color, l.size) }]
    })
  }, [lines, products])

  const value: CartState = {
    rows,
    catalog: products ? 'ready' : error ? 'error' : 'loading',
    count: rows.reduce((n, r) => n + r.quantity, 0),
    subtotal: rows.reduce((n, r) => n + r.quantity * r.price, 0),
    open,
    setOpen,
    add: (line) => {
      setLines((prev) => {
        const k = lineKey(line)
        const hit = prev.find((l) => lineKey(l) === k)
        return hit
          ? prev.map((l) => (l === hit ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l))
          : [...prev, { ...line, quantity: Math.min(MAX_QTY, line.quantity) }]
      })
      setOpen(true)
    },
    setQuantity: (key, qty) =>
      setLines((prev) =>
        prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.max(1, Math.min(MAX_QTY, qty)) } : l))),
    remove: (key) => setLines((prev) => prev.filter((l) => lineKey(l) !== key)),
    clear,
  }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
