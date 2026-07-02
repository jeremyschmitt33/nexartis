// ============================================================================
// lib/services/cop-facture.ts
// ----------------------------------------------------------------------------
// Genere une VRAIE facture liee a un contrat d'ouverture de porte (COP).
// Calque de createFactureFromDevis (lib/services/devis-automatisms.ts) :
//   - insere dans `factures` (le trigger set_facture_numero pose le numero
//     sequentiel legal F-YYYY-####),
//   - copie les lignes du COP dans la table separee `facture_lignes`,
//   - statut 'brouillon' = A ENCAISSER par defaut ; 'payee' si encaisse sur place.
// C'est le SEUL point qui fait entrer la recette dans la compta (stats + export
// lisent la table `factures`). Le COP reste le document juridique.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

interface CopLigneRaw {
  designation?: unknown
  quantite?: unknown
  unite?: unknown
  pu_ht?: unknown
  tva_taux?: unknown
}

interface CopForFacture {
  id: string
  client_id?: string | null
  numero?: string | null
  total_ht?: number | null
  total_tva?: number | null
  total_ttc?: number | null
  lignes?: CopLigneRaw[] | null
}

export interface CreateFactureFromCopParams {
  admin: SupabaseClient
  userId: string
  cop: CopForFacture
  delaiPaiementJours?: number | null
  encaisse: boolean
}

export interface CreatedFacture {
  id: string
  numero: string
}

export async function createFactureFromCop(
  params: CreateFactureFromCopParams,
): Promise<CreatedFacture> {
  const { admin, userId, cop, delaiPaiementJours, encaisse } = params

  const now = new Date()
  const dateEmission = now.toISOString().split('T')[0]
  const delai = Number(delaiPaiementJours) > 0 ? Number(delaiPaiementJours) : 30
  const echeance = new Date(now)
  echeance.setDate(echeance.getDate() + delai)
  const dateEcheance = echeance.toISOString().split('T')[0]

  const ttc = Number(cop.total_ttc) || 0

  // numero volontairement OMIS : le trigger BEFORE INSERT set_facture_numero
  // pose le numero sequentiel legal (F-YYYY-####) de facon atomique.
  const factureInsert: Record<string, unknown> = {
    user_id: userId,
    client_id: cop.client_id ?? null,
    type: 'standard',
    date_emission: dateEmission,
    date_echeance: dateEcheance,
    montant_ht: Number(cop.total_ht) || 0,
    montant_tva: Number(cop.total_tva) || 0,
    montant_ttc: ttc,
    statut: encaisse ? 'payee' : 'brouillon',
    montant_paye: encaisse ? ttc : 0,
    date_paiement: encaisse ? now.toISOString() : null,
    notes: `Contrat d'ouverture de porte ${cop.numero ?? ''}`.trim(),
  }

  const { data: facture, error } = await admin
    .from('factures')
    .insert(factureInsert)
    .select('id, numero')
    .single()

  if (error || !facture) {
    throw new Error(error?.message || 'Creation de la facture impossible')
  }

  const lignes = Array.isArray(cop.lignes) ? cop.lignes : []
  if (lignes.length > 0) {
    const rows = lignes.map((l, i) => ({
      facture_id: facture.id,
      ordre: i,
      designation: String(l.designation ?? ''),
      quantite: Number(l.quantite) || 0,
      unite: String(l.unite ?? 'forfait'),
      prix_unitaire_ht: Number(l.pu_ht) || 0,
      taux_tva: Number(l.tva_taux) || 0,
    }))
    const { error: lignesErr } = await admin.from('facture_lignes').insert(rows)
    if (lignesErr) {
      // La facture existe deja : on remonte l'erreur pour investigation, mais
      // la ligne d'entete est posee (le total y figure). Non bloquant cote UX.
      console.error('[cop-facture] insert lignes:', lignesErr)
    }
  }

  return { id: facture.id as string, numero: String(facture.numero ?? '') }
}
