// ============================================================================
// lib/banque/regles.ts — Moteur des règles de catégorisation (ISOMORPHE)
// ----------------------------------------------------------------------------
// Partagé entre les routes API (/api/banque/import/*) et les composants
// client (PanneauPointage : apprentissage des corrections). AUCUN import Node.
// Référence schéma : sql/2026-07-12-banque-02 (categorisation_regles).
//
// Deux responsabilités :
//   1. trouverRegle() — applique la PREMIÈRE règle qui matche un libellé
//      (liste triée par priorité CROISSANTE : les règles apprises, priorité
//      100, gagnent sur les règles système, priorité 880-940).
//   2. extraireMotif() — extrait le nom de commerçant significatif d'un
//      libellé bancaire pour créer une règle apprise (Lot 2c).
// ============================================================================

/** Colonnes à sélectionner sur categorisation_regles (alignées sur RegleCategorisation). */
export const REGLES_COLONNES = 'id, pattern, type_match, categorie_id, sens, priorite, auto_point'

export interface RegleCategorisation {
  id: string
  pattern: string
  type_match: 'contient' | 'commence_par'
  /**
   * null = règle 1b « binaire » (supermarché ambigu) : on RECONNAÎT le marchand
   * mais on ne propose AUCUNE catégorie (question pro/perso posée à l'utilisateur).
   */
  categorie_id: string | null
  /** 'debit' | 'credit' | null = les deux. */
  sens: 'debit' | 'credit' | null
  /** Plus petit = gagne (apprises 100 < système ~900). */
  priorite: number
  /**
   * true = niveau 1a (mono-catégorie certain) : le débit reconnu est catégorisé
   * ET pointé d'office. false = niveau 1b (ambigu) : catégorie SUGGÉRÉE (ou
   * simple reconnaissance binaire si categorie_id null), jamais pointée d'office.
   */
  auto_point: boolean
}

/**
 * Renvoie la première règle qui matche (sens respecté), ou null.
 * ⚠️ La liste DOIT être triée par priorité croissante (order('priorite')
 * côté requête) : les règles apprises priment ainsi sur les règles système.
 */
export function trouverRegle(
  regles: RegleCategorisation[],
  libelle: string,
  montant: number,
): RegleCategorisation | null {
  const libelleMaj = libelle.toUpperCase()
  for (const regle of regles) {
    if (regle.sens === 'debit' && montant >= 0) continue
    if (regle.sens === 'credit' && montant <= 0) continue
    const motif = regle.pattern.toUpperCase()
    const ok =
      regle.type_match === 'commence_par'
        ? libelleMaj.startsWith(motif)
        : libelleMaj.includes(motif)
    if (ok) return regle
  }
  return null
}

// ---------------------------------------------------------------------------
// Extraction du motif d'un libellé bancaire (apprentissage — Lot 2c)
// ---------------------------------------------------------------------------

/**
 * Jetons techniques que les banques collent EN TÊTE de libellé. On les retire
 * un à un et on s'arrête au premier jeton « métier » (pour ne jamais amputer
 * un nom de commerçant : « CB LE CAFE ROSTAND » garde bien son « LE »).
 */
const PREFIXES_TECHNIQUES = new Set([
  'CB',
  'TPE',
  'VIR',
  'VIRT',
  'VIREMENT',
  'INST',
  'INSTANTANE',
  'SEPA',
  'EUROPEEN',
  'EMIS',
  'RECU',
  'PRLV',
  'PRELEVEMENT',
  'PRELEVEMENTS',
  'ACHAT',
  'ACHATS',
  'PAIEMENT',
  'PAIEMENTS',
  'CARTE',
  'RETRAIT',
  'CHQ',
  'CHEQUE',
  'WEB',
  'PSC',
])

/**
 * Mots de référence qui peuvent survivre au nettoyage quand ils ne sont PAS
 * suivis d'un numéro (« CB FACT », « PRLV FACTURE ») : jamais un motif à eux
 * seuls — en type_match 'contient', « FACT » matcherait toutes les factures.
 */
const MOTIFS_TROP_GENERIQUES = new Set([
  'FACT',
  'FACTURE',
  'ECHEANCE',
  'ECH',
  'REF',
  'RUM',
  'MANDAT',
  'NUM',
  'ID',
  'DAB',
])

/**
 * Extrait le nom de commerçant significatif d'un libellé bancaire, pour en
 * faire le pattern d'une règle apprise. Heuristique (validée Lot 2c) :
 *   1. retirer les dates (« 29/06/26 », « 29.06 ») et les références
 *      chiffrées (« FACT 290626 », « REF ABC123 »),
 *   2. retirer les préfixes techniques en tête (CB, VIR, PRLV, ACHAT…),
 *   3. écarter les jetons sans lettre ou trop chiffrés (n° de carte, dates
 *      collées),
 *   4. garder 2 à 40 caractères, en MAJUSCULES (coupe sur un espace),
 *   5. refuser un motif d'un SEUL jeton trop court ou trop générique
 *      (« LE », « FACT ») : il sur-matcherait presque tous les libellés.
 * Renvoie null si rien de significatif ne reste (jamais de règle bancale).
 * Exemples : « CB LE CAFE ROSTAND FACT 290626 » → « LE CAFE ROSTAND »,
 *            « CB ANTHROPIC CLAU FACT 290626 » → « ANTHROPIC CLAU ».
 */
export function extraireMotif(libelleBanque: string): string | null {
  let texte = libelleBanque.toUpperCase().replace(/[*]+/g, ' ')

  // Dates explicites : 29/06/26, 29.06.2026, 29-06…
  texte = texte.replace(/\b\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?\b/g, ' ')
  // Références chiffrées : « FACT 290626 », « FACTURE 12345 », « REF ABC123 »…
  texte = texte.replace(
    /\b(?:FACT|FACTURE|ECHEANCE|ECH|REF|RUM|MANDAT|NUM|N°|ID)\.?\s*:?\s*[A-Z0-9/\-]*\d[A-Z0-9/\-]*/g,
    ' ',
  )

  const jetons = texte.split(/\s+/).filter(Boolean)

  // Préfixes techniques en tête uniquement (on s'arrête au premier jeton métier).
  let debut = 0
  while (debut < jetons.length && PREFIXES_TECHNIQUES.has(jetons[debut])) debut++

  const gardes: string[] = []
  for (const jeton of jetons.slice(debut)) {
    if (!/[A-ZÀ-Ý]/.test(jeton)) continue // que des chiffres ou de la ponctuation
    const nbChiffres = (jeton.match(/\d/g) ?? []).length
    if (nbChiffres >= 4) continue // n° de carte, date collée (290626)…
    gardes.push(jeton)
  }

  let motif = gardes.join(' ').trim()
  if (motif.length > 40) {
    const coupe = motif.slice(0, 40)
    const dernierEspace = coupe.lastIndexOf(' ')
    motif = (dernierEspace >= 2 ? coupe.slice(0, dernierEspace) : coupe).trim()
  }
  if (motif.length < 2) return null
  // Garde-fou : un motif d'un seul jeton de 2 lettres (« LE ») ou purement
  // « technique » (« FACT ») ferait une règle 'contient' dangereuse → aucune
  // règle plutôt qu'une mauvaise règle.
  if (!motif.includes(' ') && (motif.length < 3 || MOTIFS_TROP_GENERIQUES.has(motif))) {
    return null
  }
  return motif
}
