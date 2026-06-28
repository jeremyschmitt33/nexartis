/**
 * Persistance IndexedDB du moteur d'upload (rapport d'intervention).
 *
 * - Implemente QueueStore<RapportUploadPayload> (object-store "jobs").
 * - Stocke les VRAIES images (Blob) dans un object-store separe "blobs",
 *   pour survivre a un refresh / crash / fermeture AVANT envoi.
 * - Versioning via onupgradeneeded.
 * - Aucune erreur fatale : si IndexedDB est indisponible ou le quota est
 *   atteint, on bascule healthy=false (l'UI previent l'utilisateur) mais
 *   la file en memoire continue de fonctionner pour la session en cours.
 *
 * Isole au rapport : n'impacte aucun autre onglet/feature.
 */

import type { QueueStore, UploadJob } from './upload-queue'

const DB_NAME = 'nexartis-rapport-uploads'
const DB_VERSION = 1
const STORE_JOBS = 'jobs'
const STORE_BLOBS = 'blobs'

/** Donnees (clonables) d'un job d'upload de photo de rapport. Le binaire est a part. */
export interface RapportUploadPayload {
  photoLocalId: string          // UUID stable -> base de la cle R2 (idempotence)
  rapportId: string
  pageId?: string | null
  clientId?: string | null
  chantierId?: string | null
  album?: string | null
  legende?: string | null
  prisLe?: string               // ISO
  largeur?: number | null
  hauteur?: number | null
}

interface BlobRecord { localId: string; blob: Blob; savedAt: number }

function reqP<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
    tx.onerror = () => reject(tx.error)
  })
}

export class RapportUploadStore implements QueueStore<RapportUploadPayload> {
  private dbp: Promise<IDBDatabase | null>
  private mem = new Map<string, Blob>()
  healthy = true
  onUnhealthy?: (reason: string) => void

  constructor() { this.dbp = this.open() }

  private markUnhealthy(reason: string): void {
    if (this.healthy) { this.healthy = false; try { this.onUnhealthy?.(reason) } catch { /* noop */ } }
  }

  private open(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') { this.markUnhealthy('Stockage local indisponible'); return resolve(null) }
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE_JOBS)) db.createObjectStore(STORE_JOBS, { keyPath: 'id' })
          if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS, { keyPath: 'localId' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => { this.markUnhealthy('Ouverture du stockage refusee'); resolve(null) }
        req.onblocked = () => { /* un autre onglet tient une version anterieure : on resoudra a sa fermeture */ }
      } catch { this.markUnhealthy('Stockage local inaccessible'); resolve(null) }
    })
  }

  // ---- QueueStore (jobs) ----
  async load(): Promise<UploadJob<RapportUploadPayload>[]> {
    const db = await this.dbp
    if (!db) return []
    try {
      const tx = db.transaction(STORE_JOBS, 'readonly')
      const all = await reqP(tx.objectStore(STORE_JOBS).getAll() as IDBRequest<UploadJob<RapportUploadPayload>[]>)
      return all ?? []
    } catch { return [] }
  }

  async put(job: UploadJob<RapportUploadPayload>): Promise<void> {
    const db = await this.dbp
    if (!db) { this.markUnhealthy('Stockage local indisponible'); throw new Error('idb indisponible') }
    try {
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      tx.objectStore(STORE_JOBS).put(job)
      await txDone(tx)
    } catch (e) { this.markUnhealthy('Espace de stockage insuffisant'); throw e }
  }

  async remove(id: string): Promise<void> {
    const db = await this.dbp
    if (!db) return
    try {
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      tx.objectStore(STORE_JOBS).delete(id)
      await txDone(tx)
    } catch { /* best effort */ }
  }

  // ---- Binaires (Blob) ----
  async putBlob(localId: string, blob: Blob): Promise<void> {
    this.mem.set(localId, blob)   // RAM : l'envoi de la session marche meme si IndexedDB echoue
    const db = await this.dbp
    if (!db) { this.markUnhealthy('Stockage local indisponible'); return }
    try {
      const tx = db.transaction(STORE_BLOBS, 'readwrite')
      const rec: BlobRecord = { localId, blob, savedAt: Date.now() }
      tx.objectStore(STORE_BLOBS).put(rec)
      await txDone(tx)
    } catch { this.markUnhealthy('Espace de stockage insuffisant') }  // pas fatal : la RAM a la photo
  }

  async getBlob(localId: string): Promise<Blob | null> {
    const inMem = this.mem.get(localId)
    if (inMem) return inMem
    const db = await this.dbp
    if (!db) return null
    try {
      const tx = db.transaction(STORE_BLOBS, 'readonly')
      const rec = await reqP(tx.objectStore(STORE_BLOBS).get(localId) as IDBRequest<BlobRecord | undefined>)
      return rec?.blob ?? null
    } catch { return null }
  }

  async deleteBlob(localId: string): Promise<void> {
    this.mem.delete(localId)
    const db = await this.dbp
    if (!db) return
    try {
      const tx = db.transaction(STORE_BLOBS, 'readwrite')
      tx.objectStore(STORE_BLOBS).delete(localId)
      await txDone(tx)
    } catch { /* best effort */ }
  }
}

/**
 * Demande le stockage PERSISTANT (evite la purge iOS apres 7 jours) et renvoie
 * l'occupation. A appeler une fois au montage de l'editeur de rapport.
 */
export async function requestPersistentStorage(): Promise<{ persisted: boolean; usage?: number; quota?: number }> {
  try {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!s) return { persisted: false }
    const persisted = s.persist ? await s.persist() : false
    let usage: number | undefined
    let quota: number | undefined
    if (s.estimate) { const e = await s.estimate(); usage = e.usage; quota = e.quota }
    return { persisted, usage, quota }
  } catch { return { persisted: false } }
}
