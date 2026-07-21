/**
 * Module Plan 2D — Catalogue des symboles métier (Push 3a, 03/07/2026)
 *
 * Config PURE, zéro dépendance React. Chaque symbole est décrit par une liste
 * de FORMES en COORDONNÉES LOCALES MM (repère centré sur le point de pose,
 * y vers le bas) — le composant SymboleSvg (components/plan) les convertit en
 * éléments SVG. Style « schéma électrique » simplifié : cercle + traits,
 * reconnaissable à 20 px. La couleur (navy/orange) suit le calque, appliquée
 * au rendu — jamais stockée ici.
 *
 * - Électricien : 12 symboles. Plombier : 10 symboles.
 * - Peintre / carreleur / plaquiste : pas de symboles posables en 3a.
 */

import type { CalqueId, PointMm, Symbole } from './types'
import { genId } from './defaults'

/** Forme élémentaire d'un symbole, en mm locaux. `plein` = rempli couleur calque. */
export type FormeSymbole =
  | { forme: 'cercle'; cx: number; cy: number; r: number; plein?: boolean; fond?: boolean }
  | { forme: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { forme: 'ligne'; x1: number; y1: number; x2: number; y2: number; pointille?: boolean }
  | { forme: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fond?: boolean }
  | { forme: 'chemin'; d: string }
  | { forme: 'texte'; x: number; y: number; t: string; taille: number }

/**
 * Pose physique d'un type de symbole (15/07/2026). Convention de
 * REPRÉSENTATION — comment on le dessine en 3D — et non une mesure : aucun de
 * ces trois mots n'apparaît jamais dans un document exporté.
 *
 * - 'mural'   : plaqué sur un mur, à une hauteur qui SE SAISIT (`hauteurMm`).
 * - 'sol'     : posé au sol / encombrement au sol (WC, évier, portail).
 * - 'plafond' : au plafond — la hauteur vaut la HSP de la pièce, elle n'est
 *               donc PAS dans le symbole et ne se saisit pas.
 *
 * Ce champ vit dans le CATALOGUE et pas dans une table `Record<string, ...>`
 * parallèle : c'est une table parallèle qui avait produit le trou d'origine
 * (`tableau` et `vmc` oubliés de HAUTEURS_MURALES_MM, donc dessinés par terre
 * en 3D). Ici l'oubli est impossible — `pose` est requis, TypeScript refuse de
 * compiler un symbole qui n'en a pas.
 */
export type PoseSymbole = 'mural' | 'sol' | 'plafond'

export interface DefSymbole {
  type: string
  /** Libellé FR (palette, panneau, aria-labels). */
  label: string
  metier: 'electricien' | 'plombier' | 'exterieur' | 'chauffagiste'
  /** Pose physique : seule autorité pour « ce symbole est-il mural ? ». */
  pose: PoseSymbole
  /** Demi-encombrement en mm : zone cliquable + anneau de sélection. */
  rayon: number
  /**
   * Précision FR de ce que « l'axe » désigne pour CE type, affichée sous le
   * champ de saisie de la hauteur. À renseigner pour tout type mural dont
   * l'axe est ambigu (un tableau est une boîte, pas un point).
   */
  hauteurHint?: string
  formes: FormeSymbole[]
}

const S = (
  type: string,
  label: string,
  metier: 'electricien' | 'plombier' | 'exterieur' | 'chauffagiste',
  pose: PoseSymbole,
  rayon: number,
  formes: FormeSymbole[],
  hauteurHint?: string
): DefSymbole => ({ type, label, metier, pose, rayon, formes, hauteurHint })

/* ── Électricien (12) — schéma unifilaire simplifié ───────────────────────── */

const ELEC: DefSymbole[] = [
  S('prise_16a', 'Prise 16 A', 'electricien', 'mural', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
  ]),
  S('prise_double', 'Prise double', 'electricien', 'mural', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: -65, y1: -135, x2: -65, y2: -330 },
    { forme: 'ligne', x1: 65, y1: -135, x2: 65, y2: -330 },
  ]),
  S('prise_32a', 'Prise 32 A (spécialisée)', 'electricien', 'mural', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
    { forme: 'texte', x: 0, y: 60, t: '32', taille: 150 },
  ]),
  S('prise_rj45', 'Prise RJ45', 'electricien', 'mural', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
    { forme: 'texte', x: 0, y: 60, t: 'RJ', taille: 150 },
  ]),
  S('prise_tv', 'Prise TV', 'electricien', 'mural', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
    { forme: 'texte', x: 0, y: 60, t: 'TV', taille: 150 },
  ]),
  S('interrupteur', 'Interrupteur', 'electricien', 'mural', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 70, plein: true },
    { forme: 'ligne', x1: 55, y1: -55, x2: 240, y2: -240 },
    { forme: 'ligne', x1: 240, y1: -240, x2: 330, y2: -195 },
  ]),
  S('va_et_vient', 'Va-et-vient', 'electricien', 'mural', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 70, plein: true },
    { forme: 'ligne', x1: 55, y1: -55, x2: 240, y2: -240 },
    { forme: 'ligne', x1: 240, y1: -240, x2: 330, y2: -195 },
    { forme: 'ligne', x1: -55, y1: 55, x2: -240, y2: 240 },
    { forme: 'ligne', x1: -240, y1: 240, x2: -330, y2: 195 },
  ]),
  S('dcl_plafond', 'Point lumineux DCL', 'electricien', 'plafond', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: -105, y1: -105, x2: 105, y2: 105 },
    { forme: 'ligne', x1: -105, y1: 105, x2: 105, y2: -105 },
  ]),
  S('applique', 'Applique murale', 'electricien', 'mural', 340, [
    { forme: 'cercle', cx: 0, cy: -40, r: 120 },
    { forme: 'ligne', x1: -85, y1: -125, x2: 85, y2: 45 },
    { forme: 'ligne', x1: -85, y1: 45, x2: 85, y2: -125 },
    { forme: 'ligne', x1: 0, y1: 80, x2: 0, y2: 300 },
  ]),
  // Mural (15/07/2026) : il était absent de HAUTEURS_MURALES_MM, donc dessiné
  // POSÉ PAR TERRE en 3D. Un tableau électrique au sol.
  S(
    'tableau',
    'Tableau électrique',
    'electricien',
    'mural',
    400,
    [
      { forme: 'rect', x: -260, y: -160, w: 520, h: 320, fond: true },
      { forme: 'ligne', x1: -260, y1: -160, x2: 260, y2: 160 },
    ],
    // Un tableau est une BOÎTE, pas un point : « sa » hauteur peut désigner le
    // bord bas, le bord haut ou l'axe des poignées — presque un mètre d'écart.
    // D'où l'absence de défaut (HAUTEUR_DEFAUT_MM) et cette précision.
    'Axe des poignées de disjoncteur'
  ),
  S('sortie_cable', 'Sortie de câble', 'electricien', 'mural', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 60, plein: true },
    { forme: 'ligne', x1: 0, y1: -60, x2: 0, y2: -300 },
    { forme: 'ligne', x1: -90, y1: -300, x2: 90, y2: -300 },
  ]),
  // Plafond (15/07/2026) : absente de HAUTEURS_MURALES_MM, elle était dessinée
  // par terre. 'plafond' est le cas majoritaire en logement — une bouche en
  // haut de mur existe, mais `pose` est une convention de DESSIN qui ne produit
  // aucun texte ni aucun chiffre : au pire un défaut esthétique, jamais un
  // mensonge. La surcharge par symbole (`Symbole.pose?`) sera additive.
  S('vmc', 'Bouche VMC', 'electricien', 'plafond', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'cercle', cx: 0, cy: 0, r: 55 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -55 },
    { forme: 'ligne', x1: 0, y1: 55, x2: 0, y2: 150 },
    { forme: 'ligne', x1: -150, y1: 0, x2: -55, y2: 0 },
    { forme: 'ligne', x1: 55, y1: 0, x2: 150, y2: 0 },
  ]),
]

