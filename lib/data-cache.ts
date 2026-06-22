'use client'

// ─────────────────────────────────────────────────────────────────────────────
// data-cache.ts — Cache navigateur pour accélérer la navigation
// ─────────────────────────────────────────────────────────────────────────────
// Deux caches en mémoire (par onglet), pensés SÉCURITÉ d'abord :
//
//   1) Cache utilisateur : évite de rappeler supabase.auth.getUser() (réseau) à
//      chaque hook de chaque page. Un seul appel par minute, dédoublonné.
//
//   2) Cache de données (stale-while-revalidate) pour les listes : en revenant
//      sur une page déjà vue, on affiche instantanément les données mémorisées
//      puis on rafraîchit en arrière-plan.
//
// GARDE-FOUS ANTI-FUITE (appareil patron/employé partagé) :
//   - Jamais de cache tant que l'identité n'est pas confirmée (uid null → bypass).
//   - Chaque entrée stocke son `ownerId` ; on la jette si elle ne correspond pas
//     à l'utilisateur courant.
//   - Purge totale au changement de compte / déconnexion (onAuthStateChange).
//   - Rien ne s'exécute côté serveur (gardes `typeof window`).
//
// ⚠️ Toute écriture en base FAITE HORS des mutations de lib/hooks.tsx (ex. RPC
//    replace_devis_lignes) DOIT appeler clearDataCache() pour éviter des données
//    périmées affichées au retour sur la liste.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/client'

// ── Cache utilisateur ────────────────────────────────────────────────────────
export type CachedUser = { id: string; email: string; user_metadata: Record<string, string>; app_metadata?: Record<string, unknown> } | null

let cachedUser: CachedUser = null
let userTs = 0
let userPromise: Promise<CachedUser> | null = null
const USER_TTL = 60_000 // 1 minute

export function getCachedUserIdSync(): string | null {
  return cachedUser?.id ?? null
}

export async function getCachedUser(): Promise<CachedUser> {
  const now = Date.now()
  if (cachedUser && now - userTs < USER_TTL) return cachedUser
  if (userPromise) return userPromise
  userPromise = (async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const next: CachedUser = user
        ? { id: user.id, email: user.email ?? '', user_metadata: (user.user_metadata ?? {}) as Record<string, string>, app_metadata: (user.app_metadata ?? {}) as Record<string, unknown> }
        : null
      // Changement d'utilisateur (ou déconnexion) → on jette tout le cache données.
      if ((next?.id ?? null) !== (cachedUser?.id ?? null)) clearDataCache()
      cachedUser = next
      userTs = Date.now()
      return cachedUser
    } finally {
      userPromise = null
    }
  })()
  return userPromise
}

export function clearUserCache() {
  cachedUser = null
  userTs = 0
  userPromise = null
}

// ── Cache de données (stale-while-revalidate) ────────────────────────────────
interface Entry { rows: unknown[]; ownerId: string; ts: number }
const dataCache = new Map<string, Entry>()
const ENTRY_TTL = 5 * 60_000 // au-delà de 5 min on ne sert plus le cache (anti-très-périmé)

// Construit la clé de cache. La table est TOUJOURS le 2e segment (cf clearDataCache).
export function makeCacheKey(table: string, options?: unknown): string {
  const uid = getCachedUserIdSync() ?? 'anon'
  return `${uid}|${table}|${JSON.stringify(options ?? {})}`
}

export function readDataCache(key: string): unknown[] | undefined {
  if (typeof window === 'undefined') return undefined
  const uid = getCachedUserIdSync()
  if (!uid) return undefined // jamais de cache sans identité confirmée (anti-fuite)
  const e = dataCache.get(key)
  if (!e) return undefined
  if (e.ownerId !== uid) { dataCache.delete(key); return undefined } // anti cross-compte
  if (Date.now() - e.ts > ENTRY_TTL) { dataCache.delete(key); return undefined }
  return e.rows
}

export function writeDataCache(key: string, rows: unknown[]): void {
  if (typeof window === 'undefined') return
  const uid = getCachedUserIdSync()
  if (!uid) return // ne jamais cacher sous identité inconnue
  dataCache.set(key, { rows, ownerId: uid, ts: Date.now() })
}

// clearDataCache() vide tout ; clearDataCache('devis') ne vide que la table donnée.
export function clearDataCache(table?: string): void {
  if (!table) { dataCache.clear(); return }
  for (const k of Array.from(dataCache.keys())) {
    if (k.split('|')[1] === table) dataCache.delete(k)
  }
}

// ── Écoute des changements d'authentification (purge anti-fuite) ─────────────
let listenerReady = false
export function ensureAuthListener(): void {
  if (listenerReady || typeof window === 'undefined') return
  listenerReady = true
  try {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event, session) => {
      const newId = session?.user?.id ?? null
      if (event === 'SIGNED_OUT' || newId !== (cachedUser?.id ?? null)) {
        clearDataCache()
        clearUserCache()
      }
    })
  } catch {
    // silencieux : l'absence de listener ne doit jamais casser l'app
  }
}
