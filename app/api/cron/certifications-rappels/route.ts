import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendRappelCertification } from '@/lib/email'

/**
 * Cron quotidien — rappels d'expiration des certifications & assurances.
 *
 * Pour chaque certification non supprimee, calcule le nombre de jours avant
 * `date_expiration` et :
 *   - J-30 (entre 30 et 16 jours) : si rappel_envoye_j30 NULL -> email +
 *     tampon + insertIfMissing rappel (source auto_certif_30, priorite haute).
 *   - J-15 (entre 15 et 0 jours)  : si rappel_envoye_j15 NULL -> email +
 *     tampon + insertIfMissing rappel (source auto_certif_15, priorite urgente).
 *   - Expire (< 0 jour)           : insertIfMissing rappel (source
 *     auto_certif_expire, priorite urgente) SANS nouvel email.
 *   - Autoritaire : apres insertion du bon palier, cloture (deleted_at)
 *     les rappels d'expiration des AUTRES paliers pour cette certif
 *     (evite doublons J-30->J-15 et rappel fantome apres renouvellement).
 *     Si la certif est redevenue valide >30j, cloture les 3 paliers.
 *   - Audit RGE (date_audit dans <= 30 jours, rappel_audit_envoye NULL) :
 *     email + tampon + insertIfMissing (source auto_rge_audit, priorite haute).
 *
 * Defensive :
 *   - retourne ok:false / not_migrated si la table certifications n'existe pas.
 *   - idempotent : insertIfMissing matche user_id+source+lien_certification_id.
 *   - limite 100 emails / execution (anti-pic Brevo).
 *   - retry 1x sur echec d'envoi (rate limit Brevo).
 *
 * Securite : CRON_SECRET via header Authorization: Bearer ...
 * Planifie via vercel.json -> "0 8 * * *".
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type CertifRow = {
  id: string
  user_id: string
  intitule: string | null
  organisme: string | null
  numero: string | null
  date_expiration: string | null
  date_audit: string | null
  rappel_envoye_j30: string | null
  rappel_envoye_j15: string | null
  rappel_audit_envoye: string | null
}

type EntrepriseRow = {
  user_id: string
  nom: string | null
  email: string | null
  logo_url: string | null
}

type RappelInsert = {
  user_id: string
  titre: string
  description?: string | null
  due_date: string
  priorite: 'basse' | 'normale' | 'haute' | 'urgente'
  source: string
  lien_certification_id: string
}

/**
 * Insere un rappel si aucun rappel actif identique n'existe deja
 * (match user_id + source + lien_certification_id). Retourne true si insere.
 */
async function insertIfMissing(
  supabase: SupabaseClient,
  rappel: RappelInsert,
): Promise<boolean> {
  const { data: existing, error: selErr } = await supabase
    .from('rappels')
    .select('id')
    .eq('user_id', rappel.user_id)
    .eq('source', rappel.source)
    .eq('lien_certification_id', rappel.lien_certification_id)
    .eq('statut', 'actif')
    .is('deleted_at', null)
    .limit(1)

  if (selErr) {
    console.error('[certifications-rappels] select existing failed', selErr.message)
    return false
  }
  if (existing && existing.length > 0) return false

  const { error: insErr } = await supabase.from('rappels').insert(rappel)
  if (insErr) {
    console.error('[certifications-rappels] insert failed', insErr.message, rappel.source)
    return false
  }
  return true
}

/** Envoi email avec 1 retry sur echec (le helper avale l'erreur -> on retente). */
async function sendWithRetry(params: Parameters<typeof sendRappelCertification>[0]): Promise<boolean> {
  const ok = await sendRappelCertification(params)
  if (ok) return true
  await new Promise((r) => setTimeout(r, 800))
  return sendRappelCertification(params)
}

