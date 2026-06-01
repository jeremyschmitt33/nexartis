// lib/design-tokens.ts - V3.0a
//
// Tokens de design partages entre le PDF (jsPDF) et le Dashboard (Tailwind/CSS).
// Source : analyse des HTML Claude Design (`Devis.html` + `Facture.html`) - rapport
// complet dans `outputs/analyse-design-v3.md`.
//
// Decisions user :
//   - Couleurs FIXES (pas dynamiques par artisan) : navy + or pour tous.
//   - Embarquer Spline Sans Mono en plus de Hanken Grotesk (fidelite chiffres).
//   - Pas d'acompte sur facture (devis uniquement).
//
// V3.0a : ces tokens existent mais NE SONT PAS encore consommes par le rendu
// PDF / Dashboard. Ils seront branches dans V3.0b a V3.0g.
//
// Convention :
//   - `colors.*`  -> chaines hex `#RRGGBB` (utilisables en Tailwind config + CSS)
//   - `rgb.*`     -> tuples `[r, g, b]` 0-255 (utilisables directement par jsPDF
//                    `setTextColor(r,g,b)` / `setFillColor(r,g,b)`)
//   - `sizes.*`   -> nombres en POINTS (px Web) tels qu'ils apparaissent dans le
//                    HTML source. Pour jsPDF (unite `mm`), multiplier par
//                    `PX_TO_MM` ci-dessous.
//   - `spacing.*` -> idem (px).

// ----------------------------------------------------------------------------
// Conversion px <-> mm (HTML calibre a 96 dpi : 1 mm = 3.7795275591 px)
// ----------------------------------------------------------------------------

/** 1 px CSS = 0.2645833333 mm a 96 dpi. */
export const PX_TO_MM = 0.2645833333

/** 1 mm = 3.7795275591 px CSS a 96 dpi. */
export const MM_TO_PX = 3.7795275591

/** Helper : convertit une valeur en pixels CSS vers des mm pour jsPDF. */
export function px(value: number): number {
  return value * PX_TO_MM
}

// ----------------------------------------------------------------------------
// Tokens
// ----------------------------------------------------------------------------

