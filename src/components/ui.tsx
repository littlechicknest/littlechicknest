import { Check, ChevronDown, ChevronRight, Info, Loader2, Minus, Plus, Star, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/auth'
import { SiteImg } from '../lib/siteImages'

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Little Chick Nest Shop` : 'Little Chick Nest Shop | Wear it. Love it. Support our flock.'
  }, [title])
}

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted">
    <Loader2 className="size-5 animate-spin" aria-hidden /> <span>{label}…</span>
  </div>
)

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-leaf/40 bg-[#f1f7ea] text-olive',
    info: 'border-yolk/40 bg-[#fff7e0] text-olive',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {tone === 'success' ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  )
}

export const Field = ({ label, hint, error, optional, children }: { label: string; hint?: string; error?: string | null; optional?: boolean; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-olive">
      {label}{optional && <span className="text-xs font-normal text-muted">Optional</span>}
    </span>
    {children}
    {error ? <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>
      : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>
)

export type Crumb = [label: string, to?: string]
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {[['Shop', '/'] as Crumb, ...items].map(([label, to], i, all) => (
          <li key={label + i} className="flex items-center gap-1">
            {to && i < all.length - 1 ? <Link to={to} className="hover:text-orange-2 hover:underline">{label}</Link>
              : <span aria-current="page" className="font-medium text-ink/80">{label}</span>}
            {i < all.length - 1 && <ChevronRight className="size-3" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export const PageHeader = ({ eyebrow, title, crumbs, children, actions }: { eyebrow?: string; title: string; crumbs?: Crumb[]; children?: ReactNode; actions?: ReactNode }) => (
  <header className="container-x pt-6 pb-6 sm:pt-8 sm:pb-8">
    {crumbs && <Breadcrumbs items={crumbs} />}
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="script mb-1 text-2xl">{eyebrow}</p>}
        <h1 className="text-[2rem] leading-tight sm:text-[2.6rem]">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-muted">{children}</div>}
      </div>
      {actions}
    </div>
  </header>
)

export function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={`${size} ${i <= Math.round(value) ? 'fill-yolk text-yolk' : 'text-sand'}`} />
      ))}
    </span>
  )
}

export const Empty = ({ title, icon, children }: { title: string; icon?: ReactNode; children?: ReactNode }) => (
  <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
    {icon ?? <SiteImg slot="chick" alt="" width={80} height={52} className="w-20" />}
    <h2 className="text-xl">{title}</h2>
    {children && <div className="max-w-md text-muted">{children}</div>}
  </div>
)

export function QtyStepper({ value, onChange, min = 1, max = 20, size = 'md', label = 'Quantity' }: { value: number; onChange: (n: number) => void; min?: number; max?: number; size?: 'sm' | 'md'; label?: string }) {
  const pad = size === 'sm' ? 'size-8' : 'size-11'
  return (
    <div className="inline-flex items-center rounded-md border border-sand bg-paper" role="group" aria-label={label}>
      <button type="button" className={`${pad} grid place-items-center text-olive transition-colors hover:bg-cream disabled:text-sand`} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity"><Minus className="size-3.5" aria-hidden /></button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={`${pad} grid place-items-center text-olive transition-colors hover:bg-cream disabled:text-sand`} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity"><Plus className="size-3.5" aria-hidden /></button>
    </div>
  )
}

export function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="flex list-none items-center justify-between gap-4 py-4 text-[15px] font-semibold text-olive [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-5 text-[14px] text-ink/80">{children}</div>
    </details>
  )
}

/** Locks page scroll, traps Escape, restores focus. */
let locks = 0
// open overlays, newest last: only the top one reacts to Escape and Tab
const stack: object[] = []
export function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose })
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const me = {}
    stack.push(me)
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return
      if (e.key === 'Escape') close.current()
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    // count open overlays so closing one doesn't unlock scrolling while another is still open
    if (locks++ === 0) {
      const sw = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${sw}px`
    }
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[data-autofocus],button,input')?.focus())
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(me), 1)
      if (--locks === 0) {
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
      }
      prev?.focus?.()
    }
  }, [open])
  return ref
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useOverlay(open, onClose)
  const id = useId()
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 animate-fade-in bg-olive/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={(el) => { ref.current = el }} className={`relative max-h-[90vh] w-full animate-fade-up overflow-y-auto rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="-m-2 rounded-full p-2 text-muted hover:bg-cream hover:text-olive" aria-label="Close"><X className="size-5" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ toasts */
type ToastItem = { id: number; text: string; action?: { label: string; to: string } }
let toasts: ToastItem[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
export function toast(text: string, action?: ToastItem['action']) {
  const id = Date.now() + Math.random()
  toasts = [...toasts.slice(-2), { id, text, action }]
  emit()
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit() }, 3200)
}
export function Toaster() {
  const list = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-full bg-olive py-2.5 pr-2.5 pl-4 text-sm text-white shadow-lg">
          <Check className="size-4 text-yolk" aria-hidden />
          <span>{t.text}</span>
          {t.action && <Link to={t.action.to} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider hover:bg-white/25">{t.action.label}</Link>}
        </div>
      ))}
    </div>
  )
}

/** Lazy image on a soft placeholder colour, so empty space never looks broken while it loads. */
export function Img({ src, alt, className = '', ...rest }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" {...rest} className={`bg-cream-2 ${className}`} />
}

/** Gate for signed-in routes. RLS is the real guard; this is UX. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}
