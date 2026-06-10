// =====================================================================
// Cron : Relances automatiques des factures impayees (V1)
// =====================================================================
// Vercel cron declenche /api/cron/relances-auto-factures tous les jours
// a 09:00 (cf. vercel.json). Pour chaque entreprise dont
// `relances_auto_actives` n'est pas FALSE :
//   1. on liste les factures en retard non payees ;
//   2. pour chaque facture, selon le nombre de jours depuis l'echeance
//      (>=7, >=15, >=30) et si la relance correspondante n'a pas deja
//      ete envoyee, on envoie un email Brevo + on tamponne
//      `relance_envoyee_jX` + on insere une ligne dans `relances`.
//
// Securite : header Authorization: Bearer ${CRON_SECRET}.
// Volume : max 100 emails par execution (anti-timeout Vercel 10s).
// =====================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidEmail } from '@/lib/api-security'
import { sendRelanceJ7, sendRelanceJ15, sendRelanceJ30 } from '@/lib/email'

// Pas d'edge : on a besoin du Node runtime pour Brevo fetch + Supabase.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro : 60s

const MAX_EMAILS_PER_RUN = 100
const PG_UNDEFINED_COLUMN = '42703'

type Niveau = 'j7' | 'j15' | 'j30'

interface FactureRow {
  id: string
  user_id: string
  numero: string
  client_id: string | null
  client_email: string | null
  client_nom: string | null
  date_echeance: string | null
  montant_ttc: number | null
  montant_paye: number | null
  statut: string | null
  relance_envoyee_j7: string | null
  relance_envoyee_j15: string | null
  relance_envoyee_j30: string | null
}

interface EntrepriseRow {
  user_id: string
  nom: string | null
  logo_url: string | null
  email: string | null
  relances_auto_actives: boolean | null
}

interface ClientRow {
  id: string
  email: string | null
  civilite: string | null
  prenom: string | null
  nom: string | null
}

function diffDaysFromEcheance(echeanceIso: string): number {
  const echeance = new Date(echeanceIso)
  const now = new Date()
  // Mise a zero des heures pour comparer date a date (timezone Vercel UTC)
  const echeanceMs = Date.UTC(echeance.getUTCFullYear(), echeance.getUTCMonth(), echeance.getUTCDate())
  const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((nowMs - echeanceMs) / (1000 * 60 * 60 * 24))
}

function isUndefinedColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === PG_UNDEFINED_COLUMN
}

function buildClientName(c: ClientRow | null, fallback: string | null): string {
  if (c) {
    const composed = `${c.civilite || ''} ${c.prenom || ''} ${c.nom || ''}`.replace(/\s+/g, ' ').trim()
    if (composed) return composed
  }
  return fallback || 'Client'
}

