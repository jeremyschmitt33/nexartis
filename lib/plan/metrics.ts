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
  longueurAreteMm,
  longueurPolyligneMm,
  mm2VersM2,
  perimetreMm,
} from './geometry';

/**
 * Une ouverture tient-elle RÉELLEMENT sur son arête ? (15/07/2026)
 *
 * ⚠️ PRÉDICAT PARTAGÉ — il DOIT rester le seul, et rester identique au test du
 * rendu (`RenduOuverture` : `if (L <= 0 || o.offset + o.width > L) return null`).
 *
 * Le bug qu'il ferme : le RENDU abandonnait une ouverture débordante (elle
 * disparaissait du dessin) pendant que `deductionOuverturesM2` et `plinthesMl`
 * itéraient SANS AUCUN filtre de validité — ils continuaient de la déduire.
 * Le plan montrait un mur plein, le devis facturait le mur troué. Chiffré sur
 * une pièce 4×3 m avec une porte-fenêtre débordante : 12,00 ml de plinthes
 * facturés au lieu de 14,00, et 4,30 m² de peinture déduits d'un trou qui
 * n'existe nulle part. Le plan et le devis doivent dire la MÊME chose, par
 * construction et pas par coïncidence.
 *
 * On FILTRE au calcul, on n'EFFACE JAMAIS la donnée : une ouverture débordante
 * reste dans `plans.data` et redevient valide dès que le mur rallonge. C'est la
 * leçon du 14/07 (`recalerOuvertures` a remplacé `purgerOuverturesInvalides`,
 * qui supprimait la porte en silence quand on raccourcissait un mur).
 *
 * `longueurAreteMm` ramène l'index modulo n : le test `o.edgeIndex <
 * piece.vertices.length` est donc OBLIGATOIRE et ne peut pas être déduit de la
 * longueur — sans lui, une ouverture orpheline serait validée contre une arête
 * qui n'est pas la sienne.
 */
export function ouvertureValide(piece: Piece, o: Ouverture): boolean {
  // ⚠️ Le garde-fou passe AVANT `longueurAreteMm`, et l'ordre est le sujet :
  // celle-ci fait `vertices[((edgeIndex % n) + n) % n]` puis DÉSTRUCTURE le
  // sommet. Un edgeIndex NaN / undefined / non entier donne `vertices[NaN]`
  // -> undefined -> TypeError, et le crash emporterait TOUT l'éditeur
  // (RoomSheet et PlanRender appellent ce prédicat). Calculer la longueur en
  // premier rendait ce prédicat faillible sur la donnée même qu'il filtre —
  // d'autant que `estOuvertureValide` (api/plan/beacon-save) ne valide PAS
  // `edgeIndex` : un payload malformé s'installe durablement dans plans.data.
  if (!Number.isInteger(o.edgeIndex)) return false;
  if (o.edgeIndex < 0 || o.edgeIndex >= piece.vertices.length) return false;
  // Les DEUX bornes sont obligatoires et ne se déduisent pas de la longueur :
  // `longueurAreteMm` ramène l'index modulo n DANS LES DEUX SENS (-1 -> n-1),
  // donc une ouverture d'index négatif serait sinon validée contre une arête
  // qui n'est pas la sienne, et déduite du devis.
  const longueur = longueurAreteMm(piece.vertices, o.edgeIndex);
  return o.offset >= 0 && o.offset + o.width <= longueur;
}

/**
 * `cible` recouvre-t-elle une AUTRE ouverture de la même arête ? (15/07/2026)
 * Rend la coupable, ou null.
 *
 * ⚠️ BUG PROUVÉ EN PRODUCTION le 15/07 — `preparerOuverture` ne testait QUE la
 * longueur de l'arête, jamais le chevauchement. Deux porte-fenêtres posées sur
 * le même mur de 3,00 m étaient TOUTES DEUX acceptées et TOUTES DEUX déduites :
 * murs 28,20 -> 23,90 m², plinthes 11,00 -> 9,00 ml, sur un mur qui ne fait que
 * 7,50 m². On déduisait 8,60 m² d'un mur qui n'en a que 7,50. Et le plan n'en
 * DESSINE qu'une (elles sont superposées) : rien ne le signalait. Deux clics.
 *
 * Intervalles OUVERTS : deux ouvertures contiguës (`b1 === a2`, une porte qui
 * touche une fenêtre) ne se chevauchent PAS. C'est constructible en vrai.
 *
 * Les ouvertures invalides sont ignorées des deux côtés : elles ne sont ni
 * dessinées ni comptées (cf. `ouvertureValide`), donc bloquer une pose à cause
 * d'une ouverture invisible serait incompréhensible.
 */
export function chevauchementOuverture(piece: Piece, cible: Ouverture): Ouverture | null {
  if (!ouvertureValide(piece, cible)) return null;
  const a1 = cible.offset;
  const b1 = cible.offset + cible.width;
  for (const o of piece.openings) {
    if (o.id === cible.id) continue;
    if (o.edgeIndex !== cible.edgeIndex) continue;
    if (!ouvertureValide(piece, o)) continue;
    if (a1 < o.offset + o.width && o.offset < b1) return o;
  }
  return null;
}

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

/**
 * Somme des surfaces d'ouvertures déduites selon le mode, en m².
 *
 * ⚠️ Prend la PIÈCE et non `openings` (changé le 15/07/2026) : sans la pièce,
 * impossible d'appeler `ouvertureValide` — et sans ce filtre, une ouverture qui
 * déborde de son mur (donc ABSENTE du dessin) était quand même déduite du
 * devis. La signature devait changer pour que le bug soit corrigeable.
 */
export function deductionOuverturesM2(piece: Piece, mode: ModeDeduction): number {
  const seuil = seuilDeduction(mode);
  let total = 0;
  for (const o of piece.openings) {
    // Ne déduire que ce que le plan DESSINE réellement.
    if (!ouvertureValide(piece, o)) continue;
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
  const deduction = mode === 'brute' ? 0 : deductionOuverturesM2(piece, mode);
  return Math.max(0, Math.round((brutM2 - deduction) * 100) / 100);
}

/**
 * Plinthes en ml : périmètre − largeur des ouvertures qui touchent le sol.
 *
 * ⚠️ Filtre `ouvertureValide` (15/07/2026), 2e victime du même bug que
 * `deductionOuverturesM2` : une porte-fenêtre débordante, invisible sur le
 * plan, retirait quand même sa largeur des plinthes. Sur une pièce 4×3 m
 * (périmètre 14,00 ml) avec une porte-fenêtre de 2 m en débordement, le devis
 * sortait « Peinture des plinthes : 12,00 ml » sur un plan qui dessine un mur
 * continu tout autour.
 */
export function plinthesMl(piece: Piece): number {
  let solMm = perimetreMm(piece.vertices);
  for (const o of piece.openings) {
    if (!ouvertureValide(piece, o)) continue;
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
    // 3e lecteur de `piece.openings`, filtré comme les deux autres (15/07/2026).
    // Il n'a AUCUN appelant aujourd'hui (`metresPiece` non plus), donc zéro
    // effet en prod — mais c'est exactement ainsi que le bug reviendrait : le
    // jour où le comptage de menuiseries est branché à un devis, une ouverture
    // invisible sur le plan serait facturée à l'unité, et le badge « pas
    // comptée dans les métrés » de RoomSheet deviendrait un mensonge.
    if (!ouvertureValide(piece, o)) continue;
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
