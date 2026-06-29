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
  montant_paye?: number | null
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
  // Fenetre pour relancer un devis ENVOYE proche de sa date de validite :
  // de "expire il y a moins de 30 jours" a "expire dans 7 jours".
  const thirtyDaysAgoDate = thirtyDaysAgoIso.slice(0, 10)
  const in7daysDate = new Date(today.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const counters = {
    decennale: 0,
    facture_relance: 0,
    devis_a_planifier: 0,
    devis_a_relancer: 0,
    // V2.2 10/06/2026 : notif J-1 avant relance auto (filet de securite).
    notif_j1: 0,
  }
  const errors: string[] = []

  // ====================================================================
  // 1. Garantie decennale — cascade 3 paliers (J-60 / J-30 / J-7)
  //    Inspire BTPBip + audit terrain (1 seul rappel J-60 = trop tot pour
  //    un artisan qui n'a pas le temps de comparer assureurs en pleine saison).
  //    On cree DONC jusqu'a 3 rappels distincts par entreprise, avec ton
  //    et priorite croissants. Chaque palier a sa propre source pour
  //    permettre la coexistence dans la table.
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

        // Determine le palier le plus urgent applicable.
        // Plus daysLeft est petit, plus le rappel est prioritaire.
        let palier:
          | { source: string; titre: string; description: string; priorite: 'normale' | 'haute' | 'urgente' }
          | null = null

        if (daysLeft <= 7) {
          palier = {
            source: 'auto_decennale_7',
            titre: `🚨 URGENT : décennale expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
            description:
              "Sans décennale valide, vous ne pouvez plus signer de devis ni démarrer de chantier. Appelez votre assureur aujourd'hui pour assurer la continuité.",
            priorite: 'urgente',
          }
        } else if (daysLeft <= 30) {
          palier = {
            source: 'auto_decennale_30',
            titre: `Décennale expire dans ${daysLeft} jours`,
            description:
              "Votre garantie décennale arrive à échéance d'ici 30 jours. C'est le bon moment pour valider le renouvellement avec votre assureur.",
            priorite: 'haute',
          }
        } else {
          palier = {
            source: 'auto_decennale_60',
            titre: `Renouveler votre décennale (expire dans ${daysLeft} jours)`,
            description:
              'Votre décennale expire dans moins de 2 mois. Comparez les offres et préparez votre renouvellement pour éviter toute rupture de couverture.',
            priorite: 'normale',
          }
        }

        const inserted = await insertIfMissing(
          supabase,
          {
            user_id: e.user_id,
            titre: palier.titre,
            description: palier.description,
            due_date: e.decennale_date_fin,
            priorite: palier.priorite,
            source: palier.source,
          },
          { source: palier.source },
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
      .select('id, user_id, numero, montant_ttc, montant_paye, date_emission, client_id')
      .in('statut', ['envoyee', 'en_retard', 'partiellement_payee'])
      .lt('date_emission', thirtyDaysAgoIso)
      .is('deleted_at', null)

    if (error) {
      errors.push(`factures: ${error.message}`)
    } else if (data) {
      const factures = data as FactureRow[]
      // V-AVOIR : avoirs imputes a ces factures (pour calculer le NET restant du).
      const avoirParFac = new Map<string, number>()
      if (factures.length > 0) {
        try {
          const ids = factures.map((f) => f.id)
          const { data: av } = await supabase
            .from('factures')
            .select('facture_origine_id, montant_ttc')
            .eq('type', 'avoir')
            .is('deleted_at', null)
            .in('facture_origine_id', ids)
          ;(av || []).forEach((a: Record<string, unknown>) => {
            const oid = a.facture_origine_id as string | null
            if (oid) avoirParFac.set(oid, (avoirParFac.get(oid) ?? 0) + Number(a.montant_ttc ?? 0))
          })
        } catch { /* colonnes avoir absentes : net sans avoirs */ }
      }
      for (const f of factures) {
        // V-AVOIR : NET = TTC - paye - avoirs. Pas de rappel si net <= 0.
        const totalF = Number(f.montant_ttc ?? 0)
        const payeF = Number(f.montant_paye ?? 0)
        const avF = avoirParFac.get(f.id) ?? 0
        const netF = totalF - payeF - avF
        if (totalF > 0 && netF <= 0.01) continue
        const montantStr = `${netF.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC`
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

  // ====================================================================
  // 3b. Devis ENVOYÉ proche de sa date de validité sans réponse (rappel auto)
  //     -> rappel pour relancer le client avant (ou juste après) expiration.
  //     Fenêtre : expire dans <=7 jours OU expiré depuis <30 jours.
  // ====================================================================
  try {
    const { data, error } = await supabase
      .from('devis')
      .select('id, user_id, numero, date_validite, client_id')
      .eq('statut', 'envoye')
      .not('date_validite', 'is', null)
      .lte('date_validite', in7daysDate)
      .gte('date_validite', thirtyDaysAgoDate)
      .is('deleted_at', null)

    if (error) {
      errors.push(`devis_relance: ${error.message}`)
    } else if (data) {
      const rows = data as Array<{ id: string; user_id: string; numero: string | null; date_validite: string | null; client_id: string | null }>
      for (const d of rows) {
        const dv = d.date_validite ? new Date(d.date_validite) : null
        const expire = dv ? dv.getTime() < today.getTime() : false
        const dateStr = dv ? dv.toLocaleDateString('fr-FR') : ''
        const inserted = await insertIfMissing(
          supabase,
          {
            user_id: d.user_id,
            titre: expire
              ? `Devis ${d.numero || '(sans numéro)'} expiré sans réponse`
              : `Relancer le devis ${d.numero || '(sans numéro)'} (expire bientôt)`,
            description: expire
              ? `Ce devis a dépassé sa date de validité (${dateStr}) sans être accepté. Relancez le client ou prolongez la validité.`
              : `Ce devis arrive à échéance le ${dateStr}. Un petit rappel au client peut faire la différence.`,
            due_date: todayIso,
            priorite: 'normale',
            source: 'auto_devis_relance',
            lien_devis_id: d.id,
            lien_client_id: d.client_id,
          },
          { source: 'auto_devis_relance', lien_devis_id: d.id },
        )
        if (inserted) counters.devis_a_relancer++
      }
    }
  } catch (e) {
    errors.push(`devis_relance block: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ====================================================================
  // 4. V2.2 10/06/2026 — Notif J-1 avant relance auto (filet de securite)
  // Le cron `relances-auto-factures` tournera demain matin a 09h UTC.
  // On cree un rappel dashboard le matin meme (06h UTC) pour prevenir
  // l'artisan : tel client va recevoir un email demain a 9h, montant X,
  // palier Y. L'artisan peut alors exclure le client ou marquer la
  // facture payee dans les 24h pour annuler l'envoi.
  //
  // Conditions ET-iques :
  //   - relances_auto_actives (entreprise) != FALSE
  //   - pas de pause globale active
  //   - client non exclu (exclu_relances_auto != true)
  //   - facture statut envoyee/en_retard non soldee
  //   - delta jours echeance exactement 6, 14 ou 29 (= relance demain)
  //   - palier correspondant pas encore tamponne
  // ====================================================================
  try {
    const { data: entActives, error: entActivesErr } = await supabase
      .from('entreprises')
      .select('user_id, relances_auto_actives, relances_pause_jusqu_au')
      .or('relances_auto_actives.is.null,relances_auto_actives.eq.true')

    if (entActivesErr) {
      // Colonnes manquantes -> on skip ce bloc, pas un blocker
      if (!(entActivesErr.code === '42703' || (entActivesErr.message || '').includes('relances_auto_actives'))) {
        errors.push(`notif-j1 entreprises: ${entActivesErr.message}`)
      }
    } else if (entActives) {
      type EntActif = { user_id: string; relances_auto_actives: boolean | null; relances_pause_jusqu_au: string | null }
      const userIdsActifs = (entActives as EntActif[])
        .filter((e) => !e.relances_pause_jusqu_au || e.relances_pause_jusqu_au < todayDate)
        .map((e) => e.user_id)

      if (userIdsActifs.length > 0) {
        const ago30Date = new Date(today.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
        const { data: facsRaw, error: facsErr } = await supabase
          .from('factures')
          .select('id, user_id, numero, client_id, client_nom, date_echeance, montant_ttc, montant_paye, relance_envoyee_j7, relance_envoyee_j15, relance_envoyee_j30')
          .in('statut', ['envoyee', 'en_retard', 'partiellement_payee'])
          .in('user_id', userIdsActifs)
          .is('deleted_at', null)
          .gte('date_echeance', ago30Date)
          .lt('date_echeance', todayDate)
          .limit(300)

        if (facsErr) {
          // Colonnes relance_envoyee_jX absentes -> skip
          if (facsErr.code !== '42703') {
            errors.push(`notif-j1 factures: ${facsErr.message}`)
          }
        } else if (facsRaw) {
          type NotifFac = {
            id: string
            user_id: string
            numero: string | null
            client_id: string | null
            client_nom: string | null
            date_echeance: string
            montant_ttc: number | null
            montant_paye: number | null
            relance_envoyee_j7: string | null
            relance_envoyee_j15: string | null
            relance_envoyee_j30: string | null
          }
          const facs = facsRaw as NotifFac[]

          // Pre-charger les clients exclus (skip)
          const clientIds = Array.from(new Set(facs.map((f) => f.client_id).filter((id): id is string => !!id)))
          const exclusSet = new Set<string>()
          if (clientIds.length > 0) {
            try {
              const { data: clsRaw } = await supabase
                .from('clients')
                .select('id, exclu_relances_auto')
                .in('id', clientIds)
              ;(clsRaw || []).forEach((c: { id: string; exclu_relances_auto: boolean | null }) => {
                if (c.exclu_relances_auto === true) exclusSet.add(c.id)
              })
            } catch (_e) {
              // Colonne exclu_relances_auto absente : on traite tout client
            }
          }

          // V-AVOIR : avoirs imputes a ces factures (NET = TTC - paye - avoirs).
          const avoirMapJ1 = new Map<string, number>()
          if (facs.length > 0) {
            try {
              const fIds = facs.map((f) => f.id)
              const { data: avJ1 } = await supabase
                .from('factures')
                .select('facture_origine_id, montant_ttc')
                .eq('type', 'avoir')
                .is('deleted_at', null)
                .in('facture_origine_id', fIds)
              ;(avJ1 || []).forEach((a: Record<string, unknown>) => {
                const oid = a.facture_origine_id as string | null
                if (oid) avoirMapJ1.set(oid, (avoirMapJ1.get(oid) ?? 0) + Number(a.montant_ttc ?? 0))
              })
            } catch { /* colonnes avoir absentes : net sans avoirs */ }
          }

          const todayUtcMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
          for (const f of facs) {
            if (f.client_id && exclusSet.has(f.client_id)) continue
            const paye = f.montant_paye ?? 0
            const total = f.montant_ttc ?? 0
            // V-AVOIR : pas de notif J-1 si le net (avoirs deduits) est <= 0.
            const avJ1 = avoirMapJ1.get(f.id) ?? 0
            if (total > 0 && (paye + avJ1) >= total - 0.01) continue

            const ech = new Date(f.date_echeance)
            const echMs = Date.UTC(ech.getUTCFullYear(), ech.getUTCMonth(), ech.getUTCDate())
            const delta = Math.floor((todayUtcMs - echMs) / (24 * 3600 * 1000))

            let palier: 'j7' | 'j15' | 'j30' | null = null
            if (delta === 29 && !f.relance_envoyee_j30) palier = 'j30'
            else if (delta === 14 && !f.relance_envoyee_j15) palier = 'j15'
            else if (delta === 6 && !f.relance_envoyee_j7) palier = 'j7'

            if (!palier) continue

            const palierLabel = palier === 'j7' ? 'courtoise (J+7)' : palier === 'j15' ? 'ferme (J+15)' : 'stricte (J+30)'
            // V-AVOIR : on affiche le NET restant du (avoirs + acomptes deduits),
            // pas le TTC brut, pour ne pas relancer sur un montant deja credite.
            const netDu = Math.max(0, total - paye - avJ1)
            const montantStr = `${netDu.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
            const clientLabel = f.client_nom || '(client sans nom)'

            const inserted = await insertIfMissing(
              supabase,
              {
                user_id: f.user_id,
                titre: `Demain matin : relance ${palierLabel} à ${clientLabel}`,
                description: `Facture ${f.numero || '(sans numéro)'} — ${montantStr}. Pour annuler l'envoi : excluez ce client des relances auto ou marquez la facture payée d'ici demain 9h.`,
                due_date: todayIso,
                priorite: palier === 'j30' ? 'haute' : 'normale',
                source: `auto_notif_j1_${palier}`,
                lien_facture_id: f.id,
                lien_client_id: f.client_id,
              },
              { source: `auto_notif_j1_${palier}`, lien_facture_id: f.id },
            )
            if (inserted) counters.notif_j1++
          }
        }
      }
    }
  } catch (e) {
    errors.push(`notif-j1 block: ${e instanceof Error ? e.message : String(e)}`)
  }

  const durationMs = Date.now() - start
  const createdCount =
    counters.decennale + counters.facture_relance + counters.devis_a_planifier + counters.devis_a_relancer + counters.notif_j1

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