/** Jours pleins (UTC) entre aujourd'hui et une date ISO YYYY-MM-DD. */
function joursAvant(dateISO: string, todayUtcMs: number): number {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`)
  const dMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((dMs - todayUtcMs) / (24 * 3600 * 1000))
}

export async function GET(req: NextRequest) {
  // Securite CRON_SECRET
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

  // Defensive : table certifications migree ?
  const { error: probeErr } = await supabase
    .from('certifications')
    .select('id', { count: 'exact', head: true })
    .limit(1)
  if (probeErr) {
    const msg = (probeErr.message || '').toLowerCase()
    if (msg.includes('relation') || msg.includes('does not exist')) {
      return NextResponse.json({ ok: false, error: 'certifications_not_migrated' }, { status: 200 })
    }
    return NextResponse.json({ ok: false, error: 'probe_failed', detail: msg }, { status: 500 })
  }

  const start = Date.now()
  const now = new Date()
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const counters = { j30: 0, j15: 0, expire: 0, audit: 0, clotures: 0 }
  let emailsEnvoyes = 0
  let rappelsCrees = 0
  const errors: string[] = []
  const EMAIL_CAP = 100

  // Charger les certifications non supprimees ayant une date d'expiration.
  const { data: certifsRaw, error: certErr } = await supabase
    .from('certifications')
    .select('id, user_id, intitule, organisme, numero, date_expiration, date_audit, rappel_envoye_j30, rappel_envoye_j15, rappel_audit_envoye')
    .is('deleted_at', null)
    .not('date_expiration', 'is', null)
    .limit(2000)

  if (certErr) {
    return NextResponse.json({ ok: false, error: 'load_failed', detail: certErr.message }, { status: 500 })
  }

  const certifs = (certifsRaw || []) as CertifRow[]

  // Pre-charger les entreprises (email + nom + logo) pour les user_id concernes.
  const userIds = Array.from(new Set(certifs.map((c) => c.user_id)))
  const entMap = new Map<string, EntrepriseRow>()
  if (userIds.length > 0) {
    const { data: entsRaw, error: entErr } = await supabase
      .from('entreprises')
      .select('user_id, nom, email, logo_url')
      .in('user_id', userIds)
    if (entErr) {
      errors.push(`entreprises: ${entErr.message}`)
    } else {
      ;(entsRaw || []).forEach((e: EntrepriseRow) => entMap.set(e.user_id, e))
    }
  }

  for (const c of certifs) {
    const intitule = c.intitule || 'Certification'
    const ent = entMap.get(c.user_id)
    const destEmail = ent?.email || null
    const entNom = ent?.nom || undefined
    const logoUrl = ent?.logo_url || undefined

    // ---- Expiration ----
    if (c.date_expiration) {
      const jours = joursAvant(c.date_expiration, todayUtcMs)

      if (jours < 0) {
        // Expire : pas de nouvel email, juste un rappel (idempotent).
        const inserted = await insertIfMissing(supabase, {
          user_id: c.user_id,
          titre: `${intitule} a expire`,
          description: 'Ce document est expire. Renouvelez-le et mettez a jour la date dans Nexartis.',
          due_date: c.date_expiration,
          priorite: 'urgente',
          source: 'auto_certif_expire',
          lien_certification_id: c.id,
        })
        if (inserted) { rappelsCrees++; counters.expire++ }
      } else if (jours <= 15) {
        // J-15
        if (!c.rappel_envoye_j15) {
          if (destEmail && emailsEnvoyes < EMAIL_CAP) {
            const sent = await sendWithRetry({
              to: { email: destEmail, name: entNom },
              intitule,
              organisme: c.organisme,
              numero: c.numero,
              dateExpiration: c.date_expiration,
              joursRestants: jours,
              entrepriseNom: entNom,
              logoUrl,
            })
            if (sent) {
              emailsEnvoyes++
              await supabase.from('certifications').update({ rappel_envoye_j15: new Date().toISOString() }).eq('id', c.id)
            }
          }
          const inserted = await insertIfMissing(supabase, {
            user_id: c.user_id,
            titre: `${intitule} expire dans ${jours} jour${jours > 1 ? 's' : ''}`,
            description: 'Pensez a renouveler ce document pour rester couvert et conforme.',
            due_date: c.date_expiration,
            priorite: 'urgente',
            source: 'auto_certif_15',
            lien_certification_id: c.id,
          })
          if (inserted) rappelsCrees++
          counters.j15++
        }
      } else if (jours <= 30) {
        // J-30
        if (!c.rappel_envoye_j30) {
          if (destEmail && emailsEnvoyes < EMAIL_CAP) {
            const sent = await sendWithRetry({
              to: { email: destEmail, name: entNom },
              intitule,
              organisme: c.organisme,
              numero: c.numero,
              dateExpiration: c.date_expiration,
              joursRestants: jours,
              entrepriseNom: entNom,
              logoUrl,
            })
            if (sent) {
              emailsEnvoyes++
              await supabase.from('certifications').update({ rappel_envoye_j30: new Date().toISOString() }).eq('id', c.id)
            }
          }
          const inserted = await insertIfMissing(supabase, {
            user_id: c.user_id,
            titre: `${intitule} expire dans ${jours} jours`,
            description: 'C est le bon moment pour preparer le renouvellement.',
            due_date: c.date_expiration,
            priorite: 'haute',
            source: 'auto_certif_30',
            lien_certification_id: c.id,
          })
          if (inserted) rappelsCrees++
          counters.j30++
        }
      }

      // ---- Cron autoritaire : cloturer les paliers d'expiration obsoletes ----
      // Determine la SOURCE CIBLE selon le nombre de jours restants.
      const joursClot = joursAvant(c.date_expiration, todayUtcMs)
      let sourceCible: string | null
      if (joursClot < 0) sourceCible = 'auto_certif_expire'
      else if (joursClot <= 15) sourceCible = 'auto_certif_15'
      else if (joursClot <= 30) sourceCible = 'auto_certif_30'
      else sourceCible = null // certif valide > 30j : aucun palier actif

      const sourcesExpiration = ['auto_certif_30', 'auto_certif_15', 'auto_certif_expire']
      const sourcesACloturer = sourcesExpiration.filter((src) => src !== sourceCible)
      if (sourcesACloturer.length > 0) {
        const { data: clotData, error: clotErr } = await supabase
          .from('rappels')
          .update({ deleted_at: new Date().toISOString() })
          .eq('user_id', c.user_id)
          .eq('lien_certification_id', c.id)
          .in('source', sourcesACloturer)
          .eq('statut', 'actif')
          .is('deleted_at', null)
          .select('id')
        if (clotErr) {
          errors.push(`cloture ${c.id}: ${clotErr.message}`)
        } else if (clotData && clotData.length > 0) {
          counters.clotures += clotData.length
        }
      }
    }

    // ---- Audit intermediaire RGE ----
    if (c.date_audit && !c.rappel_audit_envoye) {
      const joursAudit = joursAvant(c.date_audit, todayUtcMs)
      if (joursAudit <= 30) {
        const auditFmt = new Date(`${c.date_audit.slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
        })
        if (destEmail && emailsEnvoyes < EMAIL_CAP) {
          // On reutilise l'email certif en passant l'echeance d'audit comme date.
          const sent = await sendWithRetry({
            to: { email: destEmail, name: entNom },
            intitule: `Audit intermediaire RGE - ${intitule}`,
            organisme: c.organisme,
            numero: c.numero,
            dateExpiration: c.date_audit,
            joursRestants: Math.max(0, joursAudit),
            entrepriseNom: entNom,
            logoUrl,
          })
          if (sent) {
            emailsEnvoyes++
            await supabase.from('certifications').update({ rappel_audit_envoye: new Date().toISOString() }).eq('id', c.id)
          }
        }
        const inserted = await insertIfMissing(supabase, {
          user_id: c.user_id,
          titre: `Audit intermediaire RGE a faire avant le ${auditFmt}`,
          description: `Votre certification ${intitule} impose un audit intermediaire. Planifiez-le pour ne pas perdre le label RGE.`,
          due_date: c.date_audit,
          priorite: 'haute',
          source: 'auto_rge_audit',
          lien_certification_id: c.id,
        })
        if (inserted) { rappelsCrees++; counters.audit++ }
      }
    }
  }

  const durationMs = Date.now() - start
  console.log(
    '[certifications-rappels]',
    JSON.stringify({
      ok: errors.length === 0,
      emailsEnvoyes,
      rappelsCrees,
      counters,
      certifsScanned: certifs.length,
      errors,
      durationMs,
      timestamp: new Date().toISOString(),
    }),
  )

  return NextResponse.json({
    ok: errors.length === 0,
    emailsEnvoyes,
    rappelsCrees,
    counters,
    errors,
    durationMs,
    timestamp: new Date().toISOString(),
  })
}
