// =====================================================================
// Cron : RECEPTION des factures electroniques via SUPER PDP (polling)
// =====================================================================
// Obligation legale : reception au 01/09/2026. Pas de webhook fiable cote
// SUPER PDP (cf. RAPPORT_SUPERPDP_RECEPTION) -> on POLL regulierement.
//
// Vercel cron declenche /api/cron/superpdp-reception (cf. vercel.json, 1x/jour
// a 6h : le plan Vercel Hobby limite les crons a une execution par jour).
// Pour chaque connexion SUPER PDP active (priorite aux moins recemment
// synchronisees) :
//   1. token valide du user (refresh auto) — saute proprement 409/401 ;
//   2. lit le curseur (superpdp_sync_state.last_seen_invoice_id) ;
//   3. recupere les entrantes depuis le curseur (GET ?direction=in) ;
//   4. pour chaque NOUVELLE facture (INSERT DB d'abord, ON CONFLICT DO NOTHING) :
//      telecharge le fichier (factur-x lisible, sinon original) -> bucket prive
//      'factures-recues/{user_id}/{id}.{ext}' -> met a jour fichier_path ;
//   5. avance le curseur + ecrit superpdp_sync_state ;
//   6. notifie l'artisan par email si >=1 nouvelle facture.
//
// Securite : header Authorization: Bearer ${CRON_SECRET}.
// Anti-timeout (60s) + anti-famine : budgets par RUN et par USER + throttle.
// Isolation multi-tenant : on ecrit toujours user_id = titulaire du token.
// =====================================================================

