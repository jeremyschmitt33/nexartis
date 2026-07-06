/**
 * Module Plan 2D — Métrés (Push 1, 03/07/2026)
 *
 * Le moteur calcule TOUT, les profils métier (Push 3) ne font que filtrer.
 * Règles pro validées par l'étude métier du 02/07/2026 (voir PLAN_2D_SPEC_V2) :
 * - Déduction des ouvertures : 4 modes (brute / totale / >0,5 m² peintre / >2,5 m² plaquiste).
 * - Plinthes = périmètre − largeur des ouvertures qui touchent le sol (allège = 0).
 * - Chutes carrelage/parquet : coefficient TOUJOURS visible et éditable (jamais caché).
 * - Ouvertures mitoyennes (`sharedWith`) : déduites de la surface murale des DEUX pièces,
 *   mais comptées UNE seule fois en unités (menuiserie).
 */

import type {
  Cloture,
  MetresPiece,
  ModeDeduction,
  Niveau,
  Ouverture,
  Piece,
  TypeOuverture,
} from './types';
import {
  aireMm2,
  longueurPolyligneMm,
  mm2VersM2,
  perimetreMm,
} from './geometry';

/** Surface d'une ouverture en m² (largeur × hauteur, mm -> m²). */
export function surfaceOuvertureM2(o: Ouverture): number {
  return mm2VersM2(o.width * o.height);
}

/** Une ouverture touche-t-elle le sol ? (portes, portes-fenêtres, baies : allège 0) */
export function toucheLeSol(o: Ouverture): boolean {
  return o.sillHeight <= 0;
}

/** Seuil de déduction en m² pour un mode donné (null = tout déduire). */
function seuilDeduction(mode: ModeDeduction): number | null {
  if (mode === 'brute') return Infinity; // rien n'est déduit
  if (mode === 'sup05') return 0.5;
  if (mode === 'sup25') return 2.5;
  return null; // 'totale'
}

/** Somme des surfaces d'ouvertures déduites selon le mode, en m². */
export function deductionOuverturesM2(openings: Ouverture[], mode: ModeDeduction): number {
  const seuil = seuilDeduction(mode);
  let total = 0;
  for (const o of openings) {
    const s = surfaceOuvertureM2(o);
    if (seuil === null || (seuil !== Infinity && s > seuil)) total += s;
  }
  return Math.round(total * 100) / 100;
}

/** Surface au sol en m² (aire du polygone − déduction trémie éventuelle, plancher à 0). */
export function surfaceSolM2(piece: Piece): number {
  const brut = mm2VersM2(aireMm2(piece.vertices));
  const deduction = Math.max(0, piece.deductionSolM2 ?? 0);
  return Math.max(0, Math.round((brut - deduction) * 100) / 100);
}

/** Surface de plafond en m² (= aire du polygone, sans la déduction de trémie au sol). */
export function surfacePlafondM2(piece: Piece): number {
  return mm2VersM2(aireMm2(piece.vertices));
}

/** Périmètre de la pièce en ml (mètres linéaires, 2 décimales). */
export function perimetreMl(piece: Piece): number {
  return Math.round(perimetreMm(piece.vertices) / 10) / 100;
}

/**
 * Surface murale en m² : périmètre × HSP − ouvertures selon le mode.
 * Cotes dans-œuvre assumées (spec §3). Jamais négative.
 */
export function surfaceMursM2(piece: Piece, mode: ModeDeduction): number {
  const brutM2 = mm2VersM2(perimetreMm(piece.vertices) * piece.height);
  const deduction = mode === 'brute' ? 0 : deductionOuverturesM2(piece.openings, mode);
  return Math.max(0, Math.round((brutM2 - deduction) * 100) / 100);
}

/** Plinthes en ml : périmètre − largeur des ouvertures qui touchent le sol. */
export function plinthesMl(piece: Piece): number {
  let solMm = perimetreMm(piece.vertices);
  for (const o of piece.openings) {
    if (toucheLeSol(o)) solMm -= o.width;
  }
  return Math.max(0, Math.round(solMm / 10) / 100);
}

/**
 * Comptage des ouvertures par type, en unités.
 * Une ouverture mitoyenne (sharedWith renseigné) est comptée UNE seule fois :
 * la convention est qu'elle appartient à la pièce dont l'id est le plus petit
 * (ordre lexicographique) — l'autre pièce la référence mais ne la compte pas.
 */