/* ── Plombier (10) — appareils vus de dessus ──────────────────────────────── */

const PLOMBERIE: DefSymbole[] = [
  S('evier', 'Évier', 'plombier', 'sol', 440, [
    { forme: 'rect', x: -320, y: -220, w: 640, h: 440, rx: 80 },
    { forme: 'cercle', cx: -150, cy: 0, r: 105 },
    { forme: 'cercle', cx: 150, cy: 0, r: 105 },
  ]),
  S('lavabo', 'Lavabo', 'plombier', 'sol', 400, [
    { forme: 'rect', x: -280, y: -180, w: 560, h: 380, rx: 120 },
    { forme: 'cercle', cx: 0, cy: 30, r: 90 },
  ]),
  S('wc', 'WC', 'plombier', 'sol', 420, [
    { forme: 'rect', x: -190, y: -300, w: 380, h: 190 },
    { forme: 'ellipse', cx: 0, cy: 90, rx: 200, ry: 230 },
  ]),
  S('douche', 'Douche', 'plombier', 'sol', 500, [
    { forme: 'rect', x: -350, y: -350, w: 700, h: 700 },
    { forme: 'ligne', x1: -350, y1: -350, x2: 350, y2: 350 },
    { forme: 'cercle', cx: 120, cy: -120, r: 60 },
  ]),
  S('baignoire', 'Baignoire', 'plombier', 'sol', 560, [
    { forme: 'rect', x: -450, y: -260, w: 900, h: 520, rx: 180 },
    { forme: 'cercle', cx: -300, cy: 0, r: 60 },
  ]),
  S('lave_linge', 'Lave-linge', 'plombier', 'sol', 400, [
    { forme: 'rect', x: -260, y: -260, w: 520, h: 520, rx: 40 },
    { forme: 'cercle', cx: 0, cy: 40, r: 140 },
    { forme: 'texte', x: 0, y: -140, t: 'LL', taille: 140 },
  ]),
  S('lave_vaisselle', 'Lave-vaisselle', 'plombier', 'sol', 400, [
    { forme: 'rect', x: -260, y: -260, w: 520, h: 520, rx: 40 },
    { forme: 'ligne', x1: -260, y1: -150, x2: 260, y2: -150 },
    { forme: 'texte', x: 0, y: 110, t: 'LV', taille: 150 },
  ]),
  // 'sol' : le glyphe est une empreinte AU SOL (vue de dessus). Un chauffe-eau
  // mural existe, mais lui coller une hauteur d'axe le ferait FLOTTER en 3D.
  // Cf. la note « V1 = mural uniquement » en tête de HAUTEUR_DEFAUT_MM.
  S('chauffe_eau', 'Chauffe-eau', 'plombier', 'sol', 460, [
    { forme: 'rect', x: -220, y: -330, w: 440, h: 660, rx: 200 },
    { forme: 'chemin', d: 'M -70 -110 q 140 -70 140 30 q 0 100 -140 30 q -70 130 70 160' },
  ]),
  S('nourrice', 'Nourrice (collecteur)', 'plombier', 'sol', 420, [
    { forme: 'rect', x: -300, y: -100, w: 600, h: 200, rx: 40 },
    { forme: 'ligne', x1: -300, y1: 0, x2: -460, y2: 0 },
    { forme: 'ligne', x1: -180, y1: 100, x2: -180, y2: 260 },
    { forme: 'ligne', x1: -60, y1: 100, x2: -60, y2: 260 },
    { forme: 'ligne', x1: 60, y1: 100, x2: 60, y2: 260 },
    { forme: 'ligne', x1: 180, y1: 100, x2: 180, y2: 260 },
  ]),
  S('robinet_ext', 'Robinet extérieur', 'plombier', 'sol', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 100 },
    { forme: 'ligne', x1: 0, y1: -100, x2: 0, y2: -280 },
    { forme: 'ligne', x1: -130, y1: -280, x2: 130, y2: -280 },
  ]),
]

