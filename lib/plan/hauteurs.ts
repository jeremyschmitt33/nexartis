/**
 * Module Plan — Hauteurs de pose des symboles (15/07/2026)
 *
 * Deux fonctions VOLONTAIREMENT distinctes :
 * - `poseDe(type)`   : « ce symbole est-il mural ? »  → discriminant
 * - `hauteurDe(sym)` : « à quelle hauteur est-il ? »  → mesure
 *
 * Elles étaient FUSIONNÉES jusqu'ici dans `HAUTEURS_MURALES_MM` (iso.ts), dont
 * la seule présence d'une clé servait à la fois de hauteur ET de booléen
 * « mural ». C'est ce qui a produit les deux bugs connus : `tableau` et `vmc`,
 * absents de la table, étaient dessinés POSÉS PAR TERRE en 3D. Et c'est ce qui
 * rendait le bug incorrigible sans mentir : ajouter `tableau: 1400` aurait
 * inventé rétroactivement une hauteur pour tous les tableaux déjà exportés.
 *
 * ⚠️ Ne JAMAIS refusionner. Un helper qui rendrait un `number` pour tout ferait
 * partir les WC et les éviers en haut d'une tige verticale.
 *
 * Les DÉFAUTS ne sont pas ici : ils vivent dans `symboles.ts`, lus par le seul
 * `creerSymbole`. Voir la règle fondatrice en tête de `HAUTEUR_DEFAUT_MM`.
 */

import type { Symbole } from './types'
import type { PoseSymbole } from './symboles'
import { SYMBOLES } from './symboles'

/* ── 1. Le discriminant ───────────────────────────────────────────────────── */

/**
 * Pose d'un TYPE de symbole. Seule autorité pour « ce symbole est-il mural ? ».
 *
 * ⚠️ Ne JAMAIS répondre à cette question en testant la présence de
 * `hauteurMm` : un symbole legacy (prise sans hauteur) EST mural, et un WC dont
 * le JSON aurait été bidouillé à la main ne l'est PAS.
 *
 * Type inconnu (donnée ancienne, `SYMBOLES[type]` absent) => 'sol' : c'est le
 * repli historique d'iso.ts (glyphe à plat). On ne change pas le rendu existant.
 */
export function poseDe(type: string): PoseSymbole {
  const def = SYMBOLES[type]
  return def ? def.pose : 'sol'
}

/* ── 2. La lecture de la hauteur ──────────────────────────────────────────── */

/**
 * Hauteur d'un symbole POSÉ. Union discriminée DÉLIBÉRÉE : rendre un `number`
 * (ou un `number | null`) pour tous les symboles est le piège de cette feature
 * — l'appelant traiterait un WC comme un mural à 0 mm, ou un legacy comme un
 * mural à `null` coulé en 0.
 *
 * Ici, obtenir un nombre EXIGE d'avoir traité les trois autres cas : le
 * compilateur fait le travail de revue. C'est ce qui rend structurellement
 * impossible le bug le plus cher imaginable — un legacy coulé en 0 qui
 * produirait « 0 ml de saignée » dans un devis : un zéro plausible et faux.
 */
export type HauteurInfo =
  /** Mural, hauteur d'axe saisie/matérialisée (mm entiers > 0). Donnée d'auteur. */
  | { kind: 'mural'; mm: number }
  /** Mural, hauteur INCONNUE (posé avant la feature, ou effacée). Ne rien inventer. */
  | { kind: 'mural-inconnue' }
  /** Au plafond : la hauteur vaut la HSP de la PIÈCE, l'appelant doit la résoudre. */
  | { kind: 'plafond' }
  /** Posé au sol : la notion de hauteur d'axe n'a pas de sens (WC, évier, portail). */
  | { kind: 'sol' }

/**
 * Plafond de plausibilité (30 m). Ne sert QU'À rejeter du JSON corrompu, JAMAIS
 * à corriger une saisie : au-dessous de ce seuil, la valeur passe TELLE QUELLE
 * — la cote saisie est sacrée. Une hauteur au-delà n'est pas « haute », elle
 * est cassée (NaN sérialisé, chaîne, Infinity, unité confondue).
 */
export const H_MAX_PLAUSIBLE_MM = 30000

/** Au-delà : le champ de saisie AVERTIT (sans jamais bloquer ni écrêter). */
export const H_SUSPECTE_MM = 3000

export function hauteurDe(symbole: Symbole): HauteurInfo {
  const pose = poseDe(symbole.type)
  if (pose === 'plafond') return { kind: 'plafond' }
  if (pose === 'sol') return { kind: 'sol' }
  // À partir d'ici : mural, et LUI SEUL peut porter une hauteur.
  const h = symbole.hauteurMm
  // `typeof` et pas `!== undefined` ni `in` : un patch { hauteurMm: undefined }
  // laisse la clé en mémoire (`in` dirait true), alors que JSON.stringify la
  // supprime au round-trip base (`in` dirait false). Seul `typeof` est correct
  // dans les deux mondes.
  if (typeof h !== 'number') return { kind: 'mural-inconnue' }
  // Garde défensive contre un JSONB abîmé. On ne « répare » pas une valeur
  // aberrante : on déclare inconnu. Inventer serait mentir.
  //
  // ⚠️ `!isFinite(h)` est OBLIGATOIRE et ne se déduit PAS des deux autres tests :
  // `NaN <= 0` est false ET `NaN > 30000` est false. Sans lui, un NaN sortirait
  // en { kind: 'mural', mm: NaN } → P(x, y, NaN) dans iso.ts → `bornes`
  // contaminées → viewBox NaN → la 3D entière devient BLANCHE. Ne pas retirer.
  if (!isFinite(h) || h <= 0 || h > H_MAX_PLAUSIBLE_MM) return { kind: 'mural-inconnue' }
  return { kind: 'mural', mm: h }
}
