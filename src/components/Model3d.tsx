import { createElement, useEffect, useState } from 'react'
import { Spinner } from './ui'

// the 3D viewer (and three.js) is a separate download, fetched the first time someone opens a 3D preview
let viewer: Promise<unknown> | null = null
const loadViewer = () => (viewer ??= import('@google/model-viewer').catch((e) => { viewer = null; throw e }))

/** A .glb model the shopper can turn with a finger or the mouse. */
export function Model3d({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    let on = true
    loadViewer().then(() => on && setState('ready'), () => on && setState('failed'))
    return () => { on = false }
  }, [])
  if (state === 'failed') return <div className="grid aspect-square place-items-center bg-white p-6 text-center text-sm text-muted">The 3D preview could not load. Please check your connection and try again.</div>
  if (state === 'loading') return <div className="grid aspect-square place-items-center bg-white"><Spinner /></div>
  // the viewer's own style fixes its height at 150px: it fills a square box instead, the same size as the photos
  return (
    <div className="aspect-square w-full bg-white">
      {createElement('model-viewer', {
        src, alt, 'camera-controls': '', 'touch-action': 'pan-y', 'auto-rotate': '', 'shadow-intensity': '1', exposure: '1',
        'interaction-prompt': 'none', loading: 'eager', style: { display: 'block', width: '100%', height: '100%' },
      })}
    </div>
  )
}
