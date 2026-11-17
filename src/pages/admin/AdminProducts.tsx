import { ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Field, Spinner, useTitle } from '../../components/ui'
import type { Json, Tables } from '../../lib/database.types'
import { asVariants, CATEGORIES, formatMoney, imgSrc, marginPrice, safeUrl, type Variant } from '../../lib/shop'
import { supabase } from '../../lib/supabase'
import { invalidateProducts } from '../../lib/useProducts'
import { AdminTitle } from './AdminLayout'

type Row = Tables<'products'>

export function useMargin() {
  const [margin, setMargin] = useState<number | null>(null)
  useEffect(() => {
    supabase.from('store_settings').select('global_margin_percent').eq('id', 1).single()
      .then(({ data }) => setMargin(data?.global_margin_percent ?? 50))
  }, [])
  return margin
}

const shopPrice = (p: Row, margin: number) =>
  p.source === 'manual' ? Number(p.manual_price ?? 0) : marginPrice(Number(p.base_price ?? 0), margin)

export function AdminProducts() {
  useTitle('Products')
  const margin = useMargin()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reload = () =>
    supabase.from('products').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data)))
  useEffect(() => { void reload() }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows ?? []).filter((p) => !t || p.title.toLowerCase().includes(t) || (p.external_product_id ?? '').toLowerCase().includes(t))
  }, [rows, q])

  const patch = async (id: string, change: Pick<Partial<Row>, 'is_active' | 'is_featured'>) => {
    setRows((r) => r?.map((p) => (p.id === id ? { ...p, ...change } : p)) ?? null)
    const { error } = await supabase.from('products').update(change).eq('id', id)
    if (error) {
      setError(error.message)
      void reload() // roll the optimistic toggle back to what the database has
    }
    invalidateProducts()
  }

  const remove = async (p: Row) => {
    if (!confirm(`Delete "${p.title}"? Its reviews are deleted too. Past orders keep their copy of the item.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return setError(error.message)
    setRows((r) => r?.filter((x) => x.id !== p.id) ?? null)
    invalidateProducts()
  }

  const samples = (rows ?? []).filter((p) => p.is_sample).length
  const removeSamples = async () => {
    if (!confirm(`Delete all ${samples} sample products? Real products you added are not touched. Past test orders keep their copy of the items.`)) return
    const { error } = await supabase.from('products').delete().eq('is_sample', true)
    if (error) return setError(error.message)
    setRows((r) => r?.filter((x) => !x.is_sample) ?? null)
    invalidateProducts()
  }

  return (
    <>
      <AdminTitle title="Products">
        {samples > 0 && <button type="button" onClick={removeSamples} className="btn-ghost py-2 text-red-700"><Trash2 className="size-4" aria-hidden /> Delete {samples} sample products</button>}
        <Link to="/admin/import" className="btn-ghost py-2">CSV import</Link>
        <Link to="/admin/products/new" className="btn-primary py-2"><Plus className="size-4" aria-hidden /> Add product</Link>
      </AdminTitle>
      <label className="mb-4 block"><span className="sr-only">Search</span>
        <input className="input" type="search" placeholder="Search by title or Inkthreadable code" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!rows || margin == null ? <Spinner /> : filtered.length === 0 ? (
        <p className="card p-8 text-center text-muted">No products yet. Add one or import a CSV of Inkthreadable products.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-sand text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">Product</th><th className="p-3">Source</th><th className="p-3">Category</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Shop price</th><th className="p-3">Visible</th><th className="p-3">Featured</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {filtered.map((p) => {
                const img = imgSrc(p.images[0] ?? asVariants(p.variants)[0]?.images[0])
                return (
                  <tr key={p.id} className="hover:bg-cream-2/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="size-11 shrink-0 overflow-hidden rounded bg-cream-2">{img && <img src={img} alt="" className="size-full object-cover" loading="lazy" />}</div>
                        <div className="min-w-0"><p className="max-w-64 truncate font-bold text-olive">{p.title}{p.is_sample && <span className="ml-2 rounded bg-yolk/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-olive">Sample</span>}</p>{p.external_product_id && <p className="font-mono text-xs text-muted">{p.external_product_id}</p>}</div>
                      </div>
                    </td>
                    <td className="p-3 capitalize">{p.source}</td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3 text-right tabular-nums">{p.source === 'manual' ? '—' : formatMoney(p.base_price)}</td>
                    <td className="p-3 text-right font-bold tabular-nums">{formatMoney(shopPrice(p, margin))}</td>
                    <td className="p-3"><Toggle on={p.is_active} label={`Show ${p.title} in shop`} onChange={(v) => patch(p.id, { is_active: v })} /></td>
                    <td className="p-3"><Toggle on={p.is_featured} label={`Feature ${p.title}`} onChange={(v) => patch(p.id, { is_featured: v })} /></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/admin/products/${p.id}`} className="rounded p-2 hover:bg-olive/5" aria-label={`Edit ${p.title}`}><Pencil className="size-4" aria-hidden /></Link>
                        <button type="button" onClick={() => remove(p)} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label={`Delete ${p.title}`}><Trash2 className="size-4" aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-leaf' : 'bg-sand'}`}>
      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

/* ---------------------------------------------------------------- form */

type FormState = {
  source: 'inkthreadable' | 'manual'
  external_product_id: string
  title: string
  description: string
  category: string
  base_price: string
  manual_price: string
  images: string[]
  variants: (Omit<Variant, 'sizes'> & { sizes: string })[]
  print_front: string
  print_back: string
  is_active: boolean
  is_featured: boolean
}

const EMPTY: FormState = {
  source: 'inkthreadable', external_product_id: '', title: '', description: '', category: 'Men',
  base_price: '', manual_price: '', images: [], variants: [], print_front: '', print_back: '', is_active: true, is_featured: false,
}

async function uploadImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WebP images.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be under 5 MB.')
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '31536000', contentType: file.type })
  if (error) throw error
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

