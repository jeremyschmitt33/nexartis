import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateRecapChantierPdf } from '@/lib/pdf-recap-chantier'
import type { RecapChantierPdfData } from '@/lib/pdf-recap-chantier'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

// Force le rendu dynamique : la route lit cookies/headers (auth user) donc
// elle ne peut pas être prerendered statiquement par Next.js.
export const dynamic = 'force-dynamic'

// =============================================================
// Génération du PDF "Récapitulatif de chantier" — destiné au client.
// Document de SUIVI : récap travaux + financier + timeline notes
// + garanties + SAV. 2 pages MVP. Accessible via GET ?id=<chantierId>.
// =============================================================
export async function GET(req: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting (5 exports par minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`export-recap-chantier-pdf:${ip}`, 5, 60_000)) {
      return rateLimitError()
    }

    // ✅ SÉCURITÉ : Utilisateur connecté
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // Récupérer l'id du chantier
    const { searchParams } = new URL(req.url)
    const chantierId = searchParams.get('id')
    if (!chantierId) return secureError('ID du chantier manquant')

    // ✅ SÉCURITÉ : Valider que c'est bien un UUID
    if (!isValidUUID(chantierId)) return secureError('ID du chantier invalide')

    // ✅ SÉCURITÉ (R1-010) : fail-fast si la clé service_role est absente.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('export-recap-chantier-pdf: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    )

    // Charger le chantier (en vérifiant user_id pour éviter cross-tenant)
    const { data: chantier, error: chantierErr } = await supabase
      .from('chantiers')
      .select('*')
      .eq('id', chantierId)
      .eq('user_id', user.id)
      .single()
    if (chantierErr || !chantier) return secureError('Chantier introuvable', 404)

    // Charger l'entreprise (profil artisan)
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Charger le client lié
    let client = null
    if (chantier.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('civilite, nom, prenom, adresse, code_postal, ville, telephone, email')
        .eq('id', chantier.client_id)
        .eq('user_id', user.id)
        .single()
      client = clientData
    }

    // Charger les interventions du chantier (pour calculer la période réelle)
    const { data: interventions } = await supabase
      .from('planning_interventions')
      .select('id, date_debut, date_fin, intervenant_id, devis_id')
      .eq('chantier_id', chantierId)
      .eq('user_id', user.id)
      .order('date_debut', { ascending: true })

    // Charger les intervenants (pour cohérence du payload, peu utile ici)
    const { data: intervenants } = await supabase
      .from('intervenants')
      .select('id, prenom, nom, metier')
      .eq('user_id', user.id)

    // Charger les devis du chantier (avec statut pour différencier facturé/réalisé)
    const { data: devis } = await supabase
      .from('devis')
      .select('id, numero, objet, description, montant_ttc, montant_acompte, acompte_verse, statut')
      .eq('chantier_id', chantierId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    // Charger les notes datées attachées aux interventions
    // → on EXCLUT note_artisan (privée) côté SQL pour éviter de la transmettre
    const interventionIds = (interventions || []).map(i => i.id).filter(Boolean) as string[]
    let interventionNotesData: { id: string; intervention_id: string; type: string; texte: string }[] = []
    if (interventionIds.length > 0) {
      const { data: rawNotes } = await supabase
        .from('intervention_notes_client')
        .select('id, intervention_id, type, texte')
        .in('intervention_id', interventionIds)
        .eq('user_id', user.id)
        .neq('type', 'note_artisan')
        .order('created_at', { ascending: true })
      interventionNotesData = rawNotes ?? []
    }
    // Map id → date pour le tri chronologique côté PDF
    const ivDateMap = new Map<string, string>()
    ;(interventions || []).forEach(iv => {
      if (iv.id && iv.date_debut) ivDateMap.set(iv.id as string, iv.date_debut as string)
    })
    const interventionNotes = interventionNotesData.map(n => ({
      id: n.id,
      intervention_id: n.intervention_id,
      type: n.type as 'note_client' | 'presence_requise' | 'presence_obligatoire' | 'preparation' | 'note_artisan',
      texte: n.texte,
      date_intervention: ivDateMap.get(n.intervention_id) ?? null,
    }))

    // Préparer le payload pour le générateur PDF
    const pdfData: RecapChantierPdfData = {
      entreprise: entreprise || {},
      chantier: {
        id: chantier.id,
        titre: chantier.titre,
        description: chantier.description,
        description_client: chantier.description_client,
        adresse_chantier: chantier.adresse_chantier,
        code_postal_chantier: chantier.code_postal_chantier,
        ville_chantier: chantier.ville_chantier,
        date_debut: chantier.date_debut,
        date_fin_prevue: chantier.date_fin_prevue,
      },
      client,
      interventions: interventions || [],
      intervenants: intervenants || [],
      devis: devis || [],
      interventionNotes,
    }

    // Générer le PDF
    const pdfDataUri = generateRecapChantierPdf(pdfData)
    const base64 = pdfDataUri.substring(pdfDataUri.indexOf('base64,') + 7)
    const pdfBuffer = Buffer.from(base64, 'base64')

    // Nom de fichier safe
    const titreFile = (chantier.titre || 'chantier')
      .toLowerCase()
      .replace(/[àâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="recap-${titreFile}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Export récap chantier PDF error:', error)
    return secureError('Erreur lors de la génération du récap PDF', 500)
  }
}
