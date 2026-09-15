import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import {
  CREDIT_FILLEUL_CENTS,
  CREDIT_PARRAIN_CENTS,
  recompenseParrainPourRang,
  type RecompenseParrainType,
} from './parrainage'

/**
 * RECOMPENSE DE PARRAINAGE (cote Stripe).
 *
 * Regle metier V2 (validee par Jeremy le 15/09/2026, remplace « 1 mois aux deux ») :
 *   - FILLEUL : 5 EUR de reduction sur sa prochaine facture.
 *   - PARRAIN : 1 MOIS OFFERT pour son 1er et son 10e filleul payant ;
 *     5 EUR de reduction pour chacun des autres. AUCUN plafond.
 *   - Declenche quand le FILLEUL paie son 1er mois plein.
 *   - Coupe-circuit : variable d'env PARRAINAGE_ACTIF=false desactive l'octroi.
 *   - Anti-fraude : si le paiement declencheur est rembourse/conteste, la recompense
 *     est marquee 'annule' et le credit parrain en attente est retire.
 *
 * COMMENT la recompense est livree :
 *   On CREDITE le SOLDE CLIENT Stripe (5 EUR, ou le montant d'un mois TTC reellement
 *   facture). Stripe deduit automatiquement ce credit de la PROCHAINE facture, et
 *   reporte le reste sur les suivantes s'il depasse la facture.
 *   Avantages vs coupon : les credits se CUMULENT, et chaque credit porte une
 *   Idempotency-Key => aucun double credit en cas de rejeu du webhook.
 *
 * IDEMPOTENCE :
 *   - Passage de statut 'en_attente' -> final par UPDATE conditionnel (compare-and-swap).
 *   - Chaque credit Stripe porte une Idempotency-Key deterministe.
 */

const CREDIT_PARRAIN_JOURS = 90

/** Statuts ou le filleul a REELLEMENT paye (rang du filleul). 'annule' exclu. */
const STATUTS_FILLEUL_PAYE = ['recompense', 'recompense_filleul_seul', 'non_recompense_plafond']

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
 * Credite le solde client Stripe (montant negatif = credit), deduit de la
 * prochaine facture. Idempotent grace a la cle fournie.
 */
async function crediterSolde(
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

  // Rang de CE filleul parmi les filleuls payants du parrain (1 = premier).
  const { count: filleulsPayesAvant } = await admin
    .from('parrainages')
    .select('id', { count: 'exact', head: true })
    .eq('parrain_entreprise_id', parrain.id)
    .in('statut', STATUTS_FILLEUL_PAYE)
  const rang = (filleulsPayesAvant ?? 0) + 1
  const typeParrain: RecompenseParrainType = recompenseParrainPourRang(rang)

  // --- Recompense FILLEUL (toujours, sauf programme off) : 5 EUR credites ---
  await crediterSolde(
    stripe,
    customerId,
    CREDIT_FILLEUL_CENTS,
    currency,
    'Parrainage Nexartis - 5 € offerts',
    `referral-v2-${parrainage.id}-filleul`,
  )

  // --- Recompense PARRAIN : creditee tout de suite s'il est abonne, sinon en attente ---
  let statutCible: 'recompense' | 'recompense_filleul_seul'
  if (parrain.stripe_subscription_id && parrain.stripe_customer_id) {
    let montant: { amount: number; currency: string } | null
    if (typeParrain === 'mois') {
      montant = await montantUnMois(stripe, parrain.stripe_customer_id, parrain.stripe_subscription_id)
    } else {
      montant = { amount: CREDIT_PARRAIN_CENTS, currency }
    }
    if (montant) {
      await crediterSolde(
        stripe,
        parrain.stripe_customer_id,
        montant.amount,
        montant.currency,
        typeParrain === 'mois'
          ? `Parrainage Nexartis - 1 mois offert (filleul n°${rang})`
          : 'Parrainage Nexartis - 5 € offerts (parrain)',
        `referral-v2-${parrainage.id}-parrain`,
      )
      statutCible = 'recompense'
    } else {
      // Abonne mais montant du mois introuvable : on bascule en credit en attente.
      statutCible = 'recompense_filleul_seul'
    }
  } else {
    // Parrain pas (encore) abonne : credit en attente, applique a sa souscription.
    statutCible = 'recompense_filleul_seul'
  }

  // --- Compare-and-swap : on ne marque que si toujours 'en_attente' ---
  const nowIso = new Date().toISOString()
  const creditExpire = new Date(Date.now() + CREDIT_PARRAIN_JOURS * 86_400_000).toISOString()
  const { data: claimed, error: claimErr } = await admin
    .from('parrainages')
    .update({
      statut: statutCible,
      filleul_first_invoice_id: invoice.id,
      filleul_recompense_at: nowIso,
      parrain_recompense_at: statutCible === 'recompense' ? nowIso : null,
      parrain_credit_en_attente: statutCible === 'recompense_filleul_seul',
      parrain_credit_expire_at: statutCible === 'recompense_filleul_seul' ? creditExpire : null,
      parrain_recompense_type: typeParrain,
      updated_at: nowIso,
    })
    .eq('id', parrainage.id)
    .eq('statut', 'en_attente')
    .select('id')

  // 15/09/2026 : si l'UPDATE echoue, on JETTE (webhook 500 -> rejeu Stripe sous
  // 24 h, cles d'idempotence encore valides) au lieu de laisser la ligne
  // 'en_attente' et de recrediter au renouvellement suivant.
  if (claimErr) throw new Error(`[parrainage] maj statut impossible: ${claimErr.message}`)
  // 0 ligne => un autre traitement a deja gagne -> stop (pas de double mail).
  if (!claimed || claimed.length === 0) return

  try {
    await notifierRecompense(filleul, parrain, statutCible, typeParrain)
  } catch (e) {
    console.error('[parrainage] notif recompense echouee:', e)
  }
}

