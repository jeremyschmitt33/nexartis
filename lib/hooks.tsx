'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
// Cache navigateur (perf navigation) : dédup de getUser + stale-while-revalidate.
// Sécurité : caches scopés par utilisateur + purge au changement de compte.
import { getCachedUser, makeCacheKey, readDataCache, writeDataCache, clearDataCache, ensureAuthListener } from '@/lib/data-cache'
// Push 2 : rôle du membre courant pour router l'Ouvrier vers les vues masquées
// (chantiers_ouvrier / intervenants_safe). hooks-equipe n'importe PAS hooks.tsx
// → aucun cycle d'import.
import { useCurrentRole } from '@/lib/hooks-equipe'

// ── Generic hook ──────────────────────────────────────────────

type QueryState<T> = {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function useSupabaseQuery<T>(
  table: string,
  // Push 2 : `enabled` permet d'attendre une donnée préalable (ex. le rôle du
  // membre, pour choisir la bonne table). Par défaut true → aucun changement de
  // comportement pour tous les appels existants.
  options?: { orderBy?: string; ascending?: boolean; filters?: Record<string, unknown>; includeDeleted?: boolean; enabled?: boolean }
): QueryState<T> {
  const enabled = options?.enabled ?? true
  // Clé de cache scopée utilisateur (anti-fuite) — recalculée à chaque render.
  const cacheKey = makeCacheKey(table, options)

  // Affichage instantané depuis le cache si dispo (et hook activé), sinon skeleton.
  const [data, setData] = useState<T[]>(() => (enabled ? (readDataCache(cacheKey) as T[] | undefined) : undefined) ?? [])
  const [loading, setLoading] = useState(() => !(enabled && readDataCache(cacheKey)))
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!enabled) return
    // On NE remet PAS loading=true ici : si des données (cache/précédentes) sont
    // affichées, la revalidation se fait en arrière-plan sans skeleton.
    setError(null)
    ensureAuthListener()
    const user = await getCachedUser()
    if (!user) { setError('Non connecté'); setLoading(false); return }
    const supabase = createClient()

    // Push 2 : lecture déléguée à la RLS role-aware (plus de filtre .eq('user_id'))
    // La RLS Supabase (membership + rôle) limite déjà les lignes à l'entreprise
    // du membre courant selon son rôle. Les écritures, elles, gardent leur
    // .eq('user_id') (voir insertRow/updateRow/...).
    let query = supabase.from(table).select('*')

    // Corbeille : par défaut on exclut les éléments supprimés
    // Les tables avec deleted_at : devis, factures, intervenants (D3 - 2026-06-08)
    const SOFT_DELETE_TABLES = ['devis', 'factures', 'intervenants', 'factures_recues', 'documents_types', 'documents_stockes', 'certifications']
    if (SOFT_DELETE_TABLES.includes(table)) {
      if (options?.includeDeleted) {
        // Mode corbeille : uniquement les supprimés
        query = query.not('deleted_at', 'is', null)
      } else {
        // Mode normal : exclure les supprimés
        query = query.is('deleted_at', null)
      }
    }

    if (options?.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false })
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value)
      }
    }

    const { data: rows, error: err } = await query
    if (err) { setError(err.message); setLoading(false); return }
    const result = (rows ?? []) as T[]
    // Clé recalculée ICI (identité désormais confirmée) pour que lecture et
    // écriture partagent la même clé scopée utilisateur.
    writeDataCache(makeCacheKey(table, options), result)
    setData(result)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, enabled])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ── Single record hook ────────────────────────────────────────

type SingleState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

function useSupabaseRecord<T>(table: string, id: string | null): SingleState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      ensureAuthListener()
      const user = await getCachedUser()
      if (!user) { setError('Non connecté'); setLoading(false); return }
      const supabase = createClient()
      // Push 2 : lecture déléguée à la RLS role-aware (plus de filtre .eq('user_id'))
      const { data: row, error: err } = await supabase.from(table).select('*').eq('id', id).single()
      if (err) { setError(err.message); setLoading(false); return }
      setData(row as T)
      setLoading(false)
    }
    fetch()
  }, [table, id])

  return { data, loading, error }
}

// ── Mutations ─────────────────────────────────────────────────

// Tables enfant liées par FK, pas de colonne user_id
const TABLES_WITHOUT_USER_ID = new Set(['devis_lignes', 'facture_lignes', 'paiements'])

