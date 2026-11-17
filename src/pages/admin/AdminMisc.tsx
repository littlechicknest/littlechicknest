import Papa from 'papaparse'
import { Check, Copy, Download, EyeOff, Mail, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Field, Spinner, Stars, useTitle } from '../../components/ui'
import { CSV_TEMPLATE, parseProductRows, type ImportError, type ImportProduct } from '../../lib/csv'
import type { Json, Tables } from '../../lib/database.types'
import { formatDate, formatMoney, marginPrice } from '../../lib/shop'
import { functionError, supabase } from '../../lib/supabase'
import { invalidateProducts } from '../../lib/useProducts'
import { AdminTitle } from './AdminLayout'

/* ------------------------------------------------------------ CSV import */

export function CsvImport() {
  useTitle('CSV import')
  const [parsed, setParsed] = useState<{ products: ImportProduct[]; errors: ImportError[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const onFile = (file: File | undefined) => {
    setMsg(null)
    setParsed(null)
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setMsg({ tone: 'error', text: 'CSV must be under 2 MB.' })
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (res) => setParsed(parseProductRows(res.data)),
      error: (err) => setMsg({ tone: 'error', text: err.message }),
    })
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'inkthreadable-products-template.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  const run = async () => {
    if (!parsed?.products.length) return
    setBusy(true)
    // existing codes are updated in place (visibility/featured flags are left untouched)
    const { error } = await supabase.from('products').upsert(
      parsed.products.map((p) => ({ ...p, variants: p.variants as unknown as Json })),
      { onConflict: 'external_product_id' },
    )
    setBusy(false)
    if (error) return setMsg({ tone: 'error', text: error.message })
    invalidateProducts()
    setMsg({ tone: 'success', text: `Imported ${parsed.products.length} product${parsed.products.length > 1 ? 's' : ''}.` })
    setParsed(null)
  }

  return (
    <>
      <AdminTitle title="CSV import">
        <button type="button" onClick={download} className="btn-ghost py-2"><Download className="size-4" aria-hidden /> Template</button>
      </AdminTitle>
      <div className="card mb-6 space-y-3 p-5 text-sm text-ink/85">
        <p>Inkthreadable's API has no product catalogue, so add their products here in bulk. Use <strong>one row per colour</strong>. Rows with the same <code>code</code> become one product, and the first row sets the title, description, category and base price.</p>
        <p>Separate multiple <code>sizes</code> and <code>images</code> with <code>|</code>. Category must be Men, Women, Kids or Accessories. Re-importing a code updates that product.</p>
        <label className="btn-dark cursor-pointer py-2">
          <Upload className="size-4" aria-hidden /> Choose CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {parsed && (
        <div className="space-y-4">
          {parsed.errors.length > 0 && (
            <Alert>
              <p className="font-bold">{parsed.errors.length} row{parsed.errors.length > 1 ? 's' : ''} skipped:</p>
              <ul className="mt-1 list-disc pl-5">{parsed.errors.slice(0, 50).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
            </Alert>
          )}
          {parsed.products.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-sand text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Code</th><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3 text-right">Base cost</th><th className="p-3">Colours</th></tr></thead>
                <tbody className="divide-y divide-sand">
                  {parsed.products.map((p) => (
                    <tr key={p.external_product_id}><td className="p-3 font-mono">{p.external_product_id}</td><td className="p-3">{p.title}</td><td className="p-3">{p.category}</td><td className="p-3 text-right">{formatMoney(p.base_price)}</td><td className="p-3">{p.variants.map((v) => v.color).join(', ') || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={run} disabled={busy || parsed.products.length === 0} className="btn-primary">
            {busy ? 'Importing…' : `Import ${parsed.products.length} product${parsed.products.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------ reviews */

type ReviewRow = Tables<'reviews'> & { products: { title: string } | null }

export function AdminReviews() {
  useTitle('Reviews')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('reviews').select('*, products(title)').order('is_approved').order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data as unknown as ReviewRow[])))
  }, [])

  const setApproved = async (r: ReviewRow, is_approved: boolean) => {
    const { error } = await supabase.from('reviews').update({ is_approved }).eq('id', r.id)
    if (error) return setError(error.message)
    setRows((rs) => rs?.map((x) => (x.id === r.id ? { ...x, is_approved } : x)) ?? null)
    invalidateProducts()
  }
  const remove = async (r: ReviewRow) => {
    if (!confirm('Delete this review?')) return
    const { error } = await supabase.from('reviews').delete().eq('id', r.id)
    if (error) return setError(error.message)
    setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? null)
    invalidateProducts()
  }

  return (
    <>
      <AdminTitle title="Reviews" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="card p-8 text-center text-muted">No reviews yet.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`card p-5 ${r.is_approved ? '' : 'border-yolk'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    {!r.is_approved && <span className="rounded-full bg-yolk/25 px-2 py-0.5 text-xs font-extrabold uppercase text-olive">Pending</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.author_name} on <Link to={`/product/${r.product_id}`} className="underline">{r.products?.title ?? 'product'}</Link> · {formatDate(r.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  {r.is_approved
                    ? <button type="button" onClick={() => setApproved(r, false)} className="btn-ghost py-1.5"><EyeOff className="size-4" aria-hidden /> Hide</button>
                    : <button type="button" onClick={() => setApproved(r, true)} className="btn-dark py-1.5"><Check className="size-4" aria-hidden /> Approve</button>}
                  <button type="button" onClick={() => remove(r)} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label="Delete review"><Trash2 className="size-4" aria-hidden /></button>
                </div>
              </div>
              {r.body && <p className="mt-3 whitespace-pre-line text-ink/85">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------ messages */

export function AdminMessages() {
  useTitle('Messages')
  const [rows, setRows] = useState<Tables<'contact_messages'>[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data)))
  }, [])

  const markRead = async (id: string, is_read: boolean) => {
    const { error } = await supabase.from('contact_messages').update({ is_read }).eq('id', id)
    if (error) return setError(error.message)
    setRows((rs) => rs?.map((x) => (x.id === id ? { ...x, is_read } : x)) ?? null)
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this message?')) return
    const { error } = await supabase.from('contact_messages').delete().eq('id', id)
    if (error) return setError(error.message)
    setRows((rs) => rs?.filter((x) => x.id !== id) ?? null)
  }

  return (
    <>
      <AdminTitle title="Messages" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="card p-8 text-center text-muted">No messages yet.</p> : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className={`card p-5 ${m.is_read ? 'opacity-75' : 'border-yolk'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-olive">{m.name} {!m.is_read && <span className="ml-1 rounded-full bg-yolk/25 px-2 py-0.5 text-xs font-extrabold uppercase">New</span>}</p>
                  <p className="text-sm break-all text-muted">{m.email} · {new Date(m.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: your message to Little Chick Nest')}`} onClick={() => !m.is_read && markRead(m.id, true)} className="btn-dark py-1.5"><Mail className="size-4" aria-hidden /> Reply</a>
                  <button type="button" onClick={() => markRead(m.id, !m.is_read)} className="btn-ghost py-1.5">{m.is_read ? 'Mark unread' : 'Mark read'}</button>
                  <button type="button" onClick={() => remove(m.id)} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label="Delete message"><Trash2 className="size-4" aria-hidden /></button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-ink/85">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------ customers */

export function AdminCustomers() {
  useTitle('Customers')
  const [rows, setRows] = useState<Tables<'profiles'>[] | null>(null)
  const [subs, setSubs] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000).then(({ data }) => setRows(data ?? []))
    supabase.from('newsletter_subscribers').select('email').order('created_at', { ascending: false }).then(({ data }) => setSubs((data ?? []).map((s) => s.email)))
  }, [])

  const t = q.trim().toLowerCase()
  const list = (rows ?? []).filter((r) => !t || (r.email ?? '').toLowerCase().includes(t) || (r.full_name ?? '').toLowerCase().includes(t))
  const copy = async () => {
    await navigator.clipboard.writeText(subs.join(', '))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <AdminTitle title="Customers">
        <button type="button" onClick={copy} disabled={!subs.length} className="btn-ghost py-2"><Copy className="size-4" aria-hidden /> {copied ? 'Copied!' : `Copy ${subs.length} newsletter emails`}</button>
      </AdminTitle>
      <label className="mb-4 block"><span className="sr-only">Search</span>
        <input className="input" type="search" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {!rows ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-sand text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Joined</th><th className="p-3">Role</th></tr></thead>
            <tbody className="divide-y divide-sand">
              {list.map((r) => (
                <tr key={r.id}><td className="p-3">{r.full_name || '—'}</td><td className="p-3 break-all">{r.email}</td><td className="p-3 whitespace-nowrap">{formatDate(r.created_at)}</td><td className="p-3 capitalize">{r.role}</td></tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="p-6 text-center text-muted">No customers found.</p>}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------ settings */

export function AdminSettings() {
  useTitle('Pricing & sync')
  const [s, setS] = useState<Tables<'store_settings'> | null>(null)
  const [margin, setMargin] = useState(50)
  const [shipping, setShipping] = useState('0')
  const [freeOver, setFreeOver] = useState('0')
  const [express, setExpress] = useState('0')
  const [mode, setMode] = useState<'test' | 'live'>('test')
  const [example, setExample] = useState('15')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('admin_webhook_token').then(({ data }) => setToken(data ?? null))
    supabase.from('store_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (!data) return
      setS(data)
      setMargin(data.global_margin_percent)
      setShipping(String(data.shipping_flat))
      setFreeOver(String(data.free_shipping_over))
      setExpress(String(data.express_shipping))
      setMode(data.checkout_mode === 'live' ? 'live' : 'test')
    })
  }, [])

  if (!s) return <Spinner />

  const save = async () => {
    const [ship, free, exp] = [shipping, freeOver, express].map(Number)
    if (![ship, free, exp].every((n) => n >= 0)) return setMsg({ tone: 'error', text: 'Shipping amounts must be 0 or more.' })
    const r2 = (n: number) => Math.round(n * 100) / 100
    const { data, error } = await supabase.from('store_settings')
      .update({ global_margin_percent: margin, shipping_flat: r2(ship), free_shipping_over: r2(free), express_shipping: r2(exp), checkout_mode: mode }).eq('id', 1).select().single()
    if (error) return setMsg({ tone: 'error', text: error.message })
    setS(data)
    invalidateProducts()
    setMsg({ tone: 'success', text: 'Saved. Shop prices updated instantly.' })
  }

  const syncAll = async () => {
    setSyncing(true)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke<{ message: string }>('sync-order-status', { body: {} })
    setSyncing(false)
    setMsg(error ? { tone: 'error', text: await functionError(error) } : { tone: 'success', text: data?.message ?? 'Sync complete.' })
  }

  const base = Math.max(0, Number(example) || 0)
  const dirty = margin !== s.global_margin_percent || Number(shipping) !== Number(s.shipping_flat) || Number(freeOver) !== Number(s.free_shipping_over)
    || Number(express) !== Number(s.express_shipping) || mode !== s.checkout_mode

  return (
    <>
      <AdminTitle title="Pricing & sync" />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card space-y-5 p-6">
          <div>
            <h2 className="text-xl">Profit margin</h2>
            <p className="text-sm text-muted">Added on top of the Inkthreadable cost for every Inkthreadable product. Manual products keep their fixed price.</p>
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="margin" className="text-sm font-bold text-olive">Margin</label>
              <output htmlFor="margin" className="font-display text-4xl text-orange tabular-nums">{margin}%</output>
            </div>
            <input id="margin" type="range" min={1} max={100} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-orange" />
            <div className="flex justify-between text-xs text-muted"><span>1%</span><span>50%</span><span>100%</span></div>
          </div>
          <div className="rounded-lg bg-cream-2/70 p-4">
            <p className="mb-2 text-sm font-bold text-olive">Live preview</p>
            <div className="flex flex-wrap items-center gap-2 text-lg">
              <label className="flex items-center gap-1"><span className="sr-only">Example base cost</span>$<input type="number" min="0" step="0.01" value={example} onChange={(e) => setExample(e.target.value)} className="input w-24 py-1" /></label>
              <span className="text-muted">cost →</span>
              <strong className="text-2xl text-olive tabular-nums">{formatMoney(marginPrice(base, margin))}</strong>
              <span className="text-sm text-muted">in shop (profit {formatMoney(marginPrice(base, margin) - base)})</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Standard delivery (USD)" hint="0 = always free">
              <input type="number" min="0" step="0.01" className="input" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </Field>
            <Field label="Free standard over (USD)" hint="0 = no free threshold">
              <input type="number" min="0" step="0.01" className="input" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} />
            </Field>
            <Field label="Express delivery (USD)">
              <input type="number" min="0" step="0.01" className="input" value={express} onChange={(e) => setExpress(e.target.value)} />
            </Field>
          </div>
          <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-bold text-olive">Checkout mode</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([['test', 'Test (preview)', 'Orders are saved as test orders. No payment, nothing sent to print.'], ['live', 'Live (Stripe)', 'Customers pay by card on Stripe. Needs the Stripe keys in Supabase secrets.']] as const).map(([v, label, text]) => (
                <label key={v} className={`flex cursor-pointer gap-2.5 rounded-lg border-2 p-3 text-sm ${mode === v ? 'border-orange bg-orange-soft/40' : 'border-line'}`}>
                  <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} className="mt-0.5 accent-orange" />
                  <span><strong className="block text-olive">{label}</strong><span className="text-xs text-muted">{text}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={save} disabled={!dirty} className="btn-primary w-full">Save settings</button>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-xl">Inkthreadable order sync</h2>
          <p className="text-sm text-muted">Order statuses and tracking numbers are pulled from Inkthreadable automatically every hour. You can also sync now. This also re-sends any paid orders that failed to reach Inkthreadable.</p>
          <p className="text-sm">Last sync: <strong>{s.last_api_sync ? new Date(s.last_api_sync).toLocaleString() : 'never'}</strong></p>
          <button type="button" onClick={syncAll} disabled={syncing} className="btn-dark"><RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden /> {syncing ? 'Syncing…' : 'Sync orders now'}</button>
          <div className="rounded-lg bg-cream-2/70 p-4 text-sm">
            <p className="font-bold text-olive">Real-time webhook (optional)</p>
            <p className="mt-1 text-muted">In Inkthreadable → API settings → Webhooks, add a JSON webhook pointing to:</p>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs select-all">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/inkthreadable-webhook?token={token ?? '…'}</code>
            <p className="mt-1 text-xs text-muted">Keep this URL private: the token proves calls come from Inkthreadable.</p>
          </div>
        </section>
      </div>
    </>
  )
}
