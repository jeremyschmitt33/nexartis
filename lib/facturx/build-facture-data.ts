// lib/facturx/build-facture-data.ts
// ---------------------------------------------------------------------------
// Assemblage UNIQUE des donnees d'une facture (FactureData) a partir de la base.
//
// But : garantir que le PDF de telechargement classique ET le PDF Factur-X
// partent EXACTEMENT des memes donnees, donc rendent un visuel STRICTEMENT
// identique (regle projet : dashboard / PDF download / PDF email / signer
// doivent etre identiques). Une seule source de verite = aucune divergence.
//
// Cette fonction reproduit a l'identique l'assemblage qui etait jusque-la
// inline dans app/api/download-facture/route.ts (parite HTML conservee :
// priorite au snapshot facture.notes_client, fallback table clients).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FactureData } from '../pdf'

/** Resultat de l'assemblage : les donnees PDF + la ligne entreprise (pour le theme). */
export interface BuiltFactureData {
  data: FactureData
  entreprise: Record<string, unknown>
}

/**
 * Construit l'objet FactureData a partir d'une ligne `factures` deja chargee
 * (et verifiee comme appartenant a l'utilisateur). Effectue lui-meme les
 * requetes complementaires (lignes, entreprise, client).
 */
export async function buildFactureDataFromDb(
  supabase: SupabaseClient,
  facture: Record<string, any>,
): Promise<BuiltFactureData> {
  const { data: lignes } = await supabase
    .from('facture_lignes')
    .select('*')
    .eq('facture_id', facture.id)
    .order('ordre')
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('*')
    .eq('user_id', facture.user_id)
    .single()

  // Parite HTML (app/dashboard/factures/[id]/page.tsx) : priorite au snapshot
  // fige facture.notes_client ; sinon reconstruction depuis la table clients.
  let clientNom = facture.client_nom || 'Client'
  let clientAdresse = ''
  let clientType = 'particulier'
  let clientSiret: string | undefined
  let clientTvaIntra: string | undefined

  if (facture.notes_client) {
    const parts = String(facture.notes_client).split(' | ')
    clientNom = parts[0] || clientNom
    if (parts.length > 1) clientAdresse = parts.slice(1).join(' | ')
    if (facture.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('type, siret')
        .eq('id', facture.client_id)
        .single()
      if (client) {
        clientType = client.type || 'particulier'
        clientSiret = (client.siret as string | undefined) || undefined
        clientTvaIntra =
          ((client as Record<string, unknown>).tva_intracommunautaire as string | undefined) || undefined
      }
    }
  } else if (facture.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('civilite, nom, prenom, adresse, code_postal, ville, telephone, email, type, siret')
      .eq('id', facture.client_id)
      .single()
    if (client) {
      clientNom = `${client.civilite || ''} ${client.prenom || ''} ${client.nom || ''}`
        .replace(/\s+/g, ' ')
        .trim()
      const adressParts = [client.adresse, `${client.code_postal || ''} ${client.ville || ''}`.trim()].filter(
        Boolean,
      )
      if (client.telephone) adressParts.push(client.telephone)
      if (client.email) adressParts.push(client.email)
      clientAdresse = adressParts.join(' | ')
      clientType = client.type || 'particulier'
      clientSiret = (client.siret as string | undefined) || undefined
      clientTvaIntra =
        ((client as Record<string, unknown>).tva_intracommunautaire as string | undefined) || undefined
    }
  }

  const data: FactureData = {
    numero: facture.numero,
    date_emission: facture.date_emission || facture.created_at,
    date_echeance: facture.date_echeance,
    date_prestation: facture.date_prestation,
    objet: facture.objet || '',
    clientNom,
    clientAdresse,
    clientType,
    clientSiret,
    clientTvaIntra,
    montant_ht: facture.montant_ht || 0,
    montant_tva: facture.montant_tva || 0,
    montant_ttc: facture.montant_ttc || 0,
    lignes: (lignes || []).map((l: Record<string, unknown>) => ({
      id: l.id as string | undefined,
      designation: (l.designation as string) || '',
      quantite: (l.quantite as number) || 0,
      unite: (l.unite as string) || '',
      prix_unitaire_ht: (l.prix_unitaire_ht as number) || 0,
      taux_tva: (l.taux_tva as number) ?? 20,
      type: l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined,
      niveau: l.niveau as 1 | 2 | 3 | undefined,
      parent_id: l.parent_id as string | null | undefined,
      numero: l.numero as string | undefined,
    })),
    entreprise: entreprise || {},
    conditions_paiement: facture.conditions_paiement || undefined,
    notes_personnalisees: facture.notes_personnalisees || undefined,
    acompte_pourcent: facture.acompte_pourcent ?? undefined,
    acompte_montant_ht: facture.acompte_montant_ht ?? undefined,
    acompte_montant_ttc: facture.acompte_montant_ttc ?? undefined,
    acompte_label: facture.acompte_label || undefined,
    type: facture.type || undefined,
    numero_situation: facture.numero_situation ?? undefined,
    pourcentage_situation: facture.pourcentage_situation ?? undefined,
    devis_ref: facture.devis_ref || undefined,
    devis_date: facture.devis_date || undefined,
    montant_situation_precedent_ht: facture.montant_situation_precedent_ht ?? undefined,
    montant_situation_precedent_ttc: facture.montant_situation_precedent_ttc ?? undefined,
    reste_a_facturer_ht: facture.reste_a_facturer_ht ?? undefined,
    reste_a_facturer_ttc: facture.reste_a_facturer_ttc ?? undefined,
    autoliquidation_btp: facture.autoliquidation_btp === true,
    notes: facture.notes || undefined,
  }

  return { data, entreprise: entreprise || {} }
}
