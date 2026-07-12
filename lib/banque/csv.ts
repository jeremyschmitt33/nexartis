// ============================================================================
// lib/banque/csv.ts — Moteur d'analyse des relevés bancaires CSV (SERVEUR)
// ----------------------------------------------------------------------------
// ⚠️ Utilise node:crypto : à importer UNIQUEMENT depuis les routes API
//    (app/api/banque/import/*), jamais depuis un composant client.
//
// Ce que fait ce module (cf. SPEC_DEPENSES_BANQUE_V1 §5 + migration 04) :
//   1. Décodage : UTF-8 strict, sinon Windows-1252 (les accents cassés
//      changeraient le hash_dedup → doublons futurs).
//   2. Détection SÉMANTIQUE des colonnes (aucun format imposé) : date,
//      libellé, montant signé OU débit/crédit séparés — par nom d'en-tête
//      d'abord (esprit de lib/import/mappers.ts), par contenu sinon.
//   3. Montants français : virgule décimale, espaces/​insécables, parenthèses
//      négatives, colonnes débit/crédit toutes positives.
//   4. Dates ambiguës : si au moins une ligne a un 1er nombre > 12 → JJ/MM
//      pour tout le fichier ; si un 2e nombre > 12 → MM/JJ ; sinon on DEMANDE
//      à l'utilisateur (jamais de choix silencieux).
//   5. Écriture double type Clementine : paires débit/crédit d'équilibrage
//      (même date, même libellé, montants opposés) fusionnées quand elles
//      dominent le fichier.
//   6. hash_dedup : réplique EXACTE de la colonne générée de la migration 04 :
//        md5( joursDepuisEpoch + '|' + montant.toFixed(2) + '|' +
//             libelle.trim().replace(/\s+/g,' ').toUpperCase() )
//      Le libellé est nettoyé (blancs regroupés + trim) AVANT stockage, donc
//      le regexp_replace SQL est un no-op et les deux hashs coïncident.
//   7. Doublons intra-fichier légitimes (2 cafés à 1,20 € le même jour) :
//      suffixe « #2 », « #3 »… ajouté au libellé AVANT hash et insertion.
// ============================================================================

import { createHash } from 'crypto'
import Papa from 'papaparse'

// ---------------------------------------------------------------------------
// Décodage du fichier (UTF-8 strict → Windows-1252 en secours)
// ---------------------------------------------------------------------------

export function decoderFichier(buffer: ArrayBuffer): string {
  try {
    const texte = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return retirerBom(texte)
  } catch {
    // Octets invalides en UTF-8 → export bancaire Windows (ANSI / CP1252)
    const texte = new TextDecoder('windows-1252').decode(buffer)
    return retirerBom(texte)
  }
}

function retirerBom(texte: string): string {
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte
}

// ---------------------------------------------------------------------------
// Hashs (formules officielles du projet)
// ---------------------------------------------------------------------------

/** SHA-256 du fichier brut — idempotence niveau fichier (banque_imports.fichier_hash). */
export function hashFichier(buffer: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex')
}

/** Nettoie un libellé comme le fera la colonne générée SQL : blancs → 1 espace, trim. */
export function nettoyerLibelle(libelle: string): string {
  // \s JS couvre aussi l'insécable (U+00A0) : on normalise AVANT stockage,
  // donc le regexp_replace('\s+') SQL ne changera plus rien → hashs identiques.
  return libelle.replace(/\s+/g, ' ').trim()
}

/**
 * Réplique EXACTE du hash_dedup de la migration 04.
 * - joursDepuisEpoch : jours entiers depuis le 01/01/1970 (date en UTC).
 * - montant : toujours 2 décimales, point décimal, signe '-' sur les débits
 *   (équivalent de NUMERIC(12,2)::text).
 * - libellé : déjà nettoyé par nettoyerLibelle() + upper().
 */
