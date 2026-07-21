/**
 * Module Plan 2D — Profils métier (Push 3a, 03/07/2026)
 *
 * Config PURE, zéro dépendance React, versionnée dans le code (pas de DB).
 * ARCHITECTURE (spec §1, validée à l'unanimité) : le moteur (lib/plan/metrics)
 * calcule TOUT en permanence ; le profil métier ne fait que FILTRER l'affichage
 * (palette de symboles + panneau métrés). Le plan JSONB reste agnostique.
 *
 * - Profils ACTIFS : peintre, carreleur/solier, plaquiste, électricien,
 *   plombier, menuiserie, TCE (« Tous les métrés », toujours en 1re position).
 * - maconnerie / chauffagiste : configurés mais `actif: false`
 *   (flag off tant que leurs métrés ne sont pas branchés / validés).
 * - NF C 15-100 : TOUJOURS « suggestion indicative — à vérifier »,
 *   JAMAIS « conforme » (la conformité, c'est le Consuel).
 */

import type { ModeDeduction, Symbole } from './types'

/** Identifiants des profils métier (stockés dans plans.metier_defaut). */
export type MetierId =
  | 'tce'
  | 'peintre'
  | 'carreleur_solier'
  | 'plaquiste'
  | 'electricien'
  | 'plombier'
  | 'maconnerie'
  | 'menuiserie'
  | 'chauffagiste'

/** Métrés affichables dans le panneau (clés de filtrage, le moteur calcule tout). */
export type MetreCle =
  | 'murs'
  | 'plafond'
  | 'plinthes'
  | 'sol'
  | 'chutes'
  | 'compteurs_elec'
  | 'nfc15100'
  | 'compteurs_eau'

export interface ProfilMetier {
  id: MetierId
  /** Libellé FR affiché (pill vue métier, wizard, titres du panneau). */
  label: string
  /** Clé d'icône (rendue par les composants UI, SVG inline). */
  icone: string
  /** false = codé mais non proposé dans l'UI (non validé terrain). */
  actif: boolean
  /** Mode de déduction murale proposé par DÉFAUT pour ce métier. */
  deductionDefaut: ModeDeduction
  /** Métrés affichés dans le panneau pour ce profil. */
  metres: MetreCle[]
  /** Symboles posables proposés dans la palette (clés de lib/plan/symboles). */
  symboles: string[]
}

/** Palette électricien — 12 symboles (catalogue dans lib/plan/symboles.ts). */
export const SYMBOLES_ELECTRICIEN = [
  'prise_16a',
  'prise_double',
  'prise_32a',
  'prise_rj45',
  'prise_tv',
  'interrupteur',
  'va_et_vient',
  'dcl_plafond',
  'applique',
  'tableau',
  'sortie_cable',
  'vmc',
] as const

/** Palette plombier — 10 symboles. */
export const SYMBOLES_PLOMBIER = [
  'evier',
  'lavabo',
  'wc',
  'douche',
  'baignoire',
  'lave_linge',
  'lave_vaisselle',
  'chauffe_eau',
  'nourrice',
  'robinet_ext',
] as const