async function insertRow(table: string, values: Record<string, unknown>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const row = TABLES_WITHOUT_USER_ID.has(table) ? values : { ...values, user_id: user.id }
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw new Error(error.message)
  clearDataCache()
  return data
}

async function updateRow(table: string, id: string, values: Record<string, unknown>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { data, error } = await supabase.from(table).update(values).eq('id', id).eq('user_id', user.id).select().single()
  if (error) throw new Error(error.message)
  clearDataCache()
  return data
}

async function deleteRow(table: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
  if (error) throw new Error(error.message)
  clearDataCache()
}

// ── Corbeille (soft delete) ──────────────────────────────────

/** Envoyer un élément à la corbeille (soft delete) */
async function softDeleteRow(table: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  clearDataCache()
}

/** Restaurer un élément depuis la corbeille */
async function restoreRow(table: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  clearDataCache()
}

/** Supprimer définitivement (suppression réelle en base) */
async function permanentDeleteRow(table: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
  if (error) throw new Error(error.message)
  clearDataCache()
}

/** Purger les éléments de la corbeille de plus de 7 jours */
async function purgeCorbeille() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // Supprimer les devis expirés
  await supabase.from('devis').delete().eq('user_id', user.id).not('deleted_at', 'is', null).lt('deleted_at', sevenDaysAgo)
  // Supprimer les factures expirées
  await supabase.from('factures').delete().eq('user_id', user.id).not('deleted_at', 'is', null).lt('deleted_at', sevenDaysAgo)
  clearDataCache()
}

// ── Entreprise interface ──────────────────────────────────────

export interface EntrepriseRecord {
  id: string
  user_id: string
  nom?: string
  siret?: string
  tva_intracommunautaire?: string
  code_naf?: string
  forme_juridique?: string
  capital_social?: string
  rcs_rm?: string
  adresse?: string
  code_postal?: string
  ville?: string
  telephone?: string
  email?: string
  iban?: string
  bic?: string
  assurance_nom?: string
  decennale_numero?: string
  assurance_zone?: string
  // Médiateur : ancien champ (1 textarea libre) conservé pour rétrocompatibilité,
  // remplacé depuis le 28/05/2026 par 4 sous-champs nommés.
  mediateur?: string
  mediateur_nom?: string
  mediateur_adresse?: string
  mediateur_code_postal?: string
  mediateur_ville?: string
  // Préférence notification — true par défaut (28/05/2026).
  notify_devis_signe?: boolean
  // TVA — flag franchise (auto-entrepreneur / micro / EI non assujettie).
  franchise_tva?: boolean
  // Taux TVA par défaut sur les nouveaux devis/factures (0 si franchise activée).
  tva_defaut?: number
  // Horaires de travail par défaut (28/05/2026) — utilisés pour les créneaux
  // Matin / Après-midi / Journée entière du planning. Format "HH:MM".
  heure_debut_matin?: string
  heure_fin_matin?: string
  heure_debut_apres_midi?: string
  heure_fin_apres_midi?: string
  metier?: string
  logo_url?: string
  signature_base64?: string
  tampon_base64?: string
  prefix_devis?: string
  prefix_factures?: string
  conditions_paiement?: string
  couleur_principale?: string
  auto_entrepreneur?: boolean
  abonnement_type?: string
  trial_started_at?: string
  rge?: boolean
  created_at?: string
  updated_at?: string
  [key: string]: unknown  // permet d'accéder à des colonnes ajoutées dynamiquement
}

// ── User / Entreprise ─────────────────────────────────────────

function useUser() {
  const [user, setUser] = useState<{ id: string; email: string; user_metadata: Record<string, string>; app_metadata?: Record<string, unknown> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      ensureAuthListener()
      const user = await getCachedUser()
      setUser(user)
      setLoading(false)
    }
    fetch()
  }, [])

  return { user, loading }
}

