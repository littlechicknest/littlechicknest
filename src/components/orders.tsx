import { Check, FlaskConical } from 'lucide-react'
import { Link } from 'react-router'
import { asAddress, countryName, formatMoney, imgSrc, ORDER_STEPS, sizeText, STATUS_LABEL, type OrderItem } from '../lib/shop'
import type { Json } from '../lib/database.types'

export function StatusBadge({ status }: { status: string }) {
  const tone = ['cancelled', 'refunded'].includes(status) ? 'bg-red-50 text-red-800 ring-red-200'
    : status === 'delivered' ? 'bg-[#eef6e6] text-olive ring-leaf/30'
    : status === 'shipped' ? 'bg-[#e8f1fb] text-[#1f4f86] ring-[#1f4f86]/20'
    : status === 'pending' ? 'bg-cream-2 text-muted ring-sand'
    : 'bg-orange-soft text-orange-2 ring-orange/25'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 ${tone}`}>{STATUS_LABEL[status] ?? status}</span>
}

export const TestBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4d6] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#8a5a00] uppercase ring-1 ring-yolk/40">
    <FlaskConical className="size-3" aria-hidden /> Test order
  </span>
)

export function OrderProgress({ status, compact = false }: { status: string; compact?: boolean }) {
  const at = ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number])
  if (at < 0) return <StatusBadge status={status} />
  return (
    <ol className="grid grid-cols-5" aria-label={`Order progress: ${STATUS_LABEL[status]}`}>
      {ORDER_STEPS.map((s, i) => {
        const done = i <= at
        return (
          <li key={s} className="flex flex-col items-center text-center" aria-current={i === at ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-[3px] flex-1 rounded-full ${i === 0 ? 'invisible' : done ? 'bg-orange' : 'bg-sand'}`} />
              <span className={`grid shrink-0 place-items-center rounded-full font-semibold ${compact ? 'size-6 text-[10px]' : 'size-8 text-xs'} ${i === at ? 'bg-orange text-white ring-4 ring-orange/20' : done ? 'bg-orange text-white' : 'bg-sand/70 text-muted'}`}>
                {done && i < at ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={`h-[3px] flex-1 rounded-full ${i === ORDER_STEPS.length - 1 ? 'invisible' : i < at ? 'bg-orange' : 'bg-sand'}`} />
            </div>
            <span className={`mt-2 leading-tight ${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'} ${done ? 'font-semibold text-olive' : 'text-muted'}`}>{STATUS_LABEL[s]}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function ItemRow({ it, children }: { it: OrderItem; children?: React.ReactNode }) {
  const img = imgSrc(it.image)
  return (
    <li className="flex gap-4 py-4">
      <Link to={`/product/${it.product_id}`} className="relative size-[72px] shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
        {img && <img src={img} alt="" className="size-full object-cover" loading="lazy" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/product/${it.product_id}`} className="font-medium hover:text-orange-2">{it.title}</Link>
        <p className="text-xs text-muted">{[it.color, it.size && sizeText(it.size), `Qty ${it.quantity}`].filter(Boolean).join(' · ')}</p>
        {children}
      </div>
      <p className="text-sm font-semibold text-olive">{formatMoney(it.unit_price * it.quantity)}</p>
    </li>
  )
}

export function AddressBlock({ value }: { value: Json | null }) {
  const a = asAddress(value)
  if (!a?.line1) return <p className="text-sm text-muted">No address on file.</p>
  return (
    <address className="text-sm leading-relaxed text-ink/85 not-italic">
      <span className="font-semibold text-ink">{a.name}</span><br />
      {a.line1}<br />{a.line2 && <>{a.line2}<br /></>}
      {[a.city, a.state, a.postal_code].filter(Boolean).join(', ')}<br />
      {countryName(a.country)}{a.phone && <><br /><span className="text-muted">{a.phone}</span></>}
    </address>
  )
}
