'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Download, X, ShieldCheck, Loader2, AlertTriangle, Upload } from 'lucide-react'
import { useEntreprise } from '@/lib/hooks'

/**
 * PhotoSection — bibliotheque photo reutilisable.
 *
 * Les photos sont rattachees au CLIENT (toujours present), avec des liens
 * optionnels vers chantier / devis / facture. On affiche les photos du
 * contexte courant (scope) et on rattache automatiquement les bons liens.
 */

type Album = 'avant' | 'pendant' | 'apres'
const ALBUMS: { key: Album; label: string }[] = [
  { key: 'avant', label: 'Avant' },
  { key: 'pendant', label: 'Pendant' },
  { key: 'apres', label: 'Après' },
]

type Scope = 'client' | 'chantier' | 'devis' | 'facture'

interface Photo {
  id: string
  album: Album
  legende: string | null
  prise_le: string | null
  created_at: string
  thumb_url: string | null
  url: string
}

interface SignResponse {
  putUrl?: string
  putThumbUrl?: string
  key?: string
  thumbKey?: string
  message?: string
  quota?: { warn?: boolean }
}

interface PhotoSectionProps {
  scope: Scope
  clientId: string
  chantierId?: string
  devisId?: string
  factureId?: string
  /** Adresse a graver sur le tampon (ex: adresse du chantier ou du client). */
  adresse: string
  titre?: string
}

const MAX_ORIGINAL = 2000
const MAX_THUMB = 480

// ------------------- Traitement image (compression + tampon) -------------------

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/jpeg', quality)
  })
}

function loadLogo(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, lignes: string[], logo: HTMLImageElement | null) {
  const pad = Math.round(w * 0.025)
  const fontSize = Math.max(14, Math.round(w * 0.028))
  const lineH = Math.round(fontSize * 1.35)
  const barH = lineH * lignes.length + pad
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, h - barH, w, barH)
  ctx.fillStyle = '#ffffff'
  ctx.font = `500 ${fontSize}px Arial, sans-serif`
  ctx.textBaseline = 'top'
  let y = h - barH + pad / 2
  for (const ligne of lignes) { ctx.fillText(ligne, pad, y); y += lineH }
  if (logo && logo.width > 0) {
    const logoH = Math.min(barH - pad / 2, Math.round(w * 0.07))
    const logoW = Math.round((logo.width / logo.height) * logoH)
    try { ctx.drawImage(logo, w - logoW - pad, h - logoH - pad / 3, logoW, logoH) } catch { /* canvas tainted */ }
  }
}

interface Drawable {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void
  close: () => void
}

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { width: bmp.width, height: bmp.height, draw: (ctx, dw, dh) => ctx.drawImage(bmp, 0, 0, dw, dh), close: () => bmp.close?.() }
    } catch { /* repli ci-dessous */ }
  }
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('image load'))
    i.src = url
  })
  return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, dw, dh) => ctx.drawImage(img, 0, 0, dw, dh), close: () => URL.revokeObjectURL(url) }
}