export function compteOuvertures(piece: Piece): Record<TypeOuverture, number> {
  const compte: Record<TypeOuverture, number> = {
    porte: 0,
    fenetre: 0,
    porte_fenetre: 0,
    baie: 0,
  };
  for (const o of piece.openings) {
    if (o.sharedWith && o.sharedWith < piece.id) continue; // comptée chez la voisine
    compte[o.type] += 1;
  }
  return compte;
}

/** Métrés complets d'une pièce (tous modes de déduction calculés). */
export function metresPiece(piece: Piece): MetresPiece {
  return {
    solM2: surfaceSolM2(piece),
    plafondM2: surfacePlafondM2(piece),
    perimetreMl: perimetreMl(piece),
    mursM2: {
      brute: surfaceMursM2(piece, 'brute'),
      totale: surfaceMursM2(piece, 'totale'),
      sup05: surfaceMursM2(piece, 'sup05'),
      sup25: surfaceMursM2(piece, 'sup25'),
    },
    plinthesMl: plinthesMl(piece),
    ouvertures: compteOuvertures(piece),
  };
}

/**
 * Applique un coefficient de chutes (carrelage, parquet) à une surface.
 * Taux en % (ex. 10 pour pose droite, 15 pour diagonale). TOUJOURS affiché à l'artisan.
 */
export function appliquerChutes(surfaceM2: number, tauxPct: number): number {
  const taux = Math.max(0, tauxPct);
  return Math.round(surfaceM2 * (1 + taux / 100) * 100) / 100;
}

/** Longueur d'une clôture en ml (polyligne ouverte). */
export function clotureMl(cloture: Cloture): number {
  return Math.round(longueurPolyligneMm(cloture.points) / 10) / 100;
}

/** Surface habitable d'un ensemble de pièces : intérieures uniquement. */
export function surfaceHabitableM2(pieces: Piece[]): number {
  let total = 0;
  for (const p of pieces) {
    if (p.cat === 'int') total += surfaceSolM2(p);
  }
  return Math.round(total * 100) / 100;
}

/** Surface extérieure totale (terrasses, pelouses, piscines...). */
export function surfaceExterieureM2(pieces: Piece[]): number {
  let total = 0;
  for (const p of pieces) {
    if (p.cat === 'ext') total += surfaceSolM2(p);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Totaux du groupe Extérieur d'un niveau (Push 3b) : zones cat 'ext' par
 * sous-type, clôtures en ml et portails (symboles type 'portail') en unités.
 * Le moteur calcule tout ; l'affichage (panneau, tiroir devis) filtre.
 */
export interface TotauxExterieur {
  terrasseM2: number;
  piscineM2: number;
  piscinePerimetreMl: number;
  pelouseM2: number;
  autreExtM2: number;
  clotureMl: number;
  portails: number;
}

export function totauxExterieur(niveau: Niveau): TotauxExterieur {
  const t: TotauxExterieur = {
    terrasseM2: 0,
    piscineM2: 0,
    piscinePerimetreMl: 0,
    pelouseM2: 0,
    autreExtM2: 0,
    clotureMl: 0,
    portails: 0,
  };
  for (const p of niveau.rooms) {
    if (p.cat !== 'ext') continue;
    const s = surfaceSolM2(p);
    if (p.extType === 'terrasse') t.terrasseM2 += s;
    else if (p.extType === 'piscine') {
      t.piscineM2 += s;
      t.piscinePerimetreMl += perimetreMl(p);
    } else if (p.extType === 'pelouse') t.pelouseM2 += s;
    else t.autreExtM2 += s;
  }
  for (const c of niveau.clotures) t.clotureMl += clotureMl(c);
  for (const s of niveau.symbols) {
    if (s.type === 'portail') t.portails += 1;
  }
  const arrondi = (v: number) => Math.round(v * 100) / 100;
  t.terrasseM2 = arrondi(t.terrasseM2);
  t.piscineM2 = arrondi(t.piscineM2);
  t.piscinePerimetreMl = arrondi(t.piscinePerimetreMl);
  t.pelouseM2 = arrondi(t.pelouseM2);
  t.autreExtM2 = arrondi(t.autreExtM2);
  t.clotureMl = arrondi(t.clotureMl);
  return t;
}

/** Surface créée par le calque projet (pièces intérieures du calque projet). */
export function surfaceCreeeProjetM2(pieces: Piece[]): number {
  let total = 0;
  for (const p of pieces) {
    if (p.layer === 'projet' && p.cat === 'int') total += surfaceSolM2(p);
  }
  return Math.round(total * 100) / 100;
}
