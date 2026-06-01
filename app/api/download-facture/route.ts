import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFacturePdf } from '@/lib/pdf'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

export async function POST(req: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting
    const ip = getClientIp(req)
    if (!checkRateLimit(`dl-facture:${ip}`, 20, 60_000)) {
      return rateLimitError()
    }

    // ✅ SÉCURITÉ : Vérifier que l'utilisateur est connecté
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    const { factureId } = await req.json()
    if (!factureId) return secureError('factureId manquant')

    // ✅ SÉCURITÉ : Valider l'input
    if (!isValidUUID(factureId)) return secureError('ID de facture invalide')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // ✅ SÉCURITÉ : Vérifier que la facture appartient à l'utilisateur connecté
    const { data: facture, error: factureErr } = await supabase.from('factures').select('*').eq('id', factureId).eq('user_id', user.id).single()
    if (factureErr || !facture) return secureError('Facture introuvable', 404)

    const { data: lignes } = await supabase.from('facture_lignes').select('*').eq('facture_id', factureId).order('ordre')
    const { data: entreprise } = await supabase.from('entreprises').select('*').eq('user_id', facture.user_id).single()

    // Parité HTML (app/dashboard/factures/[id]/page.tsx) :
    // le HTML utilise facture.notes_client en PRIORITÉ si présent (snapshot
    // figé à l'émission), sinon il reconstruit depuis la table clients.
    // On adopte le même ordre côté PDF pour garantir l'identité visuelle.
    let clientNom = facture.client_nom || 'Client'
    let clientAdresse = ''
    let clientType = 'particulier'
    // P11 (audit) : SIRET client et TVA intracom à afficher sur le PDF
    // pour conformité art. L441-9 Code de commerce (facture B2B).
    let clientSiret: string | undefined
    // V2.4d : ajout TVA intracommunautaire client pour conformité B2B intra-UE
    // (helper PDF accepte déjà ce champ — voir FactureData.clientTvaIntra)
    let clientTvaIntra: string | undefined

    if (facture.notes_client) {
      // PRIORITÉ 1 : snapshot figé sur la facture (parité HTML)
      const parts = String(facture.notes_client).split(' | ')
      clientNom = parts[0] || clientNom
      if (parts.length > 1) clientAdresse = parts.slice(1).join(' | ')
      // type client + SIRET : on tente toujours de récupérer depuis la table
      // clients (sans écraser nom/adresse snapshot).
      if (facture.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('type, siret')
          .eq('id', facture.client_id)
          .single()
        if (client) {
          clientType = client.type || 'particulier'
          clientSiret = (client.siret as string | undefined) || undefined
          // V2.4d : accès tolérant — devient utile dès que la colonne sera ajoutée à la table clients
          clientTvaIntra = ((client as Record<string, unknown>).tva_intracommunautaire as string | undefined) || undefined
        }
      }
    } else if (facture.client_id) {
      // PRIORITÉ 2 : fallback table clients (parité HTML)
      const { data: client } = await supabase
        .from('clients')
        .select('civilite, nom, prenom, adresse, code_postal, ville, telephone, email, type, siret')
        .eq('id', facture.client_id)
        .single()
      if (client) {
        // Ordre logique : Civilite + Prenom + Nom (ex: "M. Eric Dupont")
        clientNom = `${client.civilite || ''} ${client.prenom || ''} ${client.nom || ''}`.replace(/\s+/g, ' ').trim()
        const adressParts = [client.adresse, `${client.code_postal || ''} ${client.ville || ''}`.trim()].filter(Boolean)
        if (client.telephone) adressParts.push(client.telephone)
        if (client.email) adressParts.push(client.email)
        clientAdresse = adressParts.join(' | ')
        clientType = client.type || 'particulier'
        clientSiret = (client.siret as string | undefined) || undefined
        // V2.4d : accès tolérant — devient utile dès que la colonne sera ajoutée à la table clients
        clientTvaIntra = ((client as Record<string, unknown>).tva_intracommunautaire as string | undefined) || undefined
      }
    }

    const pdfBase64 = generateFacturePdf({
      numero: facture.numero,
      date_emission: facture.date_emission || facture.created_at,
      date_echeance: facture.date_echeance,
      date_prestation: facture.date_prestation,
      objet: facture.objet || '',
      clientNom,
      clientAdresse,
      clientType,
      clientSiret,
      // V2.4d : ajout TVA intracommunautaire client pour conformité B2B intra-UE
      clientTvaIntra,
      montant_ht: facture.montant_ht || 0,
      montant_tva: facture.montant_tva || 0,
      montant_ttc: facture.montant_ttc || 0,
      lignes: (lignes || []).map((l: Record<string, unknown>) => ({
        // V13 — Bug fix : on copie l'id (manquait) pour que computeSubtotals
        // puisse calculer les sous-totaux par section. Sans id, la fonction
        // retournait 0 pour toutes les sections.
        id: (l.id as string | undefined),
        designation: (l.designation as string) || '',
        quantite: (l.quantite as number) || 0,
        unite: (l.unite as string) || '',
        prix_unitaire_ht: (l.prix_unitaire_ht as number) || 0,
        // V13 — Bug fix : on utilise ?? au lieu de || pour respecter taux_tva=0
        // (Sans TVA / franchise art. 293 B). Avant : (0 || 10) renvoyait 10
        // donc le PDF affichait "TVA 10%" meme quand l'utilisateur avait coche
        // "Sans TVA".
        // V2.4b : fallback aligné à 20% (taux normal France) — auparavant 10% ce qui causait
        // une divergence avec lib/pdf.ts (?? 20) et le rendu HTML dashboard (?? 20).
        taux_tva: (l.taux_tva as number) ?? 20,
        type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
        niveau: (l.niveau as 1 | 2 | 3 | undefined),
        parent_id: (l.parent_id as string | null | undefined),
        numero: (l.numero as string | undefined),
      })),
      entreprise: entreprise || {},
      // Conditions visibles client (sera pré-rempli côté PDF si vide)
      conditions_paiement: facture.conditions_paiement || undefined,
      // Notes personnalisées (visibles client) — remplace l'usage de "notes internes"
      notes_personnalisees: facture.notes_personnalisees || undefined,
      // Acompte versé
      acompte_pourcent: facture.acompte_pourcent ?? undefined,
      acompte_montant_ht: facture.acompte_montant_ht ?? undefined,
      acompte_montant_ttc: facture.acompte_montant_ttc ?? undefined,
      acompte_label: facture.acompte_label || undefined,
      // Legacy : ancien champ `notes` conservé pour rétrocompat
      notes: facture.notes || undefined,
    })

    // Return the base64 PDF
    return NextResponse.json({ pdfBase64, filename: `Facture-${facture.numero}.pdf` })
  } catch (error) {
    console.error('Download facture error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
