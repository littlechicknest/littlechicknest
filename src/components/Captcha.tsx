import { useEffect, useRef } from 'react'

type Turnstile = { render: (el: HTMLElement, o: object) => string; reset: (id: string) => void; remove: (id: string) => void }
const turnstile = () => (window as unknown as { turnstile?: Turnstile }).turnstile

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

/** Cloudflare Turnstile check against password bots. Shows only once VITE_TURNSTILE_SITE_KEY is set (and CAPTCHA is on in Supabase). Change `attempt` to ask for a fresh token. */
export function Captcha({ attempt, onToken }: { attempt: number; onToken: (t: string | undefined) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  useEffect(() => { cb.current = onToken })
  useEffect(() => {
    if (!SITE_KEY) return
    let id: string | undefined
    const draw = () => {
      if (box.current) id = turnstile()?.render(box.current, { sitekey: SITE_KEY, callback: (t: string) => cb.current(t), 'expired-callback': () => cb.current(undefined) })
    }
    let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (turnstile()) draw()
    else {
      if (!s) {
        s = Object.assign(document.createElement('script'), { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true })
        s.dataset.turnstile = ''
        document.head.append(s)
      }
      s.addEventListener('load', draw)
    }
    return () => { s?.removeEventListener('load', draw); if (id) turnstile()?.remove(id) }
  }, [attempt])
  return SITE_KEY ? <div ref={box} /> : null
}
