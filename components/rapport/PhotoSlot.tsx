'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, AlertTriangle, RotateCw, X } from 'lucide-react'
import type { UploadJob } from '@/lib/rapport/upload-queue'
import type { RapportUploadPayload } from '@/lib/rapport/upload-store'
import type { PhotoRef } from '@/lib/rapport/page-content'

export interface PhotoMap { [photoId: string]: { url: string; thumb_url: string | null } }

export default function PhotoSlot({ refData, label, jobs, getPreview, photosById, onPick, onRemove, onRetry, big }: {
  refData: PhotoRef
  label?: string
  jobs: UploadJob<RapportUploadPayload>[]
  getPreview: (localId: string) => Promise<string | null>
  photosById: PhotoMap
  onPick: (files: FileList) => void
  onRemove: () => void
  onRetry: (jobId: string) => void
  big?: boolean
}) {
  const [src, setSrc] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const lid = refData.localId
    const pid = refData.photoId
    if (!lid && !pid) {
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
      setSrc(null); return
    }
    // Sticky : si on a deja un apercu, on le garde (l'objet URL reste valide
    // meme apres suppression du blob local en fin d'upload -> pas de clignotement).
    if (src) return
    let cancelled = false
    ;(async () => {
      if (lid) {
        const u = await getPreview(lid)
        if (cancelled) { if (u) URL.revokeObjectURL(u); return }
        if (u) { urlRef.current = u; setSrc(u); return }
      }
      if (!cancelled && pid && photosById[pid]) setSrc(photosById[pid].thumb_url || photosById[pid].url)
    })()
    return () => { cancelled = true }
  }, [refData.localId, refData.photoId, getPreview, photosById, src])

  // Revocation finale de l'objet URL au demontage (evite la fuite memoire mobile).
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const job = refData.localId ? jobs.find((j) => j.payload.photoLocalId === refData.localId) : undefined
  const status = job?.status
  const hasPhoto = !!src

  return (
    <div>
      {label && <p className={`font-hanken text-[10px] font-extrabold uppercase tracking-wide text-center mb-1 ${label === 'Avant' ? 'text-gray-400' : 'text-emerald-600'}`}>{label}</p>}
      <div className={`relative rounded-xl border border-gray-200 bg-gray-100 overflow-hidden ${big ? 'h-44' : 'h-32'}`}>
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src as string} alt={refData.legende || 'Photo du rapport'} className="w-full h-full object-cover" />
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-sky-dark hover:bg-sky/5 transition">
            <Camera size={26} /><span className="font-hanken text-xs">Ajouter une photo</span>
          </button>
        )}

        {hasPhoto && (
          <button type="button" aria-label="Retirer la photo" onClick={onRemove}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center text-red-600 hover:bg-white shadow"><X size={15} /></button>
        )}

        {status === 'uploading' || status === 'pending' ? (
          <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-navy/80 text-white text-[10px] font-hanken px-2 py-0.5 rounded-full">
            <Loader2 size={11} className="animate-spin" /> Envoi…
          </div>
        ) : status === 'error' ? (
          <button type="button" onClick={() => job && onRetry(job.id)}
            className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-hanken px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} /> Échec — réessayer <RotateCw size={11} />
          </button>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files && e.target.files.length) onPick(e.target.files); e.target.value = '' }} />
    </div>
  )
}
