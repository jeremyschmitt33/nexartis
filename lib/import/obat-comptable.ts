/**
 * Parser dédié au format "export comptable OBAT".
 *
 * Ce format n'est PAS l'export devis/facture standard. C'est un
 * export d'écritures comptables (destiné à l'expert-comptable),
 * dans lequel un seul devis ou une seule facture peut s'étaler
 * sur N lignes (une par taux de TVA + une ligne client).
 *
 * Colonnes attendues :
 *   - Date de l'écriture
 *   - Code journal de l'écriture comptable
 *   - Client
 *   - Référence de la pièce justificative   <-- clé de regroupement
 *   - Type de la pièce (...)                 <-- ex: Devis / Acompte / Finale / Avoir / Situation
 *   - Numéro de compte                       <-- 411 / 706 / 44574 / 658 / 758
 *   - Libellé de compte                      <-- ex: "Prestations de services à 10%"
 *   - Intitulé du chantier
 *   - Sens d'écriture                        <-- D ou C
 *   - Montant
 *   - Statut de la pièce
 *
 * Codes comptables :
 *   - 411 : compte client → montant TTC (Sens D pour devis/factures, C pour avoirs)
 *   - 706 : prestations de services HT (Sens C pour devis/factures, D pour avoirs)
 *   - 44574 : TVA collectée (Sens C pour devis/factures, D pour avoirs)
 *   - 658 / 758 : écarts d'arrondi (ignorés, négligeables)
 *
 * Logique :
 *   1. Grouper toutes les lignes du CSV par "Référence de la pièce justificative"
 *   2. Pour chaque groupe, identifier les lignes 706 (prestations), 44574 (TVA), 411 (TTC)
 *   3. Reconstituer 1 pièce avec montant HT, TVA, TTC et lignes individuelles
 *   4. Pour les avoirs : inverser les montants (devient négatif)
 */

// ───────────────────────────── Types ─────────────────────────────

type Row = Record<string, unknown>

export interface ObatComptableDoc {
  numero: string
  date_emission: string | null
  client_name: string
  chantier_titre: string
  type_doc: string          // "Devis" | "Acompte" | "Finale" | "Avoir" | "Situation" | "Situation détaillée"
  statut: string             // déjà mappé vers nos statuts
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  lignes: ObatComptableLigne[]
}

export interface ObatComptableLigne {
  ordre: number
  designation: string
  quantite: number
  prix_unitaire_ht: number
  taux_tva: number
  montant_ht: number
}

export interface ObatComptableResult {
  devis: ObatComptableDoc[]
  factures: ObatComptableDoc[]
  clients: { nom: string }[]
  chantiers: { titre: string; client_name: string }[]
}

// ───────────────────────────── Helpers ─────────────────────────────

function parseFrenchDate(s: unknown): string | null {
  if (!s) return null
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function parseNum(s: unknown): number {
  if (!s) return 0
  const n = parseFloat(String(s).replace(/,/g, '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : n
}

// Statuts de devis : Signé / Envoyé / Refusé / Annulé
function mapDevisStatut(s: string): string {
  const v = (s || '').toLowerCase().trim()
  if (v.includes('sign')) return 'signe'
  if (v.includes('envoy')) return 'envoye'
  if (v.includes('refus')) return 'refuse'
  if (v.includes('annul')) return 'refuse'
  return 'brouillon'
}

// Statuts de facture : Payée / Envoyée / Finalisée / Annulée
function mapFactureStatut(s: string): string {
  const v = (s || '').toLowerCase().trim()
  if (v.includes('pay')) return 'payee'
  if (v.includes('annul')) return 'annulee'
  if (v.includes('envoy') || v.includes('finalis')) return 'envoyee'
  return 'brouillon'
}

// ───────────────────────────── Détection ─────────────────────────────

/**
 * Renvoie true si les headers correspondent au format comptable OBAT.
 * On se base sur la présence de 3 colonnes très distinctives :
 *   - "Référence de la pièce justificative"
 *   - "Numéro de compte"
 *   - "Sens d'écriture"
 */
export function isObatComptableFormat(headers: string[]): boolean {
  const h = headers.map(s => (s || '').toLowerCase().trim())
  const hasRef = h.some(x => x.includes('référence de la pièce') || x.includes('reference de la piece'))
  const hasCompte = h.some(x => x.includes('numéro de compte') || x.includes('numero de compte'))
  const hasSens = h.some(x => x.includes("sens d'écriture") || x.includes("sens d'ecriture"))
  return hasRef && hasCompte && hasSens
}

/**
 * Détermine si le fichier contient des devis ou des factures.
 * On se base sur le contenu de la colonne "Type de la pièce" :
 *   - "Devis" → devis
 *   - "Acompte" / "Finale" / "Avoir" / "Situation" / "Situation détaillée" → factures
 */
export function detectObatComptableKind(rows: Row[]): 'devis' | 'factures' | 'mixed' {
  let hasDevis = false
  let hasFacture = false
  for (const r of rows) {
    const t = String(getColValue(r, ['Type de la pièce', 'Type de la piece'])).toLowerCase()
    if (t.includes('devis')) hasDevis = true
    else if (t) hasFacture = true
    if (hasDevis && hasFacture) return 'mixed'
  }
  if (hasDevis) return 'devis'
  return 'factures'
}

function getColValue(row: Row, possibleNames: string[]): string {
  // 1. Match exact direct
  for (const n of possibleNames) {
    if (row[n] !== undefined && row[n] !== null) return String(row[n])
  }
  // 2. Match exact insensible à la casse
  for (const n of possibleNames) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().trim() === n.toLowerCase().trim()) {
        return String(row[k])
      }
    }
  }
  // 3. Match "startsWith" insensible à la casse (gère les colonnes
  //    avec suffixe entre parenthèses comme "Type de la pièce (Acompte, Finale, …)"
  //    quand on cherche "Type de la pièce").
  for (const n of possibleNames) {
    const needle = n.toLowerCase().trim()
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().trim().startsWith(needle)) {
        return String(row[k])
      }
    }
  }
  return ''
}