function useEntreprise() {
  const [entreprise, setEntreprise] = useState<EntrepriseRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      ensureAuthListener()
      const user = await getCachedUser()
      if (!user) { setLoading(false); return }
      const supabase = createClient()
      // Push 2 : lecture déléguée à la RLS role-aware (plus de filtre .eq('user_id')).
      // Un membre (employé) appartient à 1 entreprise via la policy membership de
      // `entreprises` : la RLS ne renvoie donc que SON entreprise. On prend la
      // 1re ligne via limit(1)+maybeSingle() (au lieu de .single() qui jetterait
      // si 0 ligne pour un compte non encore rattaché). Le dirigeant legacy voit
      // toujours son entreprise (policy owner OR membership) — comportement inchangé.
      const { data } = await supabase.from('entreprises').select('*').limit(1).maybeSingle()
      setEntreprise(data as EntrepriseRecord | null)
      setLoading(false)
    }
    fetch()
  }, [])

  const update = async (values: Record<string, unknown>) => {
    if (!entreprise) return
    const supabase = createClient()
    const { data, error } = await supabase.from('entreprises').update(values).eq('id', entreprise.id).select().single()
    if (error) throw new Error(error.message)
    setEntreprise(data as EntrepriseRecord)
    clearDataCache()
    return data
  }

  return { entreprise, loading, update }
}

// ── Onboarding tutoriel ───────────────────────────────────────
//
// Gère l'état du tutoriel onboarding pour l'utilisateur connecté.
// Stocké dans la table `user_onboarding` (créée par
// `lib/supabase/migration-onboarding.sql`).
//
// - tour_dashboard_seen : spotlight sur Paramètres au 1er login
// - tour_devis_seen     : 2 infobulles sur la création de devis
// - tour_completed_at   : date de fin (toutes étapes vues)
//
// Les utilisateurs existants au moment de la migration sont
// marqués comme onboardés pour ne pas leur réafficher le tutoriel.

export interface OnboardingState {
  tour_dashboard_seen: boolean
  tour_parametres_seen: boolean
  tour_devis_seen: boolean
  // V3 (09/06/2026) — 5 nouvelles bulles : install PWA, vocal,
  // theme, mode Solo/Societe (page Equipe), journal chantier.
  // Migration : lib/supabase/migration-onboarding-step3.sql
  tour_install_seen: boolean
  tour_voice_seen: boolean
  tour_theme_seen: boolean
  tour_equipe_mode_seen: boolean
  tour_chantier_journal_seen: boolean
  tour_completed_at: string | null
}

// V3 — toutes les etapes du tour reunies en un seul type pour le
// switch markStepSeen. 'skipAll' marque toutes les etapes restantes
// d'un coup (utilise sur le 1er refus explicite par croix).
type OnboardingStep =
  | 'dashboard'
  | 'parametres'
  | 'devis'
  | 'install'
  | 'voice'
  | 'theme'
  | 'equipeMode'
  | 'chantierJournal'
  | 'skipAll'

const ONBOARDING_COLUMNS =
  'tour_dashboard_seen, tour_parametres_seen, tour_devis_seen, ' +
  'tour_install_seen, tour_voice_seen, tour_theme_seen, ' +
  'tour_equipe_mode_seen, tour_chantier_journal_seen, ' +
  'tour_completed_at'

function emptyOnboardingState(): OnboardingState {
  return {
    tour_dashboard_seen: false,
    tour_parametres_seen: false,
    tour_devis_seen: false,
    tour_install_seen: false,
    tour_voice_seen: false,
    tour_theme_seen: false,
    tour_equipe_mode_seen: false,
    tour_chantier_journal_seen: false,
    tour_completed_at: null,
  }
}

function useOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null)
  const [loading, setLoading] = useState(true)

  // Charge l'état au mount, et crée la ligne si elle n'existe pas
  // (cas d'un nouvel inscrit après la migration).
  useEffect(() => {
    let cancelled = false
    async function fetch() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }

      // Tentative de lecture
      const { data: existing } = await supabase
        .from('user_onboarding')
        .select(ONBOARDING_COLUMNS)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        if (!cancelled) {
          setState(existing as unknown as OnboardingState)
          setLoading(false)
        }
        return
      }

      // Pas de ligne → c'est un nouvel utilisateur, on en crée une vide
      const { data: inserted } = await supabase
        .from('user_onboarding')
        .insert({
          user_id: user.id,
          tour_dashboard_seen: false,
          tour_parametres_seen: false,
          tour_devis_seen: false,
          tour_install_seen: false,
          tour_voice_seen: false,
          tour_theme_seen: false,
          tour_equipe_mode_seen: false,
          tour_chantier_journal_seen: false,
          tour_completed_at: null,
        })
        .select(ONBOARDING_COLUMNS)
        .single()

      if (!cancelled) {
        setState((inserted as unknown as OnboardingState) ?? emptyOnboardingState())
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  // Marque une étape comme vue. Si toutes les étapes sont vues,
  // tour_completed_at est mis à now() automatiquement.
  // 'skipAll' permet de marquer toutes les étapes restantes d'un coup
  // (quand l'utilisateur ferme la 1ère bulle par la croix, il skippe tout).
  const markStepSeen = useCallback(async (step: OnboardingStep) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const patch: Record<string, unknown> = {}
    const isAll = step === 'skipAll'
    if (isAll || step === 'dashboard') patch.tour_dashboard_seen = true
    if (isAll || step === 'parametres') patch.tour_parametres_seen = true
    if (isAll || step === 'devis') patch.tour_devis_seen = true
    if (isAll || step === 'install') patch.tour_install_seen = true
    if (isAll || step === 'voice') patch.tour_voice_seen = true
    if (isAll || step === 'theme') patch.tour_theme_seen = true
    if (isAll || step === 'equipeMode') patch.tour_equipe_mode_seen = true
    if (isAll || step === 'chantierJournal') patch.tour_chantier_journal_seen = true

    // On calcule localement si toutes les étapes sont vues pour
    // poser tour_completed_at en un seul UPDATE.
    const prev = state ?? emptyOnboardingState()
    const nextState: OnboardingState = {
      tour_dashboard_seen: (isAll || step === 'dashboard') ? true : prev.tour_dashboard_seen,
      tour_parametres_seen: (isAll || step === 'parametres') ? true : prev.tour_parametres_seen,
      tour_devis_seen: (isAll || step === 'devis') ? true : prev.tour_devis_seen,
      tour_install_seen: (isAll || step === 'install') ? true : prev.tour_install_seen,
      tour_voice_seen: (isAll || step === 'voice') ? true : prev.tour_voice_seen,
      tour_theme_seen: (isAll || step === 'theme') ? true : prev.tour_theme_seen,
      tour_equipe_mode_seen: (isAll || step === 'equipeMode') ? true : prev.tour_equipe_mode_seen,
      tour_chantier_journal_seen: (isAll || step === 'chantierJournal') ? true : prev.tour_chantier_journal_seen,
      tour_completed_at: prev.tour_completed_at,
    }
    const allSeen =
      nextState.tour_dashboard_seen &&
      nextState.tour_parametres_seen &&
      nextState.tour_devis_seen &&
      nextState.tour_install_seen &&
      nextState.tour_voice_seen &&
      nextState.tour_theme_seen &&
      nextState.tour_equipe_mode_seen &&
      nextState.tour_chantier_journal_seen
    if (allSeen && !nextState.tour_completed_at) {
      const nowIso = new Date().toISOString()
      patch.tour_completed_at = nowIso
      nextState.tour_completed_at = nowIso
    }

    await supabase.from('user_onboarding').update(patch).eq('user_id', user.id)
    setState(nextState)
  }, [state])

  // Réinitialise complètement le tutoriel (bouton "Revoir la
  // visite guidée" dans Paramètres).
  const resetOnboarding = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('user_onboarding')
      .update({
        tour_dashboard_seen: false,
        tour_parametres_seen: false,
        tour_devis_seen: false,
        tour_install_seen: false,
        tour_voice_seen: false,
        tour_theme_seen: false,
        tour_equipe_mode_seen: false,
        tour_chantier_journal_seen: false,
        tour_completed_at: null,
      })
      .eq('user_id', user.id)

    setState(emptyOnboardingState())
  }, [])

  // Réinitialise une seule étape (utilisé depuis la page Aide pour
  // permettre de rejouer juste une partie du tutoriel sans tout
  // recommencer). 'dashboard' inclut aussi la bulle 2 (parametres)
  // car c'est le même flux. V3 : on conserve la signature
  // 'dashboard' | 'devis' pour ne pas casser la page Aide. Quand
  // on replay 'dashboard' on remet aussi a false les nouvelles
  // bulles install + voice qui se declenchent sur le meme path.
  const replayStep = useCallback(async (step: 'dashboard' | 'devis') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const patch: Record<string, unknown> = { tour_completed_at: null }
    if (step === 'dashboard') {
      patch.tour_dashboard_seen = false
      patch.tour_parametres_seen = false
      patch.tour_install_seen = false
      patch.tour_voice_seen = false
      patch.tour_theme_seen = false
    }
    if (step === 'devis') patch.tour_devis_seen = false

    await supabase.from('user_onboarding').update(patch).eq('user_id', user.id)

    setState((prev) => {
      const base = prev ?? emptyOnboardingState()
      return {
        ...base,
        tour_dashboard_seen: step === 'dashboard' ? false : base.tour_dashboard_seen,
        tour_parametres_seen: step === 'dashboard' ? false : base.tour_parametres_seen,
        tour_install_seen: step === 'dashboard' ? false : base.tour_install_seen,
        tour_voice_seen: step === 'dashboard' ? false : base.tour_voice_seen,
        tour_theme_seen: step === 'dashboard' ? false : base.tour_theme_seen,
        tour_devis_seen: step === 'devis' ? false : base.tour_devis_seen,
        tour_completed_at: null,
      }
    })
  }, [])

  return { state, loading, markStepSeen, resetOnboarding, replayStep }
}

