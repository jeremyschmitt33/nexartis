import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFacturePdf } from '@/lib/pdf'
import { themeFromEntreprise } from '@/lib/document-theme'
import { buildFactureDataFromDb } from '@/lib/facturx/build-facture-data'
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

    // Assemblage des donnees centralise (helper partage) : garantit que ce PDF
    // et le PDF Factur-X (/api/download-facture-x) partent des memes donnees et
    // rendent un visuel strictement identique.
    const { data, entreprise } = await buildFactureDataFromDb(supabase, facture)
    const pdfBase64 = generateFacturePdf(data, themeFromEntreprise(entreprise))

    // Return the base64 PDF
    return NextResponse.json({ pdfBase64, filename: `Facture-${facture.numero}.pdf` })
  } catch (error) {
    console.error('Download facture error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
