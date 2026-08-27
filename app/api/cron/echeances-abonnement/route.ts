import { NextRequest, NextResponse } from 'next/server'
import { constantTimeEqual } from '@/lib/security/constant-time'
import { createClient } from '@supabase/supabase-js'
import { sendRappelEcheance, type EtapeRappel, type MotifEcheance } from '@/lib/email'
import { accesOuvert, joursRestants, TRIAL_DAYS, type AbonnementEtat } from '@/lib/abonnement'

/**
 * Cron quotidien — rappels avant la fin d'un essai ou d'un acces offert.
 *
 * ------------------------------------------------------------------------
 * POURQUOI (27/08/2026)
 * ------------------------------------------------------------------------
 * Aucun email n'avertissait l'utilisateur : l'essai de 14 jours et les mois
 * offerts se terminaient en silence. L'artisan decouvrait la coupure en
 * ouvrant Nexartis un matin, sans comprendre pourquoi, et sans avoir eu la
 * moindre occasion de s'abonner avant. C'est le plus gros trou de conversion
 * identifie sur le parcours abonnement.
 *
 * ------------------------------------------------------------------------
 * QUI EST CONCERNE
 * ------------------------------------------------------------------------
 *   - les comptes en essai ('trial') ;
 *   - les comptes passes en 'actif' par geste commercial, c'est-a-dire SANS
 *     stripe_subscription_id (un vrai abonne Stripe se renouvele tout seul :
 *     on ne lui envoie evidemment rien).
 *
 * Trois etapes, dans cet ordre : J-7, dernier jour, puis acces termine.
 *
 * ------------------------------------------------------------------------
 * IDEMPOTENCE
 * ------------------------------------------------------------------------
 * Deux colonnes (migration `rappels_echeance_abonnement`) :
 *   - rappel_echeance_cible : la date de fin visee par le dernier envoi ;
 *   - rappel_echeance_etape : 0 / 7 / 1 / -1.
 * Memoriser la CIBLE et pas seulement l'etape est ce qui rend le cycle
 * reentrant : offrir un nouveau mois deplace l'echeance, donc la cible change,
 * donc les rappels repartent de zero sans aucune intervention manuelle.
 * On n'avance jamais a reculons (rang croissant), et on ne pose le tampon
 * qu'apres un envoi reussi.
 *
 * Securite : CRON_SECRET via header Authorization: Bearer ...
 * Planifie via vercel.json -> "0 8 * * *" (meme heure que les autres rappels).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Plafond d'envois par execution (anti-pic Brevo). */
const MAX_EMAILS = 100

type EntrepriseRow = {
  id: string
  nom: string | null
  email: string | null
  logo_url: string | null
  abonnement_type: string | null
  trial_started_at: string | null
  abonnement_expire_at: string | null
  created_at: string | null
  stripe_subscription_id: string | null
  resiliation_prevue_le: string | null
  rappel_echeance_cible: string | null
  rappel_echeance_etape: number | null
}

/** Rang de progression : on n'envoie jamais une etape deja depassee. */
function rang(etape: number): number {
  if (etape === 7) return 1
  if (etape === 1) return 2
  if (etape === -1) return 3
  return 0
}

/** Date de fin d'acces effective, ou null si le compte n'a pas d'echeance. */
function dateFinAcces(e: EntrepriseRow): Date | null {
  const type = e.abonnement_type ?? 'trial'
  if (type === 'trial') {
    const debut = e.trial_started_at ?? e.created_at
    if (!debut) return null
    const d = new Date(debut)
    if (Number.isNaN(d.getTime())) return null
    return new Date(d.getTime() + TRIAL_DAYS * 86_400_000)
  }
  if (type === 'actif') {
    if (!e.abonnement_expire_at) return null
    const d = new Date(e.abonnement_expire_at)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || !constantTimeEqual(authHeader || '', expected)) {
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

  const { data, error } = await supabase
    .from('entreprises')
    .select(
      'id, nom, email, logo_url, abonnement_type, trial_started_at, abonnement_expire_at, created_at, stripe_subscription_id, resiliation_prevue_le, rappel_echeance_cible, rappel_echeance_etape',
    )
    .in('abonnement_type', ['trial', 'actif'])
    .is('stripe_subscription_id', null)

  if (error) {
    // Colonnes de tampon absentes = migration pas encore appliquee : on sort
    // proprement plutot que de renvoyer une 500 a Vercel toutes les 24 h.
    console.error('[cron/echeances] select error:', error.message)
    return NextResponse.json({ ok: false, error: 'select_failed' }, { status: 200 })
  }

  const lignes = (data ?? []) as EntrepriseRow[]
  let envoyes = 0
  let ignores = 0
  const echecs: string[] = []

  for (const ent of lignes) {
    if (envoyes >= MAX_EMAILS) break
    if (!ent.email) { ignores++; continue }

    const fin = dateFinAcces(ent)
    if (!fin) { ignores++; continue }

    const etat = ent as unknown as AbonnementEtat
    const restant = joursRestants(etat)
    const ouvert = accesOuvert(etat)

    // Quelle etape ce compte doit-il recevoir aujourd'hui ?
    let etape: EtapeRappel | null = null
    if (!ouvert) etape = -1
    else if (restant !== null && restant <= 1) etape = 1
    else if (restant !== null && restant <= 7) etape = 7

    if (etape === null) { ignores++; continue }

    // Cle d'idempotence : la date d'echeance visee (jour, sans l'heure).
    const cible = fin.toISOString().slice(0, 10)
    const memeCible = ent.rappel_echeance_cible === cible
    const etapeFaite = memeCible ? (ent.rappel_echeance_etape ?? 0) : 0

    if (rang(etape) <= rang(etapeFaite)) { ignores++; continue }

    const motif: MotifEcheance = (ent.abonnement_type ?? 'trial') === 'trial' ? 'trial' : 'offert'

    const ok = await sendRappelEcheance({
      to: { email: ent.email, name: ent.nom || undefined },
      entrepriseNom: ent.nom,
      logoUrl: ent.logo_url,
      motif,
      etape,
      dateFin: fin.toISOString(),
    })

    if (!ok) {
      echecs.push(ent.id)
      continue
    }

    // Tampon pose UNIQUEMENT apres un envoi reussi : un echec Brevo sera
    // retente demain plutot que perdu silencieusement.
    const { error: updErr } = await supabase
      .from('entreprises')
      .update({ rappel_echeance_cible: cible, rappel_echeance_etape: etape })
      .eq('id', ent.id)

    if (updErr) {
      // L'email est parti mais le tampon n'a pas ete ecrit : on le signale,
      // le compte recevrait sinon le meme rappel demain.
      console.error(`[cron/echeances] tampon non ecrit pour ${ent.id}:`, updErr.message)
      echecs.push(ent.id)
    }

    envoyes++
  }

  console.log(`[cron/echeances] ${envoyes} email(s) envoye(s), ${ignores} ignore(s), ${echecs.length} echec(s)`)

  return NextResponse.json({
    ok: true,
    examines: lignes.length,
    envoyes,
    ignores,
    echecs: echecs.length,
  })
}
