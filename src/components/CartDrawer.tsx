import { Lock, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useCart } from '../context/cart'
import { formatMoney, imgSrc, priceOf, productImage, sizeText } from '../lib/shop'
import { useProducts, useShopConfig } from '../lib/useProducts'
import { QtyStepper, useOverlay } from './ui'

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const cfg = useShopConfig()
  if (!cfg || cfg.free_shipping_over <= 0) return null
  const left = cfg.free_shipping_over - subtotal
  const pct = Math.min(100, (subtotal / cfg.free_shipping_over) * 100)
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[13px] text-ink">
        <Truck className="size-4 text-olive" aria-hidden />
        {left > 0 ? <span>You’re <strong className="text-orange-2">{formatMoney(left)}</strong> away from free delivery</span>
          : <span className="font-semibold text-olive">You’ve unlocked free standard delivery!</span>}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-sand/70" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery">
        <div className="h-full rounded-full bg-gradient-to-r from-yolk to-orange transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { rows, subtotal, open, setOpen, setQuantity, remove, add } = useCart()
  const close = useCallback(() => setOpen(false), [setOpen])
  const ref = useOverlay(open, close)
  const navigate = useNavigate()
  const { products } = useProducts()

  // a small "goes well with" row from accessories that aren't already in the basket
  const extras = useMemo(() => {
    const inCart = new Set(rows.map((r) => r.product_id))
    return (products ?? []).filter((p) => p.category === 'Accessories' && !inCart.has(p.id) && p.variants.length <= 1 && !p.variants[0]?.sizes.length).slice(0, 2)
  }, [products, rows])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <button type="button" tabIndex={-1} aria-label="Close basket" className="absolute inset-0 animate-fade-in bg-olive/40 backdrop-blur-[2px]" onClick={close} />
      <aside ref={(el) => { ref.current = el }} className="absolute inset-y-0 right-0 flex w-full max-w-[420px] animate-slide-in-right flex-col bg-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="text-xl">Your basket {rows.length > 0 && <span className="font-sans text-sm font-normal text-muted">({rows.reduce((n, r) => n + r.quantity, 0)})</span>}</h2>
          <button type="button" onClick={close} className="-mr-2 rounded-full p-2 text-olive hover:bg-paper" aria-label="Close basket"><X className="size-5" aria-hidden /></button>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-cream-2"><ShoppingBag className="size-9 text-olive-3" aria-hidden /></span>
            <p className="font-display text-xl font-bold text-olive">Your basket is empty</p>
            <p className="text-sm text-muted">Find something cosy for you or a gift for a chick lover.</p>
            <div className="mt-2 grid w-full grid-cols-2 gap-2">
              {(['Men', 'Women', 'Kids', 'Accessories'] as const).map((c) => (
                <Link key={c} to={`/shop?category=${c}`} onClick={close} className="btn-ghost">{c === 'Accessories' ? c : `${c}'${c.endsWith('s') ? '' : 's'}`}</Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-line bg-paper px-5 py-3.5"><FreeShippingBar subtotal={subtotal} /></div>
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-line px-5">
                {rows.map((r) => {
                  const img = imgSrc(productImage(r.product, r.color))
                  return (
                    <li key={r.key} className="flex gap-4 py-4">
                      <Link to={`/product/${r.product_id}`} onClick={close} className="size-[84px] shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
                        {img && <img src={img} alt="" className="size-full object-cover" loading="lazy" />}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/product/${r.product_id}`} onClick={close} className="line-clamp-2 text-sm font-medium hover:text-orange-2">{r.product.title}</Link>
                          <button type="button" onClick={() => remove(r.key)} className="-mt-1 -mr-1 rounded p-1 text-muted hover:text-red-700" aria-label={`Remove ${r.product.title}`}><Trash2 className="size-4" aria-hidden /></button>
                        </div>
                        <p className="text-xs text-muted">{[r.color, r.size && sizeText(r.size)].filter(Boolean).join(' · ')}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <QtyStepper size="sm" value={r.quantity} onChange={(n) => setQuantity(r.key, n)} />
                          <span className="text-sm font-semibold text-olive">{formatMoney(r.price * r.quantity)}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {extras.length > 0 && (
                <div className="mx-5 mb-5 rounded-xl bg-cream-2 p-4">
                  <p className="label-caps mb-3">Goes well with</p>
                  <ul className="space-y-3">
                    {extras.map((p) => {
                      const img = imgSrc(productImage(p))
                      return (
                        <li key={p.id} className="flex items-center gap-3">
                          <span className="size-12 shrink-0 overflow-hidden rounded-md bg-paper">{img && <img src={img} alt="" className="size-full object-cover" loading="lazy" />}</span>
                          <span className="min-w-0 flex-1 text-sm"><span className="block truncate font-medium">{p.title}</span><span className="text-muted">{formatMoney(priceOf(p, p.variants[0]?.color))}</span></span>
                          <button type="button" onClick={() => add({ product_id: p.id, color: p.variants[0]?.color ?? null, size: null, quantity: 1 })}
                            className="rounded-full border border-olive/30 px-3 py-1 text-xs font-semibold text-olive uppercase hover:bg-olive hover:text-white">Add</button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-3 border-t border-line bg-paper px-5 pt-4 pb-5">
              <div className="flex justify-between text-base font-semibold text-olive"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              <p className="text-xs text-muted">Delivery is calculated at checkout.</p>
              <button type="button" onClick={() => { close(); navigate('/checkout') }} className="btn-primary w-full"><Lock className="size-4" aria-hidden /> Checkout</button>
              <button type="button" onClick={close} className="w-full text-center text-[13px] font-medium text-olive underline-offset-2 hover:underline">Continue shopping</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
