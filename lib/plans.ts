/**
 * lib/plans.ts
 *
 * Source de vérité unique pour les 2 offres Nexartis :
 *   - Essentiel : 15 € HT/mois — Devis + factures + mentions BTP, sans planning ni équipe
 *   - Complet   : 25 € HT/mois — Tout inclus
 *
 * Toute logique de feature gating (UI, middleware, API) DOIT importer depuis
 * ce fichier. Ne pas dupliquer la liste des features ailleurs.
 *
 * Conventions :
 *   - subscription_plan stocké en base sur la table entreprises
 *   - Valeurs : 'essential' | 'complete'
 *   - Pendant la période d'essai (trial), on considère le plan comme 'complete'
 *     pour laisser l'utilisateur tester toutes les fonctionnalités.
 *   - Plan par défaut pour les utilisateurs existants : 'complete' (rétrocompatible)
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PlanId = 'essential' | 'complete'

/** Catégorie de feature pour le feature gating. */
export type FeatureKey =
  // Devis & Factures (inclus dans les 2 plans)
  | 'devis'
  | 'factures'
  | 'signature_electronique'
  | 'mentions_btp_auto'
  | 'tva_auto'
  | 'autoliquidation_btp'
  | 'attestations_tva_renovation'
  | 'acomptes_situations'
  | 'avoirs_rectifications'
  | 'facturX_2026'
  // Suivi (inclus dans les 2 plans, version simple en Essentiel)
  | 'suivi_impayes'
  | 'tableau_bord_ca'
  | 'export_comptable'
  // Réservé Complet
  | 'planning_chantier'
  | 'alertes_conflit_planning'
  | 'gestion_equipe'
  | 'devis_vocal_ia'
  | 'bibliotheque_prestations_illimitee'
  | 'factures_situation'
  | 'rapport_intervention'

export interface PlanDefinition {
  id: PlanId
  name: string
  shortName: string
  priceMonthlyHT: number
  description: string
  /** Features explicitement INCLUSES dans ce plan. */
  features: FeatureKey[]
  /**
   * Routes du dashboard à bloquer pour ce plan.
   * Si l'utilisateur tente d'y accéder, on le redirige vers /dashboard/abonnement
   * avec un paramètre upgrade=<feature> pour afficher le bon message.
   */
  blockedRoutes: string[]
  /** Limites quantitatives (0 = illimité). */
  limits: {
    clients: number
    chantiers: number
    bibliothequePrestations: number
    utilisateurs: number
  }
}

// ─────────────────────────────────────────────────────────────
// Définition des plans
// ─────────────────────────────────────────────────────────────

const ESSENTIAL_FEATURES: FeatureKey[] = [
  'devis',
  'factures',
  'signature_electronique',
  'mentions_btp_auto',
  'tva_auto',
  'autoliquidation_btp',
  'attestations_tva_renovation',
  'acomptes_situations',
  'avoirs_rectifications',
  'facturX_2026',
  'suivi_impayes',
  'tableau_bord_ca',
]

const COMPLETE_FEATURES: FeatureKey[] = [
  ...ESSENTIAL_FEATURES,
  'planning_chantier',
  'alertes_conflit_planning',
  'gestion_equipe',
  'devis_vocal_ia',
  'bibliotheque_prestations_illimitee',
  'factures_situation',
  'export_comptable',
  'rapport_intervention',
]

export const PLANS: Record<PlanId, PlanDefinition> = {
  essential: {
    id: 'essential',
    name: 'Essentiel',
    shortName: 'Essentiel',
    priceMonthlyHT: 15,
    description:
      "Devis, factures et conformité BTP française pour les artisans solo. Sans planning d'équipe.",
    features: ESSENTIAL_FEATURES,
    blockedRoutes: [
      '/dashboard/planning',
      '/dashboard/equipe',
      // Le devis vocal réservé Complet (paramètre ?voice=1)
      // Géré séparément via canUseFeature('devis_vocal_ia')
    ],
    limits: {
      clients: 0, // illimité
      chantiers: 0, // illimité
      bibliothequePrestations: 50,
      utilisateurs: 1, // mono-utilisateur
    },
  },
  complete: {
    id: 'complete',
    name: 'Complet',
    shortName: 'Complet',
    priceMonthlyHT: 25,
    description:
      "Tout l'Essentiel, plus le planning d'équipe, les alertes conflits et le devis vocal IA.",
    features: COMPLETE_FEATURES,
    blockedRoutes: [],
    limits: {
      clients: 0,
      chantiers: 0,
      bibliothequePrestations: 0, // illimité
      utilisateurs: 0, // illimité
    },
  },
}

