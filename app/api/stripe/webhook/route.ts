import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

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

        if (entrepriseId) {
          await supabase
            .from('entreprises')
            .update({
              abonnement_type: 'actif',
              stripe_subscription_id: subscriptionId || null,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
              abonnement_expire_at: null,
            })
            .eq('id', entrepriseId)

          console.log(`[Stripe] Abonnement active pour entreprise ${entrepriseId}`)
        }
        break
      }

      // === FACTURE PAYEE (renouvellement mensuel) ===
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string | null

        if (subscriptionId) {
          const { data: entreprise } = await supabase
            .from('entreprises')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (entreprise) {
            await supabase
              .from('entreprises')
              .update({ abonnement_type: 'actif' })
              .eq('id', entreprise.id)
          }
        }
        break
      }

      // === PAIEMENT ECHOUE ===
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string | null

        if (subscriptionId) {
          const { data: entreprise } = await supabase
            .from('entreprises')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (entreprise) {
            await supabase
              .from('entreprises')
              .update({
                notes_admin: `[Auto] Paiement echoue le ${new Date().toLocaleDateString('fr-FR')}`,
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
          const periodEnd = new Date((subscription as any).current_period_end * 1000)

          await supabase
            .from('entreprises')
            .update({
              abonnement_type: 'suspendu',
              abonnement_expire_at: periodEnd.toISOString(),
              stripe_subscription_id: null,
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
          const status = subscription.status
          let abonnementType = 'actif'
          if (status === 'past_due' || status === 'unpaid') abonnementType = 'suspendu'
          if (status === 'canceled') abonnementType = 'suspendu'
          if (status === 'active' || status === 'trialing') abonnementType = 'actif'

          await supabase
            .from('entreprises')
            .update({ abonnement_type: abonnementType })
            .eq('id', entreprise.id)
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
