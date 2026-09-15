import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFacturePdf } from '@/lib/pdf'
import { themeFromEntreprise } from '@/lib/document-theme'
import { buildFactureDataFromDb } from '@/lib/facturx/build-facture-data'
import { chargerAcquittement } from '@/lib/facture-acquittee'
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

    const { factureId, acquittee } = await req.json()
    if (!factureId) return secureError('factureId manquant')
    // 15/09/2026 : acquittee === true -> version « facture acquittee » (verifiee serveur).
    const versionAcquittee = acquittee === true

    // ✅ SÉCURITÉ : Valider l'input
    if (!isValidUUID(factureId)) return secureError('ID de facture invalide')

    // ✅ SÉCURITÉ (R1-010) : fail-fast si la clé service_role est absente,
    // au lieu d'un fallback silencieux sur la clé anon (qui dégrade en
    // silence le comportement de la route).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('download-facture: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    )

    // ✅ SÉCURITÉ : Vérifier que la facture appartient à l'utilisateur connecté
    const { data: facture, error: factureErr } = await supabase.from('factures').select('*').eq('id', factureId).eq('user_id', user.id).single()
    if (factureErr || !facture) return secureError('Facture introuvable', 404)

    // Assemblage des donnees centralise (helper partage) : garantit que ce PDF
    // et le PDF Factur-X (/api/download-facture-x) partent des memes donnees et
    // rendent un visuel strictement identique.
    const { data, entreprise } = await buildFactureDataFromDb(supabase, facture)

    // 15/09/2026 — Facture acquittee : refusee tant que la facture n'est pas soldee.
    if (versionAcquittee) {
      const acq = await chargerAcquittement(supabase, facture)
      if (!acq.ok) return secureError(acq.raison, 409)
      data.acquittee = acq.acquittee
    }

    const pdfBase64 = generateFacturePdf(data, themeFromEntreprise(entreprise))

    // Return the base64 PDF
    const filename = versionAcquittee
      ? `Facture-acquittee-${facture.numero}.pdf`
      : `Facture-${facture.numero}.pdf`
    return NextResponse.json({ pdfBase64, filename })
  } catch (error) {
    // ✅ SÉCURITÉ (R1-009) : log serveur detaille, reponse generique au client
    // (ne pas exposer error.message brut de Postgres/Supabase).
    console.error('Download facture error:', error)
    return secureError('Erreur serveur', 500)
  }
}
