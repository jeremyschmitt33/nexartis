/**
 * Configuration de l'incrustation du logo dans le bandeau des devis et factures.
 * Distinct de DocumentTheme (qui ne gere que les couleurs).
 *
 * Stocke en DB sur entreprises :
 *   - doc_logo_style       (TEXT)
 *   - doc_logo_size        (INTEGER, 60-140)
 *   - doc_nom_size         (INTEGER, 60-140)
 */

export type LogoStyle = 'carte-classique' | 'carte-minimaliste' | 'sans-carte'

export interface LogoConfig {
  /** Style d'incrustation du logo */
  style: LogoStyle
  /** Taille du logo en pourcentage (60-140), 100 = taille standard */
  logoSize: number
  /** Taille du nom d'entreprise en pourcentage (60-140), 100 = taille standard */
  nomSize: number
}

export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  style: 'carte-classique',
  logoSize: 100,
  nomSize: 100,
}

export const LOGO_STYLE_LABELS: Record<LogoStyle, string> = {
  'carte-classique':    'Carte blanche classique',
  'carte-minimaliste':  'Carte minimaliste',
  'sans-carte':         'Sans carte (logo direct)',
}

export const LOGO_STYLE_DESCRIPTIONS: Record<LogoStyle, string> = {
  'carte-classique':    'Carte blanche 90x90px arrondie autour du logo. Robuste pour tous les logos.',
  'carte-minimaliste':  'Carte blanche 64x64px plus discrete. Compromis elegant.',
  'sans-carte':         'Logo directement sur le bandeau colore. Conseille pour les logos PNG transparents ou SVG.',
}

/**
 * Construit un LogoConfig depuis une ligne de la table entreprises.
 * Tous les champs ont un fallback individuel au defaut Nexartis,
 * garantissant qu'une colonne null ne casse jamais le rendu.
 */
export function logoConfigFromEntreprise(entreprise: any | null): LogoConfig {
  if (!entreprise) return DEFAULT_LOGO_CONFIG
  const style = entreprise.doc_logo_style as string | null
  const logoSize = entreprise.doc_logo_size as number | null
  const nomSize = entreprise.doc_nom_size as number | null

  return {
    style: (style === 'carte-classique' || style === 'carte-minimaliste' || style === 'sans-carte')
      ? style
      : DEFAULT_LOGO_CONFIG.style,
    logoSize: (typeof logoSize === 'number' && logoSize >= 60 && logoSize <= 140)
      ? logoSize
      : DEFAULT_LOGO_CONFIG.logoSize,
    nomSize: (typeof nomSize === 'number' && nomSize >= 60 && nomSize <= 140)
      ? nomSize
      : DEFAULT_LOGO_CONFIG.nomSize,
  }
}

/**
 * Convertit un LogoConfig en variables CSS injectables sur .dv-doc
 * pour piloter le rendu du dashboard.
 */
export function logoConfigToCssVars(cfg: LogoConfig): Record<string, string> {
  // Tailles de base : carte 90x90 = 100%, logo image 100%, nom 34px = 100%
  const cardBase = 90  // px (carte-classique)
  const cardMini = 64  // px (carte-minimaliste)
  const nomBase = 34   // px (taille nom de base)

  const cardSize = cfg.style === 'sans-carte'
    ? Math.round((cardBase * cfg.logoSize) / 100)  // pas de carte, on utilise quand meme la taille comme reference
    : cfg.style === 'carte-minimaliste'
      ? Math.round((cardMini * cfg.logoSize) / 100)
      : Math.round((cardBase * cfg.logoSize) / 100)

  return {
    '--dv-logo-card-size': `${cardSize}px`,
    '--dv-logo-scale': String(cfg.logoSize / 100),
    '--dv-nom-size': `${Math.round((nomBase * cfg.nomSize) / 100)}px`,
    '--dv-logo-card-bg': cfg.style === 'sans-carte' ? 'transparent' : '#ffffff',
    '--dv-logo-card-padding': cfg.style === 'sans-carte' ? '0' : cfg.style === 'carte-minimaliste' ? '4px' : '6px',
    '--dv-logo-card-shadow': cfg.style === 'sans-carte' ? 'none' : cfg.style === 'carte-minimaliste' ? '0 1px 3px rgba(0,0,0,.12)' : '0 2px 8px rgba(0,0,0,.18)',
    '--dv-logo-card-radius': cfg.style === 'carte-minimaliste' ? '12px' : '20px',
  }
}