/**
 * Applique les credits parrain EN ATTENTE quand le parrain finit par s'abonner.
 * Appele depuis le webhook sur `checkout.session.completed` (cote parrain).
 *
 * Chaque parrainage en attente (non expire) est credite selon SON type
 * (1 mois ou 5 EUR, cf. parrain_recompense_type) => les credits se CUMULENT,
 * et chaque ligne est soldee individuellement.
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
    .select('id, parrain_credit_expire_at, parrain_recompense_type')
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

    // NULL = parrainage de l'ancienne regle (1 mois) : on honore ce qui a ete promis.
    const estMois = (p as { parrain_recompense_type?: string | null }).parrain_recompense_type !== '5eur'
    await crediterSolde(
      stripe,
      customerId,
      estMois ? montantCents : CREDIT_PARRAIN_CENTS,
      cur,
      estMois ? 'Parrainage Nexartis - 1 mois offert (parrain)' : 'Parrainage Nexartis - 5 € offerts (parrain)',
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
  statutCible: 'recompense' | 'recompense_filleul_seul',
  typeParrain: RecompenseParrainType,
): Promise<void> {
  const { sendEmail } = await import('@/lib/email')

  if (filleul.email) {
    await sendEmail({
      to: { email: filleul.email, name: filleul.nom || filleul.email },
      subject: 'Vos 5 € de parrainage Nexartis sont appliqués',
      html: emailRecompenseHtml(
        filleul.nom || '',
        "Merci d'avoir rejoint Nexartis grâce à un parrainage ! <strong>5 € de réduction</strong> seront déduits de votre prochaine facture.",
      ),
    }).catch(() => {})
  }

  if (statutCible === 'recompense' && parrain.email) {
    const estMois = typeParrain === 'mois'
    await sendEmail({
      to: { email: parrain.email, name: parrain.nom || parrain.email },
      subject: estMois
        ? "Votre filleul s'est abonné - 1 mois offert pour vous"
        : "Votre filleul s'est abonné - 5 € offerts pour vous",
      html: emailRecompenseHtml(
        parrain.nom || '',
        estMois
          ? "Bonne nouvelle : un de vos filleuls vient de s'abonner. Votre prochain mois d'abonnement est <strong>offert</strong>. Merci de faire grandir Nexartis !"
          : "Bonne nouvelle : un de vos filleuls vient de s'abonner. <strong>5 € de réduction</strong> seront déduits de votre prochaine facture. Merci de faire grandir Nexartis !",
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
        <p style="font-size:13px;color:#94a3b8;margin-top:24px;line-height:1.6;">Vous pouvez suivre vos parrainages depuis vos paramètres Nexartis.</p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Envoyé via Nexartis - nexartis.fr</p>
      </div>
    </div>
  </div>
</body></html>`
}