// ─────────────────────────────────────────────────────────────
// Helpers publics
// ─────────────────────────────────────────────────────────────

/**
 * Retourne la définition complète d'un plan.
 * Fallback sur 'complete' si l'identifiant est inconnu (sécurité).
 */
export function getPlan(planId: PlanId | string | null | undefined): PlanDefinition {
  if (planId === 'essential') return PLANS.essential
  return PLANS.complete
}

/**
 * Vérifie si un plan donné a accès à une feature.
 *
 * Pendant la période d'essai (trial), TOUTES les features sont accessibles
 * (l'utilisateur teste le produit complet) → utiliser canUseFeatureForUser
 * côté UI pour gérer le cas trial.
 */
export function canUseFeature(planId: PlanId, feature: FeatureKey): boolean {
  return PLANS[planId].features.includes(feature)
}

/**
 * Variante orientée "user" qui tient compte du statut d'abonnement.
 *
 * Règles métier :
 *   - trial → toutes les features accessibles (pour test)
 *   - actif/lifetime + plan='essential' → restrictions Essentiel
 *   - actif/lifetime + plan='complete' → tout débloqué
 *   - suspendu → mêmes droits que actif (l'utilisateur a payé jusqu'à la date)
 */
export function canUseFeatureForUser(
  feature: FeatureKey,
  user: {
    abonnement_type: 'trial' | 'lifetime' | 'actif' | 'suspendu'
    subscription_plan: PlanId
  } | null | undefined,
): boolean {
  if (!user) return false
  // Pendant l'essai, on laisse tout faire pour permettre la démo
  if (user.abonnement_type === 'trial') return true
  return canUseFeature(user.subscription_plan, feature)
}

/**
 * Vérifie si une route est bloquée pour un plan donné.
 * Utilisé par le layout dashboard pour rediriger vers la page d'upgrade.
 *
 * Match par préfixe : /dashboard/planning bloque aussi /dashboard/planning/intervention/123
 */
export function isRouteBlockedForPlan(planId: PlanId, pathname: string): boolean {
  const plan = PLANS[planId]
  return plan.blockedRoutes.some((blocked) => pathname === blocked || pathname.startsWith(blocked + '/'))
}

/**
 * Retourne la feature associée à une route bloquée.
 * Permet d'afficher le bon message d'upgrade.
 */
export function getFeatureFromBlockedRoute(pathname: string): FeatureKey | null {
  if (pathname.startsWith('/dashboard/planning')) return 'planning_chantier'
  if (pathname.startsWith('/dashboard/equipe')) return 'gestion_equipe'
  return null
}

/**
 * Calcule le plan "effectif" d'un utilisateur, qui combine son abonnement_type
 * (trial/actif/suspendu/lifetime) et son subscription_plan (essential/complete).
 *
 * Règle métier :
 *   - trial    → toujours 'complete' (laisser tester tout pendant 14 jours)
 *   - lifetime → toujours 'complete' (early adopters et compte admin)
 *   - actif/suspendu → on respecte subscription_plan (défaut 'complete')
 *
 * Sortie :
 *   - plan         : le plan effectif appliqué
 *   - isTrial      : true si on est encore en période d'essai
 *   - isPaying     : true si paiement actif ou compte lifetime
 *   - hasFullAccess: alias de plan === 'complete' (commodité UI)
 */
export interface EffectivePlanInfo {
  plan: PlanId
  isTrial: boolean
  isPaying: boolean
  hasFullAccess: boolean
}

export function getEffectivePlan(
  entreprise: {
    abonnement_type?: string | null
    subscription_plan?: string | null
  } | null | undefined,
): EffectivePlanInfo {
  if (!entreprise) {
    return {
      plan: 'complete',
      isTrial: false,
      isPaying: false,
      hasFullAccess: true,
    }
  }
  const abonnementType = entreprise.abonnement_type ?? 'trial'
  const subscriptionPlan = (entreprise.subscription_plan as PlanId | undefined) ?? 'complete'

  if (abonnementType === 'trial') {
    return { plan: 'complete', isTrial: true, isPaying: false, hasFullAccess: true }
  }
  if (abonnementType === 'lifetime') {
    return { plan: 'complete', isTrial: false, isPaying: true, hasFullAccess: true }
  }
  // actif / suspendu : on applique le plan réel
  return {
    plan: subscriptionPlan,
    isTrial: false,
    isPaying: abonnementType === 'actif',
    hasFullAccess: subscriptionPlan === 'complete',
  }
}

