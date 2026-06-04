import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError,
} from '@/lib/api-security'

/**
 * GET /api/public/devis/[token]
 *
 * API publique (sans auth) — récupère un devis via son signature_token.
 * Utilisée par la page /signer/[token] pour afficher l'aperçu complet.
 *
 * Retourne : devis + lignes + entreprise + client (sans infos sensibles)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // ✅ SÉCURITÉ : Rate limiting (20 requêtes par minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`public-devis:${ip}`, 20, 60_000)) {
      return rateLimitError()
    }

    const { token } = await params

    // ✅ SÉCURITÉ : Valider le format du token (UUID strict)
    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return secureError('Token invalide')
    }

    // Service role pour bypasser RLS (c'est une page publique)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Chercher le devis par son token unique
    const { data: devis, error: devisErr } = await supabase
      .from('devis')
      .select('*')
      .eq('signature_token', token)
      .single()

    if (devisErr || !devis) {
      // ✅ SÉCURITÉ : Message générique
      return secureError('Lien invalide ou expiré', 404)
    }

    // 2. Vérifier que le devis est dans un statut signable
    if (!['envoye', 'finalise'].includes(devis.statut)) {
      // Si déjà signé, on renvoie quand même le devis mais avec un flag
      const alreadySigned = devis.statut === 'signe' || devis.statut === 'facture'
      if (!alreadySigned) {
        return secureError('Ce devis ne peut pas être consulté dans son état actuel')
      }
    }

    // 3. Récupérer les lignes du devis
    const { data: lignes } = await supabase
      .from('devis_lignes')
      .select('designation, quantite, unite, prix_unitaire_ht, taux_tva, montant_ht, ordre, type, optionnel')
      .eq('devis_id', devis.id)
      .order('ordre')

    // 4. Récupérer l'entreprise (infos publiques uniquement)
    // ✅ SÉCURITÉ : Exclure signature_base64 et tampon_base64 (données sensibles)
    // V2.4c : ajout des mentions légales obligatoires manquantes (décennale n°,
    // qualification pro, médiateur structuré, mentions custom). Les champs sensibles
    // (signature/tampon base64, IBAN, BIC) RESTENT volontairement exclus.
    // V3.0d : on ajoute les 6 colonnes doc_color_* pour que la page publique
    // /signer/[token] applique le theme custom artisan. Aucune donnee sensible :
    // ce sont juste des couleurs hex destinees a l affichage du devis.
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('nom, adresse, code_postal, ville, telephone, email, siret, tva_intracommunautaire, assurance_nom, assurance_zone, forme_juridique, capital_social, rcs_rm, franchise_tva, logo_url, decennale_numero, qualification_pro, mediateur, mediateur_nom, mediateur_adresse, mediateur_code_postal, mediateur_ville, mentions_legales_custom, doc_color_bandeau_haut, doc_color_accent, doc_color_cadre_emetteur, doc_color_cadre_adresse, doc_color_net_payer, doc_color_footer')
      .eq('user_id', devis.user_id)
      .single()

    // 5. Récupérer le client
    let clientNom = 'Client'
    let clientAdresse = ''
    let clientTelephone = ''
    let clientEmail = ''
    // P11 (audit) : SIRET du client à transmettre à la vue publique /signer
    let clientSiret = ''

    if (devis.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('civilite, nom, prenom, adresse, code_postal, ville, telephone, email, siret')
        .eq('id', devis.client_id)
        .single()
      if (client) {
        // Ordre logique : Civilite + Prenom + Nom (ex: "M. Eric Dupont")
        clientNom = `${(client as { civilite?: string }).civilite || ''} ${client.prenom || ''} ${client.nom || ''}`.replace(/\s+/g, ' ').trim()
        clientAdresse = [client.adresse, `${client.code_postal || ''} ${client.ville || ''}`.trim()].filter(Boolean).join(', ')
        clientTelephone = client.telephone || ''
        clientEmail = client.email || ''
        clientSiret = (client as { siret?: string }).siret || ''
      }
    }
    // Fallback sur notes_client
    if (devis.notes_client) {
      const parts = devis.notes_client.split(' | ').map((s: string) => s.trim())
      if (clientNom === 'Client' && parts[0]) clientNom = parts[0]
      if (!clientAdresse && parts.length > 1) clientAdresse = parts[1] || ''
    }

    // 6. Marquer le devis comme consulté
    if (!devis.consulte_par_client) {
      await supabase.from('devis').update({
        consulte_par_client: true,
        date_consultation: new Date().toISOString(),
      }).eq('id', devis.id)
    }

    // 7. Renvoyer les données (sans infos sensibles type user_id, notes_internes)
    return NextResponse.json({
      devis: {
        id: devis.id,
        numero: devis.numero,
        statut: devis.statut,
        date_emission: devis.date_emission,
        date_validite: devis.date_validite,
        date_debut_travaux: devis.date_debut_travaux,
        duree_estimee: devis.duree_estimee,
        objet: devis.objet || devis.description,
        conditions_paiement: devis.conditions_paiement,
        acompte_pourcent: devis.acompte_pourcent,
        montant_ht: devis.montant_ht,
        montant_tva: devis.montant_tva,
        montant_ttc: devis.montant_ttc,
        date_signature: devis.date_signature,
        signed_by: devis.signed_by,
        client_signature_base64: devis.client_signature_base64,
        // Déchets
        dechets_nature: devis.dechets_nature,
        dechets_quantite: devis.dechets_quantite,
        dechets_responsable: devis.dechets_responsable,
        dechets_tri: devis.dechets_tri,
        dechets_collecte_nom: devis.dechets_collecte_nom,
        dechets_collecte_adresse: devis.dechets_collecte_adresse,
        dechets_collecte_type: devis.dechets_collecte_type,
        dechets_cout: devis.dechets_cout,
        dechets_inclure_cout: devis.dechets_inclure_cout,
      },
      lignes: lignes || [],
      entreprise: entreprise || {},
      client: {
        nom: clientNom,
        adresse: clientAdresse,
        telephone: clientTelephone,
        email: clientEmail,
        siret: clientSiret || undefined,
      },
    })
  } catch (error) {
    console.error('Public devis fetch error:', error)
    // ✅ SÉCURITÉ : Ne pas exposer les détails d'erreur
    return secureError('Erreur serveur', 500)
  }
}
