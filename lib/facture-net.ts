// =====================================================================
// lib/facture-net.ts — SOURCE UNIQUE du "reste a payer" d'une facture.
// =====================================================================
// Objectif : un SEUL endroit qui sait calculer ce qu'un client doit encore,
// reutilise partout (liste, detail, accueil, stats, relances cron + manuelle,
// SMS, document). Toute divergence = bug (relance d'une dette eteinte, facture
// bloquee "partielle", etc.). NE JAMAIS recopier cette formule ailleurs.
//
// Deux notions DISTINCTES d'avoir, a ne pas confondre :
//   - avoirs EMIS SUR la facture (note de credit creee depuis cette facture) :
//     ils reduisent ce que le client doit sur CETTE facture. = totalAvoirsEmis.
//   - avoir IMPUTE EN reglement (un avoir d'un AUTRE dossier "a valoir" utilise
//     pour payer cette facture) : = avoirImputeMontant.
// Les deux viennent en deduction du reste a payer, mais ne sont JAMAIS du cash
// encaisse ni du CA (la facture garde son montant_ttc plein).
// =====================================================================

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

export interface FactureNetInput {
  montantTtc: number | null | undefined
  montantPaye?: number | null
  /** Avoirs CREES SUR cette facture (somme des montant_ttc). */
  totalAvoirsEmis?: number | null
  /** Avoir d'un autre dossier IMPUTE en reglement de cette facture. */
  avoirImputeMontant?: number | null
}

/**
 * Reste a payer (net du) d'une facture. Jamais negatif.
 * net = TTC - paye - avoirs emis sur la facture - avoir impute en reglement.
 */
export function netAPayerFacture(f: FactureNetInput): number {
  const ttc = r2(num(f.montantTtc))
  const paye = r2(num(f.montantPaye))
  const avoirsEmis = r2(num(f.totalAvoirsEmis))
  const impute = r2(num(f.avoirImputeMontant))
  return r2(Math.max(0, ttc - paye - avoirsEmis - impute))
}

/**
 * Montant total "regle" (cash + avoirs), pour le statut et la barre de paiement.
 * Une facture est consideree SOLDEE quand regle >= TTC (a un centime pres).
 */
export function montantRegleFacture(f: FactureNetInput): number {
  const paye = r2(num(f.montantPaye))
  const avoirsEmis = r2(num(f.totalAvoirsEmis))
  const impute = r2(num(f.avoirImputeMontant))
  return r2(paye + avoirsEmis + impute)
}

/** True si la facture n'a plus rien a encaisser (reste a payer <= 1 centime). */
export function estSoldeeFacture(f: FactureNetInput): boolean {
  return netAPayerFacture(f) <= 0.01
}

/**
 * Pourcentage regle (0-100), plafonne. Sert aux barres de progression.
 * Le numerateur inclut cash + avoirs (emis + impute), le denominateur = TTC.
 */
export function pourcentageRegleFacture(f: FactureNetInput): number {
  const ttc = r2(num(f.montantTtc))
  if (ttc <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((montantRegleFacture(f) / ttc) * 100)))
}

/**
 * Credit ENCORE DISPONIBLE sur un avoir "a valoir" (gere le residu).
 * dispo = montant_ttc de l'avoir - cumul deja impute. Jamais negatif.
 */
export function creditDisponibleAvoir(montantTtcAvoir: number | null | undefined, dejaImpute: number | null | undefined): number {
  return r2(Math.max(0, r2(num(montantTtcAvoir)) - r2(num(dejaImpute))))
}
