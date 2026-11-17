import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from '../components/ui'

const KEY = 'lcn-wishlist-v1'
type State = { ids: string[]; has: (id: string) => boolean; toggle: (id: string, title?: string) => void }
const Ctx = createContext<State | null>(null)

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : []
  } catch {
    return []
  }
}

/** Saved items live on this device, so the wishlist works before signing in. */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(read)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* storage blocked */ }
  }, [ids])
  // keep tabs in sync
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === KEY && setIds(read())
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  const value: State = {
    ids,
    has: (id) => ids.includes(id),
    toggle: (id, title) => {
      const adding = !ids.includes(id)
      setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]))
      toast(adding ? `${title ?? 'Item'} saved to your wishlist` : 'Removed from your wishlist', adding ? { label: 'View', to: '/wishlist' } : undefined)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWishlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}
