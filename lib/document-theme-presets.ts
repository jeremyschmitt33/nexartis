// ---------------------------------------------------------------------------
// document-theme-presets.ts (V3.0d.1)
//
// Templates de couleurs prédéfinis pour les devis & factures.
// Chaque preset propose une combinaison "accent foncé / accent vif" inspirée
// du handoff design Claude (palettes.json) ; on duplique l'accent foncé sur
// les 3 zones (bandeau haut + carte client + footer) pour garder une marque
// cohérente, et l'accent vif sur les 2 zones (accent diagonal + Net à payer).
// La carte Émetteur reste blanche pour préserver la lisibilité.
//
// L'utilisateur peut toujours personnaliser zone par zone après avoir choisi
// un preset — c'est juste un raccourci pour aller vite.
// ---------------------------------------------------------------------------

import type { DocumentTheme } from './document-theme'
import { DEFAULT_DOCUMENT_THEME } from './document-theme'

export interface ThemePreset {
  /** Identifiant stable (kebab-case) */
  id: string
  /** Nom affiché dans la galerie */
  nom: string
  /** Le thème complet (6 zones) résultant de l'application du preset */
  theme: DocumentTheme
}

/**
 * Construit un thème à 7 zones depuis 3 couleurs principales (V3.1).
 *  - left   (foncé)   → bandeau GAUCHE + carte client + footer
 *  - right  (variante) → bandeau DROITE (zone DEVIS + numero, separee par la barre doree)
 *  - accent (vif)     → barre doree + encadré Net à payer
 *  - cadre Émetteur reste blanc (lisibilité maximale)
 */
function buildPresetTheme(left: string, right: string, accent: string): DocumentTheme {
  return {
    bandeauHaut: left,
    bandeauHautDroite: right,
    accent: accent,
    cadreEmetteur: '#ffffff',
    cadreAdresse: left,
    netPayer: accent,
    footer: left,
  }
}

/**
 * Liste des templates proposés.
 * Le premier est "Nexartis (par défaut)" — sert également de bouton reset.
 * Les 12 suivants viennent du handoff design Claude (palettes.json).
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'nexartis-defaut',
    nom: 'Nexartis (par défaut)',
    theme: DEFAULT_DOCUMENT_THEME,
  },
  {
    id: 'bleu-nuit-ambre',
    nom: 'Bleu nuit · Ambre',
    theme: buildPresetTheme('#15233b', '#3856a8', '#dd9138'),
  },
  {
    id: 'vert-sapin-cuivre',
    nom: 'Vert sapin · Cuivre',
    theme: buildPresetTheme('#1c3d31', '#5a8a6b', '#c17a4b'),
  },
  {
    id: 'anthracite-or',
    nom: 'Anthracite · Or',
    theme: buildPresetTheme('#26292e', '#4a5d70', '#c9a227'),
  },
  {
    id: 'bordeaux-sable',
    nom: 'Bordeaux · Sable',
    theme: buildPresetTheme('#45202a', '#9a4530', '#d39a6b'),
  },
  {
    id: 'encre-laiton',
    nom: 'Encre · Laiton',
    theme: buildPresetTheme('#1a1d24', '#3b3a6a', '#b9954e'),
  },
  {
    id: 'bleu-petrole-corail',
    nom: 'Bleu pétrole · Corail',
    theme: buildPresetTheme('#123b42', '#2e7a82', '#e07856'),
  },
  {
    id: 'marine-turquoise',
    nom: 'Marine · Turquoise',
    theme: buildPresetTheme('#102a43', '#2c5c8a', '#2c9c9c'),
  },
  {
    id: 'foret-moutarde',
    nom: 'Forêt · Moutarde',
    theme: buildPresetTheme('#1f3324', '#5a6f30', '#cba135'),
  },
  {
    id: 'ardoise-bleu-ciel',
    nom: 'Ardoise · Bleu ciel',
    theme: buildPresetTheme('#2b3440', '#2e4e75', '#6592b8'),
  },
  {
    id: 'aubergine-champagne',
    nom: 'Aubergine · Champagne',
    theme: buildPresetTheme('#2e2138', '#6a3e85', '#cbb279'),
  },
  {
    id: 'graphite-bleu-vif',
    nom: 'Graphite · Bleu vif',
    theme: buildPresetTheme('#25282d', '#2a3d5c', '#4a76d4'),
  },
  {
    id: 'brique-creme',
    nom: 'Brique · Crème',
    theme: buildPresetTheme('#5b2f22', '#a8553a', '#e2b488'),
  },
]

/**
 * Compare deux thèmes (égalité stricte des 6 zones, casse-insensible).
 * Utile pour déterminer quel preset est "actuellement actif" dans la galerie.
 */
export function themesEqual(a: DocumentTheme, b: DocumentTheme): boolean {
  const keys: (keyof DocumentTheme)[] = [
    'bandeauHaut',
    'bandeauHautDroite',
    'accent',
    'cadreEmetteur',
    'cadreAdresse',
    'netPayer',
    'footer',
  ]
  return keys.every((k) => a[k].toLowerCase() === b[k].toLowerCase())
}

/**
 * Retourne l'id du preset correspondant au thème courant, ou null si aucune
 * correspondance exacte (cas d'une personnalisation manuelle).
 */
export function findActivePresetId(theme: DocumentTheme): string | null {
  for (const preset of THEME_PRESETS) {
    if (themesEqual(preset.theme, theme)) return preset.id
  }
  return null
}