/* ── Extérieur (Push 3b) — portail projeté sur la clôture la plus proche ──── */

const EXTERIEUR: DefSymbole[] = [
  S('portail', 'Portail', 'exterieur', 'sol', 700, [
    // Vantail 1,20 m vu de dessus : rectangle fond blanc + diagonale
    // (le rectangle « gomme » visuellement la clôture sous le portail).
    { forme: 'rect', x: -600, y: -170, w: 1200, h: 340, fond: true },
    { forme: 'ligne', x1: -600, y1: 170, x2: 600, y2: -170 },
  ]),
]

/* ── Chauffagiste ── radiateur vu de dessus (empreinte au sol) ─────────────── */

const CHAUFFAGE: DefSymbole[] = [
  S('radiateur', 'Radiateur', 'chauffagiste', 'sol', 480, [
    { forme: 'rect', x: -420, y: -140, w: 840, h: 280, rx: 40 },
    { forme: 'ligne', x1: -280, y1: -140, x2: -280, y2: 140 },
    { forme: 'ligne', x1: -140, y1: -140, x2: -140, y2: 140 },
    { forme: 'ligne', x1: 0, y1: -140, x2: 0, y2: 140 },
    { forme: 'ligne', x1: 140, y1: -140, x2: 140, y2: 140 },
    { forme: 'ligne', x1: 280, y1: -140, x2: 280, y2: 140 },
  ]),
]

/** Catalogue complet, indexé par type. */
export const SYMBOLES: Record<string, DefSymbole> = Object.fromEntries(
  [...ELEC, ...PLOMBERIE, ...EXTERIEUR, ...CHAUFFAGE].map((d) => [d.type, d])
)

/** Définition d'un symbole, ou null si le type est inconnu (donnée ancienne). */
export function defSymbole(type: string): DefSymbole | null {
  return SYMBOLES[type] ?? null
}

/** Libellé FR d'un type de symbole (repli neutre sur le type brut). */
export function labelSymbole(type: string): string {
  return SYMBOLES[type]?.label ?? type
}

