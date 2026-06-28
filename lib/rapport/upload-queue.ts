/**
 * Moteur de file d'upload RESILIENT (rapport d'intervention).
 * Objectif : ne JAMAIS perdre une photo (mobile / chantier sans reseau).
 * - Concurrence limitee, retry backoff, AUCUN arret global sur erreur.
 * - Timeout par tentative (un envoi "zombie" ne fige plus la file).
 * - Erreurs definitives (quota/401/413) non rejouees.
 * - Persistance pluggable (QueueStore), reprise apres crash, gating online/offline.
 * Coeur sans dependance ni API navigateur (injectables) -> testable sous Node.
 */

export type JobStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface UploadJob<T = unknown> {
  id: string
  payload: T
  status: JobStatus
  attempts: number
  error?: string
  result?: unknown
  nextAttemptAt?: number
}

export interface QueueStore<T = unknown> {
  load(): Promise<UploadJob<T>[]>
  put(job: UploadJob<T>): Promise<void>
  remove(id: string): Promise<void>
}

/** A jeter par uploadFn pour signaler un echec DEFINITIF (pas de retry). */
export class NonRetryableError extends Error {
  constructor(message: string) { super(message); this.name = 'NonRetryableError' }
}

function isNonRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableError) return true
  if (typeof err === 'object' && err !== null && 'retryable' in err) {
    return (err as { retryable?: unknown }).retryable === false
  }
  return false
}

export interface QueueOptions<T = unknown> {
  uploadFn: (job: UploadJob<T>, signal?: AbortSignal) => Promise<unknown>
  concurrency?: number
  maxAttempts?: number
  backoffBaseMs?: number
  backoffMaxMs?: number
  /** Delai max d'UNE tentative. 0 = desactive. Defaut 90s. */
  uploadTimeoutMs?: number
  store?: QueueStore<T>
  isOnline?: () => boolean
  onChange?: (jobs: UploadJob<T>[]) => void
  genId?: () => string
  scheduler?: (cb: () => void, ms: number) => void
}

function defaultIsOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine
  return true
}
function defaultGenId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'job_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export class UploadQueue<T = unknown> {
  private jobs: UploadJob<T>[] = []
  private active = 0
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private removedIds = new Set<string>()
  private destroyed = false
  private hydrated = false

  private readonly uploadFn: (job: UploadJob<T>, signal?: AbortSignal) => Promise<unknown>
  private readonly concurrency: number
  private readonly maxAttempts: number
  private readonly backoffBaseMs: number
  private readonly backoffMaxMs: number
  private readonly uploadTimeoutMs: number
  private readonly store?: QueueStore<T>
  private readonly isOnline: () => boolean
  private readonly onChange?: (jobs: UploadJob<T>[]) => void
  private readonly genId: () => string
  private readonly scheduler: (cb: () => void, ms: number) => void

  constructor(opts: QueueOptions<T>) {
    this.uploadFn = opts.uploadFn
    this.concurrency = Math.max(1, opts.concurrency ?? 2)
    this.maxAttempts = Math.max(1, opts.maxAttempts ?? 5)
    this.backoffBaseMs = Math.max(1, opts.backoffBaseMs ?? 800)
    this.backoffMaxMs = Math.max(this.backoffBaseMs, opts.backoffMaxMs ?? 30000)
    this.uploadTimeoutMs = opts.uploadTimeoutMs ?? 90000
    this.store = opts.store
    this.isOnline = opts.isOnline ?? defaultIsOnline
    this.onChange = opts.onChange
    this.genId = opts.genId ?? defaultGenId
    this.scheduler = opts.scheduler ?? ((cb, ms) => {
      const t = setTimeout(() => { this.timers.delete(t); cb() }, ms)
      this.timers.add(t)
    })
  }

  async hydrate(): Promise<void> {
    if (this.hydrated || !this.store) { this.hydrated = true; return }
    this.hydrated = true
    const saved = await this.store.load()
    const keep: UploadJob<T>[] = []
    for (const j of saved) {
      if (j.status === 'done') { void this.unstore(j.id); continue }   // residu deja uploade
      if (j.status === 'uploading') j.status = 'pending'                // interrompu par crash
      if (j.status === 'pending') j.nextAttemptAt = undefined           // retente tout de suite
      keep.push(j)
    }
    this.jobs = keep
    this.emit()
    this.tick()
  }

  add(payloads: T[]): UploadJob<T>[] {
    const created = payloads.map<UploadJob<T>>((payload) => ({ id: this.genId(), payload, status: 'pending', attempts: 0 }))
    this.jobs.push(...created)
    for (const j of created) void this.persist(j)
    this.emit()
    this.tick()
    return created
  }

  retry(id: string): void {
    const job = this.jobs.find((j) => j.id === id)
    if (!job || job.status === 'uploading' || job.status === 'done') return
    job.status = 'pending'; job.attempts = 0; job.error = undefined; job.nextAttemptAt = undefined
    void this.persist(job); this.emit(); this.tick()
  }

  retryAll(): void {
    let any = false
    for (const job of this.jobs) {
      if (job.status === 'error') {
        job.status = 'pending'; job.attempts = 0; job.error = undefined; job.nextAttemptAt = undefined
        void this.persist(job); any = true
      }
    }
    if (any) { this.emit(); this.tick() }
  }

  remove(id: string): void {
    const i = this.jobs.findIndex((j) => j.id === id)
    if (i === -1) return
    this.removedIds.add(id)        // marque AVANT : neutralise un run() encore en vol
    this.jobs.splice(i, 1)
    void this.unstore(id)
    this.emit()
  }

  resume(): void { this.tick() }

  getJobs(): UploadJob<T>[] { return this.jobs.map((j) => ({ ...j })) }

  summary(): { total: number; done: number; pending: number; uploading: number; error: number } {
    const s = { total: this.jobs.length, done: 0, pending: 0, uploading: 0, error: 0 }
    for (const j of this.jobs) s[j.status]++
    return s
  }

  destroy(): void {
    this.destroyed = true
    this.timers.forEach((t) => clearTimeout(t))
    this.timers.clear()
  }

  private emit(): void { this.onChange?.(this.getJobs()) }
  private async persist(job: UploadJob<T>): Promise<void> { try { await this.store?.put(job) } catch { /* memoire = verite */ } }
  private async unstore(id: string): Promise<void> { try { await this.store?.remove(id) } catch { /* idem */ } }

  private backoffFor(attempts: number): number {
    const exp = Math.min(this.backoffMaxMs, this.backoffBaseMs * Math.pow(2, attempts - 1))
    return Math.round(exp + Math.random() * this.backoffBaseMs)
  }

  private tick(): void {
    if (this.destroyed || !this.isOnline()) return
    const now = Date.now()
    while (this.active < this.concurrency) {
      const job = this.jobs.find((j) => j.status === 'pending' && (!j.nextAttemptAt || j.nextAttemptAt <= now))
      if (!job) break
      void this.run(job)
    }
  }

  /** Enveloppe uploadFn d'un timeout : un envoi zombie devient un rejet (donc un retry). */
  private async callUpload(job: UploadJob<T>): Promise<unknown> {
    if (!this.uploadTimeoutMs || this.uploadTimeoutMs <= 0) return this.uploadFn(job)
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    let to: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, rej) => {
      to = setTimeout(() => { try { ac?.abort() } catch { /* noop */ } rej(new Error("Delai d'envoi depasse")) }, this.uploadTimeoutMs)
      this.timers.add(to)
    })
    try {
      return await Promise.race([this.uploadFn(job, ac?.signal), timeout])
    } finally {
      if (to) { clearTimeout(to); this.timers.delete(to) }
    }
  }

  private async run(job: UploadJob<T>): Promise<void> {
    job.status = 'uploading'; job.attempts++; this.active++
    void this.persist(job); this.emit()
    try {
      const result = await this.callUpload(job)
      if (this.removedIds.has(job.id)) { this.removedIds.delete(job.id); return }  // annule en vol
      job.result = result; job.status = 'done'; job.error = undefined
      void this.unstore(job.id)
    } catch (err) {
      if (this.removedIds.has(job.id)) { this.removedIds.delete(job.id); return }  // annule en vol
      const msg = err instanceof Error ? err.message : String(err)
      const definitive = isNonRetryable(err) || job.attempts >= this.maxAttempts
      if (definitive) {
        job.status = 'error'; job.error = msg; void this.persist(job)
      } else {
        job.status = 'pending'; job.error = msg
        const wait = this.backoffFor(job.attempts)
        job.nextAttemptAt = Date.now() + wait
        void this.persist(job)
        if (!this.destroyed) {
          this.scheduler(() => { if (job.status === 'pending') job.nextAttemptAt = undefined; this.tick() }, wait)
        }
      }
    } finally {
      this.active--; this.emit(); this.tick()
    }
  }
}