// ── Specific table hooks ──────────────────────────────────────

type Row = Record<string, unknown>

function useClients() { return useSupabaseQuery<Row>('clients', { orderBy: 'created_at' }) }
function useFournisseurs() { return useSupabaseQuery<Row>('fournisseurs', { orderBy: 'created_at' }) }
function usePrestations() { return useSupabaseQuery<Row>('prestations', { orderBy: 'created_at' }) }

// ── Routage Ouvrier vers les vues masquées (Push 2) ──────────
//
// Un Ouvrier n'a PAS accès aux tables de base `chantiers` / `intervenants`
// (elles portent des montants / le taux horaire). La RLS le bloque dessus.
// Il lit à la place des vues sans colonnes sensibles, scopées par la RLS :
//   - chantiers_ouvrier  : chantiers où il est affecté, sans montants.
//   - intervenants_safe  : collègues sans taux_horaire / contact.
//
// On attend que le rôle soit CONNU avant de requêter (enabled: !roleLoading),
// pour ne jamais taper la mauvaise table pendant le chargement du rôle.
//
// Note soft delete : `intervenants` est dans SOFT_DELETE_TABLES, mais la vue
// `intervenants_safe` n'expose PAS deleted_at — useSupabaseQuery ne déclenche
// le filtre que sur les noms de la liste, donc la vue n'est jamais filtrée
// sur deleted_at (correct). `chantiers` n'a de toute façon pas de soft delete.
function useIntervenants() {
  const { role, loading: roleLoading } = useCurrentRole()
  const isOuvrier = role === 'ouvrier'
  const table = isOuvrier ? 'intervenants_safe' : 'intervenants'
  // La vue safe ne garantit pas la colonne created_at → on trie par 'nom'.
  const orderBy = isOuvrier ? 'nom' : 'created_at'
  return useSupabaseQuery<Row>(table, { orderBy, ascending: isOuvrier ? true : false, enabled: !roleLoading })
}
function useChantiers() {
  const { role, loading: roleLoading } = useCurrentRole()
  const isOuvrier = role === 'ouvrier'
  const table = isOuvrier ? 'chantiers_ouvrier' : 'chantiers'
  return useSupabaseQuery<Row>(table, { orderBy: 'created_at', enabled: !roleLoading })
}
function useDevis() { return useSupabaseQuery<Row>('devis', { orderBy: 'created_at' }) }
function useFactures() { return useSupabaseQuery<Row>('factures', { orderBy: 'created_at' }) }
function useDeletedDevis() { return useSupabaseQuery<Row>('devis', { orderBy: 'created_at', includeDeleted: true }) }
function useDeletedFactures() { return useSupabaseQuery<Row>('factures', { orderBy: 'created_at', includeDeleted: true }) }
function useAchats() { return useSupabaseQuery<Row>('achats', { orderBy: 'date_achat' }) }
// Documents types (CGV, PV de reception). Soft delete via deleted_at.
function useDocumentsTypes() { return useSupabaseQuery<Row>('documents_types', { orderBy: 'created_at' }) }
function useDeletedDocumentsTypes() { return useSupabaseQuery<Row>('documents_types', { orderBy: 'created_at', includeDeleted: true }) }
// Coffre-fort (Vague 2b) — fichiers televerses par l'artisan (RIB, decennale, Kbis...).
function useDocumentsStockes() { return useSupabaseQuery<Row>('documents_stockes', { orderBy: 'created_at' }) }
function useDeletedDocumentsStockes() { return useSupabaseQuery<Row>('documents_stockes', { orderBy: 'created_at', includeDeleted: true }) }
// Certifications & assurances (Vague 3a) — RGE, Qualibat, decennale, RC pro... Soft delete via deleted_at.
function useCertifications() { return useSupabaseQuery<Row>('certifications', { orderBy: 'created_at' }) }
function useDeletedCertifications() { return useSupabaseQuery<Row>('certifications', { orderBy: 'created_at', includeDeleted: true }) }
// Factures RECUES (reception e-facture). Tri par date d'emission decroissante.
function useFacturesRecues() { return useSupabaseQuery<Row>('factures_recues', { orderBy: 'date_emission' }) }
function usePaiements() { return useSupabaseQuery<Row>('paiements', { orderBy: 'date_paiement' }) }
function usePlanning() { return useSupabaseQuery<Row>('planning_interventions', { orderBy: 'date_debut', ascending: true }) }
// Session 8 (28/05/2026) — table jonction multi-intervenants par intervention.
// Schéma : { id, user_id, intervention_id, intervenant_id, role: 'referent' | 'equipier' }.
// Retourne la liste complète (filtrée user_id côté RLS + côté hook).
// Utilisée pour :
//  - Construire la `planningMap` (rendu grille : 1 intervention liée à N
//    intervenants apparaît dans N cellules).
//  - Détecter les conflits horaires sur l'ensemble des liaisons.
//  - Hydrater le multi-sélecteur du modal édition.
function useInterventionIntervenants() { return useSupabaseQuery<Row>('intervention_intervenants', { orderBy: 'created_at', ascending: true }) }
function useRelances() { return useSupabaseQuery<Row>('relances', { orderBy: 'created_at' }) }
function usePointsCollecte() { return useSupabaseQuery<Row>('points_collecte', { orderBy: 'created_at' }) }
function useMateriel() { return useSupabaseQuery<Row>('materiel', { orderBy: 'created_at' }) }
function useChantierNotes(chantierId?: string) {
  return useSupabaseQuery<Row>('chantier_notes', {
    orderBy: 'created_at',
    ascending: false,
    ...(chantierId ? { filters: { chantier_id: chantierId } } : {})
  })
}
function useSousTraitantPaiements(chantierId?: string) {
  return useSupabaseQuery<Row>('sous_traitant_paiements', {
    orderBy: 'created_at',
    ...(chantierId ? { filters: { chantier_id: chantierId } } : {})
  })
}