/**
 * Liste des routes du dashboard qui correspondent à une fonctionnalité Complet.
 * Sert à badger visuellement les items de sidebar quand l'utilisateur est en
 * Essentiel (pour qu'il sache où sont les fonctions premium).
 */
export const PREMIUM_DASHBOARD_ROUTES: ReadonlyArray<{ href: string; feature: FeatureKey }> = [
  { href: '/dashboard/planning', feature: 'planning_chantier' },
  { href: '/dashboard/equipe', feature: 'gestion_equipe' },
  // Rapports d'intervention = feature Complet (rapport_intervention) : on grise ★
  // l'item de sidebar en Essentiel (le mur d'upgrade est déjà géré dans la page).
  { href: '/dashboard/rapports', feature: 'rapport_intervention' },
] as const

export function isPremiumNavItem(href: string): boolean {
  return PREMIUM_DASHBOARD_ROUTES.some((r) => href === r.href || href.startsWith(r.href + '/'))
}

/**
 * Texte d'upgrade humain pour chaque feature réservée Complet.
 * Utilisé par le modal d'upgrade et la page /dashboard/abonnement?upgrade=...
 */
export const UPGRADE_MESSAGES: Partial<Record<FeatureKey, { title: string; description: string }>> = {
  planning_chantier: {
    title: 'Le planning chantier est réservé à l\'offre Complet',
    description:
      'Visualisez tous vos chantiers sur un calendrier visuel, affectez votre équipe et évitez les conflits d\'affectation. Disponible dans l\'offre Complet à 25 € HT/mois.',
  },
  alertes_conflit_planning: {
    title: 'Les alertes de conflit sont réservées à l\'offre Complet',
    description:
      'Soyez prévenu immédiatement si vous affectez un membre de votre équipe deux fois le même jour. Disponible dans l\'offre Complet à 25 € HT/mois.',
  },
  gestion_equipe: {
    title: 'La gestion d\'équipe est réservée à l\'offre Complet',
    description:
      'Ajoutez vos collaborateurs, gérez leurs accès et suivez leur activité sur les chantiers. Disponible dans l\'offre Complet à 25 € HT/mois.',
  },
  devis_vocal_ia: {
    title: 'Le devis vocal par IA est réservé à l\'offre Complet',
    description:
      'Dictez votre devis depuis le chantier. L\'intelligence artificielle structure les lignes pour vous. Disponible dans l\'offre Complet à 25 € HT/mois.',
  },
  bibliotheque_prestations_illimitee: {
    title: 'La bibliothèque illimitée est réservée à l\'offre Complet',
    description:
      'L\'offre Essentiel limite à 50 prestations enregistrées. L\'offre Complet à 25 € HT/mois supprime cette limite.',
  },
  factures_situation: {
    title: 'Les factures de situation sont réservées à l\'offre Complet',
    description:
      'Facturez vos chantiers longs en plusieurs situations (#1, #2, #3) avec cumul d\'avancement automatique. Disponible dans l\'offre Complet à 25 € HT/mois. Les acomptes simples restent inclus dans l\'Essentiel.',
  },
  export_comptable: {
    title: 'L\'export comptable est réservé à l\'offre Complet',
    description:
      'Exportez vos écritures vers votre comptable (format CSV compatible Sage / EBP / FEC). Disponible dans l\'offre Complet à 25 € HT/mois.',
  },
  rapport_intervention: {
    title: 'Le rapport d\'intervention est réservé à l\'offre Complet',
    description:
      'Générez des rapports d\'intervention signés sur le chantier. Disponible dans l\'offre Complet à 25 € HT/mois.',
  },
}

// ─────────────────────────────────────────────────────────────
// Helper SERVEUR (Stripe)
// ─────────────────────────────────────────────────────────────

/**
 * Retourne l'ID de prix Stripe correspondant à un plan.
 * ⚠️ À N'UTILISER QUE CÔTÉ SERVEUR (route API) : lit des variables
 * d'environnement non exposées au client.
 *
 * - essential → STRIPE_PRICE_ESSENTIAL
 * - complete  → STRIPE_PRICE_COMPLETE, avec repli sur l'ancien
 *   STRIPE_PRICE_ID (rétrocompatibilité pendant la migration Vercel).
 *
 * Retourne undefined si la variable n'est pas configurée : la route
 * appelante doit alors renvoyer une erreur 500 explicite.
 */
export function stripePriceIdForPlan(plan: PlanId): string | undefined {
  if (plan === 'essential') return process.env.STRIPE_PRICE_ESSENTIAL
  return process.env.STRIPE_PRICE_COMPLETE ?? process.env.STRIPE_PRICE_ID
}
