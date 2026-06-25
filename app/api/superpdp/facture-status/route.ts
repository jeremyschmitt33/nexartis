import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getInvoice, SuperPdpError } from '@/lib/superpdp/client'
import { getValidAccessTokenForUser } from '@/lib/superpdp/connexion'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, rateLimitError, secureError, unauthorizedError,
} from '@/lib/api-security'

// ---------------------------------------------------------------------------
// ETAPE 4 — Lecture du statut (cycle de vie) d'une facture deja envoyee.
//
// Recupere la facture chez SUPER PDP (GET /invoices/{id}) et renvoie la liste
// de ses evenements (status_text + status_code + date). On NE recalcule aucun
// libelle : on affiche le `status_text` fourni par SUPER PDP (robuste).
//
// Reserve a l'admin (feature beta). Lecture seule + MAJ best-effort du dernier
// statut connu en base (factures.superpdp_status).
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`facturx-status:${ip}`, 30, 60_000)) {
      return rateLimitError()
    }

    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()
    // Ouvert a tous : la facture est filtree par user_id (propriete) ci-dessous.

    const { factureId } = await req.json()
    if (!factureId) return secureError('factureId manquant')
    if (!isValidUUID(factureId)) return secureError('ID de facture invalide')

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('facture-status: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

    const { data: facture, error: factureErr } = await supabase
      .from('factures')
      .select('id, user_id, superpdp_invoice_id')
      .eq('id', factureId)
      .eq('user_id', user.id)
      .single()
    if (factureErr || !facture) return secureError('Facture introuvable', 404)

    // Facture jamais envoyee en electronique : rien a suivre.
    if (!facture.superpdp_invoice_id) {
      return NextResponse.json({ sent: false, events: [] })
    }

    // Jeton valide (refresh auto).
    let accessToken: string
    try {
      accessToken = await getValidAccessTokenForUser(supabase, user.id)
    } catch (e) {
      const err = e as SuperPdpError
      if (err.status === 409) return secureError("Connecte d'abord ta facturation electronique.", 409)
      if (err.status === 401) return secureError('Ta connexion SUPER PDP a expire. Reconnecte-toi.', 401)
      return secureError('Acces SUPER PDP impossible.', 500)
    }

    // Lecture de la facture (avec ses evenements) chez SUPER PDP.
    let invoice
    try {
      invoice = await getInvoice(accessToken, String(facture.superpdp_invoice_id))
    } catch (e) {
      console.error('facture-status: lecture echouee', (e as Error).message)
      return secureError('Lecture du statut impossible pour le moment.', 502)
    }

    const rawEvents = Array.isArray(invoice.events) ? invoice.events : []
    // Normalisation + tri chronologique (du plus ancien au plus recent).
    const events = rawEvents
      .map((ev) => ({
        code: ev.status_code ?? null,
        text: ev.status_text ?? null,
        date: ev.created_at ?? null,
      }))
      .sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0
        const tb = b.date ? new Date(b.date).getTime() : 0
        return ta - tb
      })

    const latest = events.length > 0 ? events[events.length - 1] : null

    // MAJ best-effort du dernier statut connu (ne bloque jamais la reponse).
    if (latest?.code) {
      await supabase
        .from('factures')
        .update({ superpdp_status: latest.code })
        .eq('id', facture.id)
    }

    return NextResponse.json({
      sent: true,
      invoiceId: String(facture.superpdp_invoice_id),
      latest,
      events,
    })
  } catch (error) {
    console.error('facture-status error:', error)
    return NextResponse.json({ error: 'Statut indisponible' }, { status: 500 })
  }
}
