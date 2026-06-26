/**
 * Export comptable CSV — ACHATS / depenses fournisseurs (Vague 1)
 *
 * Helper isole pour ne pas alourdir app/api/export-comptable/route.ts
 * (contrainte projet : fichiers compacts). Les achats n'ont ni client ni
 * numero de document : CSV dedie, meme encodage que l'export ventes
 * (BOM UTF-8, separateur ';', virgule decimale, dates JJ/MM/AAAA).
 * PAS de FEC (auto-entrepreneur / micro dispense). Lecture seule.
 */

const BOM = '﻿'
const SEP = ';'
const EOL = '\r\n'

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str === '') return ''
  const needsQuoting = /[;"\r\n]/.test(str)
  if (!needsQuoting) return str
  return '"' + str.replace(/"/g, '""') + '"'
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(SEP)
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0,00'
  return Number(n).toFixed(2).replace('.', ',')
}

function formatTaux(taux: number | null | undefined): string {
  const t = Number(taux ?? 0)
  if (t <= 0) return '0%'
  return `${String(t).replace('.', ',')}%`
}

export interface AchatRow {
  id: string
  date_achat: string | null
  description: string | null
  montant_ht: number | null
  taux_tva: number | null
  montant_ttc: number | null
  fournisseur_id: string | null
  chantier_id: string | null
  notes: string | null
}

export interface FournisseurLite {
  nom: string | null
  siret: string | null
}

export function buildCsvAchats(
  achats: AchatRow[],
  fournisseursById: Map<string, FournisseurLite>,
  chantiersById: Map<string, string>,
): string {
  const headers = [
    'Date', 'Fournisseur', 'SIRET fournisseur', 'Description', 'Chantier',
    'Montant HT', 'Taux TVA', 'Montant TVA', 'Montant TTC',
  ]
  const lines: string[] = [csvRow(headers)]
  for (const a of achats) {
    const fourn = a.fournisseur_id ? fournisseursById.get(a.fournisseur_id) : null
    const chantier = a.chantier_id ? (chantiersById.get(a.chantier_id) || '') : ''
    const ht = Number(a.montant_ht ?? 0)
    const taux = Number(a.taux_tva ?? 0)
    const tva = ht * (taux / 100)
    lines.push(csvRow([
      formatDateFr(a.date_achat),
      fourn?.nom || '',
      fourn?.siret || '',
      a.description || '',
      chantier,
      formatMoney(ht),
      formatTaux(taux),
      formatMoney(tva),
      formatMoney(a.montant_ttc),
    ]))
  }
  return BOM + lines.join(EOL) + EOL
}