function ImageList({ urls, onChange, label }: { urls: string[]; onChange: (u: string[]) => void; label: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [url, setUrl] = useState('')

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setErr(null)
    try {
      const added: string[] = []
      for (const f of Array.from(files)) added.push(await uploadImage(f))
      onChange([...urls, ...added])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    }
    setBusy(false)
  }
  const addUrl = () => {
    if (!safeUrl(url.trim())) return setErr('Enter a full https:// image URL')
    onChange([...urls, url.trim()])
    setUrl('')
    setErr(null)
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-bold text-olive">{label}</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u + i} className="relative size-20 overflow-hidden rounded-lg bg-cream-2">
            {imgSrc(u) && <img src={imgSrc(u)!} alt="" className="size-full object-cover" />}
            <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5" aria-label="Remove image"><X className="size-3.5" aria-hidden /></button>
          </div>
        ))}
        <label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-sand text-muted hover:border-olive-3">
          {busy ? <span className="text-xs">Uploading…</span> : <ImagePlus className="size-6" aria-hidden />}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} aria-label={`Upload ${label}`} />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input py-1.5 text-sm" placeholder="…or paste an image URL (e.g. Inkthreadable mockup)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" onClick={addUrl} className="btn-ghost shrink-0 py-1.5">Add</button>
      </div>
      {err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  )
}