export const DESIGN_TOKENS = {
  // --- Couleurs (hex) -------------------------------------------------------
  colors: {
    /** NAVY - accent principal (bandeau haut, carte "ADRESSE A", chips). */
    accent: '#15233b',
    /** OR / cuivre - accent secondaire (chip numero, bloc NET, accents). */
    accent2: '#dd9138',
    /** Texte tres sombre utilise sur fond OR (lisibilite). */
    accentInk: '#1c1304',
    /** Blanc - texte sur fond accent. */
    accentOnDark: '#ffffff',
    /** Fond papier A4. */
    paper: '#ffffff',
    /** Gris tres clair - fonds doux secondaires. */
    paperSoft: '#f1f3f7',
    /** Texte principal (corps + titres) - RGB 25,32,43. */
    ink: '#19202b',
    /** Variante texte douce (gris fonce - sous-titres, body neutre). */
    inkSoft: '#374151',
    /** Texte secondaire / labels muted - RGB 107,116,128. */
    mute: '#6b7480',
    /** Lignes / bordures cartes - RGB 231,233,238. */
    line: '#e7e9ee',
  },

  // --- Couleurs (RGB tuples pour jsPDF) -------------------------------------
  rgb: {
    accent:       [21, 35, 59]    as [number, number, number], // #15233b
    accent2:      [221, 145, 56]  as [number, number, number], // #dd9138
    accentInk:    [28, 19, 4]     as [number, number, number], // #1c1304
    accentOnDark: [255, 255, 255] as [number, number, number],
    paper:        [255, 255, 255] as [number, number, number],
    paperSoft:    [241, 243, 247] as [number, number, number], // #f1f3f7
    ink:          [25, 32, 43]    as [number, number, number], // #19202b
    inkSoft:      [55, 65, 81]    as [number, number, number], // #374151
    mute:         [107, 116, 128] as [number, number, number], // #6b7480
    line:         [231, 233, 238] as [number, number, number], // #e7e9ee
  },

  // --- Polices --------------------------------------------------------------
  fonts: {
    /** Police principale (corps + titres). */
    sans: 'Hanken Grotesk',
    /** Police mono pour chiffres (chip numero, totaux, montants). */
    mono: 'Spline Sans Mono',
    /** Styles jsPDF disponibles pour chaque famille (voir lib/pdf-fonts.ts). */
    sansStyles: ['normal', 'medium', 'semibold', 'bold', 'extrabold'] as const,
    monoStyles: ['normal', 'medium', 'semibold'] as const,
  },

  // --- Tailles de police (px CSS - cf rapport analyse section A.3) ----------
  sizes: {
    /** Corps de page par defaut (.dv-doc). */
    body: 13,
    /** Titre principal "DEVIS" / "FACTURE" (.dv-d-doctype). */
    titleDoctype: 41,
    /** Chip numero document "D-2026-XXXXX" (.dv-d-num). */
    docNumber: 14,
    /** Nom societe artisan dans bandeau (.dv-d-name). */
    brandName: 21,
    /** Slogan / metier sous nom societe (.dv-d-base). */
    brandTagline: 11.5,
    /** Metaline dates emission/echeance (.dv-d-metaline). */
    metaLine: 11.5,
    /** Chip "EMETTEUR" / "ADRESSE A" (.dv-d-chip). */
    chip: 10,
    /** Nom du destinataire / emetteur sur les cartes (.dv-d-cardname). */
    cardName: 17,
    /** Lignes adresse/SIRET/email dans les cartes (.dv-d-cardrows). */
    cardRow: 12,
    /** Label "OBJET" / "ADRESSE DU CHANTIER" (.dv-objet-k). */
    objectLabel: 10,
    /** Texte objet / adresse chantier. */
    objectText: 13,
    /** En-tete de tableau (#, Designation, Qte, PU HT, TVA, Total HT). */
    tableHeader: 10,
    /** Texte courant ligne tableau (qte, PU, TVA, total). */
    tableRow: 13,
    /** Texte courant ligne tableau - designation prestation. */
    tableRowDesc: 13,
    /** Numero ligne. */
    tableRowNum: 11,
    /** Designation groupe (gras). */
    tableGroupDesc: 13.5,
    /** Designation sous-section. */
    tableSubDesc: 12.5,
    /** Unite (m, h, u...). */
    unit: 10.5,
    /** Footer page (Page X / Y). */
    pageFoot: 10.5,
    /** Mini-header pages 2+ marque. */
    miniHeadBrand: 14,
    /** Mini-header pages 2+ meta. */
    miniHeadMeta: 11,
    /** Titre section recap (CONDITIONS DE REGLEMENT). */
    recapTitle: 10,
    /** Ligne recap (Sous-total HT, TVA, Total TTC). */
    recapLine: 13,
    /** Ligne recap muted (TVA detaillee, base...). */
    recapLineMute: 12,
    /** Label "Net a payer". */
    recapNetLabel: 13,
    /** Montant NET (gros chiffre OR). */
    recapNetAmount: 22,
    /** Footer recap (Reste du a la livraison...). */
    recapFoot: 10.5,
    /** Label signature ("Bon pour accord"). */
    signLabel: 12,
    /** Hint signature. */
    signHint: 11,
    /** Titre section legale (VALIDITE, EXECUTION...). */
    legalTitle: 9.5,
    /** Texte mentions legales. */
    legalText: 10,
    /** Footer mentions (RCS, capital...). */
    legalFoot: 10,
  },

  // --- Espacements / paddings / rayons (px CSS) ----------------------------
  spacing: {
    /** Marge gauche/droite du body de page (.dv-page padding). */
    page: 54,
    /** Largeur utile (page 794 - 2*54). */
    pageContent: 686,
    /** Hauteur du bandeau navy haut. */
    bandHeight: 227.8,
    /** Padding interne du bandeau navy (top, right, bottom, left). */
    bandPadding: [40, 54, 76, 54] as [number, number, number, number],
    /** Chevauchement negatif des cartes Emetteur/Adresse a sur le bandeau. */
    cardOffset: 46,
    /** Padding interne des cartes Emetteur/Adresse a. */
    cardPadding: 22,
    /** Espace entre les 2 cartes (Emetteur + Adresse a). */
    cardGap: 20,
    /** Rayon des grandes cartes. */
    cardRadius: 24,
    /** Rayon des chips ("EMETTEUR" / "ADRESSE A" / numero doc). */
    chipRadius: 6,
    /** Rayon du chip numero doc. */
    docNumRadius: 7,
    /** Padding chip numero doc (vertical, horizontal). */
    docNumPadding: [6, 13] as [number, number],
    /** Padding header tableau (top, right, bottom, left). */
    tableHeaderPadding: [0, 10, 9, 10] as [number, number, number, number],
    /** Padding ligne tableau. */
    tableRowPadding: 10,
    /** Hauteur footer page. */
    footerHeight: 59,
    /** Padding footer (top, right, bottom, left). */
    footerPadding: [18, 54, 26, 54] as [number, number, number, number],
    /** Hauteur mini-header pages 2+. */
    miniHeadHeight: 79,
    /** Padding mini-header pages 2+ (top, right, bottom, left). */
    miniHeadPadding: [40, 54, 18, 54] as [number, number, number, number],
    /** Rayon bloc NET. */
    netBlockRadius: 10,
    /** Padding bloc NET (vertical, horizontal). */
    netBlockPadding: [14, 16] as [number, number],
    /** Marge top bloc NET. */
    netBlockMarginTop: 14,
    /** Recap grid (gauche / gap / droite). */
    recapGrid: [330, 36, 320] as [number, number, number],
    /** Hauteur cadre signature. */
    signBoxHeight: 132,
    /** Rayon cadre signature. */
    signBoxRadius: 10,
    /** Padding cadre signature. */
    signBoxPadding: 16,
    /** Logo artisan dans bandeau (taille carre). */
    logomarkSize: 50,
    /** Rayon logo artisan. */
    logomarkRadius: 13,
  },

  // --- Letter-spacing (px CSS) ---------------------------------------------
  letterSpacing: {
    /** Titre DEVIS/FACTURE (0.41 px). */
    title: 0.41,
    /** Nom societe (-0.21 px, condense). */
    brandName: -0.21,
    /** Nom destinataire/emetteur (-0.17 px). */
    cardName: -0.17,
    /** Numero doc (-0.14 px). */
    docNumber: -0.14,
    /** Chips ("EMETTEUR" / "ADRESSE A") uppercase (1.4 px). */
    chip: 1.4,
    /** Label objet/adresse uppercase (1.4 px). */
    objectLabel: 1.4,
    /** Header tableau uppercase (1 px). */
    tableHeader: 1,
    /** Titre recap uppercase (1.4 px). */
    recapTitle: 1.4,
    /** Titre legal uppercase (1.14 px). */
    legalTitle: 1.14,
    /** Footer page (0.21 px). */
    pageFoot: 0.21,
  },
} as const

