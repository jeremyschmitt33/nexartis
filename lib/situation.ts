/**
 * Moteur de calcul des FACTURES DE SITUATION (facturation à l'avancement, BTP).
 *
 * PUR : aucune dépendance, aucune I/O, aucun React. Conçu pour être testé en
 * isolation (voir tests) et branché ensuite sur l'UI de facturation (Push 7B).
 * NE dépend PAS de lib/plan/* : c'est de la comptabilité, pas de la géométrie.
 *
 * Principe CLÉ (corrigé après audit comptable) : le montant d'une situation se
 * calcule par la VALEUR RÉELLE, pas par un delta de pourcentage :
 *   montant de cette situation (ligne) = (montant marché × %cumulé_actuel)
 *                                        − montant HT DÉJÀ FACTURÉ sur la ligne.
 * Le « déjà facturé » est fourni en ENTRÉE (réel), jamais reconstitué depuis un
 * %précédent × marché — sinon un avenant (marché modifié) ou une régression
 * fausserait le reste à facturer et masquerait une sur-facturation.
 *
 * Règle légale (loi 16/07/1971 + pratique comptable préconisée) :
 *  - TVA sur le HT de la situation, par taux.
 *  - Retenue de garantie PLAFONNÉE À 5 %, calculée sur le HT (jamais le TTC),
 *    déduite du net à payer.
 *  - Montants au centime. À 100 % d'avancement, la ligne facture le SOLDE exact
 *    (marché − déjà facturé) → le décompte définitif boucle au centime.
 *  - Une ligne dont le cumul objectif est INFÉRIEUR au déjà facturé produit un
 *    montant NÉGATIF (trop-perçu) signalé : l'UI décidera (avoir / blocage).
 */

/** Plafond légal de la retenue de garantie (loi 16/07/1971). */
export const RETENUE_GARANTIE_MAX_PCT = 5

/** Une ligne du marché (devis) avec son avancement cumulé et son déjà-facturé réel. */
export interface LigneMarcheSituation {
  id: string
  designation: string
  /** Montant HT total de la ligne dans le marché (devis), éventuellement avenanté. */
  montantMarcheHt: number
  /** Taux de TVA de la ligne en % (ex. 20, 10, 5.5). */
  tauxTva: number
  /** % cumulé d'avancement de cette ligne à CETTE situation, 0..100. */
  avancementActuelPct: number
  /** HT RÉELLEMENT déjà facturé sur cette ligne (situations précédentes). 0 pour la 1re. */
  montantDejaFactureHt: number
}

export interface OptionsSituation {
  /** Taux de retenue de garantie en % (borné à [0, 5]). 0 ou absent = aucune retenue. */
  retenueGarantiePct?: number
}

export interface LigneSituationCalculee {
  id: string
  designation: string
  montantMarcheHt: number
  tauxTva: number
  avancementActuelPct: number
  montantDejaFactureHt: number
  /** HT cumulé VISÉ à ce % (marché × %actuel). */
  montantCumuleObjectifHt: number
  /** HT facturé par CETTE situation = cumul objectif − déjà facturé (signé). */
  montantSituationHt: number
  /** true si la ligne est en trop-perçu (montantSituationHt < 0). */
  tropPercu: boolean
}

export interface ResultatSituation {
  lignes: LigneSituationCalculee[]
  /** HT facturé par CETTE situation (Σ des lignes, peut être négatif si avoir). */
  situationHt: number
  /** TVA de cette situation, par taux (clé = taux en chaîne). */
  tvaParTaux: Record<string, number>
  situationTva: number
  situationTtc: number
  /** Retenue de garantie prélevée (≤ 5 % du HT positif de la situation). */
  retenueGarantieHt: number
  /** Net à payer par le client pour cette situation = TTC − retenue. */
  netAPayerTtc: number
  /** HT cumulé facturé depuis le début = Σ (déjà facturé + cette situation). */
  cumulFactureHt: number
  /** HT total du marché (Σ montantMarcheHt bornés ≥ 0). */
  marcheHt: number
  /** Reste à facturer HT = marché − cumul facturé (jamais menteur). */
  resteAFacturerHt: number
  /** true si au moins une ligne est en trop-perçu (à signaler / router en avoir). */
  aTropPercu: boolean
}

/** Arrondi au centime (évite les 0,1 + 0,2 = 0,30000000004). */
export function arrondiCentimes(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Borne un pourcentage dans [0, 100] ; NaN/Infinity → 0. */
function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.min(100, Math.max(0, p))
}

