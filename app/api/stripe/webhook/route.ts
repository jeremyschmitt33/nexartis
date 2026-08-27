import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getInvoiceSubscriptionId } from '@/lib/parrainage-recompense'
import { planFromStripePriceId } from '@/lib/plans'

// ---------------------------------------------------------------------------
// Helpers ajoutes le 27/08/2026 (audit Stripe)
// ---------------------------------------------------------------------------

/**
 * Fin de la periode en cours d'une souscription, en millisecondes.
 *
 * ⚠️ POURQUOI CE HELPER EXISTE — bug corrige le 27/08/2026 :
 * le projet est epingle sur l'API Stripe '2026-03-25.dahlia' (lib/stripe.ts).
 * Dans cette version, `current_period_end` N'EXISTE PLUS sur l'objet
 * Subscription : il a ete deplace sur chaque SubscriptionItem.
 * L'ancien code faisait `new Date(subscription.current_period_end * 1000)`
 * => undefined * 1000 = NaN => `new Date(NaN).toISOString()` LEVE une
 * RangeError, avant meme l'ecriture en base. Consequence : le handler
 * `customer.subscription.deleted` plantait a chaque resiliation, l'abonnement
 * restait 'actif' avec son stripe_subscription_id, et le client gardait un
 * acces complet a vie sans plus jamais payer.
 *
 * On lit donc les items d'abord, puis les dates de fin de la souscription
 * elle-meme, et on ne renvoie JAMAIS NaN.
 */
function finDePeriodeMs(subscription: Stripe.Subscription): number {
  const sub = subscription as unknown as {
    items?: { data?: Array<{ current_period_end?: number | null }> }
    current_period_end?: number | null
    ended_at?: number | null
    cancel_at?: number | null
  }
  const candidats = [
    sub.items?.data?.[0]?.current_period_end,
    sub.current_period_end, // anciennes versions d'API : on reste tolerant
    sub.ended_at,
    sub.cancel_at,
  ]
  for (const ts of candidats) {
    if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) return ts * 1000
  }
  // Dernier recours : maintenant. Mieux vaut couper l'acces aujourd'hui que
  // planter et laisser un abonnement resilie ouvert indefiniment.
  return Date.now()
}

/**
 * Revoque l'acces d'un client apres un remboursement TOTAL ou un litige
 * bancaire (chargeback).
 *
 * Ajoute le 27/08/2026 : `charge.refunded` et `charge.dispute.created` ne
 * servaient qu'a annuler une recompense de parrainage. L'acces au logiciel,
 * lui, restait complet. Autrement dit : payer, contester le paiement aupres de
 * sa banque, recuperer son argent, et continuer a utiliser Nexartis.
 *
 * On suspend immediatement (abonnement_expire_at = null) et on trace le motif
 * dans les notes admin. C'est reversible en un clic depuis le back-office si
 * le litige se resout en votre faveur.
 *
 * eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
async function revoquerAcces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  customerId: string | null,
  motif: 'remboursement total' | 'litige bancaire',
): Promise<void> {
  if (!customerId) return

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('id, notes_admin')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!entreprise) return

  const stamp = new Date().toLocaleDateString('fr-FR')
  const note = `[Auto] Acces suspendu le ${stamp} — ${motif}`
  const notes = entreprise.notes_admin ? `${entreprise.notes_admin}\n${note}` : note

  await supabase
    .from('entreprises')
    .update({
      abonnement_type: 'suspendu',
      abonnement_expire_at: null, // suspension immediate
      stripe_subscription_id: null,
      resiliation_prevue_le: null,
      notes_admin: notes.length > 500 ? notes.slice(-500) : notes,
    })
    .eq('id', entreprise.id)

  console.warn(`[Stripe] Acces revoque pour entreprise ${entreprise.id} — ${motif}`)
}

/** Offre (essential/complete) portee par la souscription, ou null si inconnue. */
function planDeLaSouscription(subscription: Stripe.Subscription): 'essential' | 'complete' | null {
  const sub = subscription as unknown as {
    items?: { data?: Array<{ price?: { id?: string | null } | null }> }
  }
  return planFromStripePriceId(sub.items?.data?.[0]?.price?.id)
}

