/**
 * Module Plan 2D — Géométrie pure (Push 1, 03/07/2026)
 *
 * Fonctions PURES, zéro dépendance, unités en MILLIMÈTRES ENTIERS.
 * Les conversions vers m / m² se font uniquement à l'affichage via mmVersM/mm2VersM2.
 * Valeurs de référence validées à la main par l'audit du 03/07/2026 :
 * rectangle 4500×3800 -> 17,10 m², périmètre 16,60 m.
 */

import type { PointMm } from './types';

/** Aire d'un polygone simple (formule du lacet / shoelace), en mm². Toujours >= 0. */
export function aireMm2(vertices: PointMm[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let somme = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % n];
    somme += x1 * y2 - x2 * y1;
  }
  return Math.abs(somme) / 2;
}

/** Aire signée (positive si anti-horaire dans un repère y vers le bas inversé). */
export function aireSigneeMm2(vertices: PointMm[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let somme = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % n];
    somme += x1 * y2 - x2 * y1;
  }
  return somme / 2;
}

/** Périmètre d'un polygone FERMÉ, en mm. */
export function perimetreMm(vertices: PointMm[]): number {
  const n = vertices.length;
  if (n < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % n];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

/** Longueur d'une polyligne OUVERTE (clôture, réseau...), en mm. */
export function longueurPolyligneMm(points: PointMm[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

/** Longueur d'une arête du polygone (sommet i -> sommet i+1), en mm. */
export function longueurAreteMm(vertices: PointMm[], edgeIndex: number): number {
  const n = vertices.length;
  if (n < 2) return 0;
  const i = ((edgeIndex % n) + n) % n;
  const [x1, y1] = vertices[i];
  const [x2, y2] = vertices[(i + 1) % n];
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Test point-dans-polygone (ray casting). Les points sur le bord peuvent être true ou false. */
export function estDansPolygone(point: PointMm, vertices: PointMm[]): boolean {
  const [px, py] = point;
  const n = vertices.length;
  let dedans = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[j];
    const coupe =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (coupe) dedans = !dedans;
  }
  return dedans;
}

/**
 * Normalise l'ordre des sommets en anti-horaire (CCW) dans le repère écran
 * (y vers le bas) : simplifie normales et cotes en aval.
 */
export function normaliserCCW(vertices: PointMm[]): PointMm[] {
  return aireSigneeMm2(vertices) < 0 ? vertices.slice().reverse() : vertices.slice();
}

/** Centre approximatif (moyenne des sommets) — suffisant pour placer une étiquette. */
export function centreMm(vertices: PointMm[]): PointMm {
  if (vertices.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of vertices) {
    sx += x;
    sy += y;
  }
  return [Math.round(sx / vertices.length), Math.round(sy / vertices.length)];
}

/** Aimante une valeur mm sur une grille (step en mm, ex. 100). */
export function snapMm(valeur: number, step: number): number {
  if (step <= 0) return Math.round(valeur);
  return Math.round(valeur / step) * step;
}

/** Rectangle -> polygone CCW (helper de création). Dimensions en mm. */
export function rectanglePolygone(x: number, y: number, largeur: number, hauteur: number): PointMm[] {
  return normaliserCCW([
    [x, y],
    [x + largeur, y],
    [x + largeur, y + hauteur],
    [x, y + hauteur],
  ]);
}

/* ---------------------------------------------------------------------------
   Conversions & formatage (l'affichage est en mètres, virgule française)
--------------------------------------------------------------------------- */

/** mm² -> m², arrondi à 2 décimales. */
export function mm2VersM2(mm2: number): number {
  return Math.round(mm2 / 10_000) / 100;
}

/** mm -> m (linéaire), arrondi à 2 décimales. Ex. 4500 -> 4,5. */
export function mmVersM(mm: number): number {
  return Math.round(mm / 10) / 100;
}

/** Formatage français d'un nombre : 17.1 -> "17,10" (2 décimales). */
export function fmtNombreFr(valeur: number, decimales: number = 2): string {
  return valeur.toFixed(decimales).replace('.', ',');
}

/** Formatage d'une longueur mm -> "4,50 m". */
export function fmtLongueurM(mm: number): string {
  return fmtNombreFr(mmVersM(mm)) + ' m';
}

/** Formatage d'une surface mm² -> "17,10 m²". */
export function fmtSurfaceM2(mm2: number): string {
  return fmtNombreFr(mm2VersM2(mm2)) + ' m²';
}
