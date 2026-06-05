/**
 * Configuration de l'incrustation du logo dans le bandeau des devis et factures.
 * Distinct de DocumentTheme (qui ne gere que les couleurs).
 *
 * V3.1.5 : Alignement nom artisan sur taille DEVIS (parite visuelle gauche/droite).
 *   - cardBase 104px (inchange)
 *   - nomBase = 41px (= --title-size de .dv-doc) : le nom de l'entreprise a la
 *     MEME taille que "DEVIS" cote dashboard, equilibre visuel parfait.
 *   - Slider borne a 70-130% : a 130% on a 41*1.3 = 53.3px, reste < 60px max.
 */

export type LogoStyle = 'carte-classique' | 'carte-minimaliste' | 'sans-carte'

export interface LogoConfig {
  style: LogoStyle
  logoSize: number
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
  'carte-classique':    'Carte blanche arrondie autour du logo. Robuste pour tous les logos.',
  'carte-minimaliste':  'Carte blanche plus discrete. Compromis elegant.',
  'sans-carte':         'Logo directement sur le bandeau colore. Conseille pour les logos PNG transparents ou SVG.',
}

export function logoConfigFromEntreprise(entreprise: any | null): LogoConfig {
  if (!entreprise) return DEFAULT_LOGO_CONFIG
  const style = entreprise.doc_logo_style as string | null
  const logoSize = entreprise.doc_logo_size as number | null
  const nomSize = entreprise.doc_nom_size as number | null

  const safeLogoSize = typeof logoSize === 'number'
    ? Math.min(130, Math.max(70, logoSize))
    : DEFAULT_LOGO_CONFIG.logoSize
  const safeNomSize = typeof nomSize === 'number'
    ? Math.min(130, Math.max(70, nomSize))
    : DEFAULT_LOGO_CONFIG.nomSize

  return {
    style: (style === 'carte-classique' || style === 'carte-minimaliste' || style === 'sans-carte')
      ? style
      : DEFAULT_LOGO_CONFIG.style,
    logoSize: safeLogoSize,
    nomSize: safeNomSize,
  }
}

export function logoConfigToCssVars(cfg: LogoConfig): Record<string, string> {
  const cardBase = 104
  const cardMini = 72
  // V3.1.5 : nomBase = 41px = --title-size (= taille de "DEVIS" cote dashboard).
  // A 100% le nom et le titre ont strictement la meme taille -> equilibre visuel.
  const nomBase = 41

  const clampedLogoSize = Math.min(130, Math.max(70, cfg.logoSize))
  const clampedNomSize = Math.min(130, Math.max(70, cfg.nomSize))

  const cardSize = cfg.style === 'carte-minimaliste'
    ? Math.round((cardMini * clampedLogoSize) / 100)
    : Math.round((cardBase * clampedLogoSize) / 100)

  return {
    '--dv-logo-card-size': cardSize + 'px',
    '--dv-logo-scale': String(clampedLogoSize / 100),
    '--dv-nom-size': Math.round((nomBase * clampedNomSize) / 100) + 'px',
    '--dv-logo-card-bg': cfg.style === 'sans-carte' ? 'transparent' : '#ffffff',
    '--dv-logo-card-padding': cfg.style === 'sans-carte' ? '0' : cfg.style === 'carte-minimaliste' ? '4px' : '6px',
    '--dv-logo-card-shadow': cfg.style === 'sans-carte' ? 'none' : cfg.style === 'carte-minimaliste' ? '0 1px 3px rgba(0,0,0,.12)' : '0 2px 8px rgba(0,0,0,.18)',
    '--dv-logo-card-radius': cfg.style === 'carte-minimaliste' ? '12px' : '20px',
  }
}
