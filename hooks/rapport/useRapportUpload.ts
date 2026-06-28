'use client'
// hooks/rapport/useRapportUpload.ts
// Chef d'orchestre cote ECRAN des photos de rapport : relie la file d'upload
// resiliente, la sauvegarde IndexedDB, l'orchestrateur d'envoi, la detection
// reseau et le traitement (compression) photo par photo (anti-OOM mobile).
// Dedie au rapport, isole : n'impacte aucun autre onglet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UploadQueue, type UploadJob } from '@/lib/rapport/upload-queue'
import { RapportUploadStore, requestPersistentStorage, type RapportUploadPayload } from '@/lib/rapport/upload-store'
import { makeRapportUploadFn } from '@/lib/rapport/upload-photo'
import { processRapportImage } from '@/lib/rapport/process-image'
import { uuidv4 } from '@/lib/rapport/page-content'
import { toast } from '@/lib/toast'

export interface UploadedInfo { photoLocalId: string; pageId: string | null; photoId: string }
export interface UseRapportUploadOptions {
  rapportId: string
  clientId?: string | null
  /** Appele quand une photo est confirmee cote serveur (pour l'attacher a la page). */
  onUploaded?: (info: UploadedInfo) => void
  /** Plafond de photos traitees par appel (anti-saturation mobile). Defaut 30. */
  maxPerBatch?: number
}
export interface AddPhotosOptions { pageId?: string | null; legende?: string | null }
export interface UploadSummary { total: number; done: number; pending: number; uploading: number; error: number }
export interface UseRapportUploadReturn {
  jobs: UploadJob<RapportUploadPayload>[]
  summary: UploadSummary
  /** true pendant la compression d'un lot (avant mise en file). */
  processing: boolean
  /** false si la sauvegarde locale est indisponible/pleine (a signaler a l'artisan). */
  persistenceHealthy: boolean
  storage: { usage?: number; quota?: number } | null
  addPhotos: (files: FileList | File[], opts?: AddPhotosOptions) => string[]
  getPreview: (localId: string) => Promise<string | null>
  getBlobFor: (localId: string) => Promise<Blob | null>
  retry: (id: string) => void
  retryAll: () => void
  removeJob: (id: string) => void
}

function genLocalId(): string { return uuidv4() }

export function useRapportUpload(opts: UseRapportUploadOptions): UseRapportUploadReturn {
  const { rapportId, clientId = null, maxPerBatch = 30 } = opts

  const [allJobs, setAllJobs] = useState<UploadJob<RapportUploadPayload>[]>([])
  const [processing, setProcessing] = useState(false)
  const [persistenceHealthy, setPersistenceHealthy] = useState(true)
  const [storage, setStorage] = useState<{ usage?: number; quota?: number } | null>(null)

  const queueRef = useRef<UploadQueue<RapportUploadPayload> | null>(null)
  const storeRef = useRef<RapportUploadStore | null>(null)
  const processingChainRef = useRef<Promise<void>>(Promise.resolve())
  const reportedRef = useRef<Set<string>>(new Set())
  // Refs "derniere valeur" pour eviter de recreer la file a chaque rendu.
  const onUploadedRef = useRef(opts.onUploaded)
  const rapportIdRef = useRef(rapportId)
  useEffect(() => { onUploadedRef.current = opts.onUploaded }, [opts.onUploaded])
  useEffect(() => { rapportIdRef.current = rapportId }, [rapportId])

  useEffect(() => {
    const store = new RapportUploadStore()
    store.onUnhealthy = () => setPersistenceHealthy(false)
    storeRef.current = store

    const queue = new UploadQueue<RapportUploadPayload>({
      store,
      uploadFn: makeRapportUploadFn(store),
      concurrency: 2,
      onChange: (jobs) => {
        setAllJobs(jobs)
        const cb = onUploadedRef.current
        if (!cb) return
        for (const j of jobs) {
          if (j.status === 'done' && !reportedRef.current.has(j.id)) {
            reportedRef.current.add(j.id)
            const res = j.result as { photoId?: string } | undefined
            if (res?.photoId && j.payload.rapportId === rapportIdRef.current) {
              cb({ photoLocalId: j.payload.photoLocalId, pageId: j.payload.pageId ?? null, photoId: res.photoId })
            }
          }
        }
      },
    })
    queueRef.current = queue
    void queue.hydrate()
    void requestPersistentStorage().then((info) => {
      if (info.usage != null) setStorage({ usage: info.usage, quota: info.quota })
      if (!info.persisted) { /* mode best-effort : non bloquant */ }
    })

    const onOnline = () => queue.resume()
    const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') queue.resume() }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    // Filet anti-iOS : les events reseau sont peu fiables -> reveil periodique.
    const iv = window.setInterval(() => queue.resume(), 20_000)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(iv)
      queue.destroy()
    }
  }, [])

  const jobs = useMemo(() => allJobs.filter((j) => j.payload.rapportId === rapportId), [allJobs, rapportId])
  const summary = useMemo<UploadSummary>(() => {
    const s: UploadSummary = { total: jobs.length, done: 0, pending: 0, uploading: 0, error: 0 }
    for (const j of jobs) s[j.status]++
    return s
  }, [jobs])

  const addPhotos = useCallback((files: FileList | File[], addOpts?: AddPhotosOptions): string[] => {
    const queue = queueRef.current
    const store = storeRef.current
    if (!queue || !store) return []
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, maxPerBatch)
    if (list.length === 0) return []
    // Les ids locaux sont generes TOUT DE SUITE et renvoyes, pour que l'editeur
    // relie chaque photo a sa case (le traitement, lui, se fait en arriere-plan).
    const items = list.map((file) => ({ file, localId: genLocalId() }))

    // Chaine : un SEUL traitement (decode + canvas) a la fois -> evite l'OOM mobile.
    processingChainRef.current = processingChainRef.current.then(async () => {
      setProcessing(true)
      try {
        for (const { file, localId } of items) {
          try {
            const { original, thumb, largeur, hauteur } = await processRapportImage(file)
            await store.putBlob(localId, original)
            await store.putBlob(localId + '_thumb', thumb)
            queue.add([{
              photoLocalId: localId,
              rapportId,
              pageId: addOpts?.pageId ?? null,
              clientId,
              legende: addOpts?.legende ?? null,
              prisLe: new Date(file.lastModified || Date.now()).toISOString(),
              largeur, hauteur,
            }])
          } catch {
            // Photo illisible (format non supporte, ex. HEIC) : on la saute,
            // on n'interrompt PAS le lot, mais on previent l'utilisateur.
            toast.error('Une photo n\u2019a pas pu \u00eatre ajout\u00e9e (format non support\u00e9 ?).')
          }
        }
      } finally { setProcessing(false) }
    })
    return items.map((i) => i.localId)
  }, [rapportId, clientId, maxPerBatch])

  const getPreview = useCallback(async (localId: string): Promise<string | null> => {
    const store = storeRef.current
    if (!store) return null
    const blob = await store.getBlob(localId)
    return blob ? URL.createObjectURL(blob) : null
  }, [])

  const getBlobFor = useCallback(async (localId: string): Promise<Blob | null> => {
    const store = storeRef.current
    if (!store) return null
    return store.getBlob(localId)
  }, [])

  const retry = useCallback((id: string) => queueRef.current?.retry(id), [])
  const retryAll = useCallback(() => queueRef.current?.retryAll(), [])
  const removeJob = useCallback((id: string) => queueRef.current?.remove(id), [])

  return { jobs, summary, processing, persistenceHealthy, storage, addPhotos, getPreview, getBlobFor, retry, retryAll, removeJob }
}
