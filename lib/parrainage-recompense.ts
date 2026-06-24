import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

/**
 * RECOMPENSE DE PARRAINAGE (cote Stripe).
 *
 * Regle metier (validee par le fondateur) :
 *   - 1 MOIS OFFERT pour LES DEUX (parrain + filleul).
 *   - Declenche quand le FILLEUL paie son 1er mois plein => c'est le MOIS SUIVANT
 *     qui est offert aux deux.
 *   - Plafond : 10 recompenses parrain maximum (le filleul est toujours recompense).
 *   - Coupe-circuit : variable d'env PARRAINAGE_ACTIF=false desactive l'octroi.
 *   - Anti-fraude : si le paiement declencheur est rembourse/conteste, la recompense
 *     est marquee 'annule' et le credit parrain en attente est retire.
 *
 * COMMENT le "mois offert" est livre :
 *   On CREDITE le SOLDE CLIENT Stripe du montant d'un mois (montant TTC reellement
 *   facture). Stripe deduit automatiquement ce credit de la PROCHAINE facture
 *   (=> le mois suivant est gratuit), sans toucher au mois deja paye.
 *   Avantages vs coupon : les credits se CUMULENT (un parrain avec N filleuls
 *   recoit N mois), et chaque credit porte une Idempotency-Key => aucun double credit
 *   en cas de rejeu/concurrence du webhook.
 *
 * IDEMPOTENCE :
 *   - Passage de statut 'en_attente' -> final par UPDATE conditionnel (compare-and-swap).
 *   - Chaque credit Stripe porte une Idempotency-Key deterministe.
 */

const PLAFOND_PARRAIN = 10
const CREDIT_PARRAIN_JOURS = 90

/** Le programme est-il actif ? (coupe-circuit via env, defaut: actif) */
export function parrainageActif(): boolean {
  const v = (process.env.PARRAINAGE_ACTIF || '').toLowerCase()
  return v !== 'false' && v !== '0' && v !== 'off'
}

/**
 * Recupere l'ID d'abonnement d'une facture, compatible API Stripe dahlia (2026)
 * ou le champ racine `subscription` a ete deplace sous
 * invoice.parent.subscription_details.subscription.
 */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } } }
    subscription?: string | { id: string }
  }
  const sub = inv.parent?.subscription_details?.subscription ?? inv.subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

/**
 * Offre 1 mois en creditant le solde client Stripe (montant negatif = credit).
 * Idempotent grace a la cle fournie.
 */
async function crediterUnMois(
  stripe: Stripe,
  customerId: string,
  montantCents: number,
  currency: string,
  description: string,
  idempotencyKey: string,
): Promise<void> {
  if (!customerId || montantCents <= 0) return
  await stripe.customers.createBalanceTransaction(
    customerId,
    { amount: -Math.abs(montantCents), currency, description },
    { idempotencyKey },
  )
}

/**
 * Montant d'un mois pour un client, pour offrir l'equivalent.
 * 1) Derniere facture REELLEMENT payee (> 0) parmi les 24 dernieres
 *    (les plus recentes peuvent etre a 0 = mois deja offerts) ; ce montant
 *    reflete le tarif courant TTC.
 * 2) Repli : prix de l'abonnement (au cas ou aucune facture payee n'est trouvee),
 *    pour ne JAMAIS perdre la recompense d'un parrain pourtant abonne.
 */
async function montantUnMois(
  stripe: Stripe,
  customerId: string,
  subscriptionId?: string | null,
): Promise<{ amount: number; currency: string } | null> {
  const invoices = await stripe.invoices.list({ customer: customerId, status: 'paid', limit: 24 })
  for (const inv of invoices.data) {
    if (inv.amount_paid && inv.amount_paid > 0) {
      return { amount: inv.amount_paid, currency: inv.currency }
    }
  }
  // Repli : prix unitaire de l'abonnement courant
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const price = sub.items?.data?.[0]?.price
      if (price?.unit_amount && price.unit_amount > 0) {
        return { amount: price.unit_amount, currency: price.currency || 'eur' }
      }
    } catch (e) {
      console.error('[parrainage] retrieve subscription price echoue:', e)
    }
  }
  return null
}

