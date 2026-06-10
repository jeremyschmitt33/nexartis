import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cron quotidien — suggestions automatiques de rappels.
 *
 * Pour chaque utilisateur, ce cron parcourt l'etat metier (entreprise,
 * factures, devis) et cree des rappels dans la table `rappels` si certaines
 * conditions sont remplies, sans creer de doublon avec un rappel actif
 * deja existant pour la meme source/lien.
 *
 * Sources auto-generees :
 *  - `auto_decennale`         : garantie decennale qui expire dans <60 jours
 *  - `auto_facture_relance`   : facture envoyee/en_retard impayee depuis >30 jours
 *  - `auto_devis_a_planifier` : devis signe depuis >7 jours sans chantier associe
 *
 * Defensive :
 *  - retourne { ok: false, error: 'rappels_not_migrated' } si la table rappels n'existe pas
 *  - idempotent : ne cree pas un nouveau rappel si un rappel actif identique existe deja
 *  - protege par CRON_SECRET (header Authorization: Bearer ...)
 *
 * Planifie via vercel.json -> "0 7 * * *" (chaque jour a 7h UTC).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type EntrepriseRow = {
  user_id: string
  decennale_date_fin: string | null
}

type FactureRow = {
  id: string
  user_id: string
  numero: string | null
  montant_ttc: number | null
  date_emission: string | null
  client_id: string | null
}

type DevisRow = {
  id: string
  user_id: string
  numero: string | null
  date_signature: string | null
  client_id: string | null
  chantier_id: string | null
}

type RappelInsert = {
  user_id: string
  titre: string
  description?: string | null
  due_date: string
  priorite: 'basse' | 'normale' | 'haute' | 'urgente'
  source: string
  lien_facture_id?: string | null
  lien_devis_id?: string | null
  lien_client_id?: string | null
}

/**
 * Verifie qu'un rappel actif identique n'existe pas deja, sinon insere.
 * Retourne true si insertion effectuee.
 */
async function insertIfMissing(
  supabase: SupabaseClient,
  rappel: RappelInsert,
  match: { source: string; lien_facture_id?: string | null; lien_devis_id?: string | null },
): Promise<boolean> {
  let query = supabase
    .from('rappels')
    .select('id')
    .eq('user_id', rappel.user_id)
    .eq('source', match.source)
    .eq('statut', 'actif')
    .is('deleted_at', null)
    .limit(1)

  if (match.lien_facture_id) {
    query = query.eq('lien_facture_id', match.lien_facture_id)
  }
  if (match.lien_devis_id) {
    query = query.eq('lien_devis_id', match.lien_devis_id)
  }

  const { data: existing, error: selectErr } = await query
  if (selectErr) {
    console.error('[rappels-suggestions] select existing failed', selectErr.message)
    return false
  }
  if (existing && existing.length > 0) return false

  const { error: insertErr } = await supabase.from('rappels').insert(rappel)
  if (insertErr) {
    console.error('[rappels-suggestions] insert failed', insertErr.message, rappel.source)
    return false
  }
  return true
}

