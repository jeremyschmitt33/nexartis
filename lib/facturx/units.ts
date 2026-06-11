// lib/facturx/units.ts
// ---------------------------------------------------------------------------
// Correspondance des unites Nexartis -> codes d'unite UN/ECE Recommandation 20
// (champ BT-130 "Invoiced quantity unit of measure code" de la norme EN 16931).
//
// Une facture electronique Factur-X exige un CODE d'unite normalise, et non le
// libelle libre affiche sur le PDF ("U", "m²", "h"...). Cette table fait le pont.
// Toute unite inconnue retombe sur "C62" (= "une unite / piece"), valeur neutre
// et toujours acceptee, pour ne jamais bloquer la generation.
// ---------------------------------------------------------------------------

/** Table de correspondance libelle Nexartis -> code UN/ECE Rec 20. */
export const UNIT_CODE_MAP: Record<string, string> = {
  U: 'C62', // unite / piece
  Fft: 'C62', // forfait -> traite comme 1 unite
  forfait: 'C62',
  ens: 'C62', // ensemble
  lot: 'C62',
  pce: 'C62',
  'm²': 'MTK', // metre carre
  m2: 'MTK',
  'm³': 'MTQ', // metre cube
  m3: 'MTQ',
  ml: 'MTR', // metre lineaire / lineaire
  m: 'MTR', // metre
  h: 'HUR', // heure
  kg: 'KGM', // kilogramme
  t: 'TNE', // tonne
  l: 'LTR', // litre
  j: 'DAY', // jour
  jour: 'DAY',
}

/**
 * Renvoie le code d'unite UN/ECE Rec 20 pour un libelle Nexartis.
 * @param unite Libelle libre (ex. "U", "m²", "h"). `undefined` -> "C62".
 */
export function unitCode(unite?: string | null): string {
  if (!unite) return 'C62'
  return UNIT_CODE_MAP[unite] ?? 'C62'
}
