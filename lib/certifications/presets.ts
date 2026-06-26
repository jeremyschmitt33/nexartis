// lib/certifications/presets.ts — Vague 3a Certifications & assurances
//
// Catalogue des types de certifications/assurances pour artisans BTP, avec
// durees de validite VERIFIEES sur le terrain, et helpers de calcul de dates
// et d'urgence.
//
// IMPORTANT : aucun import client ici (pur TS), utilisable cote serveur (cron,
// route OCR) ET cote client (composant Parametres).

export type CertificationType =
  | 'decennale'
  | 'rc_pro'
  | 'vigilance_urssaf'
  | 'rge'
  | 'qualibat'
  | 'qualifelec'
  | 'habilitation'
  | 'autre'

export interface CertificationPreset {
  type: CertificationType
  /** Libelle court pour la tuile preset. */
  label: string
  /** Intitule pre-rempli dans le formulaire. */
  intituleDefaut: string
  /** Organisme suggere (optionnel, placeholder). */
  organismeSuggere?: string
  /** Duree de validite par defaut, en mois. */
  dureeMois: number
  /** true si ce type impose un audit intermediaire (RGE a mi-parcours). */
  aAuditIntermediaire: boolean
  /** Nom court d'icone (mappe cote composant vers un SVG). */
  icone: 'bouclier' | 'medaille' | 'document' | 'eclair'
}

// Durees VERIFIEES (audit terrain) :
//  - decennale / rc_pro : attestation annuelle -> 12 mois
//  - vigilance_urssaf    : attestation valable 6 mois
//  - rge                 : 4 ans (48 mois) + audit intermediaire a mi-parcours
//  - qualibat / qualifelec : 4 ans (48 mois)
//  - habilitation electrique : recyclage tous les 3 ans (36 mois)
//  - autre               : defaut prudent 12 mois
export const CERTIFICATION_PRESETS: CertificationPreset[] = [
  {
    type: 'decennale',
    label: 'Décennale',
    intituleDefaut: 'Assurance décennale',
    organismeSuggere: 'AXA, Allianz, MAAF…',
    dureeMois: 12,
    aAuditIntermediaire: false,
    icone: 'bouclier',
  },
  {
    type: 'rc_pro',
    label: 'RC Pro',
    intituleDefaut: 'Responsabilité civile professionnelle',
    organismeSuggere: 'MAAF, Groupama…',
    dureeMois: 12,
    aAuditIntermediaire: false,
    icone: 'bouclier',
  },
  {
    type: 'vigilance_urssaf',
    label: 'Vigilance URSSAF',
    intituleDefaut: 'Attestation de vigilance',
    organismeSuggere: 'URSSAF',
    dureeMois: 6,
    aAuditIntermediaire: false,
    icone: 'document',
  },
  {
    type: 'rge',
    label: 'RGE',
    intituleDefaut: 'Certification RGE',
    organismeSuggere: "Qualit'EnR, Qualibat RGE…",
    dureeMois: 48,
    aAuditIntermediaire: true,
    icone: 'medaille',
  },
  {
    type: 'qualibat',
    label: 'Qualibat',
    intituleDefaut: 'Qualification Qualibat',
    organismeSuggere: 'Qualibat',
    dureeMois: 48,
    aAuditIntermediaire: false,
    icone: 'medaille',
  },
  {
    type: 'qualifelec',
    label: 'Qualifelec',
    intituleDefaut: 'Qualification Qualifelec',
    organismeSuggere: 'Qualifelec',
    dureeMois: 48,
    aAuditIntermediaire: false,
    icone: 'medaille',
  },
  {
    type: 'habilitation',
    label: 'Habilitation',
    intituleDefaut: 'Habilitation électrique',
    organismeSuggere: 'Organisme de formation',
    dureeMois: 36,
    aAuditIntermediaire: false,
    icone: 'eclair',
  },
  {
    type: 'autre',
    label: 'Autre',
    intituleDefaut: '',
    dureeMois: 12,
    aAuditIntermediaire: false,
    icone: 'document',
  },
]

/** Les types consideres comme "assurance" (le reste = "certification"). */
export const ASSURANCE_TYPES: CertificationType[] = ['decennale', 'rc_pro', 'vigilance_urssaf']

export function isAssurance(type: string): boolean {
  return ASSURANCE_TYPES.indexOf(type as CertificationType) !== -1
}

/** Retourne le preset correspondant a un type, ou le preset 'autre' en secours. */
export function getPreset(type: string): CertificationPreset {
  const found = CERTIFICATION_PRESETS.find((p) => p.type === type)
  return found || CERTIFICATION_PRESETS[CERTIFICATION_PRESETS.length - 1]
}

/**
 * Ajoute `mois` mois a une date ISO (YYYY-MM-DD) et renvoie la date ISO
 * resultante (YYYY-MM-DD). Calcul en UTC pour eviter tout decalage de fuseau.
 * Gere proprement les debordements de fin de mois (ex : 31/01 + 1 mois -> 28/02).
 */
export function addMonths(dateISO: string, mois: number): string {
  if (!dateISO) return ''
  const base = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`)
  if (isNaN(base.getTime())) return ''
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const d = base.getUTCDate()
  // Date cible au 1er du mois vise, puis on clampe le jour au dernier jour valide.
  const target = new Date(Date.UTC(y, m + mois, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export type EtatUrgence = 'valide' | 'bientot' | 'urgent' | 'expire'

export interface UrgenceResult {
  etat: EtatUrgence
  joursRestants: number
}

/**
 * Calcule l'etat d'urgence d'une date d'expiration.
 * Regles :
 *   - expire si joursRestants < 0
 *   - urgent si joursRestants <= 15
 *   - bientot si joursRestants <= 30
 *   - valide sinon
 * Calcul en UTC (jours pleins), aligne sur DecennaleBanner.
 */
export function computeUrgence(dateExpiration: string): UrgenceResult {
  if (!dateExpiration) {
    return { etat: 'valide', joursRestants: 9999 }
  }
  const exp = new Date(`${dateExpiration.slice(0, 10)}T00:00:00Z`)
  if (isNaN(exp.getTime())) {
    return { etat: 'valide', joursRestants: 9999 }
  }
  const now = new Date()
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const expUtcMs = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate())
  const joursRestants = Math.round((expUtcMs - todayUtcMs) / (24 * 3600 * 1000))

  let etat: EtatUrgence
  if (joursRestants < 0) etat = 'expire'
  else if (joursRestants <= 15) etat = 'urgent'
  else if (joursRestants <= 30) etat = 'bientot'
  else etat = 'valide'

  return { etat, joursRestants }
}
