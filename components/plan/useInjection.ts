'use client'

/**
 * useInjection — Accès données du tiroir « Envoyer au devis » (Push 3b).
 *
 * ⚠️ OBJET VITAL : le devis. Règles absolues (spec V2 §3 + §7) :
 * - APPEND-ONLY STRICT : on n'INSÈRE que des lignes nouvelles via le pattern
 *   existant insertRow('devis_lignes', …). JAMAIS d'UPDATE ni de DELETE sur
 *   des lignes existantes, jamais d'écriture sur la table devis elle-même.
 * - Les lignes partent à prix 0 (montant_ht généré = 0) : les totaux du devis
 *   ne bougent pas d'un centime tant que l'artisan n'a pas chiffré lui-même.
 * - Le devis cible est re-vérifié JUSTE AVANT l'insertion (statut modifiable,
 *   non supprimé) : il a pu être signé/supprimé pendant que le tiroir était
 *   ouvert.
 * - Traçabilité : snapshot plan_revisions (reason 'devis_envoye') inséré
 *   avant les lignes, son id embarqué dans source_plan.revisionId.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { insertRow } from '@/lib/hooks'
import { isAutoEntrepreneur } from '@/lib/helpers'
import type { PlanData, SourcePlan } from '@/lib/plan/types'
import { cleDoublon, type LigneProposee } from '@/lib/plan/injection'
import { genererImagePlanNiveau } from '@/lib/plan/export'
import type { ImagePlanExport } from '@/lib/plan/plan-images'

/** Statuts de devis dans lesquels l'injection est autorisée (devis modifiable). */
export const STATUTS_MODIFIABLES = ['brouillon', 'envoye'] as const

export const LIBELLE_STATUT: Record<string, string> = {
  brouillon: 'brouillon',
  envoye: 'envoyé',
}

export interface DevisCible {
  id: string
  numero: string
  statut: string
}

/** Devis modifiables du chantier (sélecteur du tiroir). */
export function useDevisModifiables(chantierId: string | null, actif: boolean) {
  const [devis, setDevis] = useState<DevisCible[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    if (!actif) return
    if (!chantierId) {
      setDevis([])
      setChargement(false)
      return
    }
    let annule = false
    setChargement(true)
    const charger = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('devis')
          .select('id, numero, statut')
          .eq('chantier_id', chantierId)
          .is('deleted_at', null)
          .in('statut', [...STATUTS_MODIFIABLES])
          .order('created_at', { ascending: false })
        if (annule) return
        if (error) throw new Error(error.message)
        setDevis(
          (data ?? []).map((d) => ({
            id: String(d.id),
            numero: String(d.numero ?? ''),
            statut: String(d.statut ?? 'brouillon'),
          }))
        )
      } catch (_e) {
        if (!annule) setDevis([])
        console.error('[plan] chargement des devis du chantier échoué')
      } finally {
        if (!annule) setChargement(false)
      }
    }
    void charger()
    return () => {
      annule = true
    }
  }, [chantierId, actif])

  return { devis, chargement }
}

/**
 * Lignes du devis cible déjà issues de CE plan (anti-doublon).
 * Retourne un Set de clés `roomId|metric`. `version` force le rechargement
 * après une injection réussie.
 */
export function useDoublons(devisId: string | null, planId: string, actif: boolean, version: number) {
  const [doublons, setDoublons] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!actif || !devisId) {
      setDoublons(new Set())
      return
    }
    let annule = false
    const charger = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('devis_lignes')
          .select('source_plan')
          .eq('devis_id', devisId)
          .not('source_plan', 'is', null)
        if (annule) return
        if (error) throw new Error(error.message)
        const cles = new Set<string>()
        for (const row of data ?? []) {
          const sp = row.source_plan as Partial<SourcePlan> | null
          if (!sp || sp.planId !== planId || typeof sp.metric !== 'string') continue
          cles.add(cleDoublon(sp.roomId ?? null, sp.metric))
        }
        setDoublons(cles)
      } catch (_e) {
        if (!annule) setDoublons(new Set())
        console.error('[plan] détection des doublons échouée')
      }
    }
    void charger()
    return () => {
      annule = true
    }
  }, [devisId, planId, actif, version])

  return doublons
}

export interface ResultatInjection {
  inseres: number
  numero: string
}

/**
 * Injection append-only des lignes cochées dans le devis cible.
 * Lève une Error à message affichable en cas de refus ou d'échec
 * (y compris partiel : « X ligne(s) créée(s) sur N — … »).
 */