// ── Devis lignes (no user_id, linked via devis_id) ───────────

function useDevisLignes(devisId: string | null) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!devisId) { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      const supabase = createClient()
      const { data: rows } = await supabase.from('devis_lignes').select('*').eq('devis_id', devisId).order('ordre')
      setData(rows ?? [])
      setLoading(false)
    }
    fetch()
  }, [devisId])

  return { data, loading }
}

function useFactureLignes(factureId: string | null) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!factureId) { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      const supabase = createClient()
      const { data: rows } = await supabase.from('facture_lignes').select('*').eq('facture_id', factureId).order('ordre')
      setData(rows ?? [])
      setLoading(false)
    }
    fetch()
  }, [factureId])

  return { data, loading }
}

// ── Loading component ─────────────────────────────────────────

function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-lg" />
      ))}
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <p className="text-sm text-red-600 font-manrope">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-red-600 font-medium hover:underline">
          Réessayer
        </button>
      )}
    </div>
  )
}

export {
  useSupabaseQuery,
  useSupabaseRecord,
  insertRow,
  updateRow,
  deleteRow,
  softDeleteRow,
  restoreRow,
  permanentDeleteRow,
  purgeCorbeille,
  useUser,
  useEntreprise,
  useOnboarding,
  useClients,
  useFournisseurs,
  useIntervenants,
  usePrestations,
  useChantiers,
  useDevis,
  useFactures,
  useDeletedDevis,
  useDeletedFactures,
  useAchats,
  useDocumentsTypes,
  useDeletedDocumentsTypes,
  useDocumentsStockes,
  useDeletedDocumentsStockes,
  useCertifications,
  useDeletedCertifications,
  useFacturesRecues,
  usePaiements,
  usePlanning,
  useInterventionIntervenants,
  useChantierNotes,
  useSousTraitantPaiements,
  useRelances,
  useDevisLignes,
  useFactureLignes,
  usePointsCollecte,
  useMateriel,
  LoadingSkeleton,
  ErrorBanner,
}
