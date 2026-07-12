// ============================================================================
// lib/roles.ts — Matrice des rôles & permissions (multi-utilisateur)
// ----------------------------------------------------------------------------
// Contrat PARTAGÉ entre le front (menu, gardes de route, masquage UI) et le
// back (vérification des routes API). C'est la source de vérité unique des
// droits de chaque rôle. La VRAIE étanchéité reste assurée en base par la RLS
// Supabase (Phase 2a + 2b) — ce fichier ne fait que refléter ces règles côté
// applicatif (UX, menu, gardes). Ne jamais se reposer SEULEMENT dessus.
//
// 3 rôles (décision produit 12/06/2026) :
//   - dirigeant  : accès total (finances, paramètres, gestion des comptes).
//   - commercial : « Commercial / Chef de chantier ». Devis, clients, planning,
//                  chantiers. PAS les finances (factures, achats, CA, stats),
//                  PAS les paramètres, PAS la gestion des comptes.
//   - ouvrier    : son planning + interventions + ses chantiers affectés.
//                  AUCUN montant, aucune finance, aucune donnée commerciale.
// ============================================================================

export type UserRole = 'dirigeant' | 'commercial' | 'ouvrier'

export const ALL_ROLES: UserRole[] = ['dirigeant', 'commercial', 'ouvrier']

/** Rôles qu'un dirigeant peut attribuer en invitant (jamais « dirigeant »). */
export const INVITABLE_ROLES: UserRole[] = ['commercial', 'ouvrier']

export const ROLE_LABELS: Record<UserRole, string> = {
  dirigeant: 'Dirigeant',
  commercial: 'Commercial / Chef de chantier',
  ouvrier: 'Ouvrier',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  dirigeant:
    "Accès complet : devis, factures, finances, planning, chantiers, paramètres et gestion des comptes.",
  commercial:
    "Crée et gère les devis, les clients, le planning et les chantiers. Ne voit pas les factures, les achats ni le chiffre d'affaires.",
  ouvrier:
    "Consulte son planning, ses interventions et les chantiers où il est affecté. Ne voit aucun montant.",
}

// ----------------------------------------------------------------------------
// Capacités fines — utilisées pour masquer/afficher des éléments d'UI et pour
// décider, plus tard (Push 2), des règles de masquage en base.
// ----------------------------------------------------------------------------

export interface RoleCapabilities {
  /** Voit les montants des devis / chantiers (prix, totaux). */
  voitMontants: boolean
  /** Voit les indicateurs financiers globaux (CA, encaissements, statistiques). */
  voitFinancesGlobales: boolean
  /** Accès aux factures. */
  accesFactures: boolean
  /** Accès aux devis. */
  accesDevis: boolean
  /** Accès aux achats / fournisseurs. */
  accesAchats: boolean
  /** Accès au répertoire clients. */
  accesClients: boolean
  /** Accès aux chantiers. */
  accesChantiers: boolean
  /** Accès au planning. */
  accesPlanning: boolean
  /** Accès aux paramètres de l'entreprise. */
  accesParametres: boolean
  /** Accès à la page Abonnement / facturation Nexartis. */
  accesAbonnement: boolean
  /** Peut inviter / révoquer / changer le rôle des membres. */
  gereComptes: boolean
  /** Ne voit que les chantiers où il est affecté (sinon : tous ceux de l'entreprise). */
  chantiersAffectesUniquement: boolean
}

export const ROLE_CAPABILITIES: Record<UserRole, RoleCapabilities> = {
  dirigeant: {
    voitMontants: true,
    voitFinancesGlobales: true,
    accesFactures: true,
    accesDevis: true,
    accesAchats: true,
    accesClients: true,
    accesChantiers: true,
    accesPlanning: true,
    accesParametres: true,
    accesAbonnement: true,
    gereComptes: true,
    chantiersAffectesUniquement: false,
  },
  commercial: {
    voitMontants: true, // il établit les devis : il voit les prix
    voitFinancesGlobales: false, // mais pas le CA / les encaissements
    accesFactures: false,
    accesDevis: true,
    accesAchats: false,
    accesClients: true,
    accesChantiers: true,
    accesPlanning: true,
    accesParametres: false,
    accesAbonnement: false,
    gereComptes: false,
    chantiersAffectesUniquement: false,
  },
  ouvrier: {
    voitMontants: false,
    voitFinancesGlobales: false,
    accesFactures: false,
    accesDevis: false,
    accesAchats: false,
    accesClients: false, // pas de répertoire ; il voit le client via SES chantiers
    accesChantiers: true,
    accesPlanning: true,
    accesParametres: false,
    accesAbonnement: false,
    gereComptes: false,
    chantiersAffectesUniquement: true,
  },
}

