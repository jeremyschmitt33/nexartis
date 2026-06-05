/**
 * Theme de couleurs personnalisable des documents (devis & factures).
 *
 * Ce module centralise :
 *  - le type DocumentTheme (6 zones de couleur)
 *  - les valeurs par defaut Nexartis (charte historique)
 *  - les helpers de conversion DB -> theme, theme -> CSS variables
 *  - les utilitaires couleur (luminance YIQ, hex -> RGB, validation)
 *
 * Il est consomme par :
 *  - components/document/DocumentRender.tsx (rendu HTML)
 *  - lib/pdf/palette.ts (rendu PDF via jsPDF)
 *  - components/parametres/DocumentThemePicker.tsx (UI Apparence)
 *  - app/api/parametres/document-theme/route.ts (API GET/PATCH)
 */

import type { CSSProperties } from 'react'

// ============================================================
// TYPES
// ============================================================

/**
 * Theme de 6 couleurs applicables aux documents (devis & factures).
 * Toutes les valeurs sont des chaines au format hex #RRGGBB (minuscules).
 */
export interface DocumentTheme {
  /** Bandeau d en-tete (zone GAUCHE : logo + nom artisan) */
  bandeauHaut: string
  /** Bandeau d en-tete (zone DROITE : DEVIS + numero + dates), separe par la barre doree */
  bandeauHautDroite: string
  /** Couleur d accent (la barre doree oblique qui separe gauche et droite) */
  accent: string
  /** Fond de la carte Emetteur (bloc entreprise) */
  cadreEmetteur: string
  /** Fond de la carte Adresse a (bloc destinataire) */
  cadreAdresse: string
  /** Fond de l encadre Net a payer (montant TTC) */
  netPayer: string
  /** Fond du bandeau de pied de page (coordonnees) */
  footer: string
}

// ============================================================
// CONSTANTES
// ============================================================

/**
 * Theme par defaut Nexartis (charte historique).
 * Utilise comme fallback quand l entreprise n a pas (encore) configure ses couleurs,
 * et comme reset cible quand l utilisateur clique sur "Reinitialiser".
 */
export const DEFAULT_DOCUMENT_THEME: DocumentTheme = {
  bandeauHaut: '#0f1a3a',
  bandeauHautDroite: '#0f1a3a',
  accent: '#e87a2a',
  cadreEmetteur: '#ffffff',
  cadreAdresse: '#0f1a3a',
  netPayer: '#e87a2a',
  footer: '#0f1a3a',
}

// ============================================================
// HELPERS DB <-> THEME
// ============================================================

/**
 * Construit un DocumentTheme depuis une ligne de la table entreprises.
 * Chaque champ a un fallback individuel au defaut Nexartis, ce qui
 * garantit qu une colonne null/undefined ne casse jamais le rendu.
 *
 * @param entreprise - ligne entreprise (ou null si non chargee)
 */
export function themeFromEntreprise(entreprise: any | null): DocumentTheme {
  if (!entreprise) return DEFAULT_DOCUMENT_THEME

  return {
    bandeauHaut:
      entreprise.doc_color_bandeau_haut || DEFAULT_DOCUMENT_THEME.bandeauHaut,
    bandeauHautDroite:
      entreprise.doc_color_bandeau_haut_droite || entreprise.doc_color_bandeau_haut || DEFAULT_DOCUMENT_THEME.bandeauHautDroite,
    accent:
      entreprise.doc_color_accent || DEFAULT_DOCUMENT_THEME.accent,
    cadreEmetteur:
      entreprise.doc_color_cadre_emetteur || DEFAULT_DOCUMENT_THEME.cadreEmetteur,
    cadreAdresse:
      entreprise.doc_color_cadre_adresse || DEFAULT_DOCUMENT_THEME.cadreAdresse,
    netPayer:
      entreprise.doc_color_net_payer || DEFAULT_DOCUMENT_THEME.netPayer,
    footer:
      entreprise.doc_color_footer || DEFAULT_DOCUMENT_THEME.footer,
  }
}

// ============================================================
// HELPERS RENDU HTML
// ============================================================

/**
 * Convertit un DocumentTheme en objet style React (CSS custom properties).
 * Le rendu HTML (DocumentRender) applique cet objet sur le wrapper .dv-doc,
 * ce qui propage les couleurs et les couleurs de texte calculees a tout le
 * sous-arbre via les variables CSS --dv-c-*.
 *
 * Les couleurs de texte (--dv-c-*-ink) sont calculees automatiquement
 * via l algorithme YIQ : sombre sur fond clair, blanc sur fond fonce.
 */
export function themeToCssVars(theme: DocumentTheme): CSSProperties {
  return {
    // Couleurs de fond (parametrables)
    '--dv-c-bandeau': theme.bandeauHaut,
    '--dv-c-bandeau-droite': theme.bandeauHautDroite,
    '--dv-c-accent': theme.accent,
    '--dv-c-emetteur': theme.cadreEmetteur,
    '--dv-c-adresse': theme.cadreAdresse,
    '--dv-c-netpayer': theme.netPayer,
    '--dv-c-footer': theme.footer,
    // Couleurs de texte calculees (blanc/sombre selon luminance)
    '--dv-c-bandeau-ink': isLight(theme.bandeauHaut) ? '#1c1304' : '#ffffff',
    '--dv-c-bandeau-droite-ink': isLight(theme.bandeauHautDroite) ? '#1c1304' : '#ffffff',
    '--dv-c-emetteur-ink': isLight(theme.cadreEmetteur) ? '#0f1a3a' : '#ffffff',
    '--dv-c-adresse-ink': isLight(theme.cadreAdresse) ? '#0f1a3a' : '#ffffff',
    '--dv-c-netpayer-ink': isLight(theme.netPayer) ? '#1c1304' : '#ffffff',
    '--dv-c-footer-ink': isLight(theme.footer) ? '#1c1304' : '#ffffff',
  } as CSSProperties
}

// ============================================================
// UTILITAIRES COULEUR
// ============================================================

/**
 * Algorithme YIQ : determine si une couleur hex est "claire".
 * Retourne true si la luminance perçue >= 128 (texte sombre recommande).
 *
 * Formule standard W3C : Y = (R*299 + G*587 + B*114) / 1000
 *
 * @param hex - couleur au format #RRGGBB (case-insensitive)
 */
export function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128
}

/**
 * Convertit une couleur hex en tuple RGB [r, g, b] entiers 0-255.
 * Utilise pour jsPDF qui consomme les couleurs en composantes numeriques.
 *
 * @param hex - couleur au format #RRGGBB (case-insensitive)
 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/**
 * Validation stricte d une couleur hex au format #RRGGBB.
 * Refuse les raccourcis #RGB, les couleurs nommees, les rgba(), etc.
 *
 * @param hex - chaine a valider
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}
