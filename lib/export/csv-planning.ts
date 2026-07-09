// lib/export/csv-planning.ts
// -------------------------------------------------------------------
// Export CSV du planning (Excel FR : BOM UTF-8 + separateur ';').
// Dates au format AAAA-MM-JJ (tri correct + re-import sans ambiguite).
// Noms d'intervenants en clair (pas d'UUID). Lecture seule.
// -------------------------------------------------------------------

import {
  type PlanningExportData,
  type PlanningExportRow,
  horaireLabel,
  statutLabel,
  typeLabel,
  sortRows,
} from './planning-export'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'

const BOM = '﻿'
const SEP = ';'
const EOL = '\r\n'

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str === '') return ''
  if (/[;"\r\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(cell).join(SEP)
}

export function buildPlanningCsv(data: PlanningExportData): string {
  const headers = [
    'Date', 'Date fin', 'Horaire', 'Titre', 'Type', 'Statut',
    'Client', 'Chantier', 'Adresse', 'Intervenants', 'Notes',
  ]
  const lines: string[] = [row(headers)]
  for (const r of sortRows(data.rows) as PlanningExportRow[]) {
    lines.push(row([
      r.date_debut || '',
      r.date_fin || '',
      horaireLabel(r),
      r.titre || '',
      typeLabel(r.type_intervention),
      statutLabel(r.statut),
      r.client || '',
      r.chantier || '',
      r.adresse || '',
      r.intervenants || '',
      r.notes || '',
    ]))
  }
  return BOM + lines.join(EOL) + EOL
}

export function downloadPlanningCsv(data: PlanningExportData): PdfDownloadResult {
  const csv = buildPlanningCsv(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const today = new Date().toISOString().slice(0, 10)
  return downloadPdfBlob(blob, `planning-${today}.csv`)
}
