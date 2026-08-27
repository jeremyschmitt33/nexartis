import { NextRequest, NextResponse } from 'next/server'
import { constantTimeEqual } from '@/lib/security/constant-time'
import { createClient } from '@supabase/supabase-js'
import { sendActivationEmail } from '@/lib/email'
import { accesOuvert, joursRestants, type AbonnementEtat } from '@/lib/abonnement'

/**
 * Cron quotidien — sequence d'activation des nouveaux comptes.
 *
 * ------------------------------------------------------------------------
 * POURQUOI (27/08/2026)
 * ------------------------------------------------------------------------
 * Mesure faite sur la base de production ce jour-la : sur 18 comptes,
 *   - 10 ne se sont connectes QU'UN SEUL JOUR (inscription puis plus rien) ;
 *   -  8 n'ont jamais cree le moindre devis ;
 *   -  4 seulement ont depasse deux devis.
 * Le rappel de fin d'essai (cron echeances-abonnement) arrive donc chez des
 * gens qui ont oublie Nexartis depuis une semaine. Le point de rupture est
 * ailleurs : le LENDEMAIN de l'inscription. C'est ce que traite ce cron.
 *
 * ------------------------------------------------------------------------
 * REGLES
 * ------------------------------------------------------------------------
 *   - J+1 : compte cree il y a 1 a 2 jours, AUCUN devis  -> email "premier devis".
 *   - J+3 : compte cree il y a 3 a 5 jours, TOUJOURS aucun devis -> email
 *     "qu'est-ce qui vous a bloque ?", qui invite a repondre.
 *   - Des qu'un devis existe, plus rien n'est envoye : l'utilisateur est active,
 *     c'est le seul signal qui compte.
 *   - Uniquement les comptes dont l'acces est encore ouvert (inutile de pousser
 *     a creer un devis quelqu'un qui est deja bloque : c'est le cron
 *     echeances-abonnement qui lui parle).
 *   - Fenetres larges (1-2 j, 3-5 j) pour absorber une execution manquee.
 *
 * Idempotence : colonnes activation_j1_envoye_le / activation_j3_envoye_le
 * (migration `activation_nouveaux_comptes`). Tampon pose apres envoi reussi.
 *
 * Securite : CRON_SECRET via header Authorization: Bearer ...
 * Planifie via vercel.json -> "0 7 * * *".
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_EMAILS = 100

type EntrepriseRow = {
  id: string
  user_id: string
  nom: string | null
  email: string | null
  logo_url: string | null
  abonnement_type: string | null
  trial_started_at: string | null
  abonnement_expire_at: string | null
  created_at: string | null
  stripe_subscription_id: string | null
  activation_j1_envoye_le: string | null
  activation_j3_envoye_le: string | null
}

/** Jours entiers ecoules depuis une date ISO. */
function joursDepuis(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
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

  // On ne balaie que les comptes recents : au-dela de 6 jours, la sequence
  // d'activation n'a plus lieu d'etre (c'est l'echeance qui prend le relais).
  const depuis = new Date(Date.now() - 6 * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('entreprises')
    .select(
      'id, user_id, nom, email, logo_url, abonnement_type, trial_started_at, abonnement_expire_at, created_at, stripe_subscription_id, activation_j1_envoye_le, activation_j3_envoye_le',
    )
    .gte('created_at', depuis)

  if (error) {
    console.error('[cron/activation] select error:', error.message)
    return NextResponse.json({ ok: false, error: 'select_failed' }, { status: 200 })
  }

  const lignes = (data ?? []) as EntrepriseRow[]
  let envoyes = 0
  let ignores = 0
  const echecs: string[] = []

  for (const ent of lignes) {
    if (envoyes >= MAX_EMAILS) break
    if (!ent.email) { ignores++; continue }

    const age = joursDepuis(ent.created_at)
    if (age === null) { ignores++; continue }

    // Quelle etape ce compte attend-il, d'apres son age et ses tampons ?
    let etape: 1 | 3 | null = null
    if (age >= 1 && age <= 2 && !ent.activation_j1_envoye_le) etape = 1
    else if (age >= 3 && age <= 5 && !ent.activation_j3_envoye_le) etape = 3

    if (etape === null) { ignores++; continue }

    // Acces deja ferme : c'est le cron echeances-abonnement qui lui parle.
    const etat = ent as unknown as AbonnementEtat
    if (!accesOuvert(etat)) { ignores++; continue }

    // LE signal d'activation : a-t-il cree un devis ? Si oui, on se tait.
    const { count, error: devisErr } = await supabase
      .from('devis')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ent.user_id)

    if (devisErr) {
      console.error(`[cron/activation] comptage devis KO pour ${ent.id}:`, devisErr.message)
      ignores++
      continue
    }
    if ((count ?? 0) > 0) { ignores++; continue }

    const ok = await sendActivationEmail({
      to: { email: ent.email, name: ent.nom || undefined },
      entrepriseNom: ent.nom,
      logoUrl: ent.logo_url,
      etape,
      joursEssaiRestants: joursRestants(etat),
    })

    if (!ok) { echecs.push(ent.id); continue }

    const champ = etape === 1 ? 'activation_j1_envoye_le' : 'activation_j3_envoye_le'
    const { error: updErr } = await supabase
      .from('entreprises')
      .update({ [champ]: new Date().toISOString() })
      .eq('id', ent.id)

    if (updErr) {
      console.error(`[cron/activation] tampon non ecrit pour ${ent.id}:`, updErr.message)
      echecs.push(ent.id)
    }

    envoyes++
  }

  console.log(`[cron/activation] ${envoyes} email(s), ${ignores} ignore(s), ${echecs.length} echec(s)`)

  return NextResponse.json({
    ok: true,
    examines: lignes.length,
    envoyes,
    ignores,
    echecs: echecs.length,
  })
}
