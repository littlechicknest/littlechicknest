import { Heart } from 'lucide-react'
import { Link } from 'react-router'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { Empty, PageHeader, useTitle } from '../components/ui'
import { useAuth } from '../context/auth'
import { useWishlist } from '../context/wishlist'
import { useProducts } from '../lib/useProducts'
import { AccountShell } from './Account'

export default function Wishlist() {
  useTitle('Wishlist')
  const { session } = useAuth()
  const { ids } = useWishlist()
  const { products, loading } = useProducts()
  const items = ids.flatMap((id) => products?.find((p) => p.id === id) ?? [])
  const summary = items.length ? `${items.length} saved item${items.length === 1 ? '' : 's'}. Saved on this device.` : 'Tap the heart on anything you love to save it here.'

  const grid = loading ? (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">{ids.slice(0, 3).map((id) => <ProductCardSkeleton key={id} />)}</div>
  ) : items.length ? (
    <ul className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 md:grid-cols-3 ${session ? '' : 'xl:grid-cols-4'}`}>
      {items.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
    </ul>
  ) : (
    <Empty title="No saved items yet" icon={<span className="grid size-16 place-items-center rounded-full bg-orange-soft"><Heart className="size-7 text-orange" aria-hidden /></span>}>
      <Link to="/shop" className="btn-primary mt-3">Explore the shop</Link>
    </Empty>
  )

  // signed in: same account frame as Overview, so the account menu stays put
  if (session) return (
    <AccountShell title="Wishlist">
      <p className="-mt-4 mb-6 text-muted">{summary}</p>
      {grid}
    </AccountShell>
  )

  return (
    <>
      <PageHeader eyebrow="Saved for later" title="Your wishlist" crumbs={[['Wishlist']]}>{summary}</PageHeader>
      <div className="container-x">{grid}</div>
    </>
  )
}