/* ── Hauteurs de pose par défaut (15/07/2026) ─────────────────────────────── */

/**
 * ⚠️ RÈGLE FONDATRICE — `HAUTEUR_DEFAUT_MM` n'a qu'UN SEUL appelant légitime :
 * `creerSymbole`, juste dessous. Le défaut est MATÉRIALISÉ dans la DONNÉE au
 * moment de la pose, puis oublié.
 *
 * Si un rendu (2D, 3D, PDF, cartouche) venait un jour lire cette table pour
 * boucher un trou, la valeur redeviendrait un défaut de CODE : changer un
 * chiffre ici réécrirait alors le sens de tous les plans déjà envoyés à des
 * clients. Un symbole sans `hauteurMm` est une donnée ABSENTE, pas un défaut.
 *
 * V1 = symboles MURAUX uniquement. La plomberie est volontairement absente :
 * ses glyphes sont des empreintes au sol, et un évier a plusieurs hauteurs
 * (alimentation ~55-60 cm, évacuation ~52 cm, plan ~90 cm) qu'un champ
 * scalaire ne peut pas porter.
 *
 * Valeurs alignées sur `lib/normes-metiers.ts` (« NF C 15-100 — Hauteurs »,
 * confiance haute), déjà publiées dans le module Aide de l'app :
 * - prises 16 A / RJ45 / TV / sortie de câble : axe ≥ 5 cm du sol fini ;
 *   usage courant 25 cm.
 * - prise 32 A (plaque/four) : axe ≥ 12 cm — 250 respecte le minimum.
 * - interrupteur / va-et-vient : 0,90 m à 1,30 m, idéal ~1,10 m.
 * - applique : AUCUNE hauteur normative, 1800 est un usage.
 * - `tableau` : ABSENT VOLONTAIREMENT (cf. son `hauteurHint`) — la norme donne
 *   « poignées entre 0,90 et 1,30 m ; bord supérieur ≤ 1,80 m », soit presque
 *   un mètre d'écart selon ce que « la hauteur du tableau » désigne. Choisir un
 *   nombre ici serait l'inventer. Le tableau naît donc sans hauteur.
 *
 * Ces 9 valeurs sont IDENTIQUES à l'ex-`HAUTEURS_MURALES_MM` d'`iso.ts` : elles
 * pilotent déjà la 3D en production. Les « améliorer » au passage déplacerait
 * l'aspect des plans existants dans le même commit que la feature — impossible
 * à démêler si un bug apparaît.
 */
export const HAUTEUR_DEFAUT_MM: Record<string, number> = {
  prise_16a: 250,
  prise_double: 250,
  prise_32a: 250,
  prise_rj45: 250,
  prise_tv: 250,
  sortie_cable: 250,
  interrupteur: 1100,
  va_et_vient: 1100,
  applique: 1800,
}

/**
 * Fabrique un symbole prêt à poser (position en mm ENTIERS, arrondie ici).
 *
 * `hauteurMm` : hauteur d'axe imposée (mm). Omise => on matérialise le défaut
 * du catalogue. IGNORÉE si le type n'est pas mural — un WC ne prend pas de
 * hauteur, même si l'appelant insiste.
 */
export function creerSymbole(
  type: string,
  layer: CalqueId,
  position: PointMm,
  roomId: string | null,
  hauteurMm?: number
): Symbole {
  const s: Symbole = {
    id: genId(),
    type,
    layer,
    position: [Math.round(position[0]), Math.round(position[1])],
    rotation: 0,
    roomId,
  }
  // MATÉRIALISATION : le défaut est copié dans la DONNÉE ici, une fois pour
  // toutes. Après cette ligne, plus aucun code ne consulte HAUTEUR_DEFAUT_MM
  // pour ce symbole — c'est ce qui rend le plan relisible à l'identique dans
  // trois ans, même si le défaut du catalogue a changé entre-temps.
  //
  // On lit `SYMBOLES[type].pose` en direct plutôt que `poseDe()` de
  // ./hauteurs : hauteurs.ts importe SYMBOLES d'ici, l'inverse créerait un
  // cycle d'import.
  const def = SYMBOLES[type]
  if (def && def.pose === 'mural') {
    const h = typeof hauteurMm === 'number' ? hauteurMm : HAUTEUR_DEFAUT_MM[type]
    // `h` est undefined pour un type mural sans défaut (tableau) : on n'écrit
    // alors PAS la clé du tout. Le symbole naît « hauteur inconnue », ce qui
    // est la vérité.
    if (typeof h === 'number' && isFinite(h) && h > 0) s.hauteurMm = Math.round(h)
  }
  return s
}
