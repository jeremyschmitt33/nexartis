// lib/export/pdf-planning.ts
// -------------------------------------------------------------------
// Export PDF du planning — genere cote CLIENT (jsPDF + jspdf-autotable).
// Design soigne, aux couleurs Nexartis (police Hanken Grotesk de la charte) :
//   - Logo de l'artisan en haut a gauche (data URL de la fiche entreprise)
//   - Titre "Planning" + periode + coordonnees de l'entreprise
//   - Tableau paysage AERE et tres lisible avec TOUS les champs d'intervention
//     (date, horaire, client + adresse, objet + type + notes, chantier,
//      intervenant(s), statut). Lignes zebrees, marges genereuses.
//   - Periode "an" => resume mensuel (sinon des dizaines de pages illisibles).
// -------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'
import {
  type PlanningExportData,
  type PlanningExportRow,
  horaireLabel,
  statutLabel,
  typeLabel,
  sortRows,
} from './planning-export'

const FONT = 'Hanken Grotesk'
const NAVY: [number, number, number] = [15, 26, 58]
const ORANGE: [number, number, number] = [255, 122, 26]
const MUTED: [number, number, number] = [123, 139, 163]
const GREY_LINE: [number, number, number] = [230, 236, 242]
const ZEBRA: [number, number, number] = [248, 250, 252]
const WHITE: [number, number, number] = [255, 255, 255]

const M = 12 // marge laterale (mm)

function tc(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]) }

function monthLabel(ymKey: string): string {
  const d = new Date(ymKey + '-01T00:00:00')
  if (isNaN(d.getTime())) return ymKey
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// Cellule Date sur 2 lignes : "lun." / "14/07/26"
function dateCell(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  if (isNaN(d.getTime())) return isoDate
  const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  const dm = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return `${wd}\n${dm}`
}

// En-tete complet (page 1) : logo + titre + periode + bloc entreprise + filet.
// Retourne le Y (mm) ou le contenu peut demarrer.
function drawHeader(doc: jsPDF, data: PlanningExportData, count: number): number {
  const pageW = doc.internal.pageSize.getWidth()
  const ent = data.entreprise || {}

  // --- Logo (haut gauche) ---
  let titleX = M
  const logoY = 9
  if (ent.logo_url && String(ent.logo_url).startsWith('data:image')) {
    try {
      const url = String(ent.logo_url)
      const fmt = url.includes('image/png') ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(url)
      const aspect = props.width / props.height
      let h = 16
      let w = h * aspect
      if (w > 46) { w = 46; h = w / aspect }
      doc.addImage(url, fmt, M, logoY, w, h)
      titleX = M + w + 10
    } catch {
      titleX = M
    }
  }

  // --- Titre "Planning" ---
  doc.setFont(FONT, 'extrabold')
  doc.setFontSize(24)
  tc(doc, NAVY)
  doc.text('Planning', titleX, 20)

  // --- Sous-titre : periode + compte + genere le ---
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  tc(doc, MUTED)
  const genLe = new Date().toLocaleDateString('fr-FR')
  const sub = `${data.periodeLabel}   ·   ${count} intervention${count > 1 ? 's' : ''}   ·   Généré le ${genLe}`
  doc.text(sub, titleX, 27)

  // --- Bloc entreprise (haut droite, aligne a droite) ---
  const rx = pageW - M
  let ey = 11
  const line = (txt: string, size: number, bold: boolean, color: [number, number, number]) => {
    if (!txt) return
    doc.setFont(FONT, bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    tc(doc, color)
    doc.text(txt, rx, ey, { align: 'right' })
    ey += size * 0.42 + 1.1
  }
  line(String(ent.nom || ''), 11, true, NAVY)
  line(String(ent.metier || ''), 8.5, false, MUTED)
  line(String(ent.adresse || ''), 8.5, false, MUTED)
  const cpVille = [ent.code_postal, ent.ville].filter(Boolean).join(' ')
  line(cpVille, 8.5, false, MUTED)
  const telMail = [ent.telephone, ent.email].filter(Boolean).join('  ·  ')
  line(telMail, 8.5, false, MUTED)
  if (ent.siret) line(`SIRET ${ent.siret}`, 7.5, false, MUTED)

  // --- Filet orange sous l'en-tete ---
  const lineY = 33
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.setLineWidth(0.8)
  doc.line(M, lineY, pageW - M, lineY)

  return 37
}

// Bandeau slim repete sur les pages 2+ (contexte sans reprendre tout l'en-tete).
function drawSlimHeader(doc: jsPDF, data: PlanningExportData) {
  doc.setFont(FONT, 'bold')
  doc.setFontSize(9)
  tc(doc, NAVY)
  doc.text(`Planning · ${data.periodeLabel}`, M, 10)
}

function drawFooter(doc: jsPDF, pageNumber: number) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont(FONT, 'normal')
  doc.setFontSize(7.5)
  tc(doc, MUTED)
  doc.text('Nexartis', M, pageH - 7)
  doc.text(`p. ${pageNumber}`, pageW - M, pageH - 7, { align: 'right' })
}

export function buildPlanningPdf(data: PlanningExportData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  registerPdfFonts(doc)
  const sorted = sortRows(data.rows)
  const startY = drawHeader(doc, data, sorted.length)

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
      startY,
      margin: { left: M, right: M, top: 18, bottom: 14 },
      head: [['Mois', 'Interventions']],
      body,
      theme: 'plain',
      styles: { font: FONT, fontSize: 10, cellPadding: 3.5, textColor: NAVY, lineColor: GREY_LINE, lineWidth: { bottom: 0.1 } },
      headStyles: { font: FONT, fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right' } },
      didDrawPage: (d) => { if (d.pageNumber > 1) drawSlimHeader(doc, data); drawFooter(doc, d.pageNumber) },
    })
    return doc
  }

  // ===== Liste detaillee (semaine / mois) =====
  const body = sorted.map((r: PlanningExportRow) => {
    const clientCell = (r.client || '—') + (r.adresse ? `\n${r.adresse}` : '')
    const objet = [r.titre || '', typeLabel(r.type_intervention), r.notes || ''].filter(Boolean).join('\n') || '—'
    return [
      dateCell(r.date_debut),
      horaireLabel(r) || '—',
      clientCell,
      objet,
      r.chantier || '—',
      r.intervenants || '—',
      statutLabel(r.statut) || '—',
    ]
  })

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, top: 18, bottom: 14 },
    head: [['Date', 'Horaire', 'Client / adresse', 'Objet · type · notes', 'Chantier', 'Intervenant(s)', 'Statut']],
    body,
    theme: 'plain',
    styles: {
      font: FONT, fontSize: 8.5, cellPadding: { top: 2.6, right: 3, bottom: 2.6, left: 3 },
      textColor: NAVY, lineColor: GREY_LINE, lineWidth: { bottom: 0.1 }, valign: 'top', overflow: 'linebreak',
    },
    headStyles: { font: FONT, fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3, valign: 'middle' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 22 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 40 },
      5: { cellWidth: 42 },
      6: { cellWidth: 22 },
    },
    didDrawPage: (d) => { if (d.pageNumber > 1) drawSlimHeader(doc, data); drawFooter(doc, d.pageNumber) },
  })

  return doc
}

export function downloadPlanningPdf(data: PlanningExportData): PdfDownloadResult {
  const doc = buildPlanningPdf(data)
  const blob = doc.output('blob')
  const today = new Date().toISOString().slice(0, 10)
  return downloadPdfBlob(blob, `planning-${today}.pdf`)
}