// ----------------------------------------------------------------------------
// Equivalents en mm pre-calcules pour jsPDF (commodite).
// Genere a partir de `spacing.*` via PX_TO_MM. Memes noms.
// ----------------------------------------------------------------------------

export const DESIGN_TOKENS_MM = {
  page:            px(DESIGN_TOKENS.spacing.page),             // 14.30 mm
  pageContent:     px(DESIGN_TOKENS.spacing.pageContent),      // 181.52 mm
  bandHeight:      px(DESIGN_TOKENS.spacing.bandHeight),       //  60.30 mm
  cardOffset:      px(DESIGN_TOKENS.spacing.cardOffset),       //  12.17 mm
  cardPadding:     px(DESIGN_TOKENS.spacing.cardPadding),      //   5.82 mm
  cardGap:         px(DESIGN_TOKENS.spacing.cardGap),          //   5.29 mm
  cardRadius:      px(DESIGN_TOKENS.spacing.cardRadius),       //   6.35 mm
  chipRadius:      px(DESIGN_TOKENS.spacing.chipRadius),       //   1.59 mm
  docNumRadius:    px(DESIGN_TOKENS.spacing.docNumRadius),     //   1.85 mm
  tableRowPadding: px(DESIGN_TOKENS.spacing.tableRowPadding),  //   2.65 mm
  footerHeight:    px(DESIGN_TOKENS.spacing.footerHeight),     //  15.61 mm
  miniHeadHeight:  px(DESIGN_TOKENS.spacing.miniHeadHeight),   //  20.90 mm
  netBlockRadius:  px(DESIGN_TOKENS.spacing.netBlockRadius),   //   2.65 mm
  signBoxHeight:   px(DESIGN_TOKENS.spacing.signBoxHeight),    //  34.93 mm
  signBoxRadius:   px(DESIGN_TOKENS.spacing.signBoxRadius),    //   2.65 mm
  logomarkSize:    px(DESIGN_TOKENS.spacing.logomarkSize),     //  13.23 mm
  logomarkRadius:  px(DESIGN_TOKENS.spacing.logomarkRadius),   //   3.44 mm
} as const

/** Type util pour autocompleter `DESIGN_TOKENS.colors.*` ailleurs. */
export type DesignColor = keyof typeof DESIGN_TOKENS.colors
export type DesignRgb = keyof typeof DESIGN_TOKENS.rgb
