import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFacturePdf } from '@/lib/pdf'
import { themeFromEntreprise } from '@/lib/document-theme'
import { buildFactureDataFromDb } from '@/lib/facturx/build-facture-data'
import { embarquerFacturX } from '@/lib/facturx'
import { validateInvoice, sendInvoice, SuperPdpError } from '@/lib/superpdp/client'
import { getValidAccessTokenForUser } from '@/lib/superpdp/connexion'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, rateLimitError, secureError, unauthorizedError,
} from '@/lib/api-security'

// ---------------------------------------------------------------------------
// ETAPE 3 — Envoi electronique d'une facture vers SUPER PDP (chemin "argent").
//
// Flux (prudence maximale) :
//   1) Securite : auth + ADMIN uniquement (feature non finalisee) + propriete.
//   2) Gating produit : reserve aux clients PRO avec SIRET (B2B).
//   3) Generation du Factur-X (PDF/A-3) — meme generateur que le telechargement.
//   4) VALIDATION officielle SUPER PDP : si non conforme -> on BLOQUE (rien envoye).
//   5) Jeton artisan (refresh auto) puis ENVOI.
//   6) Suivi en base (superpdp_invoice_id / status / date).
//
// Route ADDITIVE : ne modifie ni /api/send-facture (email) ni /download-facture*.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`send-facturx:${ip}`, 10, 60_000)) {
      return rateLimitError()
    }

    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // Ouvert a tous les artisans connectes. Garde-fous conserves : propriete de
    // la facture, client B2B avec SIRET, validation conformite avant envoi,
    // anti double-envoi, rate-limit.

    const { factureId } = await req.json()
    if (!factureId) return secureError('factureId manquant')
    if (!isValidUUID(factureId)) return secureError('ID de facture invalide')

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('send-facture-superpdp: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

    // Propriete : la facture doit appartenir a l'utilisateur connecte.
    const { data: facture, error: factureErr } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('user_id', user.id)
      .single()
    if (factureErr || !facture) return secureError('Facture introuvable', 404)

    // Anti double-envoi : une facture deja deposee chez SUPER PDP ne doit JAMAIS
    // etre renvoyee (cela creerait une 2e facture electronique legale en doublon).
    if (facture.superpdp_invoice_id) {
      return secureError('Cette facture a deja ete envoyee en electronique.', 409)
    }

    // Memes donnees + meme generateur que le telechargement / l'email.
    const { data, entreprise } = await buildFactureDataFromDb(supabase, facture)

    // Gating (decision produit) : reserve aux clients PRO avec SIRET (B2B).
    const clientPro = data.clientType === 'professionnel'
    const clientSiret = (data.clientSiret || '').replace(/\s/g, '')
    if (!clientPro || !clientSiret) {
      return secureError(
        'La facturation electronique B2B necessite un client professionnel avec un SIRET. Les particuliers relevent du e-reporting (a venir).',
        400,
      )
    }

    // Generation du Factur-X (PDF/A-3 hybride) — identique a /download-facture-x.
    const pdfBase64 = generateFacturePdf(data, themeFromEntreprise(entreprise))
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const hybride = await embarquerFacturX(pdfBuffer, data, { titre: `Facture ${facture.numero}` })

    // 1) VALIDATION pre-envoi (decision : bloquer si non conforme).
    let report
    try {
      report = await validateInvoice(hybride, `Facture-${facture.numero}.pdf`)
    } catch (e) {
      console.error('send-facture-superpdp: validation indisponible', (e as Error).message)
      return secureError('Validation indisponible pour le moment. Reessayez plus tard.', 502)
    }
    if (!report.is_valid) {
      return NextResponse.json(
        {
          error: 'FACTURE_NON_CONFORME',
          message: "La facture n'est pas conforme : elle n'a PAS ete envoyee.",
          report,
        },
        { status: 422 },
      )
    }

    // 2) Jeton valide (refresh auto) de l'artisan.
    let accessToken: string
    try {
      accessToken = await getValidAccessTokenForUser(supabase, user.id)
    } catch (e) {
      const err = e as SuperPdpError
      if (err.status === 409) {
        return secureError("Connecte d'abord ta facturation electronique (Parametres > Facturation).", 409)
      }
      if (err.status === 401) {
        return secureError('Ta connexion SUPER PDP a expire. Reconnecte-toi (Parametres > Facturation).', 401)
      }
      return secureError('Acces SUPER PDP impossible.', 500)
    }

    // 3) ENVOI.
    let envoyee
    try {
      envoyee = await sendInvoice(accessToken, new Uint8Array(hybride))
    } catch (e) {
      console.error('send-facture-superpdp: envoi echoue', (e as Error).message)
      return secureError("L'envoi a SUPER PDP a echoue. La facture n'a pas ete transmise.", 502)
    }

    // 4) Suivi en base (best effort : ne bloque pas le succes deja acquis).
    const invoiceId = envoyee?.id != null ? String(envoyee.id) : null
    await supabase
      .from('factures')
      .update({
        superpdp_invoice_id: invoiceId,
        superpdp_status: 'deposee',
        superpdp_envoyee_at: new Date().toISOString(),
      })
      .eq('id', facture.id)

    return NextResponse.json({ ok: true, invoiceId })
  } catch (error) {
    console.error('send-facture-superpdp error:', error)
    return NextResponse.json({ error: 'Envoi electronique impossible' }, { status: 500 })
  }
}
