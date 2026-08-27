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
 * Un abonne Stripe peut lui aussi porter une abonnement_expire_at : le
 * checkout la met a null, puis invoice.payment_failed y ecrit une fin de
 * relance (dunning) le temps que Stripe retente le prelevement, et
 * customer.subscription.deleted y ecrit la fin de la periode payee.
 * Entre deux, elle reste nulle : le renouvellement mensuel ne la reecrit PAS.
 * Il ne faut donc jamais deduire d'une date absente ou passee qu'un abonne
 * Stripe ne paie plus.
 * On applique deux garde-fous :
 *   1. la presence d'un stripe_subscription_id rend le compte intouchable
 *      (c'est Stripe qui pilote, pas nous) ;
 *   2. un delai de grace de GRACE_DAYS jours, applique UNIQUEMENT au statut
 *      'suspendu' (relances de paiement Stripe en cours). Un mois offert,
 *      lui, s'arrete a la date exacte : c'est celle annoncee au client.
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
  /** Non NULL = resiliation Stripe programmee a cette date (fin de periode). */
  resiliation_prevue_le?: string | null
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
    if (!expireAt) return true
    // 3. GESTE COMMERCIAL ("+1 mois offert") : on coupe A LA DATE, sans delai
    //    de grace. 27/08/2026 — le delai de grace existe pour proteger un
    //    abonne Stripe d'un webhook en retard ; un mois offert, lui, a une
    //    date decidee a la main : elle doit etre respectee au jour pres,
    //    sinon la date annoncee au client dans l'email et sur son tableau
    //    de bord serait fausse de trois jours.
    return expireAt > now
  }

  if (type === 'suspendu') {
    // 27/08/2026 — un abonne Stripe encore lie (past_due pendant les relances
    // automatiques) ne doit PAS etre coupe le jour du premier echec de carte :
    // Stripe retente le prelevement pendant plusieurs jours. Si aucune date de
    // fin de relance n'a ete posee (evenements recus dans le desordre), on
    // laisse ouvert — c'est le webhook qui tranchera.
    if (!limite) return estAbonneStripe(e)
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

/**
 * Jours restants avant la fermeture reelle de l'acces.
 * Renvoie null quand il n'y a pas d'echeance (acces a vie, abonnement Stripe
 * qui se renouvele tout seul), et 0 quand l'acces est deja ferme.
 *
 * La date de reference est la MEME que celle utilisee par accesOuvert(),
 * delai de grace inclus : sans cela l'interface affichait « expire
 * aujourd'hui » trois jours de suite pendant la periode de grace.
 */
export function joursRestants(
  e: AbonnementEtat | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!e) return null
  const type = e.abonnement_type ?? 'trial'
  if (type === 'lifetime') return null

  if (type === 'actif' && estAbonneStripe(e)) {
    // Abonne Stripe : pas d'echeance, SAUF resiliation programmee depuis le
    // portail (l'app ne prevenait pas du tout dans ce cas avant le 27/08).
    const finAbo = toDate(e.resiliation_prevue_le)
    if (!finAbo) return null
    return Math.max(0, Math.ceil((finAbo.getTime() - now.getTime()) / MS_PAR_JOUR))
  }

  let fin: Date | null = null
  if (type === 'actif') {
    // Geste commercial : la date affichee est la date reelle (pas de grace).
    fin = toDate(e.abonnement_expire_at)
  } else if (type === 'suspendu') {
    // Suspendu : la grace couvre les relances de paiement Stripe.
    const expire = toDate(e.abonnement_expire_at)
    fin = expire ? new Date(expire.getTime() + GRACE_DAYS * MS_PAR_JOUR) : null
  } else {
    const debut = toDate(e.trial_started_at) ?? toDate(e.created_at)
    fin = debut ? new Date(debut.getTime() + TRIAL_DAYS * MS_PAR_JOUR) : null
  }
  if (!fin) return null
  return Math.max(0, Math.ceil((fin.getTime() - now.getTime()) / MS_PAR_JOUR))
}
