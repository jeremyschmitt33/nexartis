'use client'

import { ArrowUp, ArrowDown, Trash2, Plus, ImagePlus } from 'lucide-react'
import PhotoSlot, { type PhotoMap } from './PhotoSlot'
import MicDictee from './MicDictee'

/** Ajoute un texte dicté à une valeur existante (espace si déjà du contenu). */
function appendDictee(current: string | undefined, dicte: string): string {
  const c = (current ?? '').trim()
  return c ? `${c} ${dicte}` : dicte
}
import type { UploadJob } from '@/lib/rapport/upload-queue'
import type { RapportUploadPayload } from '@/lib/rapport/upload-store'
import {
  type RapportPageData, type PageContent, type PhotoRef,
  type PhotosContent, type TexteContent, type ConstatContent, type FinContent,
  PAGE_TYPE_LABELS,
} from '@/lib/rapport/page-content'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 font-hanken text-sm text-navy bg-gray-50 focus:bg-white focus:border-sky outline-none'
const labelCls = 'block font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-3 mb-1'

function StringList({ items, placeholder, onChange }: { items: string[]; placeholder: string; onChange: (items: string[]) => void }) {
  const safe = items
  return (
    <div className="space-y-1.5">
      {safe.map((val, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-orange font-bold">•</span>
          <input className={inputCls} value={val} placeholder={placeholder}
            onChange={(e) => { const n = [...safe]; n[i] = e.target.value; onChange(n) }} />
          <MicDictee onText={(t) => { const n = [...safe]; n[i] = appendDictee(safe[i], t); onChange(n) }} />
          {safe.length >= 1 && (
            <button type="button" aria-label="Retirer" onClick={() => onChange(safe.filter((_, j) => j !== i))}
              className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={15} /></button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...safe, ''])}
        className="inline-flex items-center gap-1.5 font-hanken text-sm font-semibold text-sky-dark hover:underline mt-1.5"><Plus size={15} /> Ajouter</button>
    </div>
  )
}

export default function PageCard({ page, index, total, onMoveUp, onMoveDown, onDelete, onChange, jobs, getPreview, photosById, pickPhoto, onRetry }: {
  page: RapportPageData
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChange: (contenu: PageContent) => void
  jobs: UploadJob<RapportUploadPayload>[]
  getPreview: (localId: string) => Promise<string | null>
  photosById: PhotoMap
  pickPhoto: (files: FileList) => string[]
  onRetry: (jobId: string) => void
}) {
  const slotProps = { jobs, getPreview, photosById, onRetry }

  function renderBody() {
    switch (page.type) {
      case 'photos': {
        const c = page.contenu as PhotosContent
        const photos: PhotoRef[] = c.photos?.length ? c.photos : [{}]
        const setPhotos = (next: PhotoRef[]) => onChange({ titre: c.titre ?? '', photos: next.length ? next : [{}] })
        const setRef = (i: number, r: PhotoRef) => { const n = [...photos]; n[i] = r; setPhotos(n) }
        return (<>
          <label className={labelCls}>Titre (optionnel)</label>
          <input className={inputCls} value={c.titre ?? ''} placeholder="Ex : Travaux réalisés" onChange={(e) => onChange({ titre: e.target.value, photos })} />
          <div className="space-y-3 mt-3">
            {photos.map((ref, i) => (
              <div key={i}>
                <PhotoSlot {...slotProps} refData={ref} big
                  onPick={(files) => { const [lid] = pickPhoto(files); if (lid) setRef(i, { ...ref, localId: lid, photoId: null }) }}
                  onRemove={() => setPhotos(photos.filter((_, j) => j !== i))}
                  onRotate={() => setRef(i, { ...ref, rotation: ((ref.rotation || 0) + 90) % 360 })} />
                <textarea className={`${inputCls} mt-1.5`} rows={2} value={ref.legende ?? ''} placeholder="Texte de la photo (Entrée = nouvelle ligne)"
                  onChange={(e) => setRef(i, { ...ref, legende: e.target.value })} />
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <MicDictee onText={(t) => setRef(i, { ...ref, legende: appendDictee(ref.legende, t) })} />
                  <button type="button" onClick={() => setRef(i, { ...ref, layout: ref.layout === 'side' ? 'below' : 'side' })}
                    className="inline-flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1 font-hanken text-xs font-semibold text-navy hover:border-sky hover:bg-sky/5">
                    Disposition : {ref.layout === 'side' ? 'texte à côté' : 'texte dessous'} · cliquer pour changer
                  </button>
                  <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="inline-flex items-center gap-1 border border-gray-200 rounded-lg px-2.5 py-1 font-hanken text-xs font-semibold text-gray-500 hover:border-red-300 hover:text-red-600">
                    <Trash2 size={13} /> Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPhotos([...photos, {}])}
            className="inline-flex items-center gap-1.5 font-hanken text-sm font-semibold text-sky-dark hover:underline mt-3"><ImagePlus size={16} /> Ajouter une photo</button>
        </>)
      }
      case 'texte': {
        const c = page.contenu as TexteContent
        return (<>
          <label className={labelCls}>Titre (optionnel)</label>
          <input className={inputCls} value={c.titre ?? ''} placeholder="Ex : Tableau électrique" onChange={(e) => onChange({ ...c, titre: e.target.value })} />
          <div className="flex items-center justify-between mt-3 mb-1">
            <label className="font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500">Texte</label>
            <MicDictee onText={(t) => onChange({ ...c, texte: appendDictee(c.texte, t) })} />
          </div>
          <textarea className={inputCls} rows={4} value={c.texte ?? ''} placeholder="Écrivez ce que vous voulez…" onChange={(e) => onChange({ ...c, texte: e.target.value })} />
        </>)
      }
      case 'constat': {
        const c = page.contenu as ConstatContent
        return (<><label className={labelCls}>Désordres constatés</label>
          <StringList items={c.items ?? ['']} placeholder="Ex : tableau électrique vétuste" onChange={(items) => onChange({ items })} /></>)
      }
      case 'fin': {
        const c = page.contenu as FinContent
        const titleCls = 'block w-full font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-3 mb-1 bg-transparent outline-none border-b border-dashed border-gray-200 focus:border-sky'
        return (<>
          <input className={titleCls} value={c.titreControles ?? 'Contrôles finaux'} onChange={(e) => onChange({ ...c, titreControles: e.target.value })} />
          <StringList items={c.controles ?? []} placeholder="Ex : continuité de terre vérifiée" onChange={(controles) => onChange({ ...c, controles })} />
          <input className={titleCls} value={c.titreObservations ?? 'Observations'} onChange={(e) => onChange({ ...c, titreObservations: e.target.value })} />
          <StringList items={c.observations ?? []} placeholder="Observation…" onChange={(observations) => onChange({ ...c, observations })} />
          <div className="flex items-center justify-between mt-3 mb-1">
            <input className="flex-1 font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-500 bg-transparent outline-none border-b border-dashed border-gray-200 focus:border-sky" value={c.titreConclusion ?? 'Conclusion'} onChange={(e) => onChange({ ...c, titreConclusion: e.target.value })} />
            <MicDictee className="ml-2" onText={(t) => onChange({ ...c, conclusion: appendDictee(c.conclusion, t) })} />
          </div>
          <textarea className={inputCls} rows={3} value={c.conclusion ?? ''} placeholder="Mot de conclusion…" onChange={(e) => onChange({ ...c, conclusion: e.target.value })} />
        </>)
      }
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,26,58,0.04)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-navy-mid text-white text-[10px] font-extrabold">{index + 1}</span>
        <span className="font-hanken font-bold text-[13px] text-navy">{PAGE_TYPE_LABELS[page.type]}</span>
        <span className="ml-auto flex gap-1">
          <button type="button" aria-label="Monter" disabled={index === 0} onClick={onMoveUp}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-navy-mid hover:border-sky disabled:opacity-30"><ArrowUp size={15} /></button>
          <button type="button" aria-label="Descendre" disabled={index === total - 1} onClick={onMoveDown}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-navy-mid hover:border-sky disabled:opacity-30"><ArrowDown size={15} /></button>
          <button type="button" aria-label="Supprimer la page" onClick={onDelete}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-red-500 hover:border-red-300"><Trash2 size={15} /></button>
        </span>
      </div>
      {renderBody()}
    </div>
  )
}
