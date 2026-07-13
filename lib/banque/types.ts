// ============================================================================
// lib/banque/types.ts — Types partagés du module « Dépenses & Banque »
// ----------------------------------------------------------------------------
// Partagés entre les routes API (/api/banque/import/*) et les composants
// client (app/dashboard/banque/*). AUCUN import Node ici (fichier isomorphe).
// Référence schéma : sql/2026-07-12-banque-03 et -04 (déjà appliqués en prod).
// ============================================================================

/** Une ligne de relevé normalisée par la route parse (et renvoyée telle quelle à execute). */
export interface LigneReleve {
  /** Date de l'opération au format ISO (YYYY-MM-DD). */
  date: string
  /**
   * Libellé NETTOYÉ : blancs regroupés en un seul espace + trim, et suffixe
   * « #2 » / « #3 »… déjà appliqué sur les doublons intra-fichier légitimes
   * (cf. en-tête de la migration 04). C'est CE libellé qui est stocké en base
   * et qui entre dans le hash_dedup.
   */
  libelle: string
  /** Montant SIGNÉ en euros : négatif = débit, positif = crédit. Jamais 0. */
  montant: number
  /** true si ce mouvement existe déjà en base (même compte + même hash_dedup). */
  dejaImporte?: boolean
}

/** Réponse de POST /api/banque/import/parse */
export interface ParseReponse {
  ok: true
  /**
   * Les dates du fichier sont ambiguës (tous les jours ≤ 12) : il faut
   * demander à l'utilisateur JJ/MM ou MM/JJ puis rappeler parse avec
   * `ordreDates`. Quand true, `lignes` est vide — jamais de choix silencieux.
   */
  confirmationDatesRequise: boolean
  /** Ordre de dates effectivement utilisé ('jma' = JJ/MM, 'mja' = MM/JJ, 'iso'). */
  ordreDatesUtilise: 'jma' | 'mja' | 'iso'
  lignes: LigneReleve[]
  fichierNom: string
  /** SHA-256 du fichier brut (idempotence niveau fichier). */
  fichierHash: string
  /** Un import terminé avec le même hash de fichier existe déjà. */
  fichierDejaImporte: boolean
  /** Nombre de lignes lues dans le fichier (avant fusion/erreurs). */
  nbLignesFichier: number
  /** Lignes illisibles (date ou montant invalide). */
  nbErreurs: number
  /** Paires d'écriture double (type Clementine) fusionnées. */
  nbPairesFusionnees: number
  /** Lignes déjà présentes en base (pré-marquées, seront ignorées). */
  nbDejaImportees: number
  /**
   * Débits (hors doublons déjà en base) qu'une règle 1a sait classer ET pointer
   * automatiquement à l'import — pour l'aperçu « X seront classées ».
   */
  nbTriablesAuto: number
  /**
   * Débits reconnus par une règle 1b (ambiguë) : catégorie suggérée OU marchand
   * reconnu (binaire pro/perso) — resteront « à confirmer », jamais pointés.
   */
  nbSuggerables: number
  /** Totaux pour détecter les signes inversés d'un coup d'œil. */
  totalEntrees: number
  totalSorties: number
  periodeDebut: string | null
  periodeFin: string | null
  /** Colonnes détectées (pour information dans l'aperçu). */
  colonnes: { date: string; libelle: string; montant: string }
}

/** Corps de POST /api/banque/import/execute */
export interface ExecuteRequete {
  compteId: string
  fichierNom: string
  fichierHash: string
  /** Lignes normalisées renvoyées par parse (avec suffixes déjà appliqués). */
  lignes: LigneReleve[]
}

/** Total d'une catégorie sur un import (écran de synthèse). */
export interface TotalCategorieImport {
  /** Libellé « artisan » de la catégorie (ex. « Matériaux & fournitures chantier »). */
  label: string
  /** Somme des montants (valeur absolue, en euros) des débits classés dans cette catégorie. */
  montant: number
}

/** Réponse de POST /api/banque/import/execute */
export interface ExecuteReponse {
  ok: true
  importId: string
  nbImportees: number
  nbDoublons: number
  nbErreurs: number
  /**
   * DÉBITS reconnus par une règle 1a : catégorisés ET pointés automatiquement
   * (statut_pointage = 'pointe' + categorisation_auto = true dès l'insertion).
   * = le gros chiffre « N déjà classées » de l'écran de synthèse.
   */
  nbClassees: number
  /**
   * Débits reconnus par une règle 1b (ambiguë) : catégorie suggérée OU marchand
   * reconnu (binaire), restés « à confirmer » (a_pointer + categorisation_auto=true).
   */
  nbAConfirmer: number
  /**
   * Reste importé, ni classé ni reconnu : à trier manuellement (inclut les
   * crédits, jamais catégorisés automatiquement — garantie URSSAF).
   */
  nbATrier: number
  /** Totaux par catégorie des débits CLASSÉS 1a, pour l'écran de synthèse. */
  totauxCategories: TotalCategorieImport[]
}

/** Limites V1 de l'import CSV. */
export const IMPORT_MAX_OCTETS = 4 * 1024 * 1024 // 4 Mo
export const IMPORT_MAX_LIGNES = 10_000
