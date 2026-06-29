'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Check, Loader2, CloudOff, Eye, Download, X, Send, Images } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useEntreprise } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { downloadPdfBlob } from '@/lib/download-pdf'
import { generateRapportPdf, collectPhotoRefs, imgMapKey, type PdfImage } from '@/lib/rapport/pdf-rapport'
import { useRapportUpload } from '@/hooks/rapport/useRapportUpload'
import PageCard from '@/components/rapport/PageCard'
import AddPageSheet from '@/components/rapport/AddPageSheet'
import AstuceDictee from '@/components/ui/AstuceDictee'
import type { PhotoMap } from '@/components/rapport/PhotoSlot'
import {
  type RapportPageData, type PageType, type PageContent, type PhotoRef,
  type PhotosContent, type TexteContent, type ConstatContent, type FinContent,
  createDefaultContent, uuidv4, normalizePage,
} from '@/lib/rapport/page-content'

interface Meta {
  numero: string | null; objet: string | null; statut: string
  client_nom_snapshot: string | null; date_intervention: string | null; date_fin: string | null; client_id: string | null; client_email: string | null
  adresse_rue: string | null; adresse_cp: string | null; adresse_ville: string | null
}

/** Renseigne le photoId sur la PhotoRef qui porte ce localId (apres confirmation upload). */
function attachPhotoId(pages: RapportPageData[], localId: string, photoId: string): RapportPageData[] {
  const fix = (r: PhotoRef | undefined): { r: PhotoRef | undefined; hit: boolean } =>
    r && r.localId === localId ? { r: { ...r, photoId }, hit: true } : { r, hit: false }
  return pages.map((p) => {
    if (p.type === 'photos') {
      const c = p.contenu as PhotosContent; let hit = false
      const photos = (c.photos ?? []).map((r) => { const f = fix(r); if (f.hit) hit = true; return (f.r ?? {}) as PhotoRef })
      return hit ? { ...p, contenu: { ...c, photos } } : p
    }
    return p
  })
}

function pageHasContent(p: RapportPageData): boolean {
  if (p.type === 'photos') { const c = p.contenu as PhotosContent; return !!c.titre?.trim() || (c.photos ?? []).some((r) => !!(r?.localId || r?.photoId || r?.legende?.trim())) }
  if (p.type === 'texte') { const c = p.contenu as TexteContent; return !!(c.titre?.trim() || c.texte?.trim()) }
  if (p.type === 'constat') return ((p.contenu as ConstatContent).items ?? []).some((x) => !!x && x.trim() !== '')
  if (p.type === 'fin') { const c = p.contenu as FinContent; return ((c.controles ?? []).some((x) => x?.trim())) || ((c.observations ?? []).some((x) => x?.trim())) || !!c.conclusion?.trim() }
  return false
}

type ClientOpt = { id: string; raison_sociale: string | null; prenom: string | null; nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null }
function clientDisplay(c: ClientOpt): string {
  if (c.raison_sociale) return c.raison_sociale
  return [c.prenom, c.nom].filter(Boolean).join(' ').trim()
}
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(blob) })
}
function bakePhoto(dataUrl: string): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1400
      let w = img.naturalWidth || 1, h = img.naturalHeight || 1
      const scale = Math.min(1, MAX / Math.max(w, h))
      w = Math.round(w * scale); h = Math.round(h * scale)
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')
      if (!ctx) { resolve({ dataUrl, w, h }); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ dataUrl: cv.toDataURL('image/jpeg', 0.82), w, h })
    }
    img.onerror = () => resolve({ dataUrl, w: 0, h: 0 })
    img.src = dataUrl
  })
}
function rotateDataUrl(dataUrl: string, deg: number): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const swap = deg === 90 || deg === 270
      const w = swap ? img.naturalHeight : img.naturalWidth
      const h = swap ? img.naturalWidth : img.naturalHeight
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')
      if (!ctx) { resolve({ dataUrl, w: img.naturalWidth, h: img.naturalHeight }); return }
      ctx.translate(w / 2, h / 2); ctx.rotate((deg * Math.PI) / 180); ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      resolve({ dataUrl: cv.toDataURL('image/jpeg', 0.85), w, h })
    }
    img.onerror = () => resolve({ dataUrl, w: 0, h: 0 })
    img.src = dataUrl
  })
}

