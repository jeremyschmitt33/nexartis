// =====================================================================
// Route : Relancer MANUELLEMENT une facture impayee (V2.1 10/06/2026)
// =====================================================================
// L'artisan clique sur "Relancer maintenant" depuis la fiche facture.
// On envoie un email de relance Brevo, sans attendre le cron quotidien.
//
// Choix du niveau (palier) :
//   - On determine le delta jours echeance -> today
//   - On envoie le palier le plus haut encore NON tamponne
//     (priorite j30 > j15 > j7 si applicable)
//   - Si tous les paliers sont deja envoyes : on renvoie le plus haut
//     (l'artisan veut relancer encore une fois, on respecte)
//
// Securite :
//   - Auth obligatoire
//   - Rate limit : 5 envois / minute / user
//   - Verifie ownership (user_id = facture.user_id)
//   - Verifie email valide
// =====================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, checkRateLimit,
  isValidUUID, isValidEmail,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { sendRelanceJ7, sendRelanceJ15, sendRelanceJ30 } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Niveau = 'j7' | 'j15' | 'j30'

interface RouteContext {
  params: { id: string }
}

function diffDaysFromEcheance(echeanceIso: string): number {
  const echeance = new Date(echeanceIso)
  const now = new Date()
  const echeanceMs = Date.UTC(echeance.getUTCFullYear(), echeance.getUTCMonth(), echeance.getUTCDate())
  const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((nowMs - echeanceMs) / (1000 * 60 * 60 * 24))
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  // ---- Securite : auth obligatoire ------------------------------------
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  // Rate limit : 5 envois manuels / min / user pour eviter les abus
  if (!checkRateLimit(`relance-manuelle:${user.id}`, 5, 60_000)) {
    return rateLimitError()
  }

  // ---- Validation params ---------------------------------------------
  const factureId = ctx?.params?.id
  if (!factureId || !isValidUUID(factureId)) {
    return secureError('ID de facture invalide')
  }

  // ✅ SÉCURITÉ (R1-010) : fail-fast si la clé service_role est absente.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('relancer-maintenant: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }

  // ---- Chargement de la facture + verif ownership --------------------
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  )

  const { data: facture, error: factureErr } = await supabase
    .from('factures')
    .select(
      'id, user_id, numero, client_id, client_email, client_nom, date_echeance, montant_ttc, montant_paye, statut, relance_envoyee_j7, relance_envoyee_j15, relance_envoyee_j30',
    )
    .eq('id', factureId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (factureErr || !facture) {
    return secureError('Facture introuvable', 404)
  }

  // ---- Verification metier --------------------------------------------
  if (!facture.date_echeance) {
    return secureError("Cette facture n'a pas de date d'echeance, impossible de relancer")
  }
  const paye = facture.montant_paye ?? 0
  const total = facture.montant_ttc ?? 0
  if (total > 0 && paye >= total) {
    return secureError('Cette facture est deja soldee, pas besoin de relancer')
  }

  const delta = diffDaysFromEcheance(facture.date_echeance)
  if (delta < 0) {
    return secureError("La date d'echeance n'est pas encore passee — la facture n'est pas en retard")
  }

  // ---- Determine le palier --------------------------------------------
  // On choisit le plus haut palier applicable et NON ENCORE tamponne.
  // Si tous sont deja envoyes, on renvoie le plus haut applicable
  // (l'artisan veut quand meme relancer manuellement, on respecte).
  let niveau: Niveau
  if (delta >= 30 && !facture.relance_envoyee_j30) niveau = 'j30'
  else if (delta >= 15 && !facture.relance_envoyee_j15) niveau = 'j15'
  else if (delta >= 7 && !facture.relance_envoyee_j7) niveau = 'j7'
  else if (delta >= 30) niveau = 'j30'
  else if (delta >= 15) niveau = 'j15'
  else niveau = 'j7'

  // ---- Resoudre email + nom client ------------------------------------
  let clientEmail = facture.client_email
  let clientNom = facture.client_nom || 'Client'

  if (facture.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('email, civilite, prenom, nom')
      .eq('id', facture.client_id)
      .maybeSingle()
    if (client) {
      if (!clientEmail) clientEmail = client.email
      const composed = `${client.civilite || ''} ${client.prenom || ''} ${client.nom || ''}`.replace(/\s+/g, ' ').trim()
      if (composed) clientNom = composed
    }
  }

  if (!clientEmail || !isValidEmail(clientEmail)) {
    return secureError("Aucun email valide pour ce client — renseignez-le sur la fiche client")
  }

  // ---- Chargement entreprise pour la signature email -------------------
  const { data: entrepriseData } = await supabase
    .from('entreprises')
    .select('nom, logo_url, email')
    .eq('user_id', facture.user_id)
    .maybeSingle()

  const factureForMail = {
    id: facture.id,
    numero: facture.numero,
    montant_ttc: total,
    date_echeance: facture.date_echeance,
  }
  const entrepriseForMail = {
    nom: (entrepriseData?.nom as string) || undefined,
    logo_url: (entrepriseData?.logo_url as string) || undefined,
    email: (entrepriseData?.email as string) || undefined,
  }
  const clientForMail = { email: clientEmail, nom: clientNom }

  // ---- Envoi ----------------------------------------------------------
  let success = false
  try {
    if (niveau === 'j30') success = await sendRelanceJ30(factureForMail, entrepriseForMail, clientForMail)
    else if (niveau === 'j15') success = await sendRelanceJ15(factureForMail, entrepriseForMail, clientForMail)
    else success = await sendRelanceJ7(factureForMail, entrepriseForMail, clientForMail)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur envoi email'
    return secureError(`Echec envoi : ${msg}`, 500)
  }
  if (!success) {
    return secureError('Email non envoye (Brevo a retourne false)', 500)
  }

  // ---- Tamponner facture + INSERT relance (best-effort) ----------------
  try {
    const stampCol =
      niveau === 'j7' ? 'relance_envoyee_j7'
      : niveau === 'j15' ? 'relance_envoyee_j15'
      : 'relance_envoyee_j30'

    await supabase
      .from('factures')
      .update({ [stampCol]: new Date().toISOString() })
      .eq('id', facture.id)
      .eq('user_id', user.id)

    const typeRelance =
      niveau === 'j7' ? 'rappel'
      : niveau === 'j15' ? 'ferme'
      : 'mise_en_demeure'

    await supabase.from('relances').insert({
      user_id: facture.user_id,
      facture_id: facture.id,
      type: typeRelance,
      date_envoi: new Date().toISOString(),
      statut: 'envoyee',
      contenu: `Relance MANUELLE ${niveau.toUpperCase()} envoyee a ${clientEmail}`,
    })
  } catch (err) {
    // DB tampon en erreur : on log mais l'email est parti, on retourne ok.
    console.warn('[relance-manuelle] tampon DB en erreur :', err)
  }

  return secureJson({
    ok: true,
    niveau,
    sent_to: clientEmail,
    client_nom: clientNom,
  })
}