// ───────────────────────────── Parser principal ─────────────────────────────

/**
 * Pré-traite un export comptable OBAT en regroupant les écritures
 * par référence et en reconstituant des pièces complètes (devis/factures).
 *
 * @param rows Rows brutes issues du parsing CSV (avec headers en clés)
 * @returns Devis, factures, clients déduits, chantiers déduits
 */
export function preprocessObatComptable(rows: Row[]): ObatComptableResult {
  const result: ObatComptableResult = {
    devis: [],
    factures: [],
    clients: [],
    chantiers: [],
  }

  if (!rows.length) return result

  // 1. Grouper par référence de la pièce justificative
  const byRef = new Map<string, Row[]>()
  for (const row of rows) {
    const ref = getColValue(row, ['Référence de la pièce justificative', 'Reference de la piece justificative'])
    if (!ref || ref.trim() === '') continue
    if (!byRef.has(ref)) byRef.set(ref, [])
    byRef.get(ref)!.push(row)
  }

  // 2. Pour chaque groupe, reconstituer la pièce
  const clientsMap = new Map<string, { nom: string }>()
  const chantiersMap = new Map<string, { titre: string; client_name: string }>()

  for (const [ref, lines] of Array.from(byRef.entries())) {
    const first = lines[0]
    const clientName = getColValue(first, ['Client']).trim()
    const date = parseFrenchDate(getColValue(first, ["Date de l'écriture", "Date de l'ecriture"]))
    const chantierName = getColValue(first, ['Intitulé du chantier', 'Intitule du chantier']).trim()
    const typeRaw = getColValue(first, ['Type de la pièce', 'Type de la piece']).trim()
    const statusRaw = getColValue(first, ['Statut de la pièce', 'Statut de la piece']).trim()

    // Détection du type de pièce
    const isDevis = typeRaw.toLowerCase() === 'devis'
    const isAvoir = typeRaw.toLowerCase() === 'avoir'

    // Pour les avoirs, les sens sont inversés en comptabilité
    const sensClient = isAvoir ? 'C' : 'D'
    const sensProd = isAvoir ? 'D' : 'C'
    const avoirSign = isAvoir ? -1 : 1

    // Ligne client (compte 411) → TTC
    const clientLine = lines.find(l =>
      getColValue(l, ['Numéro de compte', 'Numero de compte']) === '411' &&
      getColValue(l, ["Sens d'écriture", "Sens d'ecriture"]) === sensClient
    )
    const montant_ttc = (clientLine ? parseNum(getColValue(clientLine, ['Montant'])) : 0) * avoirSign

    // Lignes prestations (compte 706) → HT, avec taux TVA extrait du libellé
    const prestLines = lines.filter(l =>
      getColValue(l, ['Numéro de compte', 'Numero de compte']) === '706' &&
      getColValue(l, ["Sens d'écriture", "Sens d'ecriture"]) === sensProd
    )

    const lignes_doc: ObatComptableLigne[] = prestLines.map((l, i) => {
      const libelle = getColValue(l, ['Libellé de compte', 'Libelle de compte']) || 'Prestations de services'
      const tvaMatch = libelle.match(/à\s+(\d+(?:[.,]\d+)?)\s*%/i)
      const taux = tvaMatch ? parseFloat(tvaMatch[1].replace(',', '.')) : 0
      const isAutoliq = libelle.toLowerCase().includes('autoliquidation')
      const montant = parseNum(getColValue(l, ['Montant'])) * avoirSign
      return {
        ordre: i + 1,
        designation: libelle,
        quantite: 1,
        prix_unitaire_ht: montant,
        taux_tva: isAutoliq ? 0 : taux,
        montant_ht: montant,
      }
    })

    const montant_ht = lignes_doc.reduce((s, l) => s + l.montant_ht, 0)

    // Lignes TVA (compte 44574)
    const tvaLines = lines.filter(l =>
      getColValue(l, ['Numéro de compte', 'Numero de compte']) === '44574' &&
      getColValue(l, ["Sens d'écriture", "Sens d'ecriture"]) === sensProd
    )
    const montant_tva = tvaLines.reduce((s, l) => s + parseNum(getColValue(l, ['Montant'])), 0) * avoirSign

    const doc: ObatComptableDoc = {
      numero: ref,
      date_emission: date,
      client_name: clientName,
      chantier_titre: chantierName,
      type_doc: typeRaw,
      statut: isDevis ? mapDevisStatut(statusRaw) : mapFactureStatut(statusRaw),
      montant_ht,
      montant_tva,
      montant_ttc,
      lignes: lignes_doc,
    }

    if (isDevis) {
      result.devis.push(doc)
    } else {
      result.factures.push(doc)
    }

    // Déduplication clients et chantiers
    if (clientName && !clientsMap.has(clientName)) {
      clientsMap.set(clientName, { nom: clientName })
    }
    if (chantierName && !chantiersMap.has(chantierName)) {
      chantiersMap.set(chantierName, { titre: chantierName, client_name: clientName })
    }
  }

  result.clients = Array.from(clientsMap.values())
  result.chantiers = Array.from(chantiersMap.values())

  return result
}