export async function GET(req: NextRequest) {
  // ---- SECURITE : Authorization Bearer CRON_SECRET --------------------
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[cron relances] Missing Supabase env vars')
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
  }

  // Service role : on doit lire/ecrire les factures de TOUS les users.
  // Justification CLAUDE.md : cron systeme, pas de session utilisateur.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let sent = 0
  let skipped = 0
  const errors: Array<{ factureId?: string; niveau?: Niveau; message: string }> = []

  try {
    // 1) Entreprises avec relances actives.
    //    NULL est considere comme TRUE (defaut).
    let entreprises: EntrepriseRow[] = []
    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('user_id, nom, logo_url, email, relances_auto_actives')
        .or('relances_auto_actives.is.null,relances_auto_actives.eq.true')
      if (error) throw error
      entreprises = (data || []) as EntrepriseRow[]
    } catch (err) {
      // Si la colonne n'existe pas encore en DB (migration pas appliquee) :
      // on retombe sur "toutes les entreprises" (defaut TRUE).
      if (isUndefinedColumnError(err)) {
        console.warn('[cron relances] colonne relances_auto_actives absente, fallback all entreprises')
        const { data, error: e2 } = await supabase
          .from('entreprises')
          .select('user_id, nom, logo_url, email')
        if (e2) throw e2
        entreprises = (data || []).map((e: Record<string, unknown>) => ({
          user_id: e.user_id as string,
          nom: (e.nom as string) ?? null,
          logo_url: (e.logo_url as string) ?? null,
          email: (e.email as string) ?? null,
          relances_auto_actives: null,
        }))
      } else {
        throw err
      }
    }

    // Index entreprise par user_id pour acces O(1)
    const entByUser = new Map<string, EntrepriseRow>()
    entreprises.forEach((e) => { entByUser.set(e.user_id, e) })

    if (entreprises.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: [], message: 'Aucune entreprise eligible' })
    }

    // 2) Factures en retard, non payees, avec email client.
    //    On limite a 200 factures candidates pour rester sous 60s
    //    (100 envois max + marge).
    const userIds = entreprises.map((e) => e.user_id)
    const nowIso = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const { data: facturesRaw, error: facturesErr } = await supabase
      .from('factures')
      .select(
        'id, user_id, numero, client_id, client_email, client_nom, date_echeance, montant_ttc, montant_paye, statut, relance_envoyee_j7, relance_envoyee_j15, relance_envoyee_j30',
      )
      .is('deleted_at', null)
      .in('statut', ['envoyee', 'en_retard'])
      .in('user_id', userIds)
      .lt('date_echeance', nowIso)
      .limit(200)

    if (facturesErr) {
      // Cas migration pas encore appliquee sur factures
      if (isUndefinedColumnError(facturesErr)) {
        console.warn('[cron relances] colonnes relance_envoyee_jX absentes, skip run')
        return NextResponse.json({
          ok: false,
          error: 'Migration relances-auto non appliquee',
          sent: 0,
        }, { status: 200 })
      }
      throw facturesErr
    }

    const factures = (facturesRaw || []) as FactureRow[]

    // 3) Pre-charger les clients (1 requete pour tous)
    const clientIds = Array.from(new Set(factures.map((f) => f.client_id).filter((id): id is string => !!id)))
    const clientsById = new Map<string, ClientRow>()
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, email, civilite, prenom, nom')
        .in('id', clientIds)
      ;(clientsData || []).forEach((c: ClientRow) => clientsById.set(c.id, c))
    }

    // 4) Pour chaque facture, decider du niveau a envoyer
    for (const f of factures) {
      if (sent >= MAX_EMAILS_PER_RUN) {
        skipped += 1
        continue
      }

      // Defense : echeance manquante = on skip
      if (!f.date_echeance) { skipped += 1; continue }

      // Defense : facture deja soldee
      const paye = f.montant_paye ?? 0
      const total = f.montant_ttc ?? 0
      if (total > 0 && paye >= total) { skipped += 1; continue }

      const delta = diffDaysFromEcheance(f.date_echeance)
      if (delta < 7) { skipped += 1; continue }

      // Choisir le plus haut niveau encore non envoye (priorite J+30 > J+15 > J+7)
      let niveau: Niveau | null = null
      if (delta >= 30 && !f.relance_envoyee_j30) niveau = 'j30'
      else if (delta >= 15 && !f.relance_envoyee_j15) niveau = 'j15'
      else if (delta >= 7 && !f.relance_envoyee_j7) niveau = 'j7'

      if (!niveau) { skipped += 1; continue }

      // Resoudre email + nom client
      const clientRow = f.client_id ? clientsById.get(f.client_id) || null : null
      const emailFromFacture = f.client_email
      const emailFromClient = clientRow?.email || null
      const email = emailFromFacture || emailFromClient
      if (!email || !isValidEmail(email)) { skipped += 1; continue }

      const clientNom = buildClientName(clientRow, f.client_nom)

      const entreprise = entByUser.get(f.user_id)
      if (!entreprise) { skipped += 1; continue }

      // 4a) Envoi (avec retry une fois si Brevo 429)
      const factureForMail = {
        id: f.id,
        numero: f.numero,
        montant_ttc: total,
        date_echeance: f.date_echeance,
      }
      const entrepriseForMail = {
        nom: entreprise.nom || undefined,
        logo_url: entreprise.logo_url || undefined,
        email: entreprise.email || undefined,
      }
      const clientForMail = { email, nom: clientNom }

      let success = false
      try {
        if (niveau === 'j30') success = await sendRelanceJ30(factureForMail, entrepriseForMail, clientForMail)
        else if (niveau === 'j15') success = await sendRelanceJ15(factureForMail, entrepriseForMail, clientForMail)
        else success = await sendRelanceJ7(factureForMail, entrepriseForMail, clientForMail)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Send error'
        // Retry simple si 429
        if (/429|rate.?limit/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 1000))
          try {
            if (niveau === 'j30') success = await sendRelanceJ30(factureForMail, entrepriseForMail, clientForMail)
            else if (niveau === 'j15') success = await sendRelanceJ15(factureForMail, entrepriseForMail, clientForMail)
            else success = await sendRelanceJ7(factureForMail, entrepriseForMail, clientForMail)
          } catch (err2) {
            const msg2 = err2 instanceof Error ? err2.message : 'Send error retry'
            errors.push({ factureId: f.id, niveau, message: `retry: ${msg2}` })
            continue
          }
        } else {
          errors.push({ factureId: f.id, niveau, message: msg })
          continue
        }
      }

      if (!success) {
        errors.push({ factureId: f.id, niveau, message: 'send returned false' })
        continue
      }

      // 4b) Tamponner facture + INSERT relances (try/catch isole)
      try {
        const stampCol =
          niveau === 'j7' ? 'relance_envoyee_j7'
          : niveau === 'j15' ? 'relance_envoyee_j15'
          : 'relance_envoyee_j30'

        await supabase
          .from('factures')
          .update({ [stampCol]: new Date().toISOString() })
          .eq('id', f.id)

        const typeRelance =
          niveau === 'j7' ? 'rappel'
          : niveau === 'j15' ? 'ferme'
          : 'mise_en_demeure'

        await supabase.from('relances').insert({
          user_id: f.user_id,
          facture_id: f.id,
          type: typeRelance,
          date_envoi: new Date().toISOString(),
          statut: 'envoyee',
          contenu: `Relance automatique ${niveau.toUpperCase()} envoyee a ${email}`,
        })

        sent += 1
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'DB update error'
        errors.push({ factureId: f.id, niveau, message: `db: ${msg}` })
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, errors, total: factures.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron relances] fatal', err)
    return NextResponse.json({ ok: false, error: msg, sent, skipped, errors }, { status: 500 })
  }
}
