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

export interface DefSymbole {
  type: string
  /** Libellé FR (palette, panneau, aria-labels). */
  label: string
  metier: 'electricien' | 'plombier'
  /** Demi-encombrement en mm : zone cliquable + anneau de sélection. */
  rayon: number
  formes: FormeSymbole[]
}

const S = (
  type: string,
  label: string,
  metier: 'electricien' | 'plombier',
  rayon: number,
  formes: FormeSymbole[]
): DefSymbole => ({ type, label, metier, rayon, formes })

/* ── Électricien (12) — schéma unifilaire simplifié ───────────────────────── */

const ELEC: DefSymbole[] = [
  S('prise_16a', 'Prise 16 A', 'electricien', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
  ]),
  S('prise_double', 'Prise double', 'electricien', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: -65, y1: -135, x2: -65, y2: -330 },
    { forme: 'ligne', x1: 65, y1: -135, x2: 65, y2: -330 },
  ]),
  S('prise_32a', 'Prise 32 A (spécialisée)', 'electricien', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
    { forme: 'texte', x: 0, y: 60, t: '32', taille: 150 },
  ]),
  S('prise_rj45', 'Prise RJ45', 'electricien', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
    { forme: 'texte', x: 0, y: 60, t: 'RJ', taille: 150 },
  ]),
  S('prise_tv', 'Prise TV', 'electricien', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: 0, y1: -150, x2: 0, y2: -330 },
    { forme: 'texte', x: 0, y: 60, t: 'TV', taille: 150 },
  ]),
  S('interrupteur', 'Interrupteur', 'electricien', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 70, plein: true },
    { forme: 'ligne', x1: 55, y1: -55, x2: 240, y2: -240 },
    { forme: 'ligne', x1: 240, y1: -240, x2: 330, y2: -195 },
  ]),
  S('va_et_vient', 'Va-et-vient', 'electricien', 360, [
    { forme: 'cercle', cx: 0, cy: 0, r: 70, plein: true },
    { forme: 'ligne', x1: 55, y1: -55, x2: 240, y2: -240 },
    { forme: 'ligne', x1: 240, y1: -240, x2: 330, y2: -195 },
    { forme: 'ligne', x1: -55, y1: 55, x2: -240, y2: 240 },
    { forme: 'ligne', x1: -240, y1: 240, x2: -330, y2: 195 },
  ]),
  S('dcl_plafond', 'Point lumineux DCL', 'electricien', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 150 },
    { forme: 'ligne', x1: -105, y1: -105, x2: 105, y2: 105 },
    { forme: 'ligne', x1: -105, y1: 105, x2: 105, y2: -105 },
  ]),
  S('applique', 'Applique murale', 'electricien', 340, [
    { forme: 'cercle', cx: 0, cy: -40, r: 120 },
    { forme: 'ligne', x1: -85, y1: -125, x2: 85, y2: 45 },
    { forme: 'ligne', x1: -85, y1: 45, x2: 85, y2: -125 },
    { forme: 'ligne', x1: 0, y1: 80, x2: 0, y2: 300 },
  ]),
  S('tableau', 'Tableau électrique', 'electricien', 400, [
    { forme: 'rect', x: -260, y: -160, w: 520, h: 320, fond: true },
    { forme: 'ligne', x1: -260, y1: -160, x2: 260, y2: 160 },
  ]),
  S('sortie_cable', 'Sortie de câble', 'electricien', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 60, plein: true },
    { forme: 'ligne', x1: 0, y1: -60, x2: 0, y2: -300 },
    { forme: 'ligne', x1: -90, y1: -300, x2: 90, y2: -300 },
  ]),
  S('vmc', 'Bouche VMC', 'electricien', 340, [
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
  S('evier', 'Évier', 'plombier', 440, [
    { forme: 'rect', x: -320, y: -220, w: 640, h: 440, rx: 80 },
    { forme: 'cercle', cx: -150, cy: 0, r: 105 },
    { forme: 'cercle', cx: 150, cy: 0, r: 105 },
  ]),
  S('lavabo', 'Lavabo', 'plombier', 400, [
    { forme: 'rect', x: -280, y: -180, w: 560, h: 380, rx: 120 },
    { forme: 'cercle', cx: 0, cy: 30, r: 90 },
  ]),
  S('wc', 'WC', 'plombier', 420, [
    { forme: 'rect', x: -190, y: -300, w: 380, h: 190 },
    { forme: 'ellipse', cx: 0, cy: 90, rx: 200, ry: 230 },
  ]),
  S('douche', 'Douche', 'plombier', 500, [
    { forme: 'rect', x: -350, y: -350, w: 700, h: 700 },
    { forme: 'ligne', x1: -350, y1: -350, x2: 350, y2: 350 },
    { forme: 'cercle', cx: 120, cy: -120, r: 60 },
  ]),
  S('baignoire', 'Baignoire', 'plombier', 560, [
    { forme: 'rect', x: -450, y: -260, w: 900, h: 520, rx: 180 },
    { forme: 'cercle', cx: -300, cy: 0, r: 60 },
  ]),
  S('lave_linge', 'Lave-linge', 'plombier', 400, [
    { forme: 'rect', x: -260, y: -260, w: 520, h: 520, rx: 40 },
    { forme: 'cercle', cx: 0, cy: 40, r: 140 },
    { forme: 'texte', x: 0, y: -140, t: 'LL', taille: 140 },
  ]),
  S('lave_vaisselle', 'Lave-vaisselle', 'plombier', 400, [
    { forme: 'rect', x: -260, y: -260, w: 520, h: 520, rx: 40 },
    { forme: 'ligne', x1: -260, y1: -150, x2: 260, y2: -150 },
    { forme: 'texte', x: 0, y: 110, t: 'LV', taille: 150 },
  ]),
  S('chauffe_eau', 'Chauffe-eau', 'plombier', 460, [
    { forme: 'rect', x: -220, y: -330, w: 440, h: 660, rx: 200 },
    { forme: 'chemin', d: 'M -70 -110 q 140 -70 140 30 q 0 100 -140 30 q -70 130 70 160' },
  ]),
  S('nourrice', 'Nourrice (collecteur)', 'plombier', 420, [
    { forme: 'rect', x: -300, y: -100, w: 600, h: 200, rx: 40 },
    { forme: 'ligne', x1: -300, y1: 0, x2: -460, y2: 0 },
    { forme: 'ligne', x1: -180, y1: 100, x2: -180, y2: 260 },
    { forme: 'ligne', x1: -60, y1: 100, x2: -60, y2: 260 },
    { forme: 'ligne', x1: 60, y1: 100, x2: 60, y2: 260 },
    { forme: 'ligne', x1: 180, y1: 100, x2: 180, y2: 260 },
  ]),
  S('robinet_ext', 'Robinet extérieur', 'plombier', 340, [
    { forme: 'cercle', cx: 0, cy: 0, r: 100 },
    { forme: 'ligne', x1: 0, y1: -100, x2: 0, y2: -280 },
    { forme: 'ligne', x1: -130, y1: -280, x2: 130, y2: -280 },
  ]),
]

/** Catalogue complet, indexé par type. */
export const SYMBOLES: Record<string, DefSymbole> = Object.fromEntries(
  [...ELEC, ...PLOMBERIE].map((d) => [d.type, d])
)

/** Définition d'un symbole, ou null si le type est inconnu (donnée ancienne). */
export function defSymbole(type: string): DefSymbole | null {
  return SYMBOLES[type] ?? null
}

/** Libellé FR d'un type de symbole (repli neutre sur le type brut). */
export function labelSymbole(type: string): string {
  return SYMBOLES[type]?.label ?? type
}

/** Fabrique un symbole prêt à poser (position en mm ENTIERS, arrondie ici). */
export function creerSymbole(
  type: string,
  layer: CalqueId,
  position: PointMm,
  roomId: string | null
): Symbole {
  return {
    id: genId(),
    type,
    layer,
    position: [Math.round(position[0]), Math.round(position[1])],
    rotation: 0,
    roomId,
  }
}