export async function injecterLignes(
  planId: string,
  devisId: string,
  lignes: LigneProposee[],
  planData: PlanData,
  /** Push 5 — niveau d'origine des métrés (sélection de l'image de plan). */
  niveauId: string | null = null
): Promise<ResultatInjection> {
  if (lignes.length === 0) throw new Error('Aucun métré sélectionné.')
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error('Non connecté — reconnectez-vous.')

  // 1) Re-vérification du devis cible : il a pu être signé, refusé ou
  //    supprimé pendant que le tiroir était ouvert. On refuse net.
  const { data: devisRow, error: errDevis } = await supabase
    .from('devis')
    .select('id, numero, statut, deleted_at')
    .eq('id', devisId)
    .maybeSingle()
  if (errDevis || !devisRow) throw new Error('Devis introuvable — actualisez la page.')
  if (devisRow.deleted_at) throw new Error('Ce devis a été supprimé entre-temps.')
  if (!STATUTS_MODIFIABLES.includes(devisRow.statut as (typeof STATUTS_MODIFIABLES)[number])) {
    throw new Error(`Ce devis n'est plus modifiable (statut « ${String(devisRow.statut)} »).`)
  }

  // 2) Taux de TVA par défaut du profil (0 si franchise / auto-entrepreneur).
  const { data: ent } = await supabase
    .from('entreprises')
    .select('franchise_tva, forme_juridique, tva_defaut')
    .limit(1)
    .maybeSingle()
  const tvaBrute = Number(ent?.tva_defaut)
  const tauxTva = isAutoEntrepreneur(ent) ? 0 : Number.isFinite(tvaBrute) ? tvaBrute : 10

  // 3) Ordre : à la suite des lignes existantes (append-only, jamais entre).
  const { data: derniere } = await supabase
    .from('devis_lignes')
    .select('ordre')
    .eq('devis_id', devisId)
    .order('ordre', { ascending: false })
    .limit(1)
  const ordreBase = Number(derniere?.[0]?.ordre ?? 0)

  // 4) Snapshot de traçabilité AVANT les lignes : son id part dans
  //    source_plan.revisionId. Best effort : un échec du snapshot ne bloque
  //    pas l'injection (revisionId null), il est seulement journalisé.
  let revisionId: string | null = null
  const { data: rev, error: errRev } = await supabase
    .from('plan_revisions')
    .insert({ plan_id: planId, user_id: user.id, data: planData, reason: 'devis_envoye' })
    .select('id')
    .single()
  if (errRev || !rev) console.error('[plan] snapshot devis_envoye échoué')
  else revisionId = String(rev.id)

  // 5) INSERT append-only via le pattern existant (lib/hooks insertRow).
  let inseres = 0
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i]
    const sourcePlan: SourcePlan = {
      planId,
      revisionId,
      roomId: l.roomId,
      metric: l.metric,
      lie: true,
      niveauId,
    }
    try {
      await insertRow('devis_lignes', {
        devis_id: devisId,
        designation: l.designation,
        quantite: l.quantite,
        unite: l.unite,
        prix_unitaire_ht: 0,
        taux_tva: tauxTva,
        ordre: ordreBase + i + 1,
        type: 'prestation',
        niveau: 3,
        numero: null,
        optionnel: false,
        inclus_par_defaut: true,
        source_plan: sourcePlan,
      })
      inseres++
    } catch (_e) {
      console.error('[plan] insertion ligne devis échouée')
      throw new Error(
        `${inseres} ligne${inseres > 1 ? 's' : ''} créée${inseres > 1 ? 's' : ''} sur ${lignes.length} — ` +
          'réessayez : les lignes déjà créées seront signalées comme doublons.'
      )
    }
  }

  return { inseres, numero: String(devisRow.numero ?? '') }
}

/**
 * Push 5 — Génère le PNG du niveau injecté et le stocke dans
 * `plans.export_images` (data URL base64, pattern logo). C'est CETTE image
 * unique que relisent les 4 rendus du devis (parité par construction).
 *
 * BEST-EFFORT STRICT : ne lève JAMAIS (un échec de génération/stockage ne
 * doit pas faire échouer une injection réussie). Une ré-injection régénère
 * l'image du niveau (remplacement par niveauId) ; les images des autres
 * niveaux sont conservées telles quelles (pas de régénération silencieuse).
 *
 * ⚠️ RETOURNE un résultat (14/07/2026) — auparavant `void` : tout échec était
 * AVALÉ EN SILENCE. L'artisan voyait l'écran de succès et croyait son plan
 * joint au devis envoyé au client, alors qu'il n'y était pas. Best-effort ne
 * doit pas vouloir dire « mentir » : on ne bloque toujours pas l'injection,
 * mais l'appelant DOIT pouvoir le dire.
 *
 * 'sans_objet' = rien à illustrer (niveau vide) → aucun avertissement.
 * 'echec' = on aurait dû produire une image et on n'a pas pu → à signaler.
 */
export type ResultatImagePlan = 'ok' | 'sans_objet' | 'echec'

export async function stockerImagePlanNiveau(
  planId: string,
  planData: PlanData,
  niveauId: string
): Promise<ResultatImagePlan> {
  try {
    const niveau = planData.levels.find((n) => n.id === niveauId)
    if (!niveau) return 'sans_objet'
    // Niveau vide : il n'y a légitimement rien à illustrer, ce n'est pas un
    // échec — on n'avertit donc pas.
    if (niveau.rooms.length === 0 && niveau.clotures.length === 0) return 'sans_objet'

    const dataUrl = await genererImagePlanNiveau(planData, niveauId)
    if (!dataUrl) return 'echec'

    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return 'echec'

    const { data: row, error: errLecture } = await supabase
      .from('plans')
      .select('export_images')
      .eq('id', planId)
      .maybeSingle()
    if (errLecture) throw new Error(errLecture.message)

    const existantes: ImagePlanExport[] = Array.isArray(row?.export_images)
      ? (row!.export_images as ImagePlanExport[]).filter(
          (e) => e && typeof e === 'object' && e.niveauId !== niveauId
        )
      : []
    existantes.push({
      niveauId,
      nom: niveau.name,
      dataUrl,
      genereLe: new Date().toISOString(),
    })
    // Garde-fou taille de ligne : on conserve au plus les 4 niveaux les plus récents.
    const bornees = existantes.slice(-4)

    const { error } = await supabase
      .from('plans')
      .update({ export_images: bornees })
      .eq('id', planId)
      .eq('user_id', auth.user.id)
    if (error) throw new Error(error.message)
    return 'ok'
  } catch (_e) {
    // Best-effort : journalisé côté client uniquement, jamais bloquant.
    console.error("[plan] image d'export du plan non enregistrée")
    return 'echec'
  }
}