export const PROFILS: Record<MetierId, ProfilMetier> = {
  tce: {
    id: 'tce',
    label: 'Tous les métrés',
    icone: 'tce',
    actif: true,
    deductionDefaut: 'totale',
    metres: ['sol', 'chutes', 'murs', 'plafond', 'plinthes', 'compteurs_elec', 'nfc15100', 'compteurs_eau'],
    symboles: [...SYMBOLES_ELECTRICIEN, ...SYMBOLES_PLOMBIER],
  },
  peintre: {
    id: 'peintre',
    label: 'Peinture',
    icone: 'peintre',
    actif: true,
    // Règle usuelle du peintre : seules les ouvertures > 0,5 m² sont déduites
    // (le temps de découpe compense la surface non peinte).
    deductionDefaut: 'sup05',
    metres: ['murs', 'plafond', 'plinthes'],
    symboles: [],
  },
  carreleur_solier: {
    id: 'carreleur_solier',
    label: 'Carrelage / sols',
    icone: 'carreleur_solier',
    actif: true,
    deductionDefaut: 'totale',
    metres: ['sol', 'chutes', 'plinthes'],
    symboles: [],
  },
  plaquiste: {
    id: 'plaquiste',
    label: 'Plâtrerie',
    icone: 'plaquiste',
    actif: true,
    // Usage Placo : seules les ouvertures > 2,5 m² sont déduites.
    deductionDefaut: 'sup25',
    metres: ['murs', 'plafond'],
    symboles: [],
  },
  electricien: {
    id: 'electricien',
    label: 'Électricité',
    icone: 'electricien',
    actif: true,
    deductionDefaut: 'totale',
    metres: ['compteurs_elec', 'nfc15100'],
    symboles: [...SYMBOLES_ELECTRICIEN],
  },
  plombier: {
    id: 'plombier',
    label: 'Plomberie',
    icone: 'plombier',
    actif: true,
    deductionDefaut: 'totale',
    metres: ['compteurs_eau'],
    symboles: [...SYMBOLES_PLOMBIER],
  },
  // ── Flag off : configurés, non proposés dans l'UI (spec §1) ──────────────
  maconnerie: {
    id: 'maconnerie',
    label: 'Maçonnerie',
    icone: 'maconnerie',
    actif: false,
    deductionDefaut: 'totale',
    metres: ['sol', 'murs'],
    symboles: [],
  },
  menuiserie: {
    id: 'menuiserie',
    label: 'Menuiserie',
    icone: 'menuiserie',
    actif: true, // activé 21/07/2026 : les ouvertures dessinées partent au devis
    deductionDefaut: 'totale',
    metres: [],
    symboles: [],
  },
  chauffagiste: {
    id: 'chauffagiste',
    label: 'Chauffage',
    icone: 'chauffagiste',
    actif: false,
    deductionDefaut: 'totale',
    metres: ['compteurs_eau'],
    symboles: [],
  },
}

/** Ordre du popover « Vue métier » : TCE toujours en 1er, puis les actifs. */
export const ORDRE_VUES: MetierId[] = [
  'tce',
  'peintre',
  'carreleur_solier',
  'plaquiste',
  'electricien',
  'plombier',
  'menuiserie',
]

/** Métiers proposés à l'étape 1 du wizard de création (6 actifs). */
export const METIERS_WIZARD: MetierId[] = [
  'electricien',
  'plombier',
  'menuiserie',
  'peintre',
  'carreleur_solier',
  'plaquiste',
  'tce',
]

/** Coefficient de chutes carrelage par défaut, en % (TOUJOURS visible/éditable). */
export const CHUTES_DEFAUT_PCT = 10

/**
 * Résout un `metier_defaut` venant de la base (TEXT nullable) vers un profil
 * sûr : inconnu, null ou profil inactif → 'tce' (Tous les métrés).
 */
export function profilDe(id: string | null | undefined): ProfilMetier {
  const p = id ? PROFILS[id as MetierId] : undefined
  return p && p.actif ? p : PROFILS.tce
}

/* ---------------------------------------------------------------------------
   Compteurs de symboles (électricité / plomberie) — par pièce ou par niveau
--------------------------------------------------------------------------- */

/** Types comptés comme « prises » (courant fort) pour la NF C 15-100. */
const TYPES_PRISES = ['prise_16a', 'prise_double', 'prise_32a']
/** Commandes d'éclairage. */
const TYPES_COMMANDES = ['interrupteur', 'va_et_vient']
/** Points lumineux. */
const TYPES_LUMIERES = ['dcl_plafond', 'applique']
/** Prises courant faible (comptées à part, hors NF prises). */
const TYPES_COURANT_FAIBLE = ['prise_rj45', 'prise_tv']
/** Autres équipements élec (m4, audit 3a) : comptés dans une ligne dédiée. */
const TYPES_AUTRES_ELEC = ['vmc', 'sortie_cable']
/** Points d'eau (plomberie). */
const TYPES_POINTS_EAU = [
  'evier',
  'lavabo',
  'wc',
  'douche',
  'baignoire',
  'lave_linge',
  'lave_vaisselle',
  'chauffe_eau',
  'robinet_ext',
]

