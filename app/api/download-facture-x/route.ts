import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFacturePdf } from '@/lib/pdf'
import { themeFromEntreprise } from '@/lib/document-theme'
import { buildFactureDataFromDb } from '@/lib/facturx/build-facture-data'
import { embarquerFacturX } from '@/lib/facturx'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  rateLimitError, secureError, unauthorizedError,
} from '@/lib/api-security'

// ---------------------------------------------------------------------------
// Route ISOLEE de telechargement Factur-X (PDF/A-3 hybride : PDF visuel + XML).
//
// Volontairement separee de /api/download-facture pour NE PAS modifier le flux
// de telechargement actuel. Le PDF visuel est genere par EXACTEMENT le meme
// `generateFacturePdf` + les memes donnees (helper partage) : visuel identique
// au telechargement classique et au rendu dashboard. La seule difference est le
// XML Factur-X embarque en piece jointe.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`dl-facturx:${ip}`, 20, 60_000)) {
      return rateLimitError()
    }

    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    const { factureId } = await req.json()
    if (!factureId) return secureError('factureId manquant')
    if (!isValidUUID(factureId)) return secureError('ID de facture invalide')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Verification de propriete : la facture doit appartenir a l'utilisateur connecte.
    const { data: facture, error: factureErr } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('user_id', user.id)
      .single()
    if (factureErr || !facture) return secureError('Facture introuvable', 404)

    // Memes donnees + meme generateur que le telechargement classique.
    const { data, entreprise } = await buildFactureDataFromDb(supabase, facture)
    const pdfBase64 = generateFacturePdf(data, themeFromEntreprise(entreprise))

    // Embarquement du XML Factur-X (EN 16931) dans le PDF -> PDF/A-3 hybride.
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const hybride = await embarquerFacturX(pdfBuffer, data, { titre: `Facture ${facture.numero}` })

    return NextResponse.json({
      pdfBase64: hybride.toString('base64'),
      filename: `Facture-${facture.numero}-facturx.pdf`,
    })
  } catch (error) {
    console.error('Download facture-x error:', error)
    return NextResponse.json({ error: 'Generation Factur-X impossible' }, { status: 500 })
  }
}
