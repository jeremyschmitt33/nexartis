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
  // V3.2 : logo seul par defaut (le nom n'apparait plus a cote du logo).
  showCompanyName: false,
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
  // V3.2 : null/undefined = FALSE (logo seul par defaut). Seul un TRUE
  // explicite enregistre par l'artisan affiche le nom (sous le logo, en petit).
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
    showCompanyName: showCompanyNameRaw === true ? true : false,
  }
}

export function logoConfigToCssVars(cfg: LogoConfig): Record<string, string> {
  // V3.x : "la carte epouse le logo". Taille pilotee par la HAUTEUR du logo ;
  // la largeur = fit-content (CSS) plafonnee a --dv-logo-maxw. Memes valeurs
  // (proportionnelles, ~3.47px/mm) que le PDF (lib/pdf/header.ts) -> PDF == HTML.
  // V3.2 : bandeau ~13% moins haut. Base logo 90 -> 78px (classique), 76 -> 66px
  // (minimaliste), plafond 132 -> 115px. Coherent avec headerH PDF 50 -> 43.5mm.
  const baseHpx = cfg.style === 'carte-minimaliste' ? 66 : 78
  const LOGO_H_MAX_PX = 115
  // V3.2 : quand le nom est affiche, il va EN PETIT SOUS le logo (plus a cote).
  // Taille reduite (~15px de base) pour rester contenu dans la zone gauche sans
  // jamais toucher la diagonale doree.
  const nomBase = 15
  const clampedLogoSize = Math.min(130, Math.max(70, cfg.logoSize))
  const clampedNomSize = Math.min(130, Math.max(70, cfg.nomSize))
  const sizeMultiplier = cfg.showCompanyName ? 1 : LOGO_LARGE_FACTOR
  const logoH = Math.round(Math.min(baseHpx * (clampedLogoSize / 100) * sizeMultiplier, LOGO_H_MAX_PX))
  const padPx = cfg.style === 'sans-carte' ? 0 : cfg.style === 'carte-minimaliste' ? 5 : 9
  const cardH = logoH + 2 * padPx
  // V3.2 : la zone gauche du bandeau (logo + nom dessous) reste large et bornee
  // bien avant la diagonale (CSS max-width:46% sur .dv-d-brand fait le clamp dur).
  const maxW = 200
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
