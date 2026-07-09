// lib/export/pdf-planning.ts
// -------------------------------------------------------------------
// Export PDF du planning — generation CLIENT-SIDE (jsPDF + jspdf-autotable).
// Format : LISTE chronologique (pas une grille calendrier : illisible/pagination
// catastrophique a l'impression). Periode "an" => resume mensuel (sinon des
// dizaines de pages). Palette Nexartis. Meme patron que lib/export/pdf-achats.ts.
// -------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'
import {
  type PlanningExportData,
  type PlanningExportRow,
  horaireLabel,
  statutLabel,
  typeLabel,
  dateFrShort,
  sortRows,
} from './planning-export'

const NAVY: [number, number, number] = [15, 26, 58]
const ORANGE: [number, number, number] = [255, 122, 26]
const MUTED: [number, number, number] = [123, 139, 163]
const GREY_LINE: [number, number, number] = [230, 236, 242]
const HEAD_BG: [number, number, number] = [250, 251, 252]

function tc(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]) }
function dc(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]) }

function monthLabel(ymKey: string): string {
  const d = new Date(ymKey + '-01T00:00:00')
  if (isNaN(d.getTime())) return ymKey
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function buildPlanningPdf(data: PlanningExportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const M = 12
  const sorted = sortRows(data.rows)

  // ===== En-tete =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  tc(doc, NAVY)
  doc.text('Planning', M, 18)
  dc(doc, ORANGE)
  doc.setLineWidth(0.8)
  doc.line(M, 21.5, M + 28, 21.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  tc(doc, MUTED)
  doc.text(`Periode : ${data.periodeLabel}`, M, 28)
  const genLe = new Date().toLocaleDateString('fr-FR')
  doc.text(`Genere le ${genLe} - ${sorted.length} intervention${sorted.length > 1 ? 's' : ''}`, M, 33)

  if (data.periodType === 'year') {
    // ===== Resume mensuel =====
    const byMonth = new Map<string, number>()
    for (const r of sorted) {
      const k = (r.date_debut || '').slice(0, 7)
      if (k) byMonth.set(k, (byMonth.get(k) || 0) + 1)
    }
    const keys = Array.from(byMonth.keys()).sort()
    const body = keys.map((k) => [monthLabel(k), String(byMonth.get(k) || 0)])
    autoTable(doc, {
      startY: 38,
      head: [['Mois', 'Interventions']],
      body,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 3, textColor: NAVY, lineColor: GREY_LINE, lineWidth: { bottom: 0.1 } },
      headStyles: { fillColor: HEAD_BG, textColor: MUTED, fontSize: 8, fontStyle: 'bold', lineColor: NAVY, lineWidth: { bottom: 0.4 } },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'right' } },
      margin: { left: M, right: M },
    })
    return doc
  }

  // ===== Liste chronologique (semaine / mois) =====
  const body = sorted.map((r: PlanningExportRow) => {
    const clientCell = (r.client || '—') + (r.adresse ? `\n${r.adresse}` : '')
    return [
      dateFrShort(r.date_debut),
      horaireLabel(r),
      clientCell,
      r.chantier || '',
      r.intervenants || '',
      typeLabel(r.type_intervention),
      statutLabel(r.statut),
    ]
  })

  autoTable(doc, {
    startY: 38,
    head: [['Date', 'Horaire', 'Client / adresse', 'Chantier', 'Intervenant(s)', 'Type', 'Statut']],
    body,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: NAVY, lineColor: GREY_LINE, lineWidth: { bottom: 0.1 }, valign: 'top' },
    headStyles: { fillColor: HEAD_BG, textColor: MUTED, fontSize: 7, fontStyle: 'bold', lineColor: NAVY, lineWidth: { bottom: 0.4 } },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30 },
      4: { cellWidth: 28 },
      5: { cellWidth: 24 },
      6: { cellWidth: 18 },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      const page = doc.getNumberOfPages()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      tc(doc, MUTED)
      const h = doc.internal.pageSize.getHeight()
      const w = doc.internal.pageSize.getWidth()
      doc.text(`Nexartis - p. ${page}`, w - M, h - 6, { align: 'right' })
    },
  })

  return doc
}

export function downloadPlanningPdf(data: PlanningExportData): PdfDownloadResult {
  const doc = buildPlanningPdf(data)
  const blob = doc.output('blob')
  const today = new Date().toISOString().slice(0, 10)
  return downloadPdfBlob(blob, `planning-${today}.pdf`)
}