export function ProductForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  useTitle(isNew ? 'Add product' : 'Edit product')
  const navigate = useNavigate()
  const margin = useMargin()
  const [f, setF] = useState<FormState | null>(isNew ? EMPTY : null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase.from('products').select('*').eq('id', id!).maybeSingle().then(({ data, error }) => {
      if (error || !data) return setError('Product not found.')
      const pf = (data.print_files ?? {}) as Record<string, string>
      setF({
        source: data.source as FormState['source'], external_product_id: data.external_product_id ?? '', title: data.title,
        description: data.description, category: data.category, base_price: data.base_price?.toString() ?? '',
        manual_price: data.manual_price?.toString() ?? '', images: data.images,
        variants: asVariants(data.variants).map((v) => ({ ...v, sizes: v.sizes.join(', ') })),
        print_front: pf.front ?? '', print_back: pf.back ?? '', is_active: data.is_active, is_featured: data.is_featured,
      })
    })
  }, [id, isNew])

  if (!f) return error ? <Alert>{error}</Alert> : <Spinner />
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => (s ? { ...s, [k]: v } : s))
  const setVariant = (i: number, change: Partial<FormState['variants'][0]>) =>
    set('variants', f.variants.map((v, j) => (j === i ? { ...v, ...change } : v)))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const ink = f.source === 'inkthreadable'
    const base = Number(f.base_price), manual = Number(f.manual_price)
    if (ink && (!f.external_product_id.trim() || !(base >= 0) || f.base_price === '')) return setError('Inkthreadable products need a product code and base price.')
    if (!ink && (f.manual_price === '' || !(manual >= 0))) return setError('Manual products need a price.')
    for (const u of [f.print_front, f.print_back]) if (u && !safeUrl(u)) return setError('Print file links must be full https:// URLs.')
    const names = f.variants.map((v) => v.color.trim().toLowerCase())
    if (names.some((n) => !n)) return setError('Every colour needs a name.')
    if (new Set(names).size !== names.length) return setError('Colour names must be unique.')

    const payload = {
      source: f.source,
      external_product_id: ink ? f.external_product_id.trim() : null,
      title: f.title.trim(),
      description: f.description.trim(),
      category: f.category,
      base_price: ink ? Math.round(base * 100) / 100 : null,
      manual_price: ink ? null : Math.round(manual * 100) / 100,
      images: f.images,
      variants: f.variants.map((v) => ({
        color: v.color.trim(), ...(v.hex && { hex: v.hex }), ...(v.pn?.trim() && { pn: v.pn.trim() }),
        sizes: v.sizes.split(',').map((s) => s.trim()).filter(Boolean), images: v.images,
      })) as unknown as Json,
      print_files: { ...(f.print_front && { front: f.print_front }), ...(f.print_back && { back: f.print_back }) },
      is_active: f.is_active,
      is_featured: f.is_featured,
    }
    setBusy(true)
    const { error } = isNew
      ? await supabase.from('products').insert(payload)
      : await supabase.from('products').update(payload).eq('id', id!)
    setBusy(false)
    if (error) return setError(error.code === '23505' ? 'Another product already uses that Inkthreadable code.' : error.message)
    invalidateProducts()
    navigate('/admin/products')
  }

  const preview = f.source === 'inkthreadable' && f.base_price !== '' && margin != null ? marginPrice(Number(f.base_price), margin) : null

  return (
    <>
      <AdminTitle title={isNew ? 'Add product' : 'Edit product'} />
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-olive">Source</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([['inkthreadable', 'Inkthreadable product', 'Price = cost + margin. Orders go to Inkthreadable automatically.'], ['manual', 'Manual product', 'You set a fixed price and fulfil it yourself.']] as const).map(([v, t, d]) => (
                  <label key={v} className={`cursor-pointer rounded-lg border-2 p-3 ${f.source === v ? 'border-olive bg-white' : 'border-sand'}`}>
                    <input type="radio" name="source" value={v} checked={f.source === v} onChange={() => set('source', v)} className="sr-only" />
                    <span className="block font-bold text-olive">{t}</span><span className="text-xs text-muted">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Title"><input className="input" required maxLength={200} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Description"><textarea className="input" rows={5} maxLength={5000} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              {f.source === 'inkthreadable' ? (
                <Field label="Inkthreadable product code (pn)"><input className="input font-mono" maxLength={100} value={f.external_product_id} onChange={(e) => set('external_product_id', e.target.value)} /></Field>
              ) : (
                <Field label="Price (USD)"><input className="input" type="number" min="0" step="0.01" value={f.manual_price} onChange={(e) => set('manual_price', e.target.value)} /></Field>
              )}
            </div>
            {f.source === 'inkthreadable' && (
              <Field label="Base cost from Inkthreadable (USD)" hint={preview != null ? `Shop price at current ${margin}% margin: ${formatMoney(preview)}` : undefined}>
                <input className="input" type="number" min="0" step="0.01" value={f.base_price} onChange={(e) => set('base_price', e.target.value)} />
              </Field>
            )}
          </section>

          <section className="card space-y-4 p-5">
            <ImageList label="Product images" urls={f.images} onChange={(u) => set('images', u)} />
          </section>

          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Colours & sizes</h2>
              <button type="button" className="btn-ghost py-2" onClick={() => set('variants', [...f.variants, { color: '', hex: '#3b4228', sizes: 'S, M, L, XL', images: [] }])}><Plus className="size-4" aria-hidden /> Add colour</button>
            </div>
            {f.variants.length === 0 && <p className="text-sm text-muted">No colours: the product is sold as a single option.</p>}
            {f.variants.map((v, i) => (
              <div key={i} className="space-y-3 rounded-lg border border-sand p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_80px_1fr_auto]">
                  <Field label="Colour name"><input className="input" required maxLength={40} value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} /></Field>
                  <Field label="Swatch"><input type="color" className="h-[46px] w-full cursor-pointer rounded-lg border border-sand bg-white p-1" value={v.hex ?? '#cccccc'} onChange={(e) => setVariant(i, { hex: e.target.value })} /></Field>
                  {f.source === 'inkthreadable'
                    ? <Field label="Colour code (optional)" hint="Only if this colour has its own pn"><input className="input font-mono" maxLength={100} value={v.pn ?? ''} onChange={(e) => setVariant(i, { pn: e.target.value })} /></Field>
                    : <span />}
                  <button type="button" onClick={() => set('variants', f.variants.filter((_, j) => j !== i))} className="self-start rounded p-2 text-red-700 hover:bg-red-50 sm:mt-7" aria-label={`Remove colour ${v.color}`}><Trash2 className="size-4" aria-hidden /></button>
                </div>
                <Field label="Sizes" hint="Comma separated, e.g. S, M, L, XL. Leave empty for one-size."><input className="input" value={v.sizes} onChange={(e) => setVariant(i, { sizes: e.target.value })} /></Field>
                <ImageList label={`Images for ${v.color || 'this colour'}`} urls={v.images} onChange={(u) => setVariant(i, { images: u })} />
              </div>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="text-xl">Visibility</h2>
            <label className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Show in shop</span><Toggle on={f.is_active} label="Show in shop" onChange={(v) => set('is_active', v)} /></label>
            <label className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Featured on home page</span><Toggle on={f.is_featured} label="Featured" onChange={(v) => set('is_featured', v)} /></label>
          </section>
          {f.source === 'inkthreadable' && (
            <section className="card space-y-4 p-5">
              <h2 className="text-xl">Print files</h2>
              <p className="text-xs text-muted">High-resolution PNG links sent to Inkthreadable with each order. Never shown to customers.</p>
              <Field label="Front design URL"><input className="input" type="url" value={f.print_front} onChange={(e) => set('print_front', e.target.value)} /></Field>
              <Field label="Back design URL"><input className="input" type="url" value={f.print_back} onChange={(e) => set('print_back', e.target.value)} /></Field>
            </section>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}</button>
            <Link to="/admin/products" className="btn-ghost">Cancel</Link>
          </div>
        </div>
      </form>
    </>
  )
}