export async function GET(req: NextRequest) {
  // Securite : tout appel sans le bon CRON_SECRET est rejete.
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'missing_supabase_env' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Defensive : si la table `rappels` n'a pas encore ete migree,
  // on ne plante pas (deploiement progressif).
  const { error: probeErr } = await supabase
    .from('rappels')
    .select('id', { count: 'exact', head: true })
    .limit(1)
  if (probeErr) {
    const msg = probeErr.message || ''
    if (msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('does not exist')) {
      return NextResponse.json({ ok: false, error: 'rappels_not_migrated' }, { status: 200 })
    }
    return NextResponse.json({ ok: false, error: 'probe_failed', detail: msg }, { status: 500 })
  }

  const start = Date.now()
  const today = new Date()
  const todayIso = today.toISOString()
  const todayDate = todayIso.slice(0, 10)
  const in60daysDate = new Date(today.getTime() + 60 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  const thirtyDaysAgoIso = new Date(today.getTime() - 30 * 24 * 3600 * 1000).toISOString()
  const sevenDaysAgoIso = new Date(today.getTime() - 7 * 24 * 3600 * 1000).toISOString()

  const counters = {
    decennale: 0,
    facture_relance: 0,
    devis_a_planifier: 0,
  }
  const errors: string[] = []

  // ====================================================================
  // 1. Garantie decennale qui expire dans <60 jours
  // ====================================================================
  try {
    const { data, error } = await supabase
      .from('entreprises')
      .select('user_id, decennale_date_fin')
      .not('decennale_date_fin', 'is', null)
      .gte('decennale_date_fin', todayDate)
      .lte('decennale_date_fin', in60daysDate)

    if (error) {
      // Colonne pas encore migree -> on saute proprement
      if ((error.message || '').toLowerCase().includes('decennale_date_fin')) {
        errors.push('decennale_date_fin column missing — migration to run')
      } else {
        errors.push(`entreprises: ${error.message}`)
      }
    } else if (data) {
      const entreprises = data as EntrepriseRow[]
      for (const e of entreprises) {
        if (!e.decennale_date_fin) continue
        const dueMs = new Date(e.decennale_date_fin).getTime() - today.getTime()
        const daysLeft = Math.max(0, Math.ceil(dueMs / (24 * 3600 * 1000)))
        const inserted = await insertIfMissing(
          supabase,
          {
            user_id: e.user_id,
            titre: `Renouveler votre décennale (expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''})`,
            description: 'Votre garantie décennale arrive à échéance. Contactez votre assureur pour la renouveler.',
            due_date: e.decennale_date_fin,
            priorite: daysLeft < 30 ? 'haute' : 'normale',
            source: 'auto_decennale',
          },
          { source: 'auto_decennale' },
        )
        if (inserted) counters.decennale++
      }
    }
  } catch (e) {
    errors.push(`decennale block: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ====================================================================
  // 2. Factures envoyees impayees depuis >30 jours
  //    (la table factures n'a pas de date_envoi -> on utilise date_emission
  //    qui est equivalente cote metier : c'est la date a partir de laquelle
  //    le delai de paiement court).
  // ====================================================================
  try {
    const { data, error } = await supabase
      .from('factures')
      .select('id, user_id, numero, montant_ttc, date_emission, client_id')
      .in('statut', ['envoyee', 'en_retard', 'partiellement_payee'])
      .lt('date_emission', thirtyDaysAgoIso)
      .is('deleted_at', null)

    if (error) {
      errors.push(`factures: ${error.message}`)
    } else if (data) {
      const factures = data as FactureRow[]
      for (const f of factures) {
        const montantStr =
          typeof f.montant_ttc === 'number'
            ? `${f.montant_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC`
            : '?'
        const inserted = await insertIfMissing(
          supabase,
          {
            user_id: f.user_id,
            titre: `Relancer la facture ${f.numero || '(sans numéro)'} (impayée)`,
            description: `Montant : ${montantStr}. Émise depuis plus de 30 jours.`,
            due_date: todayIso,
            priorite: 'haute',
            source: 'auto_facture_relance',
            lien_facture_id: f.id,
            lien_client_id: f.client_id,
          },
          { source: 'auto_facture_relance', lien_facture_id: f.id },
        )
        if (inserted) counters.facture_relance++
      }
    }
  } catch (e) {
    errors.push(`factures block: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ====================================================================
  // 3. Devis signes depuis >7 jours sans chantier associe
  //    (statut metier = 'signe' dans Nexartis)
  // ====================================================================
  try {
    const { data, error } = await supabase
      .from('devis')
      .select('id, user_id, numero, date_signature, client_id, chantier_id')
      .eq('statut', 'signe')
      .lt('date_signature', sevenDaysAgoIso)
      .is('chantier_id', null)
      .is('deleted_at', null)

    if (error) {
      errors.push(`devis: ${error.message}`)
    } else if (data) {
      const devis = data as DevisRow[]
      for (const d of devis) {
        const inserted = await insertIfMissing(
          supabase,
          {
            user_id: d.user_id,
            titre: `Planifier le chantier du devis ${d.numero || '(sans numéro)'}`,
            description: 'Devis signé mais aucun chantier créé. Pensez à le planifier.',
            due_date: todayIso,
            priorite: 'normale',
            source: 'auto_devis_a_planifier',
            lien_devis_id: d.id,
            lien_client_id: d.client_id,
          },
          { source: 'auto_devis_a_planifier', lien_devis_id: d.id },
        )
        if (inserted) counters.devis_a_planifier++
      }
    }
  } catch (e) {
    errors.push(`devis block: ${e instanceof Error ? e.message : String(e)}`)
  }

  const durationMs = Date.now() - start
  const createdCount =
    counters.decennale + counters.facture_relance + counters.devis_a_planifier

  // Log structure pour Vercel Logs
  console.log(
    '[rappels-suggestions]',
    JSON.stringify({
      ok: errors.length === 0,
      createdCount,
      counters,
      errors,
      durationMs,
      timestamp: new Date().toISOString(),
    }),
  )

  return NextResponse.json({
    ok: errors.length === 0,
    createdCount,
    counters,
    errors,
    durationMs,
    timestamp: new Date().toISOString(),
  })
}
