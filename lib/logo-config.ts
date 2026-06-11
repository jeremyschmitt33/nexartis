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
  // V3.1.7 : si false, le wordmark "Nom Société" n'est pas affiche a cote du
  // logo (le logo prend la place liberee). Par defaut true (backward-compat).
  showCompanyName: boolean
}

export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  style: 'carte-classique',
  logoSize: 100,
  nomSize: 100,
  showCompanyName: true,
}

// V3.1.7 : facteur d'agrandissement applique au logo quand le nom est masque.
// La largeur libre dans le bandeau passe de ~50% (logo + nom) a presque tout
// le cote gauche. On agrandit le logo en restant raisonnable (1.2x = ~20% plus grand
// que la taille de base, sans dominer le bandeau). V3.x : reduit de 1.55 a 1.2
// suite retour utilisateur (logo trop gros quand le nom est masque).
export const LOGO_LARGE_FACTOR = 1.2

export const LOGO_STYLE_LABELS: Record<LogoStyle, string> = {
  'carte-classique':    'Carte blanche classique',
  'carte-minimaliste':  'Carte minimaliste',
  'sans-carte':         'Sans carte (logo direct)',
}

export const LOGO_STYLE_DESCRIPTIONS: Record<LogoStyle, string> = {
  'carte-classique':    'Carte blanche arrondie autour du logo. Robuste pour tous les logos.',
  'carte-minimaliste':  'Carte blanche plus discrete. Compromis elegant.',
  'sans-carte':         'Logo pose directement sur le bandeau, sans carte blanche. A reserver aux logos detoures (PNG a fond transparent ou SVG) — sinon le fond blanc de votre fichier reste visible.',
}

export function logoConfigFromEntreprise(entreprise: any | null): LogoConfig {
  if (!entreprise) return DEFAULT_LOGO_CONFIG
  const style = entreprise.doc_logo_style as string | null
  const logoSize = entreprise.doc_logo_size as number | null
  const nomSize = entreprise.doc_nom_size as number | null
  // V3.1.7 : null/undefined = TRUE (backward-compat strict). Seul un FALSE
  // explicite enregistre par l'artisan masque le wordmark.
  const showCompanyNameRaw = entreprise.document_show_company_name as boolean | null | undefined

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
    showCompanyName: showCompanyNameRaw === false ? false : true,
  }
}

export function logoConfigToCssVars(cfg: LogoConfig): Record<string, string> {
  // V3.x : "la carte epouse le logo". Taille pilotee par la HAUTEUR du logo ;
  // la largeur = fit-content (CSS) plafonnee a --dv-logo-maxw. Memes valeurs
  // (proportionnelles, ~3.47px/mm) que le PDF (lib/pdf/header.ts) -> PDF == HTML.
  const baseHpx = cfg.style === 'carte-minimaliste' ? 76 : 90
  const LOGO_H_MAX_PX = 132
  const nomBase = 41
  const clampedLogoSize = Math.min(130, Math.max(70, cfg.logoSize))
  const clampedNomSize = Math.min(130, Math.max(70, cfg.nomSize))
  const sizeMultiplier = cfg.showCompanyName ? 1 : LOGO_LARGE_FACTOR
  const logoH = Math.round(Math.min(baseHpx * (clampedLogoSize / 100) * sizeMultiplier, LOGO_H_MAX_PX))
  const padPx = cfg.style === 'sans-carte' ? 0 : cfg.style === 'carte-minimaliste' ? 5 : 9
  const cardH = logoH + 2 * padPx
  const maxW = cfg.showCompanyName ? 167 : 222 // = 48mm / 64mm cote PDF
  return {
    '--dv-logo-card-h': cardH + 'px',
    '--dv-logo-card-pad': padPx + 'px',
    '--dv-logo-maxw': maxW + 'px',
    '--dv-nom-size': Math.round((nomBase * clampedNomSize) / 100) + 'px',
    '--dv-logo-card-bg': cfg.style === 'sans-carte' ? 'transparent' : '#ffffff',
    '--dv-logo-card-shadow': cfg.style === 'sans-carte' ? 'none' : cfg.style === 'carte-minimaliste' ? '0 1px 3px rgba(0,0,0,.12)' : '0 2px 8px rgba(0,0,0,.18)',
    '--dv-logo-card-radius': cfg.style === 'carte-minimaliste' ? '12px' : '20px',
    '--dv-name-display': cfg.showCompanyName ? 'block' : 'none',
    '--dv-brandtext-display': cfg.showCompanyName ? 'flex' : 'none',
  }
}
