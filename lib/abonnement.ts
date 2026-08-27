/**
 * lib/abonnement.ts
 *
 * Source de verite UNIQUE pour repondre a la question : "cet acces est-il
 * encore ouvert ?".
 *
 * ------------------------------------------------------------------------
 * POURQUOI CE FICHIER EXISTE (bug corrige le 27/08/2026)
 * ------------------------------------------------------------------------
 * Le geste commercial de l'admin ("+1 mois offert") passe le compte en
 * abonnement_type = 'actif' ET remplit abonnement_expire_at.
 * Mais AUCUN des trois points de controle (middleware, layout dashboard,
 * badge admin) ne lisait cette date quand le type valait 'actif' : ils
 * laissaient passer inconditionnellement. Resultat : un mois offert
 * donnait un acces gratuit a vie, et l'admin affichait "Actif" pour
 * toujours. 6 comptes etaient concernes.
 *
 * ------------------------------------------------------------------------
 * REGLE DE PRUDENCE (ne JAMAIS couper un client qui paye)
 * ------------------------------------------------------------------------
 * Un vrai abonne Stripe a lui aussi une abonnement_expire_at : le webhook
 * y ecrit la fin de periode a chaque renouvellement
 * (app/api/stripe/webhook/route.ts). Si ce webhook a du retard, la date est
 * dans le passe alors que le client est parfaitement a jour.
 * On applique donc deux garde-fous :
 *   1. la presence d'un stripe_subscription_id rend le compte intouchable
 *      (c'est Stripe qui pilote, pas nous) ;
 *   2. un delai de grace de GRACE_DAYS jours apres la date d'expiration.
 * En cas de doute (donnee manquante), on laisse passer : le design de tout
 * le projet est "fail-open" (cf. getPlan dans lib/plans.ts).
 */

/** Duree de l'essai gratuit, en jours. */
export const TRIAL_DAYS = 14

/** Delai de grace apres l'expiration, en jours (retard de webhook, fuseau). */
export const GRACE_DAYS = 3

const MS_PAR_JOUR = 86_400_000

/**
 * Les seuls champs necessaires pour trancher. Toutes les colonnes sont
 * optionnelles : l'appelant peut passer un objet partiel sans risque.
 */
export interface AbonnementEtat {
  abonnement_type?: string | null
  trial_started_at?: string | null
  abonnement_expire_at?: string | null
  created_at?: string | null
  stripe_subscription_id?: string | null
}

/** Parse une date ISO en Date, ou null si absente / invalide. */
function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Un compte 'actif' est-il un vrai abonne Stripe ?
 * Si oui, on ne coupe jamais : c'est le webhook qui fait foi.
 */
export function estAbonneStripe(e: AbonnementEtat): boolean {
  return typeof e.stripe_subscription_id === 'string' && e.stripe_subscription_id.length > 0
}

/**
 * L'acces au dashboard est-il encore ouvert ?
 *
 * @param e   etat d'abonnement de l'entreprise
 * @param now date de reference (injectable pour les tests)
 */
export function accesOuvert(e: AbonnementEtat | null | undefined, now: Date = new Date()): boolean {
  // Pas de donnee : on laisse passer (fail-open, cf. en-tete).
  if (!e) return true

  const type = e.abonnement_type ?? 'trial'
  const expireAt = toDate(e.abonnement_expire_at)
  const limite = expireAt ? new Date(expireAt.getTime() + GRACE_DAYS * MS_PAR_JOUR) : null

  if (type === 'lifetime') return true

  if (type === 'actif') {
    // 1. Vrai abonne Stripe : intouchable.
    if (estAbonneStripe(e)) return true
    // 2. Passage en actif a la main sans date (historique) : on laisse passer.
    if (!limite) return true
    // 3. Geste commercial date : on coupe apres la date + grace.
    return limite > now
  }

  if (type === 'suspendu') {
    // Suspendu sans date = suspension immediate.
    if (!limite) return false
    return limite > now
  }

  // Trial (valeur par defaut) : TRIAL_DAYS jours depuis le debut d'essai.
  const debut = toDate(e.trial_started_at) ?? toDate(e.created_at)
  if (!debut) return true // date de debut inconnue : fail-open
  return new Date(debut.getTime() + TRIAL_DAYS * MS_PAR_JOUR) > now
}

/**
 * Variante lisible pour l'affichage admin : pourquoi l'acces est-il ferme ?
 * Renvoie null si l'acces est ouvert.
 */
export function motifFermeture(
  e: AbonnementEtat | null | undefined,
  now: Date = new Date(),
): 'trial_expire' | 'offert_expire' | 'suspendu' | null {
  if (accesOuvert(e, now)) return null
  const type = e?.abonnement_type ?? 'trial'
  if (type === 'actif') return 'offert_expire'
  if (type === 'suspendu') return 'suspendu'
  return 'trial_expire'
}

/** Jours restants avant fermeture (0 si deja ferme, null si illimite). */
export function joursRestants(
  e: AbonnementEtat | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!e) return null
  const type = e.abonnement_type ?? 'trial'
  if (type === 'lifetime') return null
  if (type === 'actif' && estAbonneStripe(e)) return null

  let fin: Date | null = null
  if (type === 'actif' || type === 'suspendu') {
    fin = toDate(e.abonnement_expire_at)
  } else {
    const debut = toDate(e.trial_started_at) ?? toDate(e.created_at)
    fin = debut ? new Date(debut.getTime() + TRIAL_DAYS * MS_PAR_JOUR) : null
  }
  if (!fin) return null
  return Math.max(0, Math.ceil((fin.getTime() - now.getTime()) / MS_PAR_JOUR))
}