export default function RapportEditorPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { entreprise } = useEntreprise()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busyPdf, setBusyPdf] = useState(false)
  const [showEnvoyer, setShowEnvoyer] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const headerReady = useRef(false)
  const [clientsList, setClientsList] = useState<ClientOpt[]>([])
  const [showClientSug, setShowClientSug] = useState(false)
  const [headerForm, setHeaderForm] = useState({ objet: '', client_nom_snapshot: '', adresse_rue: '', adresse_cp: '', adresse_ville: '', date_intervention: '', date_fin: '' })
  const multiRef = useRef<HTMLInputElement>(null)

  const [meta, setMeta] = useState<Meta | null>(null)
  const [pages, setPages] = useState<RapportPageData[]>([])
  const [photosById, setPhotosById] = useState<PhotoMap>({})
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showAdd, setShowAdd] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const skipSave = useRef(true)
  const bodyRef = useRef<HTMLDivElement>(null)

  const onUploaded = useCallback(({ photoLocalId, photoId }: { photoLocalId: string; photoId: string }) => {
    setPages((prev) => attachPhotoId(prev, photoLocalId, photoId))
  }, [])

  const upload = useRapportUpload({ rapportId: id, clientId: meta?.client_id ?? null, onUploaded })

  // Chargement initial
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [rRes, pRes] = await Promise.all([
          fetch(`/api/rapports/${id}`),
          fetch(`/api/rapport-photos?rapport_id=${encodeURIComponent(id)}`),
        ])
        const rJson = await rRes.json()
        if (!rRes.ok) { toast.error('Rapport introuvable'); return }
        setMeta(rJson.rapport)
        const rp = rJson.rapport
        setHeaderForm({ objet: rp.objet || '', client_nom_snapshot: rp.client_nom_snapshot || '', adresse_rue: rp.adresse_rue || '', adresse_cp: rp.adresse_cp || '', adresse_ville: rp.adresse_ville || '', date_intervention: rp.date_intervention || '', date_fin: rp.date_fin || '' })
        setTimeout(() => { headerReady.current = true }, 0)
        setPages((rJson.pages ?? []).map((p: { id: string; type: string; contenu: Record<string, unknown> }) => normalizePage(p)))
        const pJson = await pRes.json().catch(() => ({ photos: [] }))
        const map: PhotoMap = {}
        for (const ph of pJson.photos ?? []) map[ph.id] = { url: ph.url, thumb_url: ph.thumb_url }
        setPhotosById(map)
      } catch { toast.error('Chargement impossible') } finally {
        setLoading(false)
        // Laisse passer le 1er rendu avant d'autoriser l'autosave.
        setTimeout(() => { skipSave.current = false }, 0)
      }
    })()
  }, [id])

  // Clients enregistres (pour l'autocompletion du champ Client)
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('clients').select('id, raison_sociale, prenom, nom, adresse, code_postal, ville').order('created_at', { ascending: false })
        setClientsList((data as ClientOpt[]) ?? [])
      } catch { /* liste optionnelle */ }
    })()
  }, [])

  // Autosave debounce
  useEffect(() => {
    if (skipSave.current || loading) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rapports/${id}/pages`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: pages.map((p) => ({ id: p.id, type: p.type, contenu: p.contenu })) }),
        })
        setSaveState(res.ok ? 'saved' : 'idle')
        if (!res.ok) toast.error('Sauvegarde échouée')
      } catch { setSaveState('idle'); toast.error('Sauvegarde échouée (réseau)') }
    }, 1000)
    return () => clearTimeout(t)
  }, [pages, id, loading])

  // Autosave en-tete (champs visibles, plus besoin d'ouvrir une fenetre)
  useEffect(() => {
    if (!headerReady.current) return
    const t = setTimeout(() => {
      const body = { ...headerForm, date_fin: headerForm.date_fin || null }
      fetch(`/api/rapports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then((r) => { if (r.ok) setMeta((m) => (m ? { ...m, ...headerForm, date_fin: headerForm.date_fin || null } : m)) })
        .catch(() => { /* reseau */ })
    }, 900)
    return () => clearTimeout(t)
  }, [headerForm, id])

  // Avertit si on quitte avec des photos en cours d'envoi.
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (upload.summary.uploading + upload.summary.pending > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', before)
    return () => window.removeEventListener('beforeunload', before)
  }, [upload.summary.uploading, upload.summary.pending])

  const addPage = (type: PageType) => {
    setPages((prev) => [...prev, { id: uuidv4(), type, contenu: createDefaultContent(type) }])
    setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }), 60)
  }
  const updatePage = (pid: string, contenu: PageContent) => setPages((prev) => prev.map((p) => (p.id === pid ? { ...p, contenu } : p)))
  const move = (i: number, dir: -1 | 1) => setPages((prev) => {
    const j = i + dir; if (j < 0 || j >= prev.length) return prev
    const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  const del = (pid: string) => {
    const pg = pages.find((p) => p.id === pid)
    if (pg && pageHasContent(pg) && !window.confirm('Supprimer cette page et son contenu ?')) return
    setPages((prev) => prev.filter((p) => p.id !== pid))
  }

  const terminer = async () => {
    const s = upload.summary
    if (s.uploading + s.pending > 0 && !window.confirm('Des photos sont encore en cours d\u2019envoi. Finaliser quand m\u00eame ?')) return
    if (s.error > 0 && !window.confirm('Certaines photos ont \u00e9chou\u00e9 \u00e0 l\u2019envoi. Finaliser quand m\u00eame ?')) return
    setFinishing(true)
    try {
      const res = await fetch(`/api/rapports/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'finalise' }),
      })
      if (res.ok) { setMeta((m) => (m ? { ...m, statut: 'finalise' } : m)); toast.success('Rapport finalisé') }
      else toast.error('Action impossible')
    } catch { toast.error('Action impossible') } finally { setFinishing(false) }
  }

  const pickClient = (c: ClientOpt) => {
    setHeaderForm((h) => ({ ...h, client_nom_snapshot: clientDisplay(c), adresse_rue: c.adresse || '', adresse_cp: c.code_postal || '', adresse_ville: c.ville || '' }))
    setShowClientSug(false)
  }

  const buildImages = useCallback(async (): Promise<Map<string, PdfImage>> => {
    const refs = collectPhotoRefs(pages)
    const map = new Map<string, PdfImage>()
    for (const ref of refs) {
      const key = imgMapKey(ref)
      if (!key || map.has(key)) continue
      let blob: Blob | null = ref.localId ? await upload.getBlobFor(ref.localId) : null
      if (!blob && ref.photoId && photosById[ref.photoId]) {
        try { const r = await fetch(photosById[ref.photoId].url); if (r.ok) blob = await r.blob() } catch { /* ignore */ }
      }
      if (!blob) continue
      try {
        let upright = await blobToDataURL(blob)
        const rot = (((ref.rotation || 0) % 360) + 360) % 360
        if (rot) { const r = await rotateDataUrl(upright, rot); upright = r.dataUrl }
        const baked = await bakePhoto(upright)
        map.set(key, { dataUrl: baked.dataUrl, w: baked.w, h: baked.h })
      } catch { /* ignore */ }
    }
    return map
  }, [pages, photosById, upload])

  const makeDoc = useCallback(async () => {
    const images = await buildImages()
    return generateRapportPdf({
      meta: { numero: meta?.numero ?? null, objet: meta?.objet ?? null, clientNom: meta?.client_nom_snapshot ?? null, adresseRue: meta?.adresse_rue ?? null, adresseCp: meta?.adresse_cp ?? null, adresseVille: meta?.adresse_ville ?? null, date: meta?.date_intervention ?? null, dateFin: meta?.date_fin ?? null },
      pages, images, entrepriseNom: (entreprise?.nom as string) || '', entreprise,
    })
  }, [buildImages, meta, pages, entreprise])

  const onApercu = async () => {
    // On ouvre l'onglet DANS le clic (sinon le bloqueur de pop-up le refuse),
    // puis on y charge le PDF. Plus fiable que l'iframe (bloquee par certains
    // bloqueurs de pub).
    const w = window.open('', '_blank')
    setBusyPdf(true)
    try {
      const doc = await makeDoc()
      const blob = doc.output('blob') as Blob
      const url = URL.createObjectURL(blob)
      if (w) { w.location.href = url } else { downloadPdfBlob(blob, `${meta?.numero || 'rapport'}.pdf`) }
    } catch { toast.error('Aperçu impossible') } finally { setBusyPdf(false) }
  }
  const onDownload = async () => {
    setBusyPdf(true)
    try { const doc = await makeDoc(); downloadPdfBlob(doc.output('blob') as Blob, `${meta?.numero || 'rapport'}.pdf`); toast.success('PDF prêt') }
    catch { toast.error('Téléchargement impossible') } finally { setBusyPdf(false) }
  }
  const closePreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }

  const addManyPhotos = (files: FileList) => {
    const arr = Array.from(files).filter((fl) => fl.type.startsWith('image/')).slice(0, 30)
    if (!arr.length) return
    const newPages: RapportPageData[] = arr.map((file) => {
      const pid = uuidv4()
      const [lid] = upload.addPhotos([file], { pageId: pid })
      return { id: pid, type: 'photos', contenu: { titre: '', photos: [{ localId: lid ?? null, photoId: null }] } as PhotosContent }
    })
    setPages((prev) => [...prev, ...newPages])
    setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }), 60)
  }

  const openEnvoyer = () => { setEmailTo(meta?.client_email || ''); setShowEnvoyer(true) }
  const onEnvoyer = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) { toast.error('Adresse e-mail invalide'); return }
    setSendingEmail(true)
    try {
      const doc = await makeDoc()
      const b64 = ((doc.output('datauristring') as string).split(',')[1]) || ''
      const res = await fetch(`/api/rapports/${id}/envoyer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: b64, email: emailTo, message: emailMsg }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.message || 'Envoi impossible'); return }
      setMeta((m) => (m ? { ...m, statut: 'envoye' } : m)); setShowEnvoyer(false); toast.success('Rapport envoyé à ' + emailTo)
    } catch { toast.error('Envoi impossible') } finally { setSendingEmail(false) }
  }


  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 font-hanken py-20 justify-center"><Loader2 className="animate-spin" size={18} /> Chargement…</div>
  }

  const clientQuery = headerForm.client_nom_snapshot.trim().toLowerCase()
  const clientMatches = showClientSug && clientQuery.length >= 1
    ? clientsList.filter((c) => clientDisplay(c).toLowerCase().includes(clientQuery)).slice(0, 6)
    : []

  return (
    <div className="max-w-2xl mx-auto px-4 pb-56 pt-4">
      {/* En-tete */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <Link href="/dashboard/rapports" className="inline-flex items-center gap-1 font-hanken text-sm text-gray-500 hover:text-navy"><ChevronLeft size={16} /> Rapports</Link>
        <div className="flex items-center gap-2">
          <span className="font-spline-mono text-xs text-gray-400">{meta?.numero}</span>
          {upload.summary.uploading + upload.summary.pending > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-hanken text-sky-dark"><Loader2 size={11} className="animate-spin" /> {upload.summary.uploading + upload.summary.pending} photo(s)…</span>
          ) : upload.summary.error > 0 ? (
            <button onClick={upload.retryAll} className="inline-flex items-center gap-1 text-[11px] font-hanken text-red-600 font-semibold">{upload.summary.error} échec — réessayer</button>
          ) : saveState === 'saving' ? <span className="inline-flex items-center gap-1 text-[11px] font-hanken text-gray-400"><Loader2 size={11} className="animate-spin" /> Enregistrement…</span>
            : saveState === 'saved' ? <span className="inline-flex items-center gap-1 text-[11px] font-hanken text-emerald-600"><Check size={12} /> Enregistré</span> : null}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <p className="font-hanken text-[10px] uppercase tracking-wide font-bold text-gray-400 mb-2">En-tête du rapport</p>
        <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Client</label>
        <div className="relative mb-3">
          <input value={headerForm.client_nom_snapshot} autoComplete="off"
            onChange={(e) => { setHeaderForm((h) => ({ ...h, client_nom_snapshot: e.target.value })); setShowClientSug(true) }}
            onFocus={() => setShowClientSug(true)}
            onBlur={() => setTimeout(() => setShowClientSug(false), 150)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50" placeholder="Nom du client (tapez pour rechercher)" />
          {clientMatches.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {clientMatches.map((c) => (
                <button type="button" key={c.id} onMouseDown={(e) => { e.preventDefault(); pickClient(c) }}
                  className="w-full text-left px-3 py-2 hover:bg-sky/5 border-b border-gray-100 last:border-0">
                  <span className="block font-hanken text-sm text-navy font-semibold">{clientDisplay(c)}</span>
                  {(c.adresse || c.ville) && (
                    <span className="block font-hanken text-xs text-gray-400">{[c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Adresse</label>
        <input value={headerForm.adresse_rue} onChange={(e) => setHeaderForm((h) => ({ ...h, adresse_rue: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 mb-2" placeholder="Rue (ex : 12 rue des Lilas)" />
        <div className="grid grid-cols-3 gap-2 mb-3">
          <input value={headerForm.adresse_cp} onChange={(e) => setHeaderForm((h) => ({ ...h, adresse_cp: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 col-span-1" placeholder="Code postal" />
          <input value={headerForm.adresse_ville} onChange={(e) => setHeaderForm((h) => ({ ...h, adresse_ville: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 col-span-2" placeholder="Ville" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Date d&apos;intervention</label>
            <input type="date" value={headerForm.date_intervention} onChange={(e) => setHeaderForm((h) => ({ ...h, date_intervention: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50" />
          </div>
          <div>
            <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Fin (plusieurs jours)</label>
            <input type="date" value={headerForm.date_fin} onChange={(e) => setHeaderForm((h) => ({ ...h, date_fin: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50" />
          </div>
        </div>
        <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Objet</label>
        <input value={headerForm.objet} onChange={(e) => setHeaderForm((h) => ({ ...h, objet: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50" placeholder="Ex : allée + clôture" />
      </div>

      {!upload.persistenceHealthy && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <CloudOff size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="font-hanken text-xs text-amber-800">Sauvegarde hors-ligne indisponible sur cet appareil. Terminez l&apos;envoi des photos avant de fermer.</p>
        </div>
      )}

      <AstuceDictee className="mb-3" />

      <div ref={bodyRef} className="space-y-3">
        {pages.length === 0 && (
          <p className="text-center font-hanken text-sm text-gray-400 italic py-6">Ajoutez vos pages ci-dessous. La mise en page se fait toute seule.</p>
        )}
        {pages.map((p, i) => (
          <PageCard key={p.id} page={p} index={i} total={pages.length}
            onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} onDelete={() => del(p.id)}
            onChange={(contenu) => updatePage(p.id, contenu)}
            jobs={upload.jobs} getPreview={upload.getPreview} photosById={photosById}
            pickPhoto={(files) => upload.addPhotos(files, { pageId: p.id })} onRetry={upload.retry} />
        ))}
      </div>

      {/* Barre d'action fixe */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-[#f6f8fb] via-[#f6f8fb] to-transparent pt-6 pb-3 px-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setShowAdd(true)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange to-orange-hover text-white font-hanken font-extrabold text-[15px] shadow-[0_8px_22px_rgba(232,122,42,0.35)] active:translate-y-px flex items-center justify-center gap-2">
            <Plus size={18} /> Ajouter une page
          </button>
          <button onClick={() => multiRef.current?.click()} className="w-full mt-1.5 inline-flex items-center justify-center gap-1 font-hanken text-xs text-sky-dark hover:underline">
            <Images size={13} /> ou ajouter plusieurs photos d&apos;un coup
          </button>
          <input ref={multiRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addManyPhotos(e.target.files); e.target.value = '' }} />
          <div className="flex gap-2 mt-2">
            <button onClick={onApercu} disabled={busyPdf || pages.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-navy font-hanken font-bold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              {busyPdf ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Aperçu
            </button>
            <button onClick={onDownload} disabled={busyPdf || pages.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-navy font-hanken font-bold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              <Download size={15} /> PDF
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={terminer} disabled={finishing}
              className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-navy font-hanken font-bold text-sm disabled:opacity-50">
              {meta?.statut === 'finalise' ? 'Finalisé ✓' : meta?.statut === 'envoye' ? 'Envoyé ✓' : finishing ? '…' : 'Terminer'}
            </button>
            <button onClick={openEnvoyer} disabled={pages.length === 0}
              className="flex-[2] py-2.5 rounded-xl bg-navy text-white font-hanken font-bold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              <Send size={15} /> Envoyer au client
            </button>
          </div>
        </div>
      </div>

      {showEnvoyer && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => !sendingEmail && setShowEnvoyer(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1"><h2 className="font-hanken font-extrabold text-lg text-navy">Envoyer au client</h2>
              <button aria-label="Fermer" onClick={() => setShowEnvoyer(false)} className="text-gray-400 hover:text-navy"><X size={20} /></button></div>
            <p className="font-hanken text-xs text-gray-500 mb-4">Le rapport sera envoyé en PDF, en pièce jointe.</p>
            <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">E-mail du client</label>
            <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@exemple.fr" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 mb-3" />
            <label className="block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Message (optionnel)</label>
            <textarea value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} rows={3} placeholder="Mot d'accompagnement…" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 mb-5" />
            <button onClick={onEnvoyer} disabled={sendingEmail} className="w-full py-2.5 rounded-xl bg-navy text-white font-hanken font-bold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              {sendingEmail ? <><Loader2 size={15} className="animate-spin" /> Envoi…</> : <><Send size={15} /> Envoyer</>}
            </button>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[60] bg-navy/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-navy text-white">
            <span className="font-hanken text-sm font-bold">Aperçu du PDF</span>
            <div className="flex items-center gap-4">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="font-hanken text-sm text-sky-light underline">Ouvrir dans un onglet</a>
              <button onClick={closePreview} className="inline-flex items-center gap-1 font-hanken text-sm text-sky-light"><X size={16} /> Fermer</button>
            </div>
          </div>
          <div className="bg-sky/15 text-center text-[11px] text-white/80 py-1.5 font-hanken">Voici le PDF que recevra votre client. Mise en page automatique à vos couleurs.</div>
          <iframe title="Aperçu du rapport" src={previewUrl} className="flex-1 w-full bg-white" />
        </div>
      )}

      <AddPageSheet open={showAdd} onClose={() => setShowAdd(false)} onAdd={addPage} />
    </div>
  )
}