export function getCapabilities(role: UserRole): RoleCapabilities {
  return ROLE_CAPABILITIES[role] ?? ROLE_CAPABILITIES.ouvrier
}

// ----------------------------------------------------------------------------
// Gardes de route — quelles routes /dashboard chaque rôle peut ouvrir.
// On raisonne par préfixe (le plus spécifique gagne). Tout ce qui n'est pas
// listé est, par défaut, réservé au dirigeant (principe du moindre privilège).
// Utilisé par la garde de route du layout dashboard (Push 2).
// ----------------------------------------------------------------------------

interface RouteRule {
  prefix: string
  roles: UserRole[]
}

// Ordonné du plus spécifique au plus général (important : on prend la 1re
// règle dont le préfixe correspond).
const ROUTE_RULES: RouteRule[] = [
  // Devis vocal et création : commercial + dirigeant
  { prefix: '/dashboard/devis', roles: ['dirigeant', 'commercial'] },
  { prefix: '/dashboard/factures', roles: ['dirigeant'] },
  // Documents types (CGV, PV de réception) : dirigeant + commercial.
  { prefix: '/dashboard/documents', roles: ['dirigeant', 'commercial'] },
  // Rapports d'intervention : dirigeant + commercial (comme la RLS).
  { prefix: '/dashboard/rapports', roles: ['dirigeant', 'commercial'] },
  { prefix: '/dashboard/achats', roles: ['dirigeant'] },
  // Dépenses & Banque (Lot 2a) : données financières → dirigeant uniquement,
  // comme la RLS des tables banque_* (sans cette ligne, la règle générale
  // '/dashboard' en fin de liste ouvrirait la route à tous les rôles).
  { prefix: '/dashboard/banque', roles: ['dirigeant'] },
  { prefix: '/dashboard/fournisseurs', roles: ['dirigeant'] },
  { prefix: '/dashboard/statistiques', roles: ['dirigeant'] },
  { prefix: '/dashboard/clients', roles: ['dirigeant', 'commercial'] },
  { prefix: '/dashboard/prestations', roles: ['dirigeant', 'commercial'] },
  { prefix: '/dashboard/materiel', roles: ['dirigeant', 'commercial'] },
  { prefix: '/dashboard/planning', roles: ['dirigeant', 'commercial', 'ouvrier'] },
  { prefix: '/dashboard/chantiers', roles: ['dirigeant', 'commercial', 'ouvrier'] },
  { prefix: '/dashboard/equipe', roles: ['dirigeant', 'commercial', 'ouvrier'] }, // visible, mais gestion des comptes gardée par gereComptes
  { prefix: '/dashboard/parametres', roles: ['dirigeant'] },
  { prefix: '/dashboard/abonnement', roles: ['dirigeant'] },
  { prefix: '/dashboard/import', roles: ['dirigeant'] },
  { prefix: '/dashboard/corbeille', roles: ['dirigeant', 'commercial'] },
  { prefix: '/dashboard/admin', roles: ['dirigeant'] },
  { prefix: '/dashboard/aide', roles: ['dirigeant', 'commercial', 'ouvrier'] },
  // Accueil : accessible à tous (le contenu financier y est masqué selon le rôle)
  { prefix: '/dashboard', roles: ['dirigeant', 'commercial', 'ouvrier'] },
]

/** Page d'atterrissage par défaut selon le rôle (après login / si accès refusé). */
export const DEFAULT_LANDING: Record<UserRole, string> = {
  dirigeant: '/dashboard',
  commercial: '/dashboard',
  ouvrier: '/dashboard/planning',
}

/**
 * Indique si un rôle peut ouvrir une route /dashboard donnée.
 * Le dirigeant a toujours accès à tout.
 */
export function canAccessDashboardPath(role: UserRole, pathname: string): boolean {
  if (role === 'dirigeant') return true
  for (const rule of ROUTE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      return rule.roles.includes(role)
    }
  }
  // Non listé → réservé au dirigeant.
  return false
}

/** Garde-fou : valide qu'une chaîne arbitraire est bien un rôle connu. */
export function isUserRole(value: unknown): value is UserRole {
  return value === 'dirigeant' || value === 'commercial' || value === 'ouvrier'
}