import { NextRequest, NextResponse } from 'next/server'
import { constantTimeEqual } from '@/lib/security/constant-time'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getValidAccessTokenForUser } from '@/lib/superpdp/connexion'
import { SuperPdpError, type SuperPdpFileResult } from '@/lib/superpdp/client'
import { fetchReceivedInvoices, downloadInvoiceFile, type ReceivedInvoice } from '@/lib/superpdp/reception'
import { sendEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro

const MAX_USERS_PER_RUN = 20      // connexions traitees par execution
const MAX_INVOICES_PER_RUN = 150  // plafond GLOBAL de factures traitees / run
const MAX_INVOICES_PER_USER = 30  // anti-famine : un gros compte n'accapare pas le run
const THROTTLE_MS = 60            // ~ reste sous 30 req/s (chaque facture = 2-3 req)
const BUCKET = 'factures-recues'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface ConnexionRow {
  user_id: string
  status: string | null
}

export async function GET(req: NextRequest) {
  // ---- SECURITE : Authorization Bearer CRON_SECRET --------------------
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET
  if (!expected || !constantTimeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[cron reception] Missing Supabase env vars')
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
  }

  // service_role : le cron lit/ecrit pour TOUS les users (pas de session).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let processedUsers = 0
  let totalNew = 0
  let totalInvoicesSeen = 0
  const errors: Array<{ userId: string; message: string }> = []

  try {
    // 1) Connexions actives, priorite aux moins recemment synchronisees.
    const { data: connexions, error: cxErr } = await admin
      .from('superpdp_connexions')
      .select('user_id, status')
      .is('deleted_at', null)
    if (cxErr) throw cxErr

    let users = (connexions || []) as ConnexionRow[]

    // Curseurs / dernieres synchros pour prioriser (ancien d'abord).
    const { data: syncRows } = await admin
      .from('superpdp_sync_state')
      .select('user_id, last_seen_invoice_id, last_sync_at')
    const syncByUser = new Map<string, { cursor: number | null; lastAt: string | null }>()
    for (const s of syncRows || []) {
      syncByUser.set(s.user_id as string, {
        cursor: (s.last_seen_invoice_id as number) ?? null,
        lastAt: (s.last_sync_at as string) ?? null,
      })
    }
    users = users.sort((a, b) => {
      const la = syncByUser.get(a.user_id)?.lastAt || '' // '' (jamais synchro) passe en premier
      const lb = syncByUser.get(b.user_id)?.lastAt || ''
      return la < lb ? -1 : la > lb ? 1 : 0
    }).slice(0, MAX_USERS_PER_RUN)

    // 2) Boucle utilisateur
    for (const cx of users) {
      if (totalInvoicesSeen >= MAX_INVOICES_PER_RUN) break
      const userId = cx.user_id
      processedUsers += 1

      // 2a) Token valide (refresh auto). 409 = non connecte, 401 = reconnexion.
      let token: string
      try {
        token = await getValidAccessTokenForUser(admin, userId)
      } catch (e) {
        const err = e as SuperPdpError
        const status = err?.status === 409 ? 'non_connecte' : err?.status === 401 ? 'reconnexion_requise' : 'erreur'
        await writeSyncState(admin, userId, syncByUser.get(userId)?.cursor ?? null, status, err?.message || 'token')
        continue
      }

      // 2b) Curseur courant + budget restant pour ce user
      const cursor = syncByUser.get(userId)?.cursor ?? null
      const remainingRun = MAX_INVOICES_PER_RUN - totalInvoicesSeen
      const budget = Math.max(0, Math.min(MAX_INVOICES_PER_USER, remainingRun))
      if (budget === 0) break

      // 2c) Recuperation des entrantes depuis le curseur
      let invoices: ReceivedInvoice[]
      try {
        invoices = await fetchReceivedInvoices(token, { sinceId: cursor, maxItems: budget })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'fetch'
        errors.push({ userId, message: msg })
        await writeSyncState(admin, userId, cursor, 'erreur', msg)
        continue
      }

      totalInvoicesSeen += invoices.length
      let maxCursor = cursor ?? 0
      let newForUser = 0

      // 2d) Traitement facture par facture (ordre asc => curseur monotone)
      for (const inv of invoices) {
        try {
          // INSERT D'ABORD (idempotence) : on ne telecharge le fichier QUE si la
          // ligne est reellement nouvelle (ON CONFLICT DO NOTHING => 0 ligne si doublon).
          const { data: insertedRows, error: insErr } = await admin
            .from('factures_recues')
            .upsert(
              {
                user_id: userId,
                superpdp_invoice_id: inv.superpdpId,
                superpdp_direction: inv.direction,
                emetteur_nom: inv.emetteurNom,
                emetteur_siren: inv.emetteurSiren,
                emetteur_siret: inv.emetteurSiret,
                emetteur_tva_intra: inv.emetteurTvaIntra,
                type_document: inv.typeDocument,
                numero: inv.numero,
                date_emission: inv.dateEmission,
                date_echeance: inv.dateEcheance,
                devise: inv.devise,
                montant_ht: inv.montantHt,
                montant_tva: inv.montantTva,
                montant_ttc: inv.montantTtc,
                tva_details: inv.tvaDetails,
                statut_pdp_code: inv.statutPdpCode,
                statut_pdp_text: inv.statutPdpText,
                raw_payload: inv.raw,
              },
              { onConflict: 'user_id,superpdp_invoice_id', ignoreDuplicates: true },
            )
            .select('id')

          if (insErr) throw insErr

          const inserted = Array.isArray(insertedRows) && insertedRows.length > 0
          if (inserted) {
            newForUser += 1
            const factureRowId = insertedRows[0].id as string
            // Telechargement : factur-x (PDF lisible genere par la PA) en priorite,
            // sinon le fichier original (XML UBL/CII).
            let file: SuperPdpFileResult | undefined
            let formatLabel = 'factur-x'
            try {
              file = await downloadInvoiceFile(token, inv.superpdpId, 'factur-x')
            } catch {
              try {
                file = await downloadInvoiceFile(token, inv.superpdpId, 'original')
                formatLabel = 'original'
              } catch { /* fichier indisponible : on garde la ligne sans fichier */ }
            }
            if (file) {
              // id est un bigint valide (verifie a la normalisation) => path sur.
              const path = `${userId}/${inv.superpdpId}.${file.ext}`
              const { error: upErr } = await admin.storage
                .from(BUCKET)
                .upload(path, file.bytes, { contentType: file.contentType, upsert: true })
              if (!upErr) {
                await admin
                  .from('factures_recues')
                  .update({
                    fichier_path: path,
                    fichier_format: file.ext === 'pdf' ? formatLabel : 'original',
                    fichier_taille: file.bytes.byteLength,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', factureRowId)
              } else {
                console.error('[cron reception] upload storage echoue', upErr.message)
              }
            }
          }

          if (inv.superpdpId > maxCursor) maxCursor = inv.superpdpId
          await sleep(THROTTLE_MS)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'invoice'
          errors.push({ userId, message: `inv ${inv.superpdpId}: ${msg}` })
          // On NE met PAS a jour le curseur au-dela d'une facture en echec
          // (elle sera retentee au prochain run). On stoppe la boucle de ce user.
          break
        }
      }

      totalNew += newForUser
      await writeSyncState(admin, userId, maxCursor || cursor || null, 'ok', null)

      // 2e) Notification email si nouvelles factures
      if (newForUser > 0) {
        try { await notifyUser(admin, userId, newForUser) } catch { /* best effort */ }
      }
    }

    return NextResponse.json({ ok: true, processedUsers, totalNew, totalInvoicesSeen, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron reception] fatal', err)
    return NextResponse.json({ ok: false, error: msg, processedUsers, totalNew, errors }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
async function writeSyncState(
  admin: SupabaseClient,
  userId: string,
  cursor: number | null,
  status: string,
  error: string | null,
) {
  await admin.from('superpdp_sync_state').upsert(
    {
      user_id: userId,
      last_seen_invoice_id: cursor,
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: error ? error.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}

async function notifyUser(
  admin: SupabaseClient,
  userId: string,
  count: number,
) {
  // Email de l'entreprise (sinon on ne notifie pas — pas d'email connu).
  const { data: ent } = await admin
    .from('entreprises')
    .select('email, nom')
    .eq('user_id', userId)
    .maybeSingle()
  const to = (ent?.email as string) || null
  if (!to) return
  const n = count
  const sujet = n === 1 ? '1 nouvelle facture fournisseur recue' : `${n} nouvelles factures fournisseurs recues`
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f1a3a;">
      <h2 style="color:#0f1a3a;">${n === 1 ? 'Une nouvelle facture' : `${n} nouvelles factures`} dans votre espace</h2>
      <p>Bonjour,</p>
      <p>Vous avez recu ${n === 1 ? 'une nouvelle facture electronique' : `${n} nouvelles factures electroniques`} de la part de vos fournisseurs.</p>
      <p>Retrouvez-${n === 1 ? 'la' : 'les'} dans <strong>Achats &gt; Factures recues</strong> de votre tableau de bord Nexartis pour la consulter, l'approuver ou la refuser.</p>
      <p style="margin-top:24px;font-size:13px;color:#64748b;">Nexartis — Facturation electronique conforme.</p>
    </div>`
  await sendEmail({ to: { email: to, name: (ent?.nom as string) || undefined }, subject: sujet, html, senderName: 'Nexartis' })
}