async function traiterPhoto(file: File, lignes: string[], logo: HTMLImageElement | null): Promise<{ original: Blob; thumb: Blob; largeur: number; hauteur: number }> {
  const src = await loadDrawable(file)
  const ratio = Math.min(1, MAX_ORIGINAL / Math.max(src.width, src.height))
  const ow = Math.round(src.width * ratio)
  const oh = Math.round(src.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = ow; canvas.height = oh
  const ctx = canvas.getContext('2d')!
  src.draw(ctx, ow, oh)
  drawWatermark(ctx, ow, oh, lignes, logo)
  const original = await canvasToBlob(canvas, 0.82)
  const tRatio = Math.min(1, MAX_THUMB / Math.max(ow, oh))
  const tCanvas = document.createElement('canvas')
  tCanvas.width = Math.round(ow * tRatio); tCanvas.height = Math.round(oh * tRatio)
  tCanvas.getContext('2d')!.drawImage(canvas, 0, 0, tCanvas.width, tCanvas.height)
  const thumb = await canvasToBlob(tCanvas, 0.7)
  src.close()
  return { original, thumb, largeur: ow, hauteur: oh }
}

// ------------------- Composant -------------------

export default function PhotoSection({ scope, clientId, chantierId, devisId, factureId, adresse, titre }: PhotoSectionProps) {
  const { entreprise } = useEntreprise()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [album, setAlbum] = useState<Album>('avant')
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [warn, setWarn] = useState(false)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const scopeId = scope === 'client' ? clientId : scope === 'chantier' ? chantierId : scope === 'devis' ? devisId : factureId

  const charger = useCallback(async () => {
    if (!scopeId) { setPhotos([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/chantier-photos?${scope}_id=${encodeURIComponent(scopeId)}`)
      const json = await res.json()
      setPhotos(json.photos ?? [])
    } catch { setPhotos([]) } finally { setLoading(false) }
  }, [scope, scopeId])

  useEffect(() => { charger() }, [charger])

  const onPrendre = () => { setErreur(null); camRef.current?.click() }
  const onImporter = () => { setErreur(null); fileRef.current?.click() }

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    if (!clientId) { setErreur('Aucun client associé : impossible de ranger la photo.'); return }

    const logo = await loadLogo((entreprise?.logo_url as string) || '')
    setUploading({ done: 0, total: files.length })
    setErreur(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const dateStr = new Date(file.lastModified || Date.now()).toLocaleDateString('fr-FR')
        const lignes = [dateStr, adresse, (entreprise?.nom as string) || ''].filter(Boolean)
        const { original, thumb, largeur, hauteur } = await traiterPhoto(file, lignes, logo)

        const signRes = await fetch('/api/chantier-photos/sign-upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, size: original.size }),
        })
        let sign: SignResponse | null = null
        try { sign = await signRes.json() } catch { /* non JSON */ }
        if (!signRes.ok || !sign?.putUrl || !sign?.putThumbUrl) {
          setErreur(sign?.message || `Préparation de l'envoi refusée (code ${signRes.status}).`)
          break
        }
        if (sign.quota?.warn) setWarn(true)
        const { putUrl, putThumbUrl, key, thumbKey } = sign

        const origBuf = await original.arrayBuffer()
        const thumbBuf = await thumb.arrayBuffer()
        const putOpts = (buf: ArrayBuffer): RequestInit => ({ method: 'PUT', body: buf, headers: { 'Content-Type': 'image/jpeg' } })
        let put1: Response | null = null
        let put2: Response | null = null
        try {
          const r = await Promise.all([fetch(putUrl, putOpts(origBuf)), fetch(putThumbUrl, putOpts(thumbBuf))])
          put1 = r[0]; put2 = r[1]
        } catch (netErr) {
          setErreur(`Le stockage des photos est inaccessible (réseau ou CORS). Détail : ${(netErr as Error).message}`)
          break
        }
        if (!put1.ok || !put2.ok) {
          setErreur(`Le stockage a refusé l'envoi (code ${!put1.ok ? put1.status : put2.status}).`)
          break
        }

        const confRes = await fetch('/api/chantier-photos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            chantier_id: chantierId ?? null,
            devis_id: devisId ?? null,
            facture_id: factureId ?? null,
            album,
            r2_key: key,
            thumb_key: thumbKey,
            largeur, hauteur,
            prise_le: new Date(file.lastModified || Date.now()).toISOString(),
          }),
        })
        if (!confRes.ok) { setErreur(`Enregistrement refusé (code ${confRes.status}).`); break }
      } catch {
        setErreur('Cette photo n\'a pas pu être préparée par votre navigateur (format non supporté ?).')
      }
      setUploading({ done: i + 1, total: files.length })
    }

    setUploading(null)
    charger()
  }

  const supprimer = async (p: Photo) => {
    if (!window.confirm('Supprimer cette photo définitivement ?')) return
    setPhotos((prev) => prev.filter((x) => x.id !== p.id))
    try {
      const res = await fetch(`/api/chantier-photos/${p.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
    } catch {
      setErreur('La suppression a échoué. La photo a été restaurée.')
      charger()
    }
  }

  const telecharger = async (p: Photo) => {
    try {
      const res = await fetch(p.url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `photo-${p.album}-${p.id.slice(0, 8)}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { setErreur('Téléchargement impossible.') }
  }

  const photosAlbum = photos.filter((p) => p.album === album)
  const compteByAlbum = (a: Album) => photos.filter((p) => p.album === a).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-syne font-bold text-lg text-[#1a1a2e] flex items-center gap-2">
          <Camera size={20} className="text-[#5ab4e0]" /> {titre || 'Photos'}
        </h3>
        <div className="flex gap-2">
          <button onClick={onPrendre} disabled={!!uploading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e87a2a] hover:bg-[#f09050] text-white font-manrope font-semibold text-sm transition disabled:opacity-60">
            <Camera size={16} /> Prendre une photo
          </button>
          <button onClick={onImporter} disabled={!!uploading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[#1a1a2e] font-manrope font-semibold text-sm transition disabled:opacity-60">
            <Upload size={16} /> Galerie
          </button>
        </div>
        <input ref={camRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={onFiles} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      </div>

      <div className="bg-[#eef7fc] border border-[#5ab4e0]/30 rounded-xl p-3 flex items-start gap-2.5">
        <ShieldCheck size={18} className="text-[#1a6fb5] flex-shrink-0 mt-0.5" />
        <p className="font-manrope text-xs text-[#1a6fb5] leading-relaxed">
          Chaque photo est <strong>datée, localisée et estampillée de votre logo</strong>, de façon non modifiable — utile comme preuve en cas de litige.
        </p>
      </div>

      {warn && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="font-manrope text-xs text-amber-700 leading-relaxed">
            Vous approchez votre limite de stockage photos. Pensez à faire le ménage dans vos anciennes photos.
          </p>
        </div>
      )}

      {erreur && <div className="bg-red-50 border border-red-200 rounded-xl p-3 font-manrope text-xs text-red-700">{erreur}</div>}

      <div className="flex gap-2 flex-wrap">
        {ALBUMS.map((a) => (
          <button key={a.key} onClick={() => setAlbum(a.key)} className={`px-4 py-1.5 rounded-lg text-sm font-manrope font-medium transition ${album === a.key ? 'bg-[#5ab4e0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {a.label} <span className="opacity-70">· {compteByAlbum(a.key)}</span>
          </button>
        ))}
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-sm font-manrope text-[#1a1a2e]">
          <Loader2 size={16} className="animate-spin text-[#5ab4e0]" /> Envoi en cours… {uploading.done}/{uploading.total}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 font-manrope py-8">Chargement…</div>
      ) : photosAlbum.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400 font-manrope border border-dashed border-gray-200 rounded-xl">
          Aucune photo dans « {ALBUMS.find((a) => a.key === album)?.label} » pour l’instant.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photosAlbum.map((p) => (
            <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb_url || p.url} alt="Photo" loading="lazy" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(p)} />
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => telecharger(p)} aria-label="Télécharger" className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center text-[#1a1a2e] hover:bg-white"><Download size={14} /></button>
                <button onClick={() => supprimer(p)} aria-label="Supprimer" className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center text-red-600 hover:bg-white"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button aria-label="Fermer" className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={28} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt="Photo" className="max-w-full max-h-[88vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
