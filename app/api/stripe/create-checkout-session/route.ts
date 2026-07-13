import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { stripePriceIdForPlan, type PlanId } from '@/lib/plans'

/**
 * POST /api/stripe/create-checkout-session
 * Cree une session Stripe Checkout pour l'abonnement mensuel.
 * L'utilisateur doit etre connecte.
 */

// Versions des documents legaux affiches/acceptes a la souscription.
// A mettre a jour si le contenu des CGV ou de la politique change, pour pouvoir
// prouver QUELLE version a ete acceptee.
const CGV_VERSION = '2026-06-30'
const CONFIDENTIALITE_VERSION = '2026-06-30'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req)
    if (!checkRateLimit(`stripe-checkout:${ip}`, 5, 60_000)) {
      return rateLimitError()
    }

    // Verifier l'authentification
    const user = await getAuthenticatedUser()
    if (!user || !user.email) return unauthorizedError()

    // Lire le plan choisi dans le body (defaut conservateur 'complete').
    // On lit le body UNE SEULE FOIS, en tolerant un body vide/invalide.
    let plan: PlanId = 'complete'
    try {
      const parsedBody = await req.json().catch(() => null)
      if (parsedBody && (parsedBody.plan === 'essential' || parsedBody.plan === 'complete')) {
        plan = parsedBody.plan
      }
    } catch {
      // body absent ou non-JSON : on garde 'complete'
    }

    // Recuperer les infos entreprise
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('id, nom, stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!entreprise) {
      return secureError('Profil entreprise introuvable', 404)
    }

    // Conformite : enregistrer la preuve d'acceptation des CGV au moment du
    // paiement. L'UI exige la case "j'accepte les CGV" cochee pour atteindre
    // cette route. Non bloquant : un echec d'ecriture n'empeche pas le paiement.
    {
      const { error: acceptErr } = await supabase.from('cgv_acceptances').insert({
        user_id: user.id,
        entreprise_id: entreprise.id,
        cgv_version: CGV_VERSION,
        confidentialite_version: CONFIDENTIALITE_VERSION,
        ip,
      })
      if (acceptErr) {
        console.error('[checkout] enregistrement acceptation CGV echoue (non bloquant):', acceptErr.message)
      }
    }

    // Recuperer ou creer le client Stripe
    const stripeCustomerId = await getOrCreateStripeCustomer(
      user.id,
      user.email,
      entreprise.nom || user.email,
      entreprise.stripe_customer_id,
    )

    // Sauvegarder le stripe_customer_id si c'est nouveau
    if (!entreprise.stripe_customer_id) {
      await supabase
        .from('entreprises')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', entreprise.id)
    }

    // Creer la session Checkout — le prix depend du plan choisi
    const priceId = stripePriceIdForPlan(plan)
    if (!priceId) {
      return secureError(`Configuration Stripe incomplete (price manquant pour ${plan})`, 500)
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard/abonnement?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard/abonnement?canceled=1`,
      // Collecter le SIRET et la TVA (obligatoire en France)
      tax_id_collection: { enabled: true },
      // Appliquer la TVA automatiquement
      automatic_tax: { enabled: true },
      // Metadata pour le webhook
      metadata: {
        nexartis_user_id: user.id,
        nexartis_entreprise_id: entreprise.id,
        nexartis_plan: plan,
      },
      subscription_data: {
        metadata: {
          nexartis_user_id: user.id,
          nexartis_entreprise_id: entreprise.id,
          nexartis_plan: plan,
        },
      },
    })

    return secureJson({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return secureError('Erreur lors de la creation de la session de paiement', 500)
  }
}
