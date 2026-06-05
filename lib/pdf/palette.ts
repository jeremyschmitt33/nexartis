// lib/pdf/palette.ts - V3.0d
// Palette unique du generateur PDF "Edition Signature".
// V3.0d : la palette est desormais CONSTRUITE a partir d'un DocumentTheme optionnel.
// Le helper buildPalette(theme | null) retourne la palette finale fusionnee.
// L'export `C` est conserve (= buildPalette(null) = charte Nexartis historique)
// pour rester retro-compatible avec tous les modules pdf/* qui importent `C`.
//
// Aucun composant pdf/* ne doit hardcoder une couleur — toutes les couleurs
// thematables doivent passer par les cles "navy" (bandeau/footer/adresse) et
// "orange" (accent/netPayer). Quand un theme est applique, ces alias sont
// dynamiquement remplaces par les couleurs du theme.

import { DEFAULT_DOCUMENT_THEME, hexToRgb, isLight, type DocumentTheme } from '@/lib/document-theme'

export type RGB = readonly [number, number, number]

// ---------------------------------------------------------------------------
// Couleurs neutres (jamais thematables)
// ---------------------------------------------------------------------------
const C_BASE_NEUTRALS = {
  // Tons clairs
  cream:       [250, 245, 235] as RGB, // fond ligne niveau 1 (section)
  grayPale:    [248, 250, 252] as RGB, // fond ligne niveau 2 (sous-section)
  skyVeryPale: [240, 247, 252] as RGB, // fond encadre mentions
  white:       [255, 255, 255] as RGB,

  // Bordures + textes secondaires
  border:      [230, 236, 242] as RGB, // bordures fines, traits tableau
  borderSky:   [195, 215, 230] as RGB, // separateurs recap
  muted:       [123, 139, 163] as RGB, // labels uppercase, texte secondaire
  whiteSoft:   [220, 225, 235] as RGB, // texte baseline dans bandeau navy

  // Cadre logo placeholder
  placeholder: [240, 240, 245] as RGB,

  // Bannieres profil incomplet (amber) - filet securite
  amberBg:     [254, 243, 199] as RGB,
  amberBorder: [252, 211, 77]  as RGB,
  amberText:   [120, 53, 15]   as RGB,
  amberAccent: [180, 83, 9]    as RGB,
} as const

// ---------------------------------------------------------------------------
// buildPalette : fusionne les neutres avec les couleurs derivees du theme.
// theme === null  -> couleurs Nexartis historiques (retro-compat).
// theme defini    -> les couleurs thematables sont remplacees par celles du theme.
// ---------------------------------------------------------------------------
function deriveInk(hex: string, base: RGB): RGB {
  return isLight(hex) ? base : C_BASE_NEUTRALS.white
}

export function buildPalette(theme: DocumentTheme | null) {
  const t = theme ?? DEFAULT_DOCUMENT_THEME

  // Couleurs thematables converties en RGB
  const bandeau:  RGB = hexToRgb(t.bandeauHaut)
  const bandeauDroite: RGB = hexToRgb(t.bandeauHautDroite || t.bandeauHaut)
  const accent:   RGB = hexToRgb(t.accent)
  const adresse:  RGB = hexToRgb(t.cadreAdresse)
  const netPayer: RGB = hexToRgb(t.netPayer)
  const footer:   RGB = hexToRgb(t.footer)
  // cadreEmetteur n'est pas applique au PDF aujourd'hui (la carte EMETTEUR PDF
  // est toujours blanche avec ombre), on le calcule quand meme pour usage futur.
  const emetteur: RGB = hexToRgb(t.cadreEmetteur)

  // Texte du body : derive de bandeauHaut (fond du header).
  // Pour conserver la regle "texte bleu marine partout dans le body" du PDF
  // Nexartis historique, on garde [15,26,58] comme defaut ; quand le theme a
  // un bandeau perso, on prend la couleur du bandeau comme accent body.
  const navyText: RGB = bandeau // identique a navy (rendu inchange par defaut)

  return {
    // ===== Couleurs neutres (inchangees) =====
    ...C_BASE_NEUTRALS,

    // ===== Couleurs thematables (alias rétro-compat) =====
    // "navy" reste le nom historique pour la couleur principale (bandeau/footer/adresse)
    navy:        bandeau,
    navyDroite:  bandeauDroite,  // V3.1 : couleur de la zone droite du bandeau
    navyDeep:    adresse,                 // carte ADRESSE A
    navyMid:     [26, 45, 90] as RGB,     // accents secondaires (non themable)
    navyText:    navyText,                // texte body

    // "orange" reste le nom historique pour l'accent
    orange:      accent,
    orangeLight: [240, 144, 80] as RGB,
    orangePale:  [253, 234, 215] as RGB,  // fond pillule numero section

    // ===== Nouvelles cles explicites (pour usage futur) =====
    bandeau,
    bandeauInk:  deriveInk(t.bandeauHaut, [15, 26, 58]),
    accent,
    emetteur,
    emetteurInk: deriveInk(t.cadreEmetteur, [15, 26, 58]),
    adresse,
    adresseInk:  deriveInk(t.cadreAdresse, [15, 26, 58]),
    netPayer,
    // V3.0d : ink calque parfaitement la regle CSS (--accent2-ink #1c1304 sur fond clair).
    netPayerInk: deriveInk(t.netPayer, [28, 19, 4]),
    footer,
    // V3.0d : ink calque la regle CSS (--accent-ink derive du bandeau, identique au footer).
    footerInk:   deriveInk(t.footer, [15, 26, 58]),
  } as const
}

export type Palette = ReturnType<typeof buildPalette>

// ---------------------------------------------------------------------------
// Export retro-compat : `C` = palette par defaut (charte Nexartis).
// Tous les modules existants (header.ts, footer.ts, totals.ts, identity.ts,
// legal.ts, objet.ts, table.ts, signatures.ts) importent `C` directement.
// Ils continueront a fonctionner inchanges quand aucun theme custom n'est
// applique. Pour appliquer un theme, on passe `palette` en argument optionnel
// des fonctions drawXXX (cf. lib/pdf.ts).
// ---------------------------------------------------------------------------
export const C: Palette = buildPalette(null)

export type PaletteKey = keyof Palette
