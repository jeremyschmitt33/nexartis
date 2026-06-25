// lib/superpdp/refus-motifs.ts
// ---------------------------------------------------------------------------
// Motifs de REFUS d'une facture recue (statut DGFiP fr:210 "Refusee").
// Le refus motive est la SEULE action destinataire juridiquement obligatoire
// en 2026. Les codes sont normalises par la norme AFNOR XP Z12-012 v1.3
// (publiee le 26/02/2026) — 45 codes / 6 familles. On expose ici un
// sous-ensemble courant et utile a un artisan ; le code normalise est envoye a
// SUPER PDP dans details[], le texte libre vient en COMPLEMENT (jamais en
// remplacement). Liste extensible — a completer avec le referentiel exact
// expose par SUPER PDP si besoin.
// ---------------------------------------------------------------------------

export interface RefusMotif {
  code: string
  label: string
  famille: string
}

export const REFUS_MOTIFS: RefusMotif[] = [
  // Famille : facture erronee / montants
  { code: 'AMOUNT_INCORRECT', label: 'Montant(s) incorrect(s)', famille: 'Erreur de facturation' },
  { code: 'VAT_INCORRECT', label: 'TVA incorrecte', famille: 'Erreur de facturation' },
  { code: 'PRICE_NOT_AGREED', label: 'Prix non conforme a la commande / au devis', famille: 'Erreur de facturation' },
  { code: 'DUPLICATE', label: 'Facture en double', famille: 'Erreur de facturation' },
  // Famille : reference / commande
  { code: 'NO_ORDER', label: 'Aucune commande / aucun bon ne correspond', famille: 'Reference manquante' },
  { code: 'WRONG_RECIPIENT', label: 'Destinataire erronne (facture pas pour nous)', famille: 'Reference manquante' },
  { code: 'MISSING_REFERENCE', label: 'Reference obligatoire manquante', famille: 'Reference manquante' },
  // Famille : prestation / livraison
  { code: 'GOODS_NOT_RECEIVED', label: 'Marchandise / prestation non recue', famille: 'Prestation' },
  { code: 'SERVICE_NOT_CONFORM', label: 'Prestation non conforme', famille: 'Prestation' },
  { code: 'WORK_NOT_DONE', label: 'Travaux non realises / incomplets', famille: 'Prestation' },
  // Famille : mentions legales
  { code: 'LEGAL_MENTIONS_MISSING', label: 'Mentions legales obligatoires manquantes', famille: 'Conformite' },
  { code: 'WRONG_VAT_NUMBER', label: 'Numero de TVA / SIRET erronne', famille: 'Conformite' },
  // Famille : litige commercial
  { code: 'COMMERCIAL_DISPUTE', label: 'Litige commercial', famille: 'Litige' },
  // Autre (texte libre obligatoire)
  { code: 'OTHER', label: 'Autre motif (precisez)', famille: 'Autre' },
]

export function isValidRefusCode(code: string): boolean {
  return REFUS_MOTIFS.some((m) => m.code === code)
}