export function hashDedup(dateIso: string, montant: number, libelleNettoye: string): string {
  const [a, m, j] = dateIso.split('-').map(Number)
  const joursDepuisEpoch = Math.round(Date.UTC(a, m - 1, j) / 86_400_000)
  const montantTexte = (Math.round(montant * 100) / 100).toFixed(2)
  const libelleHash = libelleNettoye.toUpperCase()
  return createHash('md5')
    .update(`${joursDepuisEpoch}|${montantTexte}|${libelleHash}`)
    .digest('hex')
}

// ---------------------------------------------------------------------------
// Montants français
// ---------------------------------------------------------------------------

/**
 * Parse un montant « à la française » : "1 234,56", "−45,90", "(45,90)",
 * "1.234,56", "1,234.56", "45.90 €"… Renvoie null si illisible.
 */
export function parserMontantFrancais(brut: string): number | null {
  if (!brut) return null
  let s = String(brut).trim()
  if (!s) return null

  // Parenthèses comptables = négatif
  let negatif = false
  if (/^\(.*\)$/.test(s)) {
    negatif = true
    s = s.slice(1, -1)
  }

  // Espaces (dont insécables/fines), symbole €, lettres EUR
  s = s.replace(/[\s  ]/g, '').replace(/€|EUR/gi, '')

  // Signes (le tiret typographique − compris), y compris signe final "45,90-"
  if (/^[-−–]/.test(s)) { negatif = true; s = s.slice(1) }
  if (/[-−–]$/.test(s)) { negatif = true; s = s.slice(0, -1) }
  if (s.startsWith('+')) s = s.slice(1)
  if (!s) return null

  const aVirgule = s.includes(',')
  const aPoint = s.includes('.')
  if (aVirgule && aPoint) {
    // Le dernier séparateur rencontré est le séparateur décimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (aVirgule) {
    // "1,234,567" (plusieurs virgules) = milliers ; sinon virgule décimale
    s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (aPoint) {
    // "1.234.567" (plusieurs points) = milliers ; un seul point = décimal
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '')
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const valeur = Math.round(parseFloat(s) * 100) / 100
  if (!isFinite(valeur)) return null
  return negatif ? -valeur : valeur
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export type OrdreDates = 'jma' | 'mja' | 'iso'

interface DateBrute {
  /** null si la chaîne ne ressemble pas à une date. */
  n1: number
  n2: number
  annee: number
  iso: boolean
}

/** Découpe "07/03/2026", "07-03-26", "2026-03-07"… sans décider de l'ordre JJ/MM. */
function decouperDate(brut: string): DateBrute | null {
  const s = String(brut || '').trim()
  if (!s) return null

  // ISO : 2026-03-07 (ou 2026/03/07)
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return { annee: Number(m[1]), n1: Number(m[3]), n2: Number(m[2]), iso: true }

  // Européen / US : 07/03/2026, 07-03-2026, 07.03.26
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let annee = Number(m[3])
    if (annee < 100) annee += annee <= 69 ? 2000 : 1900
    return { n1: Number(m[1]), n2: Number(m[2]), annee, iso: false }
  }
  return null
}

function dateValide(jour: number, mois: number, annee: number): boolean {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || annee < 1970 || annee > 2100) return false
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  return d.getUTCDate() === jour && d.getUTCMonth() === mois - 1
}

