/**
 * Module Plan 2D — Viewport (Push 2, 03/07/2026)
 *
 * Conversions monde (mm) <-> écran (px) centralisées. Fonctions PURES,
 * zéro dépendance React. Le rendu SVG dessine en coordonnées monde dans un
 * <g transform="translate(tx ty) scale(k)"> : ces helpers calculent la
 * transformation, le zoom autour d'un point et le cadrage automatique.
 */

import type { Niveau, PointMm } from './types'

/** Transformation monde -> écran : sx = x*k + tx ; sy = y*k + ty. */
export interface Viewport {
  /** Échelle en px par mm (ex. 0.06 : une pièce de 4500 mm -> 270 px). */
  k: number
  tx: number
  ty: number
}

/** Rectangle englobant en coordonnées monde (mm). */
export interface BoundsMm {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Bornes de zoom : de 1 px/m (vue très large) à 0,5 px/mm (très zoomé). */
export const K_MIN = 0.001
export const K_MAX = 0.5

/** Viewport par défaut avant tout cadrage. */
export function viewportDefaut(): Viewport {
  return { k: 0.06, tx: 60, ty: 60 }
}

/** Point monde (mm) -> point écran (px). */
export function versEcran(v: Viewport, p: PointMm): [number, number] {
  return [p[0] * v.k + v.tx, p[1] * v.k + v.ty]
}

/** Point écran (px) -> point monde (mm), non arrondi. */
export function versMonde(v: Viewport, sx: number, sy: number): [number, number] {
  return [(sx - v.tx) / v.k, (sy - v.ty) / v.k]
}

/** Attribut `transform` du groupe SVG monde. */
export function transformSvg(v: Viewport): string {
  return `translate(${v.tx} ${v.ty}) scale(${v.k})`
}

/**
 * Zoom multiplicatif autour d'un point écran (le point sous le curseur
 * reste immobile). `facteur` > 1 : zoom avant.
 */
export function zoomAutour(
  v: Viewport,
  sx: number,
  sy: number,
  facteur: number,
  kMin: number = K_MIN,
  kMax: number = K_MAX
): Viewport {
  const k2 = Math.min(kMax, Math.max(kMin, v.k * facteur))
  return {
    k: k2,
    tx: sx - (sx - v.tx) * (k2 / v.k),
    ty: sy - (sy - v.ty) * (k2 / v.k),
  }
}

/** Translation du viewport en pixels écran (pan). */
export function deplacer(v: Viewport, dxPx: number, dyPx: number): Viewport {
  return { k: v.k, tx: v.tx + dxPx, ty: v.ty + dyPx }
}

/** Rectangle englobant de toutes les pièces + clôtures d'un niveau, ou null si vide. */
export function bornesNiveau(niveau: Niveau): BoundsMm | null {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  let vide = true
  const etendre = (p: PointMm) => {
    vide = false
    if (p[0] < x1) x1 = p[0]
    if (p[1] < y1) y1 = p[1]
    if (p[0] > x2) x2 = p[0]
    if (p[1] > y2) y2 = p[1]
  }
  for (const piece of niveau.rooms) for (const p of piece.vertices) etendre(p)
  for (const clo of niveau.clotures) for (const p of clo.points) etendre(p)
  if (vide) return null
  return { x1, y1, x2, y2 }
}

/**
 * Cadre le viewport sur des bornes monde, centré dans une zone écran
 * `largeurPx` x `hauteurPx`, avec une marge monde en mm (défaut 1500 mm).
 */
export function cadrerSur(
  bornes: BoundsMm,
  largeurPx: number,
  hauteurPx: number,
  margeMm: number = 1500
): Viewport {
  const x1 = bornes.x1 - margeMm
  const y1 = bornes.y1 - margeMm
  const x2 = bornes.x2 + margeMm
  const y2 = bornes.y2 + margeMm
  const w = Math.max(1, x2 - x1)
  const h = Math.max(1, y2 - y1)
  const k = Math.min(K_MAX, Math.max(K_MIN, Math.min(largeurPx / w, hauteurPx / h)))
  return {
    k,
    tx: (largeurPx - w * k) / 2 - x1 * k,
    ty: (hauteurPx - h * k) / 2 - y1 * k,
  }
}