/**
 * POST /api/stripe/webhook
 *
 * Recoit les evenements Stripe (paiement reussi, annulation, etc.).
 *
 * SECURITE :
 * - Cette route ne doit PAS verifier l'auth utilisateur, elle verifie
 *   la SIGNATURE Stripe a la place (stripe.webhooks.constructEvent).
 * - La signature use le RAW body, pas le JSON parse : on lit req.text()
 *   AVANT toute autre operation.
 *
 * IDEMPOTENCE (P9 audit) :
 * - Stripe rejoue les events en cas de timeout ou d'erreur 5xx renvoyee
 *   par notre endpoint. Sans protection, on traiterait 2x le meme event
 *   -> double activation d'abonnement, doublons en DB, etc.
 * - On s'appuie sur la table public.stripe_webhook_events (cf migration
 *   sql/create-stripe-webhook-events.sql) :
 *     1. INSERT ON CONFLICT DO NOTHING (event_id = PK = unique cote Stripe)
 *     2. Si l'event est deja processed_ok = true -> return 200 sans rien faire
 *     3. Sinon on traite normalement, puis UPDATE processed_ok = true
 *     4. En cas d'erreur dans le traitement, on stocke error_message mais on
 *        laisse processed_ok = false -> Stripe retentera, et la prochaine
 *        tentative repassera dans le handler.
 *
 * PURGE :
 * - Voir sql/create-stripe-webhook-events.sql pour la requete de purge a 90j.
 *   A executer ponctuellement ou via pg_cron.
 */
