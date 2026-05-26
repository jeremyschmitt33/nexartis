'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'

// ── Generic hook ──────────────────────────────────────────────

type QueryState<T> = {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function useSupabaseQuery<T>(
  table: string,
  options?: { orderBy?: string; ascending?: boolean; filters?: Record<string, unknown>; includeDeleted?: boolean }
): QueryState<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non connecté'); setLoading(false); return }

    let query = supabase.from(table).select('*').eq('user_id', user.id)

    // Corbeille : par défaut on exclut les éléments supprimés
    // Les tables avec deleted_at : devis, factures
    const SOFT_DELETE_TABLES = ['devis', 'factures']
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
    setData((rows ?? []) as T[])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Non connecté'); setLoading(false); return }
      // Double sécurité : filtre user_id côté client + RLS côté Supabase
      const { data: row, error: err } = await supabase.from(table).select('*').eq('id', id).eq('user_id', user.id).single()
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
  return data
}

async function updateRow(table: string, id: string, values: Record<string, unknown>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { data, error } = await supabase.from(table).update(values).eq('id', id).eq('user_id', user.id).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function deleteRow(table: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
  if (error) throw new Error(error.message)
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
}

/** Supprimer définitivement (suppression réelle en base) */
async function permanentDeleteRow(table: string, id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
  if (error) throw new Error(error.message)
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
  mediateur?: string
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
  const [user, setUser] = useState<{ id: string; email: string; user_metadata: Record<string, string> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user ? { id: user.id, email: user.email ?? '', user_metadata: (user.user_metadata ?? {}) as Record<string, string> } : null)
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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('entreprises').select('*').eq('user_id', user.id).single()
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
  tour_devis_seen: boolean
  tour_completed_at: string | null
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
        .select('tour_dashboard_seen, tour_devis_seen, tour_completed_at')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        if (!cancelled) {
          setState(existing as OnboardingState)
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
          tour_devis_seen: false,
          tour_completed_at: null,
        })
        .select('tour_dashboard_seen, tour_devis_seen, tour_completed_at')
        .single()

      if (!cancelled) {
        setState((inserted as OnboardingState) ?? {
          tour_dashboard_seen: false,
          tour_devis_seen: false,
          tour_completed_at: null,
        })
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  // Marque une étape comme vue. Si toutes les étapes sont vues,
  // tour_completed_at est mis à now() automatiquement.
  const markStepSeen = useCallback(async (step: 'dashboard' | 'devis') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const patch: Record<string, unknown> = {}
    if (step === 'dashboard') patch.tour_dashboard_seen = true
    if (step === 'devis') patch.tour_devis_seen = true

    // On calcule localement si toutes les étapes sont vues pour
    // poser tour_completed_at en un seul UPDATE.
    const nextState: OnboardingState = {
      tour_dashboard_seen: step === 'dashboard' ? true : (state?.tour_dashboard_seen ?? false),
      tour_devis_seen: step === 'devis' ? true : (state?.tour_devis_seen ?? false),
      tour_completed_at: state?.tour_completed_at ?? null,
    }
    if (nextState.tour_dashboard_seen && nextState.tour_devis_seen && !nextState.tour_completed_at) {
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
        tour_devis_seen: false,
        tour_completed_at: null,
      })
      .eq('user_id', user.id)

    setState({
      tour_dashboard_seen: false,
      tour_devis_seen: false,
      tour_completed_at: null,
    })
  }, [])

  // Réinitialise une seule étape (utilisé depuis la page Aide pour
  // permettre de rejouer juste une partie du tutoriel sans tout
  // recommencer).
  const replayStep = useCallback(async (step: 'dashboard' | 'devis') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const patch: Record<string, unknown> = { tour_completed_at: null }
    if (step === 'dashboard') patch.tour_dashboard_seen = false
    if (step === 'devis') patch.tour_devis_seen = false

    await supabase.from('user_onboarding').update(patch).eq('user_id', user.id)

    setState((prev) => ({
      tour_dashboard_seen: step === 'dashboard' ? false : (prev?.tour_dashboard_seen ?? false),
      tour_devis_seen: step === 'devis' ? false : (prev?.tour_devis_seen ?? false),
      tour_completed_at: null,
    }))
  }, [])

  return { state, loading, markStepSeen, resetOnboarding, replayStep }
}

// ── Specific table hooks ──────────────────────────────────────

type Row = Record<string, unknown>

function useClients() { return useSupabaseQuery<Row>('clients', { orderBy: 'created_at' }) }
function useFournisseurs() { return useSupabaseQuery<Row>('fournisseurs', { orderBy: 'created_at' }) }
function useIntervenants() { return useSupabaseQuery<Row>('intervenants', { orderBy: 'created_at' }) }
function usePrestations() { return useSupabaseQuery<Row>('prestations', { orderBy: 'created_at' }) }
function useChantiers() { return useSupabaseQuery<Row>('chantiers', { orderBy: 'created_at' }) }
function useDevis() { return useSupabaseQuery<Row>('devis', { orderBy: 'created_at' }) }
function useFactures() { return useSupabaseQuery<Row>('factures', { orderBy: 'created_at' }) }
function useDeletedDevis() { return useSupabaseQuery<Row>('devis', { orderBy: 'created_at', includeDeleted: true }) }
function useDeletedFactures() { return useSupabaseQuery<Row>('factures', { orderBy: 'created_at', includeDeleted: true }) }
function useAchats() { return useSupabaseQuery<Row>('achats', { orderBy: 'date_achat' }) }
function usePaiements() { return useSupabaseQuery<Row>('paiements', { orderBy: 'date_paiement' }) }
function usePlanning() { return useSupabaseQuery<Row>('planning_interventions', { orderBy: 'date_debut', ascending: true }) }
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
  usePaiements,
  usePlanning,
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