/** Nombre fini et positif, sinon 0. */
function positif(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Calcule une facture de situation à partir des lignes du marché, de leur
 * avancement cumulé actuel et de leur déjà-facturé réel. Fonction pure.
 */
export function calculerSituation(
  lignes: LigneMarcheSituation[],
  options: OptionsSituation = {}
): ResultatSituation {
  const retenuePct = Math.min(RETENUE_GARANTIE_MAX_PCT, positif(options.retenueGarantiePct ?? 0))

  const lignesCalc: LigneSituationCalculee[] = lignes.map((l) => {
    const marche = positif(l.montantMarcheHt)
    const act = clampPct(l.avancementActuelPct)
    const dejaFacture = Number.isFinite(l.montantDejaFactureHt) ? l.montantDejaFactureHt : 0
    const cumulObjectif = arrondiCentimes(marche * (act / 100))
    const montantSituationHt = arrondiCentimes(cumulObjectif - dejaFacture)
    return {
      id: l.id,
      designation: l.designation,
      montantMarcheHt: arrondiCentimes(marche),
      tauxTva: positif(l.tauxTva),
      avancementActuelPct: act,
      montantDejaFactureHt: arrondiCentimes(dejaFacture),
      montantCumuleObjectifHt: cumulObjectif,
      montantSituationHt,
      tropPercu: montantSituationHt < 0,
    }
  })

  const situationHt = arrondiCentimes(lignesCalc.reduce((s, l) => s + l.montantSituationHt, 0))

  // TVA par taux, sur le HT (arrondi ligne) de CETTE situation.
  const htParTaux: Record<string, number> = {}
  for (const l of lignesCalc) {
    const k = String(l.tauxTva)
    htParTaux[k] = arrondiCentimes((htParTaux[k] ?? 0) + l.montantSituationHt)
  }
  const tvaParTaux: Record<string, number> = {}
  let situationTva = 0
  for (const [k, ht] of Object.entries(htParTaux)) {
    const t = arrondiCentimes(ht * (Number(k) / 100))
    tvaParTaux[k] = t
    situationTva += t
  }
  situationTva = arrondiCentimes(situationTva)
  const situationTtc = arrondiCentimes(situationHt + situationTva)

  // Retenue : sur le HT POSITIF de la situation uniquement (un avoir ne retient pas).
  const retenueGarantieHt = arrondiCentimes(Math.max(0, situationHt) * (retenuePct / 100))
  const netAPayerTtc = arrondiCentimes(situationTtc - retenueGarantieHt)

  const marcheHt = arrondiCentimes(lignesCalc.reduce((s, l) => s + l.montantMarcheHt, 0))
  const cumulFactureHt = arrondiCentimes(
    lignesCalc.reduce((s, l) => s + l.montantDejaFactureHt + l.montantSituationHt, 0)
  )
  const resteAFacturerHt = arrondiCentimes(marcheHt - cumulFactureHt)
  const aTropPercu = lignesCalc.some((l) => l.tropPercu)

  return {
    lignes: lignesCalc,
    situationHt,
    tvaParTaux,
    situationTva,
    situationTtc,
    retenueGarantieHt,
    netAPayerTtc,
    cumulFactureHt,
    marcheHt,
    resteAFacturerHt,
    aTropPercu,
  }
}

/** États d'avancement d'une pièce (miroir de lib/plan AVANCEMENT_META — garder en phase). */
export type EtatAvancementSituation = 'a_faire' | 'en_cours' | 'termine' | 'receptionne'

/**
 * % d'avancement SUGGÉRÉ (indicatif, modifiable) depuis l'état d'une pièce du plan.
 * DOIT rester cohérent avec AVANCEMENT_META.pctSuggere (lib/plan/defaults).
 */
export function pctSuggereDepuisEtat(etat: string | undefined | null): number {
  switch (etat) {
    case 'termine':
    case 'receptionne':
      return 100
    case 'en_cours':
      return 50
    default:
      return 0
  }
}

/** Détail par ligne mémorisé sur une facture de situation (colonne factures.situation_lignes). */
export interface SituationLigneEnregistree {
  devis_ligne_id: string
  montant_ht: number
}

/**
 * Agrège le HT DÉJÀ FACTURÉ par ligne de devis, en sommant les `situation_lignes`
 * de toutes les situations précédentes. Robuste aux entrées absentes/corrompues.
 * Résultat : { [devis_ligne_id]: montant HT cumulé déjà facturé }.
 */
export function cumulDejaFactureParLigne(
  situationsPrecedentes: Array<{ situation_lignes?: SituationLigneEnregistree[] | null }>
): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const s of situationsPrecedentes) {
    const lignes = Array.isArray(s?.situation_lignes) ? s.situation_lignes : []
    for (const l of lignes) {
      if (!l || typeof l.devis_ligne_id !== 'string') continue
      const m = Number(l.montant_ht)
      acc[l.devis_ligne_id] = arrondiCentimes((acc[l.devis_ligne_id] ?? 0) + (Number.isFinite(m) ? m : 0))
    }
  }
  return acc
}
