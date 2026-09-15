// =====================================================================
// lib/facture-acquittee.ts — Facture ACQUITTEE (15/09/2026)
// =====================================================================
// Une facture acquittee est une VERSION A PART de la facture : meme document,
// plus un bandeau « Facture acquittee — reglee le JJ/MM/AAAA par <mode> ».
// La facture d'origine n'est jamais modifiee (numero, montants, Factur-X).
//
// Utilise par /api/download-facture et /api/send-facture (parametre
// `acquittee: true`). Le serveur est seul juge : on ne fait JAMAIS confiance
// au front pour dire qu'une facture est payee.
//
// Regle : la facture doit etre SOLDEE, avec le calcul unique de
// lib/facture-net.ts (cash encaisse + avoirs emis + avoir impute >= TTC).
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { estSoldeeFacture, netAPayerFacture } from './facture-net'
import type { AcquitteeInfo } from './pdf'

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Libelle lisible d'un mode de reglement (colonne paiements.methode). */
export function libelleMethodePaiement(methode: string | null | undefined): string | null {
  const m = String(methode ?? '').trim().toLowerCase()
  if (!m) return null
  switch (m) {
    case 'virement': return 'virement bancaire'
    case 'cheque':
    case 'chèque': return 'chèque'
    case 'especes':
    case 'espèces': return 'espèces'
    case 'carte':
    case 'cb':
    case 'carte_bancaire': return 'carte bancaire'
    case 'prelevement':
    case 'prélèvement': return 'prélèvement'
    default: return String(methode).trim()
  }
}

export type ResultatAcquittement =
  | { ok: true; acquittee: AcquitteeInfo }
  | { ok: false; raison: string }

/**
 * Verifie qu'une facture (deja chargee ET verifiee comme appartenant a
 * l'utilisateur) est entierement reglee, et assemble les infos du bandeau.
 */
export async function chargerAcquittement(
  supabase: SupabaseClient,
  facture: Record<string, any>,
): Promise<ResultatAcquittement> {
  if (facture.type === 'avoir') {
    return { ok: false, raison: 'Un avoir ne peut pas être acquitté.' }
  }
  const ttc = Number(facture.montant_ttc ?? 0)
  if (!(ttc > 0.01) || facture.statut === 'brouillon') {
    return { ok: false, raison: "Cette facture n'est pas encore encaissée." }
  }

  const { data: avoirs } = await supabase
    .from('factures')
    .select('montant_ttc')
    .eq('facture_origine_id', facture.id)
    .eq('type', 'avoir')
    .is('deleted_at', null)
  const totalAvoirsEmis = r2(
    ((avoirs as Array<{ montant_ttc: number | null }> | null) ?? [])
      .reduce((s, a) => s + Number(a.montant_ttc ?? 0), 0),
  )

  const netInput = {
    montantTtc: ttc,
    montantPaye: Number(facture.montant_paye ?? 0),
    totalAvoirsEmis,
    avoirImputeMontant: Number(facture.avoir_impute_montant ?? 0),
  }
  if (!estSoldeeFacture(netInput)) {
    const reste = netAPayerFacture(netInput)
    return {
      ok: false,
      raison: `Cette facture n'est pas entièrement encaissée : il reste ${reste.toFixed(2).replace('.', ',')} € à percevoir.`,
    }
  }

  const { data: paiements } = await supabase
    .from('paiements')
    .select('montant, date_paiement, methode')
    .eq('facture_id', facture.id)
    .is('deleted_at', null)
    .order('date_paiement', { ascending: true })
  const liste = (paiements as Array<{ montant: number | null; date_paiement: string | null; methode: string | null }> | null) ?? []

  // Date d'acquittement = date du DERNIER reglement (celui qui solde la facture).
  const dates = liste.map((p) => p.date_paiement).filter((d): d is string => !!d).sort()
  const date =
    dates[dates.length - 1] ||
    (facture.date_paiement as string | null) ||
    (facture.updated_at as string | null) ||
    new Date().toISOString()

  const modes: string[] = []
  for (const p of liste) {
    const l = libelleMethodePaiement(p.methode)
    if (l && !modes.includes(l)) modes.push(l)
  }

  const avoirs2 = r2(totalAvoirsEmis + Number(facture.avoir_impute_montant ?? 0))
  if (avoirs2 > 0.01 && !modes.includes('avoir')) modes.push('avoir')

  return {
    ok: true,
    acquittee: {
      date,
      modes,
      montantRegle: r2(ttc),
    },
  }
}
