import type { ImgHTMLAttributes } from 'react'
import { useShopConfigState } from './useProducts'

// Pictures the owner can replace in the admin panel (Website photos). Same names as SLOTS in the admin repo.
const DEFAULTS = {
  logo: 'img/logo.png', chick: 'img/chick.png',
  'hero-1': 'banners/hero-hoodie.webp', 'hero-2': 'banners/hero-cap.webp', 'hero-3': 'banners/hero-mug.webp',
  'category-men': 'products/man-olive-cap.webp', 'category-women': 'products/hoodie-beige.webp',
  'category-kids': 'products/set-classic.webp', 'category-accessories': 'products/mug-olive.webp',
  'story-1': 'banners/story-hoodie.webp', 'story-2': 'banners/story-cap.webp', 'story-3': 'banners/story-mug.webp',
  why: 'products/gift-box.webp', login: 'banners/login-hoodie.webp',
  'contact-top': 'banners/contact-man.webp', 'contact-bottom': 'products/set-premium.webp',
  'about-top': 'banners/about-mug.webp', 'about-1': 'products/tee-cream-detail.webp', 'about-2': 'products/cap-back.webp', 'about-3': 'products/set-classic.webp',
} as const
export type Slot = keyof typeof DEFAULTS

/** Waits for the settings (remembered between visits), so a replaced picture never flashes the old one. */
export function SiteImg({ slot, ...rest }: { slot: Slot } & ImgHTMLAttributes<HTMLImageElement>) {
  const { cfg, failed } = useShopConfigState()
  const fallback = import.meta.env.BASE_URL + DEFAULTS[slot]
  return <img {...rest} src={cfg ? cfg.site_images[slot] ?? fallback : failed ? fallback : undefined} />
}
