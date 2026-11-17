import { Heart } from 'lucide-react'
import { Link } from 'react-router'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { Empty, PageHeader, useTitle } from '../components/ui'
import { useWishlist } from '../context/wishlist'
import { useProducts } from '../lib/useProducts'

export default function Wishlist() {
  useTitle('Wishlist')
  const { ids } = useWishlist()
  const { products, loading } = useProducts()
  const items = ids.flatMap((id) => products?.find((p) => p.id === id) ?? [])

  return (
    <>
      <PageHeader eyebrow="Saved for later" title="Your wishlist" crumbs={[['Wishlist']]}>
        {items.length ? `${items.length} saved item${items.length === 1 ? '' : 's'}. Saved on this device.` : 'Tap the heart on anything you love to save it here.'}
      </PageHeader>
      <div className="container-x">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">{ids.slice(0, 4).map((id) => <ProductCardSkeleton key={id} />)}</div>
        ) : items.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
          </ul>
        ) : (
          <Empty title="No saved items yet" icon={<span className="grid size-16 place-items-center rounded-full bg-orange-soft"><Heart className="size-7 text-orange" aria-hidden /></span>}>
            <Link to="/shop" className="btn-primary mt-3">Explore the shop</Link>
          </Empty>
        )}
      </div>
    </>
  )
}
