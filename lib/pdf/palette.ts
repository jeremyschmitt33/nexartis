// lib/pdf/palette.ts - V3.0c
// Palette unique du generateur PDF "Edition Signature".
// Tout hex doit etre defini ici (jsPDF prend des tuples RGB).
// Aucun composant pdf/* ne doit hardcoder une couleur.

export type RGB = readonly [number, number, number]

export const C = {
  // Fonds principaux
  navy:        [15, 26, 58]   as RGB, // #0F1A3A - bandeau + footer
  navyDeep:    [10, 18, 42]   as RGB, // carte ADRESSE A
  navyMid:     [26, 45, 90]   as RGB, // accents secondaires
  navyText:    [15, 26, 58]   as RGB, // texte body

  // Accents orange
  orange:      [232, 122, 42] as RGB, // accent principal, NET A PAYER, pastilles, badges
  orangeLight: [240, 144, 80] as RGB,
  orangePale:  [253, 234, 215] as RGB, // fond pillule numero section

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

  // Bandeau forfait (utilise skyVeryPale + orange standard)
  // (pas de couleur dediee)
} as const

export type PaletteKey = keyof typeof C