export async function POST(req: NextRequest) {
  // 1. Lire le RAW body AVANT toute autre operation (requis pour la signature)
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET non configure')
    return NextResponse.json({ error: 'Configuration webhook manquante' }, { status: 500 })
  }

  // 2. Verifier la signature Stripe (empeche les faux webhooks)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  // 3. Client Supabase admin (service role) pour la DB
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 4. IDEMPOTENCE - Insert + check de l'etat actuel
  //    On utilise upsert avec ignoreDuplicates pour ne PAS ecraser un eventuel
  //    enregistrement processed_ok = true qui existerait deja.
  const { error: insertErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  // Code 23505 = unique_violation = doublon attendu en cas de rejeu
  if (insertErr && insertErr.code !== '23505') {
    console.error('[Stripe webhook] insert idempotence failed:', insertErr)
    // On echoue volontairement (500) pour que Stripe retente. C'est moins
    // grave de retenter qu'on rate la trace d'idempotence.
    return NextResponse.json({ error: 'Erreur idempotence' }, { status: 500 })
  }

  // Lire l'etat actuel pour savoir si on doit (re)traiter
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('processed_ok')
    .eq('event_id', event.id)
    .single()

  if (existing?.processed_ok) {
    console.log(`[Stripe webhook] event ${event.id} (${event.type}) deja traite, ignore (rejeu)`)
    return NextResponse.json({ received: true, idempotent: true })
  }

  // 5. Traiter l'event
  try {
    switch (event.type) {
      // === PAIEMENT REUSSI ===
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const entrepriseId = session.metadata?.nexartis_entreprise_id
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription)?.id

        // Plan choisi a la souscription (essential/complete). Defaut 'complete'
        // si absent ou valeur inattendue (retrocompatibilite + securite).
        const planChoisi = session.metadata?.nexartis_plan
        const subscriptionPlan = (planChoisi === 'essential' || planChoisi === 'complete') ? planChoisi : 'complete'

        // 27/08/2026 — on n'active QUE si le paiement est reellement encaisse.
        // Avant, un checkout complete mais dont l'authentification 3-D Secure
        // echouait ensuite (souscription 'incomplete') donnait un acces complet
        // permanent sans un centime encaisse.
        // 'no_payment_required' couvre les cas 100 % remise / essai Stripe.
        const paiementOk = session.payment_status === 'paid'
          || session.payment_status === 'no_payment_required'

        if (entrepriseId && !paiementOk) {
          console.warn(
            `[Stripe] checkout.session.completed IGNORE pour ${entrepriseId} : payment_status=${session.payment_status}`,
          )
        }

        if (entrepriseId && paiementOk) {
          // 27/08/2026 — ne JAMAIS ecraser un identifiant Stripe existant par
          // null : si Stripe renvoie un objet etendu au lieu d'une chaine, on
          // perdrait le lien et tous les evenements suivants (renouvellement,
          // resiliation) ne retrouveraient plus l'entreprise.
          const customerId = typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer | null)?.id ?? null

          const updates: Record<string, unknown> = {
            abonnement_type: 'actif',
            subscription_plan: subscriptionPlan,
            abonnement_expire_at: null,
            // Nouvel abonnement : on efface toute resiliation programmee anterieure
            resiliation_prevue_le: null,
          }
          if (subscriptionId) updates.stripe_subscription_id = subscriptionId
          if (customerId) updates.stripe_customer_id = customerId

          await supabase
            .from('entreprises')
            .update(updates)
            .eq('id', entrepriseId)

          console.log(`[Stripe] Abonnement active pour entreprise ${entrepriseId}`)

          // PARRAINAGE : si ce parrain avait un credit "1 mois offert" en attente
          // (filleul deja recompense alors que le parrain n'etait pas encore abonne),
          // on l'applique a son tout nouvel abonnement. Non bloquant.
          try {
            const { appliquerCreditsParrainEnAttente } = await import('@/lib/parrainage-recompense')
            await appliquerCreditsParrainEnAttente(
              supabase,
              stripe,
              entrepriseId,
              typeof session.customer === 'string' ? session.customer : null,
              session.amount_total ?? null,
              session.currency ?? null,
            )
          } catch (e) {
            console.error('[Stripe] credit parrain en attente echoue:', e)
          }
        }
        break
      }

      // === FACTURE PAYEE (renouvellement mensuel) ===
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = getInvoiceSubscriptionId(invoice)

        if (subscriptionId) {
          let { data: entreprise } = await supabase
            .from('entreprises')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          // 27/08/2026 — RATTRAPAGE. stripe_subscription_id n'est ecrit que par
          // checkout.session.completed. Si cet evenement a ete perdu (500
          // repetes, maintenance, abandon des retries Stripe au bout de ~3
          // jours), le lookup echouait ici a CHAQUE renouvellement : le client
          // etait preleve tous les mois tout en etant redirige vers
          // "abonnement expire", sans aucun moyen de rattrapage automatique.
          // On retombe donc sur le customer Stripe, et on repare le lien.
          if (!entreprise) {
            const customerId = typeof invoice.customer === 'string'
              ? invoice.customer
              : (invoice.customer as Stripe.Customer | null)?.id ?? null
            if (customerId) {
              const { data: parCustomer } = await supabase
                .from('entreprises')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single()
              if (parCustomer) {
                entreprise = parCustomer
                await supabase
                  .from('entreprises')
                  .update({ stripe_subscription_id: subscriptionId })
                  .eq('id', parCustomer.id)
                console.warn(
                  `[Stripe] Lien souscription repare pour entreprise ${parCustomer.id} (${subscriptionId})`,
                )
              }
            }
          }

          if (entreprise) {
            await supabase
              .from('entreprises')
              .update({ abonnement_type: 'actif', resiliation_prevue_le: null })
              .eq('id', entreprise.id)
          }
        }

        // PARRAINAGE : 1er vrai paiement du filleul => 1 mois offert pour les deux.
        // Le traitement est idempotent (compare-and-swap + Idempotency-Key Stripe).
        // On le laisse remonter une erreur eventuelle pour que Stripe rejoue.
        {
          const { traiterRecompenseParrainage } = await import('@/lib/parrainage-recompense')
          await traiterRecompenseParrainage(supabase, stripe, invoice)
        }
        break
      }

      // === PAIEMENT ECHOUE ===
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = getInvoiceSubscriptionId(invoice)

        if (subscriptionId) {
          const { data: entreprise } = await supabase
            .from('entreprises')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (entreprise) {
            // 27/08/2026 — on pose une FIN DE RELANCE (dunning) explicite.
            // Stripe retente le prelevement pendant plusieurs jours (smart
            // retries) : couper l'acces des le premier echec ferait fuir un
            // client dont la carte a simplement expire. On laisse 14 jours,
            // apres quoi lib/abonnement.ts coupera si rien n'a ete paye.
            // (invoice.payment_succeeded remettra 'actif' entre-temps.)
            const finRelance = new Date(Date.now() + 14 * 86_400_000)
            await supabase
              .from('entreprises')
              .update({
                abonnement_expire_at: finRelance.toISOString(),
                notes_admin: `[Auto] Paiement echoue le ${new Date().toLocaleDateString('fr-FR')} — acces maintenu jusqu'au ${finRelance.toLocaleDateString('fr-FR')}`,
              })
              .eq('id', entreprise.id)

            console.warn(`[Stripe] Paiement echoue pour entreprise ${entreprise.id}`)
          }
        }
        break
      }

      // === ABONNEMENT ANNULE ===
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const { data: entreprise } = await supabase
          .from('entreprises')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (entreprise) {
          // 27/08/2026 — passe par finDePeriodeMs() : l'ancien acces direct a
          // subscription.current_period_end donnait NaN sur l'API dahlia et
          // faisait planter tout le handler (cf. commentaire du helper).
          const periodEnd = new Date(finDePeriodeMs(subscription))

          await supabase
            .from('entreprises')
            .update({
              abonnement_type: 'suspendu',
              abonnement_expire_at: periodEnd.toISOString(),
              stripe_subscription_id: null,
              // La resiliation est consommee : l'abonnement est termine
              resiliation_prevue_le: null,
            })
            .eq('id', entreprise.id)

          console.log(`[Stripe] Abonnement annule pour entreprise ${entreprise.id}, acces jusqu'au ${periodEnd.toLocaleDateString('fr-FR')}`)
        }
        break
      }

      // === ABONNEMENT MIS A JOUR ===
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const { data: entreprise } = await supabase
          .from('entreprises')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (entreprise) {
          // 27/08/2026 — mapping EXHAUSTIF. Avant, la valeur par defaut etait
          // 'actif' : les statuts 'incomplete', 'incomplete_expired' et
          // 'paused' retombaient donc sur "abonnement actif" alors qu'aucun
          // paiement n'etait encaisse.
          const status = subscription.status
          let abonnementType: string
          switch (status) {
            case 'active':
            case 'trialing':
              abonnementType = 'actif'
              break
            case 'past_due':
            case 'unpaid':
            case 'canceled':
            case 'incomplete':
            case 'incomplete_expired':
            case 'paused':
              abonnementType = 'suspendu'
              break
            default:
              // Statut inconnu (nouvelle valeur ajoutee par Stripe) : on ne
              // touche a rien plutot que de couper un client qui paie.
              abonnementType = ''
          }

          // RESILIATION PROGRAMMEE (P-admin) : quand le client clique
          // "Annuler l'abonnement" dans le portail Stripe avec l'option
          // "a la fin de la periode", Stripe garde status = 'active' et pose
          // cancel_at_period_end = true. Sans ce bloc, l'app afficherait
          // "Actif" jusqu'au dernier jour et l'admin ne verrait rien.
          const sub = subscription as unknown as {
            cancel_at_period_end?: boolean
            cancel_at?: number | null
            current_period_end?: number | null
          }
          let resiliationPrevueLe: string | null = null
          if (sub.cancel_at_period_end) {
            // finDePeriodeMs gere l'API dahlia (current_period_end deplace sur
            // les items) ; cancel_at reste prioritaire quand il est pose.
            const ts = sub.cancel_at ? sub.cancel_at * 1000 : finDePeriodeMs(subscription)
            resiliationPrevueLe = new Date(ts).toISOString()
          }

          const updates: Record<string, unknown> = { resiliation_prevue_le: resiliationPrevueLe }
          if (abonnementType) updates.abonnement_type = abonnementType

          // 27/08/2026 — l'offre suit le prix Stripe. Sans cela, un client qui
          // passait de Complet a Essentiel depuis le portail payait 15 € tout
          // en gardant planning, equipe, devis vocal et export comptable ;
          // et l'inverse payait 25 € en restant bloque sur l'Essentiel.
          // On n'ecrit rien si le prix ne correspond a aucune offre connue :
          // ne jamais retrograder un client sur une simple inconnue.
          const planSouscrit = planDeLaSouscription(subscription)
          if (planSouscrit) updates.subscription_plan = planSouscrit

          // Un abonnement redevenu sain efface la fin de relance posee par
          // invoice.payment_failed.
          if (abonnementType === 'actif') updates.abonnement_expire_at = null

          await supabase
            .from('entreprises')
            .update(updates)
            .eq('id', entreprise.id)
        }
        break
      }

      // === REMBOURSEMENT (anti-fraude parrainage) ===
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        // On n'annule QUE sur remboursement TOTAL (un remboursement partiel,
        // ex: geste commercial de quelques euros, ne doit pas annuler la recompense).
        const montant = charge.amount ?? 0
        const rembourse = charge.amount_refunded ?? 0
        const remboursementTotal = montant > 0 && rembourse >= montant
        const invoiceId = typeof (charge as unknown as { invoice?: string }).invoice === 'string'
          ? (charge as unknown as { invoice: string }).invoice
          : null
        if (remboursementTotal && invoiceId) {
          const { annulerRecompensePourFacture } = await import('@/lib/parrainage-recompense')
          await annulerRecompensePourFacture(supabase, stripe, invoiceId, 'remboursement')
        }
        // 27/08/2026 — on coupe aussi l'ACCES, pas seulement la recompense de
        // parrainage : un client integralement rembourse gardait le logiciel.
        if (remboursementTotal) {
          const customerId = typeof charge.customer === 'string'
            ? charge.customer
            : (charge.customer as Stripe.Customer | null)?.id ?? null
          await revoquerAcces(supabase, customerId, 'remboursement total')
        }
        break
      }

      // === LITIGE / CONTESTATION (anti-fraude parrainage) ===
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = typeof dispute.charge === 'string'
          ? dispute.charge
          : (dispute.charge as Stripe.Charge)?.id
        if (chargeId) {
          const ch = await stripe.charges.retrieve(chargeId)
          const invoiceId = typeof (ch as unknown as { invoice?: string }).invoice === 'string'
            ? (ch as unknown as { invoice: string }).invoice
            : null
          if (invoiceId) {
            const { annulerRecompensePourFacture } = await import('@/lib/parrainage-recompense')
            await annulerRecompensePourFacture(supabase, stripe, invoiceId, 'litige')
          }
          // 27/08/2026 — un chargeback rendait l'argent SANS couper l'acces.
          // On suspend le temps du litige ; c'est reversible en un clic depuis
          // le back-office si Stripe tranche en votre faveur.
          const customerId = typeof ch.customer === 'string'
            ? ch.customer
            : (ch.customer as Stripe.Customer | null)?.id ?? null
          await revoquerAcces(supabase, customerId, 'litige bancaire')
        }
        break
      }

      default:
        // Evenement non gere - c'est normal, on ignore
        break
    }

    // 6. Marquer l'event comme traite avec succes
    await supabase
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString(), processed_ok: true })
      .eq('event_id', event.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    // 7. Erreur dans le traitement : on stocke le message pour debug,
    //    on laisse processed_ok = false, et on retourne 500 -> Stripe retentera.
    console.error('Webhook handler error for event', event.id, event.type, error)
    const errMsg = error instanceof Error ? error.message : String(error)
    await supabase
      .from('stripe_webhook_events')
      .update({ error_message: errMsg.slice(0, 500) })
      .eq('event_id', event.id)
      .then(undefined, (e) => console.error('Webhook error_message update failed:', e))

    return NextResponse.json({ error: 'Erreur webhook' }, { status: 500 })
  }
}
