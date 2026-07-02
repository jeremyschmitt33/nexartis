import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getClientIp, checkRateLimit, isValidUUID,
  secureError, rateLimitError,
} from '@/lib/api-security'

/**
 * GET /api/public/cop/[token]
 *
 * API publique (sans auth) — recupere un contrat d'ouverture de porte via son
 * signature_token. Utilisee par la page /signer/cop/[token] pour afficher au
 * CLIENT sa copie (lecture seule + impression).
 *
 * Retourne les champs bruts du COP (pour buildCopDocument) + l'entreprise
 * (infos figurant deja sur le contrat que le client a recu).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`public-cop:${ip}`, 20, 60_000)) return rateLimitError()

    const { token } = await params
    if (!token || !isValidUUID(token)) return secureError('Token invalide')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: cop, error: copErr } = await supabase
      .from('contrats_ouverture')
      .select('*')
      .eq('signature_token', token)
      .single()

    if (copErr || !cop) return secureError('Lien invalide ou expire', 404)

    // Lien expire : on refuse SAUF si le contrat est deja signe (la copie doit
    // rester consultable). Les contrats sans expiration ne sont pas affectes.
    if (
      cop.statut !== 'signe' &&
      cop.signature_token_expire_at &&
      new Date(cop.signature_token_expire_at).getTime() < Date.now()
    ) {
      return secureError('Lien invalide ou expire', 410)
    }

    // Entreprise : champs figurant sur le contrat (dont signature/tampon et IBAN,
    // qui font partie du document remis au client). Champs de couleur pour le theme.
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('nom, adresse, code_postal, ville, telephone, email, siret, tva_intracommunautaire, assurance_nom, assurance_zone, decennale_numero, forme_juridique, capital_social, rcs_rm, code_naf, franchise_tva, logo_url, signature_base64, tampon_base64, iban, bic, mediateur, mediateur_nom, mediateur_adresse, mediateur_code_postal, mediateur_ville, doc_color_bandeau_haut, doc_color_bandeau_haut_droite, doc_color_accent, doc_color_cadre_emetteur, doc_color_cadre_adresse, doc_color_net_payer, doc_color_footer')
      .eq('user_id', cop.user_id)
      .single()

    // On renvoie les champs BRUTS attendus par buildCopDocument (RawCop).
    return NextResponse.json({
      cop: {
        numero: cop.numero,
        statut: cop.statut,
        client_nom: cop.client_nom,
        client_prenom: cop.client_prenom,
        client_adresse: cop.client_adresse,
        client_cp: cop.client_cp,
        client_ville: cop.client_ville,
        statut_occupant: cop.statut_occupant,
        identite_verifiee: cop.identite_verifiee,
        piece_nature: cop.piece_nature,
        date_intervention: cop.date_intervention,
        lieu: cop.lieu,
        lignes: cop.lignes,
        nature_urgence: cop.nature_urgence,
        client_signature_base64: cop.client_signature_base64,
        signed_by: cop.signed_by,
        date_signature: cop.date_signature,
      },
      entreprise: entreprise || {},
    })
  } catch (error) {
    console.error('Public cop fetch error:', error)
    return secureError('Erreur serveur', 500)
  }
}