type EntrepriseRow = {
  id: string
  nom: string | null
  email: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

/**
 * Traite la recompense au 1er vrai paiement du filleul.
 * Appele depuis le webhook sur `invoice.payment_succeeded`.
 *
 * Retour silencieux si : programme desactive, facture a 0 EUR, client introuvable,
 * ou pas de parrainage 'en_attente'. Peut JETER sur erreur Stripe/DB inattendue
 * (le webhook renverra 500 -> Stripe rejoue ; le traitement est idempotent).
 */
export async function traiterRecompenseParrainage(
  admin: SupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<void> {
  if (!parrainageActif()) return

  const amountPaid = (invoice as unknown as { amount_paid?: number }).amount_paid ?? 0
  if (amountPaid <= 0) return

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
  if (!customerId) return
  const currency = invoice.currency || 'eur'

  // Entreprise du filleul (retrouvee par le customer Stripe, fiable des le checkout)
  const { data: filleul } = await admin
    .from('entreprises')
    .select('id, nom, email, stripe_subscription_id, stripe_customer_id')
    .eq('stripe_customer_id', customerId)
    .single()
  if (!filleul) return

  // Parrainage en attente pour ce filleul ?
  const { data: parrainage } = await admin
    .from('parrainages')
    .select('id, parrain_entreprise_id, filleul_entreprise_id, statut')
    .eq('filleul_entreprise_id', filleul.id)
    .eq('statut', 'en_attente')
    .single()
  if (!parrainage) return

  const { data: parrain } = await admin
    .from('entreprises')
    .select('id, nom, email, stripe_subscription_id, stripe_customer_id')
    .eq('id', parrainage.parrain_entreprise_id)
    .single()
  if (!parrain) return

  const { count: dejaRecompenses } = await admin
    .from('parrainages')
    .select('id', { count: 'exact', head: true })
    .eq('parrain_entreprise_id', parrain.id)
    .in('statut', ['recompense', 'recompense_filleul_seul'])
  const plafondAtteint = (dejaRecompenses ?? 0) >= PLAFOND_PARRAIN

  // --- Recompense FILLEUL (toujours, sauf programme off) : 1 mois credite ---
  await crediterUnMois(
    stripe,
    customerId,
    amountPaid,
    currency,
    'Parrainage Nexartis - 1 mois offert',
    `referral-${parrainage.id}-filleul`,
  )

  // --- Recompense PARRAIN : seulement s'il est abonne ET hors plafond ---
  let statutCible: 'recompense' | 'recompense_filleul_seul' | 'non_recompense_plafond'
  if (plafondAtteint) {
    statutCible = 'non_recompense_plafond'
  } else if (parrain.stripe_subscription_id && parrain.stripe_customer_id) {
    const m = await montantUnMois(stripe, parrain.stripe_customer_id, parrain.stripe_subscription_id)
    if (m) {
      await crediterUnMois(
        stripe,
        parrain.stripe_customer_id,
        m.amount,
        m.currency,
        'Parrainage Nexartis - 1 mois offert (parrain)',
        `referral-${parrainage.id}-parrain`,
      )
      statutCible = 'recompense'
    } else {
      // Abonne mais montant introuvable : on bascule en credit en attente.
      statutCible = 'recompense_filleul_seul'
    }
  } else {
    // Parrain pas (encore) abonne : credit en attente, applique a sa souscription.
    statutCible = 'recompense_filleul_seul'
  }

  // --- Compare-and-swap : on ne marque que si toujours 'en_attente' ---
  const nowIso = new Date().toISOString()
  const creditExpire = new Date(Date.now() + CREDIT_PARRAIN_JOURS * 86_400_000).toISOString()
  const { data: claimed } = await admin
    .from('parrainages')
    .update({
      statut: statutCible,
      filleul_first_invoice_id: invoice.id,
      filleul_recompense_at: nowIso,
      parrain_recompense_at: statutCible === 'recompense' ? nowIso : null,
      parrain_credit_en_attente: statutCible === 'recompense_filleul_seul',
      parrain_credit_expire_at: statutCible === 'recompense_filleul_seul' ? creditExpire : null,
      updated_at: nowIso,
    })
    .eq('id', parrainage.id)
    .eq('statut', 'en_attente')
    .select('id')

  // 0 ligne => un autre traitement a deja gagne -> stop (pas de double mail).
  if (!claimed || claimed.length === 0) return

  try {
    await notifierRecompense(filleul, parrain, statutCible)
  } catch (e) {
    console.error('[parrainage] notif recompense echouee:', e)
  }
}

/**
 * Applique les credits parrain EN ATTENTE quand le parrain finit par s'abonner.
 * Appele depuis le webhook sur `checkout.session.completed` (cote parrain).
 *
 * Chaque parrainage en attente (non expire) donne 1 mois credite => les mois
 * se CUMULENT correctement (N filleuls = N mois), et chaque ligne est soldee
 * individuellement.
 *
 * @param montantCents montant TTC du 1er paiement du parrain (= 1 mois)
 */
export async function appliquerCreditsParrainEnAttente(
  admin: SupabaseClient,
  stripe: Stripe,
  parrainEntrepriseId: string,
  customerId: string | null,
  montantCents: number | null,
  currency: string | null,
): Promise<void> {
  if (!parrainageActif() || !customerId || !montantCents || montantCents <= 0) return

  const { data: enAttente } = await admin
    .from('parrainages')
    .select('id, parrain_credit_expire_at')
    .eq('parrain_entreprise_id', parrainEntrepriseId)
    .eq('statut', 'recompense_filleul_seul')
    .eq('parrain_credit_en_attente', true)
  if (!enAttente || enAttente.length === 0) return

  const now = Date.now()
  const cur = currency || 'eur'
  const nowIso = new Date().toISOString()

  for (const p of enAttente) {
    const exp = p.parrain_credit_expire_at ? new Date(p.parrain_credit_expire_at).getTime() : null
    if (exp !== null && exp <= now) continue // credit expire => on ne credite pas

    await crediterUnMois(
      stripe,
      customerId,
      montantCents,
      cur,
      'Parrainage Nexartis - 1 mois offert (parrain)',
      `referral-credit-${p.id}`,
    )

    await admin
      .from('parrainages')
      .update({
        statut: 'recompense',
        parrain_credit_en_attente: false,
        parrain_recompense_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', p.id)
      .eq('statut', 'recompense_filleul_seul')
  }
}

/**
 * Annule une recompense si le paiement declencheur du filleul est rembourse/conteste.
 * Appele depuis le webhook sur `charge.refunded` / `charge.dispute.created`.
 *
 * NB : on ne re-debite pas un credit deja consomme (eviter de facturer un client
 * de maniere surprise). On stoppe la chaine : statut 'annule' + credit parrain
 * en attente retire. Le risque financier est ainsi borne a 1 mois.
 */
export async function annulerRecompensePourFacture(
  admin: SupabaseClient,
  _stripe: Stripe,
  invoiceId: string,
  raison: string,
): Promise<void> {
  if (!invoiceId) return

  const { data: parrainage } = await admin
    .from('parrainages')
    .select('id, statut')
    .eq('filleul_first_invoice_id', invoiceId)
    .in('statut', ['recompense', 'recompense_filleul_seul', 'non_recompense_plafond'])
    .single()
  if (!parrainage) return

  await admin
    .from('parrainages')
    .update({
      statut: 'annule',
      parrain_credit_en_attente: false,
      parrain_credit_expire_at: null,
      notes: `Annule (${raison}) le ${new Date().toISOString()}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parrainage.id)
}

// -------------------------------------------------------------------
// Notifications email (best effort, jamais bloquant)
// -------------------------------------------------------------------

async function notifierRecompense(
  filleul: EntrepriseRow,
  parrain: EntrepriseRow,
  statutCible: 'recompense' | 'recompense_filleul_seul' | 'non_recompense_plafond',
): Promise<void> {
  const { sendEmail } = await import('@/lib/email')

  if (filleul.email) {
    await sendEmail({
      to: { email: filleul.email, name: filleul.nom || filleul.email },
      subject: 'Votre mois offert Nexartis est applique',
      html: emailRecompenseHtml(
        filleul.nom || '',
        "Merci d'avoir rejoint Nexartis via un parrainage ! Votre prochain mois d'abonnement est <strong>offert</strong> : votre prochaine facture sera deduite d'un mois.",
      ),
    }).catch(() => {})
  }

  if (statutCible === 'recompense' && parrain.email) {
    await sendEmail({
      to: { email: parrain.email, name: parrain.nom || parrain.email },
      subject: "Votre filleul s'est abonne - 1 mois offert pour vous",
      html: emailRecompenseHtml(
        parrain.nom || '',
        "Bonne nouvelle : un de vos filleuls vient de s'abonner. Votre prochain mois d'abonnement est <strong>offert</strong>. Merci de faire grandir Nexartis !",
      ),
    }).catch(() => {})
  }
}

function emailRecompenseHtml(name: string, message: string): string {
  const hello = name ? `Bonjour ${name},` : 'Bonjour,'
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f4f6f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="padding:28px 32px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#1e293b;">Nexartis</div>
      </div>
      <div style="height:1px;background:#e5e7eb;margin:0 32px;"></div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">${hello}</h2>
        <p style="font-size:15px;color:#475569;line-height:1.7;">${message}</p>
        <p style="font-size:13px;color:#94a3b8;margin-top:24px;line-height:1.6;">Vous pouvez suivre vos parrainages depuis vos parametres Nexartis.</p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Envoye via Nexartis - nexartis.fr</p>
      </div>
    </div>
  </div>
</body></html>`
}
