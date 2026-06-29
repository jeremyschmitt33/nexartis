import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDevisPdf } from '@/lib/pdf'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
import { themeFromEntreprise } from '@/lib/document-theme'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

// V2.4d : nouvelle route — calque de download-facture mais pour le devis.
// Remplace l'ancien window.print() du dashboard devis qui produisait un rendu
// HTML divergent du PDF jsPDF envoyé par email au client. Désormais, le bouton
// "Télécharger PDF" du dashboard appelle cette route et reçoit le même PDF
// (parité stricte avec /api/send-devis).
export async function POST(req: NextRequest) {
  try {
    // SÉCURITÉ : Rate limiting
    const ip = getClientIp(req)
    if (!checkRateLimit(`dl-devis:${ip}`, 20, 60_000)) {
      return rateLimitError()
    }

    // SÉCURITÉ : Vérifier que l'utilisateur est connecté
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    const { devisId } = await req.json()
    if (!devisId) return secureError('devisId manquant')

    // SÉCURITÉ : Valider l'input
    if (!isValidUUID(devisId)) return secureError('ID de devis invalide')

    // ✅ SÉCURITÉ (R1-010) : fail-fast si la clé service_role est absente.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('download-devis: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    )

    // SÉCURITÉ : Vérifier que le devis appartient à l'utilisateur connecté
    const { data: devis, error: devisErr } = await supabase.from('devis').select('*').eq('id', devisId).eq('user_id', user.id).single()
    if (devisErr || !devis) return secureError('Devis introuvable', 404)

    const { data: lignes } = await supabase.from('devis_lignes').select('*').eq('devis_id', devisId).order('ordre')
    const { data: entreprise } = await supabase.from('entreprises').select('*').eq('user_id', devis.user_id).single()

    // Resolve client — calque exact de send-devis pour parité PDF email / PDF download
    let clientNom = 'Client'
    let clientAdresse = ''
    let clientType = 'particulier'
    let clientSiret: string | undefined
    // V2.4d : TVA intracom client B2B (préparée pour future colonne BDD).
    // Aujourd'hui la colonne n'existe pas sur la table clients donc on lit
    // de façon tolérante — le helper PDF ignore le champ si vide.
    let clientTvaIntra: string | undefined

    if (devis.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('civilite, nom, prenom, adresse, code_postal, ville, type, telephone, email, siret')
        .eq('id', devis.client_id)
        .single()
      if (client) {
        clientNom = `${client.civilite || ''} ${client.prenom || ''} ${client.nom || ''}`.replace(/\s+/g, ' ').trim()
        clientAdresse = [client.adresse, `${client.code_postal || ''} ${client.ville || ''}`.trim(), client.telephone, client.email].filter(Boolean).join(' | ')
        clientType = client.type || 'particulier'
        clientSiret = (client.siret as string | undefined) || undefined
        // V2.4d : accès tolérant — devient utile dès que la colonne est ajoutée à la table clients
        clientTvaIntra = ((client as Record<string, unknown>).tva_intracommunautaire as string | undefined) || undefined
      }
    }
    // Fallback sur notes_client si pas de client_id ou client non trouvé
    if (devis.notes_client) {
      const parts = String(devis.notes_client).split(' | ').map((s: string) => s.trim())
      if (clientNom === 'Client' && parts[0]) clientNom = parts[0]
      if (!clientAdresse && parts.length > 1) clientAdresse = parts.slice(1).join(' | ')
    }

    // Filet de securite : recalcul numerotation hierarchique a la volee
    const lignesAvecNumero = computeHierarchicalNumbers(
      (lignes || []).map((l: Record<string, unknown>) => ({
        type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
        numero: (l.numero as string | undefined),
        _orig: l,
      })),
    )

    const pdfBase64 = generateDevisPdf({
      numero: devis.numero,
      date_emission: devis.date_emission || devis.created_at,
      date_validite: devis.date_validite,
      date_debut_travaux: devis.date_debut_travaux,
      duree_travaux: devis.duree_travaux,
      objet: devis.objet || devis.description,
      conditions_paiement: devis.conditions_paiement,
      acompte_pourcent: devis.acompte_pourcent,
      clientNom,
      clientAdresse,
      clientType,
      clientSiret,
      // V2.4d : ajout TVA intracommunautaire client pour conformité B2B intra-UE
      clientTvaIntra,
      montant_ht: devis.montant_ht || 0,
      montant_tva: devis.montant_tva || 0,
      montant_ttc: devis.montant_ttc || 0,
      lignes: lignesAvecNumero.map((item) => {
        const l = item._orig as Record<string, unknown>
        return {
          // V13 — id requis pour computeSubtotals (sections a 0 sans cela)
          id: (l.id as string | undefined),
          designation: (l.designation as string) || '',
          quantite: (l.quantite as number) || 0,
          unite: (l.unite as string) || '',
          prix_unitaire_ht: (l.prix_unitaire_ht as number) || 0,
          // V2.4b : fallback aligné à 20% (taux normal France)
          taux_tva: (l.taux_tva as number) ?? 20,
          type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
          niveau: (l.niveau as 1 | 2 | 3 | undefined),
          parent_id: (l.parent_id as string | null | undefined),
          numero: item.numero,
          // Statut d'inclusion (devis cochable) : exclusion des options du total + bloc dédié.
          optionnel: (l.optionnel as boolean | null | undefined),
          inclus_par_defaut: (l.inclus_par_defaut as boolean | null | undefined),
        }
      }),
      entreprise: entreprise || {},
      // Statut + signature client : utilises pour afficher "Bon pour accord" + date
      statut: devis.statut,
      date_signature: devis.date_signature,
      client_signature_base64: devis.client_signature_base64,
      dechets: (devis.dechets_nature || devis.dechets_quantite || devis.dechets_collecte_nom) ? {
        nature: devis.dechets_nature || undefined,
        quantite: devis.dechets_quantite || undefined,
        responsable: devis.dechets_responsable || undefined,
        tri: devis.dechets_tri || undefined,
        collecte_nom: devis.dechets_collecte_nom || undefined,
        collecte_adresse: devis.dechets_collecte_adresse || undefined,
        collecte_type: devis.dechets_collecte_type || undefined,
        cout: devis.dechets_cout ?? undefined,
        inclure_cout: devis.dechets_inclure_cout ?? false,
      } : undefined,
    }, themeFromEntreprise(entreprise))

    return NextResponse.json({ pdfBase64, filename: `Devis-${devis.numero}.pdf` })
  } catch (error) {
    console.error('Download devis error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
