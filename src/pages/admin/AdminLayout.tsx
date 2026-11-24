import type { ReactNode } from 'react'
import { ExternalLink, Gauge, LogOut, MessageSquareText, Package, Settings, Shirt, Star, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { Logo } from '../../components/Layout'
import { useAuth } from '../../context/auth'

const NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/orders', label: 'Orders', icon: Package },
  { to: '/admin/products', label: 'Products', icon: Shirt },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquareText },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/settings', label: 'Pricing & sync', icon: Settings },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${isActive ? 'bg-cream/15 text-cream' : 'text-cream/75 hover:bg-cream/10 hover:text-cream'}`

  return (
    <div className="min-h-screen bg-cream">
      <aside className="bg-olive text-cream lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-screen lg:w-[240px] lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <NavLink to="/" className="rounded-xl bg-cream p-2 lg:inline-block" aria-label="Back to shop"><Logo className="h-10" /></NavLink>
          <p className="label-caps text-cream/70 lg:mt-4">Admin dashboard</p>
        </div>
        <nav aria-label="Admin" className="flex gap-1 lg:flex-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={cls}><Icon className="size-4" aria-hidden />{label}</NavLink>
          ))}
        </nav>
        <div className="hidden space-y-1 border-t border-cream/15 px-3 py-4 lg:block">
          <NavLink to="/" className={cls({ isActive: false })}><ExternalLink className="size-4" aria-hidden /> View shop</NavLink>
          <button type="button" onClick={signOut} className={`${cls({ isActive: false })} w-full`}><LogOut className="size-4" aria-hidden /> Sign out</button>
          <p className="truncate px-3 pt-2 text-xs text-cream/60" title={profile?.email ?? ''}>{profile?.email}</p>
        </div>
      </aside>
      <main className="min-w-0 px-4 lg:ml-[240px] py-6 sm:px-6 lg:px-10 lg:py-8"><Outlet /></main>
    </div>
  )
}

export const AdminTitle = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <h1 className="text-3xl">{title}</h1>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
)