function versIso(jour: number, mois: number, annee: number): string {
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

/**
 * Détermine l'ordre des dates du fichier entier.
 * - un 1er nombre > 12 quelque part → JJ/MM (règle de la spec)
 * - sinon un 2e nombre > 12 quelque part → MM/JJ (seule lecture possible)
 * - sinon → 'ambigu' : on demande à l'utilisateur, jamais de choix silencieux.
 */
export function detecterOrdreDates(datesBrutes: string[]): OrdreDates | 'ambigu' {
  let toutesIso = true
  let unJourSup12 = false
  let unMoisSup12 = false
  let auMoinsUne = false
  for (const brut of datesBrutes) {
    const d = decouperDate(brut)
    if (!d) continue
    auMoinsUne = true
    if (d.iso) continue
    toutesIso = false
    if (d.n1 > 12) unJourSup12 = true
    if (d.n2 > 12) unMoisSup12 = true
  }
  if (!auMoinsUne) return 'ambigu'
  if (toutesIso) return 'iso'
  if (unJourSup12) return 'jma'
  if (unMoisSup12) return 'mja'
  return 'ambigu'
}

/** Convertit une date brute en ISO selon l'ordre choisi. null si invalide. */
export function parserDate(brut: string, ordre: OrdreDates): string | null {
  const d = decouperDate(brut)
  if (!d) return null
  if (d.iso) {
    // decouperDate a rangé jour dans n1 / mois dans n2 pour l'ISO
    return dateValide(d.n1, d.n2, d.annee) ? versIso(d.n1, d.n2, d.annee) : null
  }
  const [jour, mois] = ordre === 'mja' ? [d.n2, d.n1] : [d.n1, d.n2]
  return dateValide(jour, mois, d.annee) ? versIso(jour, mois, d.annee) : null
}

// ---------------------------------------------------------------------------
// Détection sémantique des colonnes
// ---------------------------------------------------------------------------

export interface ColonnesDetectees {
  /** Index (0-based) dans les lignes du CSV. */
  date: number
  libelle: number
  /** Soit une colonne montant signé… */
  montant: number | null
  /** …soit deux colonnes débit / crédit séparées. */
  debit: number | null
  credit: number | null
  /** Index de la ligne d'en-tête dans le fichier ; -1 si fichier sans en-tête. */
  ligneEntete: number
  noms: { date: string; libelle: string; montant: string }
}

function normaliserEntete(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents décomposés par NFD
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Mots-clés sémantiques (esprit des `sourceColumn: 'A|B|C'` de lib/import/mappers.ts)
const MOTS_DATE = ['date operation', 'date de l operation', 'date compta', 'date comptabilisation', 'date', 'dateop', 'date mouvement', 'transaction date', 'booking date']
const MOTS_DATE_EXCLUS = ['date valeur', 'value date', 'date de valeur']
const MOTS_LIBELLE = ['libelle', 'libelle operation', 'libelle simplifie', 'label', 'description', 'designation', 'motif', 'nature', 'communication', 'detail', 'details', 'operation', 'intitule', 'memo', 'reference', 'counterparty name', 'nom de la contrepartie']
const MOTS_MONTANT = ['montant', 'montant eur', 'montant en euros', 'amount', 'valeur', 'somme', 'montant de l operation']
const MOTS_DEBIT = ['debit', 'debit eur', 'montant debit', 'sortie', 'depense']
const MOTS_CREDIT = ['credit', 'credit eur', 'montant credit', 'entree', 'recette']

function chercherColonne(entetes: string[], motsCles: string[], exclusions: string[] = []): number {
  const normalises = entetes.map(normaliserEntete)
  // Passe 1 : égalité stricte (la plus fiable)
  for (const mot of motsCles) {
    const i = normalises.findIndex((e) => e === mot)
    if (i !== -1) return i
  }
  // Passe 2 : l'en-tête contient le mot-clé (hors exclusions)
  for (const mot of motsCles) {
    const i = normalises.findIndex(
      (e) => e.includes(mot) && !exclusions.some((x) => e.includes(x)),
    )
    if (i !== -1) return i
  }
  return -1
}

/** Part des cellules non vides d'une colonne qui ressemblent à une date / un montant. */
function scoreColonne(lignes: string[][], index: number, test: (v: string) => boolean): number {
  let nonVides = 0
  let ok = 0
  for (const ligne of lignes) {
    const v = (ligne[index] ?? '').trim()
    if (!v) continue
    nonVides++
    if (test(v)) ok++
  }
  return nonVides === 0 ? 0 : ok / nonVides
}

/**
 * Détecte les colonnes du relevé, SANS format imposé.
 * `lignes` = toutes les lignes brutes du CSV (certaines banques mettent un
 * préambule « Solde au… » avant l'en-tête : on cherche l'en-tête dans les
 * 10 premières lignes).
 */
export function detecterColonnes(lignes: string[][]): ColonnesDetectees | null {
  const maxEntete = Math.min(lignes.length, 10)

  // ── Passe 1 : par nom d'en-tête ──
  for (let e = 0; e < maxEntete; e++) {
    const entetes = lignes[e]
    if (!entetes || entetes.length < 2) continue
    const iDate = chercherColonne(entetes, MOTS_DATE, MOTS_DATE_EXCLUS)
    const iLibelle = chercherColonne(entetes, MOTS_LIBELLE)
    const iMontant = chercherColonne(entetes, MOTS_MONTANT)
    const iDebit = chercherColonne(entetes, MOTS_DEBIT)
    const iCredit = chercherColonne(entetes, MOTS_CREDIT)
    if (iDate === -1 || iLibelle === -1) continue
    if (iMontant === -1 && (iDebit === -1 || iCredit === -1)) continue
    // Vérification par le contenu (évite un faux en-tête dans le préambule)
    const corps = lignes.slice(e + 1, e + 30)
    if (scoreColonne(corps, iDate, (v) => decouperDate(v) !== null) < 0.6) continue
    // Débit/crédit séparés prioritaires (certaines banques ont AUSSI une
    // colonne « Montant » de solde intermédiaire qu'il ne faut pas prendre).
    const modeDebitCredit = iDebit !== -1 && iCredit !== -1
    return {
      date: iDate,
      libelle: iLibelle,
      montant: modeDebitCredit ? null : iMontant,
      debit: modeDebitCredit ? iDebit : null,
      credit: modeDebitCredit ? iCredit : null,
      ligneEntete: e,
      noms: {
        date: entetes[iDate] ?? 'date',
        libelle: entetes[iLibelle] ?? 'libellé',
        montant:
          iDebit !== -1 && iCredit !== -1
            ? `${entetes[iDebit] ?? 'débit'} / ${entetes[iCredit] ?? 'crédit'}`
            : entetes[iMontant] ?? 'montant',
      },
    }
  }

  // ── Passe 2 : par contenu (fichier sans en-tête reconnaissable) ──
  const corps = lignes.slice(0, 200)
  const nbColonnes = Math.max(...corps.map((l) => l.length), 0)
  if (nbColonnes < 2) return null

  let iDate = -1
  let meilleurScoreDate = 0
  for (let c = 0; c < nbColonnes; c++) {
    const score = scoreColonne(corps, c, (v) => decouperDate(v) !== null)
    if (score > 0.8 && score > meilleurScoreDate) { meilleurScoreDate = score; iDate = c }
  }
  if (iDate === -1) return null

  let iMontant = -1
  let meilleurScoreMontant = 0
  for (let c = 0; c < nbColonnes; c++) {
    if (c === iDate) continue
    // Une colonne montant est numérique ET n'est pas une date
    const score = scoreColonne(
      corps, c,
      (v) => decouperDate(v) === null && parserMontantFrancais(v) !== null,
    )
    if (score > 0.8 && score > meilleurScoreMontant) { meilleurScoreMontant = score; iMontant = c }
  }
  if (iMontant === -1) return null

  // Libellé = la colonne texte la plus « longue » restante
  let iLibelle = -1
  let meilleureLongueur = -1
  for (let c = 0; c < nbColonnes; c++) {
    if (c === iDate || c === iMontant) continue
    let total = 0
    let n = 0
    for (const ligne of corps) {
      const v = (ligne[c] ?? '').trim()
      if (!v) continue
      if (decouperDate(v) !== null || parserMontantFrancais(v) !== null) continue
      total += v.length
      n++
    }
    if (n > 0 && total / n > meilleureLongueur) { meilleureLongueur = total / n; iLibelle = c }
  }
  if (iLibelle === -1) return null

  return {
    date: iDate,
    libelle: iLibelle,
    montant: iMontant,
    debit: null,
    credit: null,
    ligneEntete: -1,
    noms: { date: `colonne ${iDate + 1}`, libelle: `colonne ${iLibelle + 1}`, montant: `colonne ${iMontant + 1}` },
  }
}

// ---------------------------------------------------------------------------
// Analyse complète d'un fichier
// ---------------------------------------------------------------------------

export interface LigneNormalisee {
  date: string
  libelle: string
  montant: number
}

export interface ResultatAnalyse {
  /** true → dates ambiguës : demander JJ/MM ou MM/JJ à l'utilisateur. */
  confirmationDatesRequise: boolean
  ordreDatesUtilise: OrdreDates
  lignes: LigneNormalisee[]
  nbLignesFichier: number
  nbErreurs: number
  nbPairesFusionnees: number
  colonnes: ColonnesDetectees
}

export class ErreurAnalyseCsv extends Error {}

/**
 * Analyse un CSV bancaire de bout en bout : décodage déjà fait en amont.
 * @param texte    contenu texte du fichier
 * @param ordreForce ordre de dates choisi par l'utilisateur après confirmation
 */
export function analyserCsvBancaire(texte: string, ordreForce?: OrdreDates): ResultatAnalyse {
  const resultat = Papa.parse<string[]>(texte, {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
  })
  const brutes = (resultat.data ?? []).filter((l) => Array.isArray(l))
  if (brutes.length === 0) {
    throw new ErreurAnalyseCsv('Le fichier est vide ou illisible.')
  }

  const colonnes = detecterColonnes(brutes)
  if (!colonnes) {
    throw new ErreurAnalyseCsv(
      "Impossible de reconnaître les colonnes du relevé (date, libellé, montant). Vérifiez que c'est bien le fichier CSV téléchargé depuis votre banque.",
    )
  }

  const corps = brutes.slice(colonnes.ligneEntete + 1)

  // ── Ordre des dates (jamais de choix silencieux) ──
  const datesBrutes = corps.map((l) => l[colonnes.date] ?? '')
  const ordreDetecte = detecterOrdreDates(datesBrutes)
  let ordre: OrdreDates
  if (ordreForce) {
    ordre = ordreForce
  } else if (ordreDetecte === 'ambigu') {
    return {
      confirmationDatesRequise: true,
      ordreDatesUtilise: 'jma',
      lignes: [],
      nbLignesFichier: corps.length,
      nbErreurs: 0,
      nbPairesFusionnees: 0,
      colonnes,
    }
  } else {
    ordre = ordreDetecte
  }

  // ── Normalisation ligne à ligne ──
  const lignes: LigneNormalisee[] = []
  let nbErreurs = 0
  for (const brute of corps) {
    const dateIso = parserDate(brute[colonnes.date] ?? '', ordre)
    const libelle = nettoyerLibelle(String(brute[colonnes.libelle] ?? ''))

    let montant: number | null = null
    if (colonnes.debit !== null && colonnes.credit !== null) {
      // Colonnes débit/crédit séparées, « toutes positives » chez la plupart
      // des banques — on tolère aussi un débit déjà négatif.
      const d = parserMontantFrancais(brute[colonnes.debit] ?? '')
      const c = parserMontantFrancais(brute[colonnes.credit] ?? '')
      if (d === null && c === null) montant = null
      else {
        const partDebit = d === null ? 0 : d > 0 ? -d : d
        const partCredit = c ?? 0
        montant = Math.round((partCredit + partDebit) * 100) / 100
      }
    } else if (colonnes.montant !== null) {
      montant = parserMontantFrancais(brute[colonnes.montant] ?? '')
    }

    // Ligne totalement vide sur nos 3 colonnes → on l'ignore sans la compter en erreur
    const touteVide =
      !String(brute[colonnes.date] ?? '').trim() &&
      !libelle &&
      montant === null
    if (touteVide) continue

    if (!dateIso || !libelle || montant === null || montant === 0) {
      nbErreurs++
      continue
    }
    lignes.push({ date: dateIso, libelle, montant })
  }

  // ── Écriture double type Clementine ──
  const { lignesFusionnees, nbPairesFusionnees } = fusionnerEcritureDouble(lignes)

  // ── Doublons intra-fichier légitimes : suffixe « #2 » AVANT hash ──
  suffixerDoublonsIntraFichier(lignesFusionnees)

  return {
    confirmationDatesRequise: false,
    ordreDatesUtilise: ordre,
    lignes: lignesFusionnees,
    nbLignesFichier: corps.length,
    nbErreurs,
    nbPairesFusionnees,
    colonnes,
  }
}

/**
 * Fusionne les paires d'équilibrage d'une écriture double (type Clementine) :
 * même date + même libellé + montants exactement opposés. On ne fusionne que
 * si ces paires DOMINENT le fichier (≥ 60 % des lignes), pour ne pas avaler
 * un remboursement légitime dans un relevé classique. Dans une paire on garde
 * la première ligne rencontrée ; l'aperçu Entrées/Sorties permet de repérer
 * des signes inversés (et l'UI propose d'inverser).
 */
function fusionnerEcritureDouble(lignes: LigneNormalisee[]): {
  lignesFusionnees: LigneNormalisee[]
  nbPairesFusionnees: number
} {
  const parCle = new Map<string, number[]>()
  lignes.forEach((l, i) => {
    const cle = `${l.date}|${l.libelle.toUpperCase()}|${Math.abs(l.montant).toFixed(2)}`
    const liste = parCle.get(cle)
    if (liste) liste.push(i)
    else parCle.set(cle, [i])
  })

  const aSupprimer = new Set<number>()
  let nbPaires = 0
  for (const indices of Array.from(parCle.values())) {
    if (indices.length < 2) continue
    const positifs = indices.filter((i) => lignes[i].montant > 0)
    const negatifs = indices.filter((i) => lignes[i].montant < 0)
    const nbPairesGroupe = Math.min(positifs.length, negatifs.length)
    for (let p = 0; p < nbPairesGroupe; p++) {
      // On garde la ligne rencontrée en premier dans la paire, on retire l'autre
      const garde = Math.min(positifs[p], negatifs[p])
      const retire = positifs[p] === garde ? negatifs[p] : positifs[p]
      void garde
      aSupprimer.add(retire)
      nbPaires++
    }
  }

  // Heuristique fichier : l'écriture double doit dominer, sinon on ne touche à rien
  if (lignes.length === 0 || (nbPaires * 2) / lignes.length < 0.6) {
    return { lignesFusionnees: lignes, nbPairesFusionnees: 0 }
  }
  return {
    lignesFusionnees: lignes.filter((_, i) => !aSupprimer.has(i)),
    nbPairesFusionnees: nbPaires,
  }
}

/**
 * Suffixe les doublons intra-fichier légitimes : « LIBELLE #2 », « #3 »…
 * AVANT hash et insertion (documenté dans l'en-tête de la migration 04).
 * Modifie les lignes en place.
 */
export function suffixerDoublonsIntraFichier(lignes: LigneNormalisee[]): void {
  const vus = new Map<string, number>()
  for (const ligne of lignes) {
    const cle = `${ligne.date}|${ligne.montant.toFixed(2)}|${ligne.libelle.toUpperCase()}`
    const n = (vus.get(cle) ?? 0) + 1
    vus.set(cle, n)
    if (n > 1) {
      ligne.libelle = `${ligne.libelle} #${n}`
      // Le libellé suffixé devient une nouvelle clé potentielle (cas extrême :
      // le fichier contient déjà un « X #2 ») — on l'enregistre aussi.
      const cleSuffixee = `${ligne.date}|${ligne.montant.toFixed(2)}|${ligne.libelle.toUpperCase()}`
      vus.set(cleSuffixee, (vus.get(cleSuffixee) ?? 0) + 1)
    }
  }
}
