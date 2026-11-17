import { Heart, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router'
import { useCart } from '../context/cart'
import { useWishlist } from '../context/wishlist'
import { formatMoney, productImages, type Product } from '../lib/shop'
import { Img, Stars } from './ui'

const NEW_DAYS = 21
const LOADED_AT = Date.now()

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { has, toggle } = useWishlist()
  const { add } = useCart()
  const imgs = productImages(product)
  const saved = has(product.id)
  const v = product.variants
  // one colour + no sizes = nothing to choose, so it can go straight in the basket
  const quick = v.length <= 1 && !(v[0]?.sizes.length)
  const isNew = LOADED_AT - new Date(product.created_at).getTime() < NEW_DAYS * 864e5
  const to = `/product/${product.id}`

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
        <Link to={to} tabIndex={-1} aria-hidden className="absolute inset-0">
          {imgs[0] ? (
            <>
              <Img src={imgs[0]} alt="" fetchPriority={priority ? 'high' : undefined} loading={priority ? 'eager' : 'lazy'}
                className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
              {imgs[1] && (
                <img src={imgs[1]} alt="" loading="lazy" decoding="async"
                  className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              )}
            </>
          ) : <span className="grid size-full place-items-center text-sm text-muted">Image coming soon</span>}
        </Link>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {product.is_featured && <span className="rounded-sm bg-orange px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">Bestseller</span>}
          {!product.is_featured && isNew && <span className="rounded-sm bg-olive px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">New</span>}
        </div>

        <button
          type="button" onClick={() => toggle(product.id, product.title)} aria-pressed={saved}
          aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-white/90 text-olive shadow-sm backdrop-blur transition hover:scale-105 hover:text-orange"
        >
          <Heart className={`size-[18px] ${saved ? 'animate-pop fill-orange text-orange' : ''}`} aria-hidden />
        </button>

        <div className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 opacity-0 transition duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
          {quick ? (
            <button type="button" className="btn-dark w-full min-h-10 py-2 text-xs"
              onClick={() => add({ product_id: product.id, color: v[0]?.color ?? null, size: null, quantity: 1 })}>
              <ShoppingBag className="size-4" aria-hidden /> Add to basket
            </button>
          ) : (
            <Link to={to} className="btn w-full min-h-10 bg-white/95 py-2 text-xs text-olive shadow-sm backdrop-blur hover:bg-white">
              Choose options
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <h3 className="font-sans text-[14px] leading-snug font-medium text-ink">
          <Link to={to} className="line-clamp-2 hover:text-orange-2">
            {product.title}
          </Link>
        </h3>
        {product.rating_count > 0 && product.rating_avg != null && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Stars value={product.rating_avg} size="size-3" /> ({product.rating_count})</p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-olive">{formatMoney(product.price)}</span>
          {v.length > 1 && (
            <span className="flex items-center gap-1" title={v.map((x) => x.color).join(', ')}>
              {v.slice(0, 4).map((x) => (
                <span key={x.color} className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: x.hex ?? '#ccc' }} />
              ))}
              {v.length > 4 && <span className="text-[11px] text-muted">+{v.length - 4}</span>}
              <span className="sr-only">{v.length} colours</span>
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

export const ProductCardSkeleton = () => (
  <div aria-hidden>
    <div className="skeleton aspect-square rounded-[var(--radius-card)]" />
    <div className="skeleton mt-3 h-4 w-3/4" />
    <div className="skeleton mt-2 h-4 w-1/4" />
  </div>
)
