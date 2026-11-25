import type { ReactNode } from 'react'
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import Layout from './components/Layout'
import { RequireAuth } from './components/ui'
import { AuthProvider } from './context/auth'
import { CartProvider } from './context/cart'
import { Account, Addresses, ChangePassword, DeleteAccount, Profile } from './pages/Account'
import Checkout, { CheckoutSuccess } from './pages/Checkout'
import Contact from './pages/Contact'
import { About, Cookies, Faq, Privacy, ShippingReturns, Terms } from './pages/Content'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import { OrderDetail, Orders } from './pages/Orders'
import Product from './pages/Product'
import Shop from './pages/Shop'
import Wishlist from './pages/Wishlist'
import { WishlistProvider } from './context/wishlist'

const authed = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>
const Providers = () => (
  <AuthProvider>
    <CartProvider><WishlistProvider><Outlet /></WishlistProvider></CartProvider>
  </AuthProvider>
)

const router = createHashRouter([{
  element: <Providers />,
  children: [
    {
      element: <Layout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'shop', element: <Shop /> },
        { path: 'product/:id', element: <Product /> },
        { path: 'login', element: <Login /> },
        { path: 'reset-password', element: authed(<ChangePassword recovery />) },
        { path: 'account', element: authed(<Account />) },
        { path: 'account/password', element: authed(<ChangePassword />) },
        { path: 'account/addresses', element: authed(<Addresses />) },
        { path: 'account/profile', element: authed(<Profile />) },
        { path: 'wishlist', element: <Wishlist /> },
        { path: 'checkout', element: <Checkout /> },
        { path: 'account/delete', element: authed(<DeleteAccount />) },
        { path: 'orders', element: authed(<Orders />) },
        { path: 'orders/:id', element: authed(<OrderDetail />) },
        { path: 'checkout/success', element: authed(<CheckoutSuccess />) },
        { path: 'checkout/cancel', element: <Navigate to="/checkout" replace /> },
        { path: 'about', element: <About /> },
        { path: 'contact', element: <Contact /> },
        { path: 'faq', element: <Faq /> },
        { path: 'shipping-returns', element: <ShippingReturns /> },
        { path: 'terms', element: <Terms /> },
        { path: 'privacy-policy', element: <Privacy /> },
        { path: 'cookie-policy', element: <Cookies /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
}])

export default function App() {
  return <RouterProvider router={router} />
}