export interface CompteursElec {
  /** Nombre d'appareillages posés (une prise double = 1 appareillage). */
  prises: number
  /**
   * Nombre de SOCLES au sens NF C 15-100 (une prise double = 2 socles).
   * C'est cette valeur qui se compare aux minima de la norme.
   */
  socles: number
  courantFaible: number
  commandes: number
  lumieres: number
  tableaux: number
  /** VMC + sorties de câble (m4) : ligne « Autres équipements » du panneau. */
  autres: number
}

export function compteursElec(symbols: Symbole[]): CompteursElec {
  const c: CompteursElec = { prises: 0, socles: 0, courantFaible: 0, commandes: 0, lumieres: 0, tableaux: 0, autres: 0 }
  for (const s of symbols) {
    if (TYPES_PRISES.includes(s.type)) {
      c.prises++
      c.socles += s.type === 'prise_double' ? 2 : 1
    } else if (TYPES_COURANT_FAIBLE.includes(s.type)) c.courantFaible++
    else if (TYPES_COMMANDES.includes(s.type)) c.commandes++
    else if (TYPES_LUMIERES.includes(s.type)) c.lumieres++
    else if (s.type === 'tableau') c.tableaux++
    else if (TYPES_AUTRES_ELEC.includes(s.type)) c.autres++
  }
  return c
}

export interface CompteursEau {
  /** Nombre total de points d'eau (WC, lavabo, douche…). */
  pointsEau: number
  /** Détail par type de symbole (uniquement les types présents). */
  parType: { type: string; nombre: number }[]
}

export function compteursPlomberie(symbols: Symbole[]): CompteursEau {
  const parType = new Map<string, number>()
  let pointsEau = 0
  for (const s of symbols) {
    if (TYPES_POINTS_EAU.includes(s.type) || s.type === 'nourrice') {
      parType.set(s.type, (parType.get(s.type) ?? 0) + 1)
      if (TYPES_POINTS_EAU.includes(s.type)) pointsEau++
    }
  }
  return {
    pointsEau,
    parType: Array.from(parType.entries()).map(([type, nombre]) => ({ type, nombre })),
  }
}

/* ---------------------------------------------------------------------------
   NF C 15-100 — SUGGESTION INDICATIVE (jamais « conforme », spec §1)
--------------------------------------------------------------------------- */

/** Règle simple par type de pièce (table validée par l'étude métier). */
const REGLES_NFC: { motifs: string[]; libelle: string; min: number; parM2: number | null }[] = [
  // Séjour : 1 prise / 4 m², minimum 5 ; au-delà de 28 m² → 7 conseillées.
  { motifs: ['séjour', 'sejour', 'salon'], libelle: 'Séjour', min: 5, parM2: 4 },
  { motifs: ['chambre'], libelle: 'Chambre', min: 3, parM2: null },
  { motifs: ['cuisine'], libelle: 'Cuisine', min: 6, parM2: null },
]

export interface SuggestionNfc {
  libelle: string
  prisesConseillees: number
  /** Phrase complète prête à afficher (se termine par « à vérifier »). */
  texte: string
}

/**
 * Suggestion NF C 15-100 pour une pièce : nombre de prises conseillées selon
 * le type de pièce (déduit du nom) et la surface. Retourne null si aucune
 * règle simple ne s'applique. Le wording reste TOUJOURS indicatif.
 */
export function suggestionNfc(
  nomPiece: string,
  aireM2: number,
  prisesPosees: number
): SuggestionNfc | null {
  const nom = nomPiece.toLowerCase()
  const regle = REGLES_NFC.find((r) => r.motifs.some((m) => nom.includes(m)))
  if (!regle) return null
  let conseil = regle.min
  if (regle.parM2 !== null) {
    conseil = aireM2 > 28 ? 7 : Math.max(regle.min, Math.ceil(aireM2 / regle.parM2))
  }
  const aire = aireM2.toFixed(1).replace('.', ',')
  const s = conseil > 1 ? 's' : ''
  const posees = prisesPosees > 1 ? 'posées' : 'posée'
  const texte =
    `${regle.libelle} ${aire} m² → ${conseil} prise${s} min conseillée${s} — ` +
    `${prisesPosees} ${posees}, à vérifier.`
  return { libelle: regle.libelle, prisesConseillees: conseil, texte }
}
