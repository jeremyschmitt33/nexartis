import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateChantierPlanningPdf } from '@/lib/pdf-chantier'
import type { ChantierPdfData } from '@/lib/pdf-chantier'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

// Force le rendu dynamique : la route lit cookies/headers (auth user) donc
// elle ne peut pas être prerendered statiquement par Next.js.
export const dynamic = 'force-dynamic'

// =============================================================
// Logique partagée GET / POST.
// GET  : export simple (pas de pacte de chantier).
// POST : export avec options (withPacte + pacteTexte personnalisé).
//        Body: { withPacte: boolean, pacteTexte: string }
// =============================================================
async function handleExport(
  req: NextRequest,
  chantierId: string,
  opts: { withPacte: boolean; pacteTexte: string },
) {
  try {
    // ✅ SÉCURITÉ : Rate limiting (5 exports par minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`export-chantier-pdf:${ip}`, 5, 60_000)) {
      return rateLimitError()
    }

    // ✅ SÉCURITÉ : Utilisateur connecté
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // ✅ SÉCURITÉ : Valider que c'est bien un UUID
    if (!isValidUUID(chantierId)) return secureError('ID du chantier invalide')

    // ✅ SÉCURITÉ (R1-010) : fail-fast si la clé service_role est absente.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('export-chantier-pdf: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    )

    // ✅ SÉCURITÉ : Charger le chantier en vérifiant user_id
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

    // Charger les interventions du chantier (avec devis_id pour regroupement par phase)
    // V2 : on inclut creneau + heure_debut + heure_fin pour la colonne "Horaire" du PDF
    const { data: interventions } = await supabase
      .from('planning_interventions')
      .select('id, titre, description_travaux, date_debut, date_fin, intervenant_id, devis_id, creneau, heure_debut, heure_fin')
      .eq('chantier_id', chantierId)
      .eq('user_id', user.id)
      .order('date_debut', { ascending: true })

    // Charger les intervenants (pour retrouver les noms)
    const { data: intervenants } = await supabase
      .from('intervenants')
      .select('id, prenom, nom, metier, type_contrat')
      .eq('user_id', user.id)

    // Charger les devis du chantier (V2 : inclut acompte/modalites)
    const { data: devis } = await supabase
      .from('devis')
      .select('id, numero, objet, description, montant_ttc, montant_acompte, acompte_verse, modalites_paiement')
      .eq('chantier_id', chantierId)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    // Charger les notes visibles dans le PDF
    const { data: notes } = await supabase
      .from('chantier_notes')
      .select('id, texte, categorie, visible_in_pdf')
      .eq('chantier_id', chantierId)
      .eq('user_id', user.id)
      .eq('visible_in_pdf', true)
      .order('created_at', { ascending: true })

    // V2 : charger les notes datées attachées aux interventions (sans note_artisan)
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

    // V2 (Pacte) : si l'artisan a inclus un pacte personnalisé via la modal,
    // on le sauvegarde côté chantier pour la prochaine édition + on le passe
    // au générateur PDF.
    let pacteTexteFinal: string | null = null
    if (opts.withPacte && opts.pacteTexte.trim()) {
      pacteTexteFinal = opts.pacteTexte.trim()
      // Sauvegarder pour pouvoir ré-éditer lors d'un prochain export
      await supabase
        .from('chantiers')
        .update({ pacte_chantier_texte: pacteTexteFinal })
        .eq('id', chantierId)
        .eq('user_id', user.id)
    }

    // Préparer les données pour le générateur PDF
    const pdfData: ChantierPdfData = {
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
        acces_info: chantier.acces_info,
        preparation_client: chantier.preparation_client,
        non_inclus: chantier.non_inclus,
        modalites_personnalisees: chantier.modalites_personnalisees,
        pacte_chantier_texte: chantier.pacte_chantier_texte,
      },
      client,
      interventions: interventions || [],
      intervenants: intervenants || [],
      devis: devis || [],
      notes: notes || [],
      interventionNotes,
      pacteTexte: pacteTexteFinal,
    }

    // Générer le PDF
    const pdfDataUri = generateChantierPlanningPdf(pdfData)
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
        'Content-Disposition': `attachment; filename="planning-${titreFile}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Export chantier PDF error:', error)
    return secureError('Erreur lors de la génération du PDF', 500)
  }
}

// ============== GET (export simple, sans pacte) ==============
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chantierId = searchParams.get('id')
  if (!chantierId) return secureError('ID du chantier manquant')
  return handleExport(req, chantierId, { withPacte: false, pacteTexte: '' })
}

// ============== POST (export avec options) ==============
// Body : { id: string, withPacte?: boolean, pacteTexte?: string }
export async function POST(req: NextRequest) {
  let body: { id?: string; withPacte?: boolean; pacteTexte?: string } = {}
  try {
    body = await req.json()
  } catch {
    return secureError('Body JSON invalide')
  }
  const chantierId = body.id || ''
  if (!chantierId) return secureError('ID du chantier manquant')
  return handleExport(req, chantierId, {
    withPacte: Boolean(body.withPacte),
    pacteTexte: typeof body.pacteTexte === 'string' ? body.pacteTexte : '',
  })
}
