import { useEffect, useRef, useState } from 'react'

type Turnstile = { render: (el: HTMLElement, o: object) => string; reset: (id: string) => void; remove: (id: string) => void }
const turnstile = () => (window as unknown as { turnstile?: Turnstile }).turnstile

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
export const captchaOn = !!SITE_KEY

/** Cloudflare Turnstile check against password bots. Shows only once VITE_TURNSTILE_SITE_KEY is set (and CAPTCHA is on in Supabase). Change `attempt` to ask for a fresh token. */
export function Captcha({ attempt, onToken }: { attempt: number; onToken: (t: string | undefined) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const cb = useRef(onToken)
  useEffect(() => { cb.current = onToken })
  useEffect(() => {
    if (!SITE_KEY) return
    let id: string | undefined
    const draw = () => {
      if (box.current) id = turnstile()?.render(box.current, { sitekey: SITE_KEY, callback: (t: string) => cb.current(t), 'expired-callback': () => cb.current(undefined) })
    }
    // a failed script is removed so the retry downloads it again
    const fail = () => { s?.remove(); setFailed(true) }
    let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (turnstile()) draw()
    else {
      if (!s) {
        s = Object.assign(document.createElement('script'), { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true })
        s.dataset.turnstile = ''
        document.head.append(s)
      }
      s.addEventListener('load', draw)
      s.addEventListener('error', fail)
    }
    return () => { s?.removeEventListener('load', draw); s?.removeEventListener('error', fail); if (id) turnstile()?.remove(id) }
  }, [attempt, retry])
  if (!SITE_KEY) return null
  return failed
    ? <p className="text-sm text-muted">The security check couldn’t load. <button type="button" onClick={() => { setFailed(false); setRetry((n) => n + 1) }} className="font-semibold text-orange-2 underline">Try again</button></p>
    : <div ref={box} />
}
