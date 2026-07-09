// lib/export/pdf-planning.ts
// -------------------------------------------------------------------
// Export PDF du planning — genere cote CLIENT (jsPDF).
// VRAI VISUEL CALENDAIRE (pas une simple liste) :
//   - "semaine" : 7 colonnes-jours (agenda hebdo) avec les interventions
//   - "mois"    : grille calendrier classique (Lun..Dim x semaines)
//   - "an"      : resume mensuel (tableau)
// En-tete aux couleurs Nexartis : logo artisan haut-gauche + titre "Planning"
// + coordonnees entreprise (marges soignees, SIRET ne touche plus le filet).
// Police Hanken Grotesk de la charte.
// -------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'
import {
  type PlanningExportData,
  type PlanningExportRow,
  type PlanningExportEntreprise,
  horaireLabel,
  typeLabel,
  sortRows,
  rowsByDate,
} from './planning-export'

const FONT = 'Hanken Grotesk'
const NAVY: [number, number, number] = [15, 26, 58]
const ORANGE: [number, number, number] = [255, 122, 26]
const MUTED: [number, number, number] = [123, 139, 163]
const GREY_LINE: [number, number, number] = [222, 230, 238]
const WEEKEND_BG: [number, number, number] = [245, 248, 251]
const OUT_BG: [number, number, number] = [250, 251, 252]
const CHIP_BG: [number, number, number] = [255, 243, 233]
const WHITE: [number, number, number] = [255, 255, 255]
const WHITE_SOFT: [number, number, number] = [214, 222, 233]

const M = 12
const PAGE_W = 297
const PAGE_H = 210

// ---- helpers couleur / police ----
function sf(doc: jsPDF, style: string, size: number, c: [number, number, number]) {
  doc.setFont(FONT, style); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2])
}
function fill(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]) }
function stroke(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]) }

function pad2(n: number): string { return n < 10 ? '0' + n : String(n) }
function parseIso(s: string): Date { return new Date(s.slice(0, 10) + 'T00:00:00') }
function isoOf(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function mondayOf(d: Date): Date { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x }
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

function ellipsize(doc: jsPDF, text: string, maxW: number): string {
  if (!text) return ''
  if (doc.getTextWidth(text) <= maxW) return text
  let t = text
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
  return t + '…'
}

function firstRowDate(data: PlanningExportData): Date {
  const s = sortRows(data.rows)
  if (s.length > 0 && s[0].date_debut) return parseIso(s[0].date_debut)
  if (data.periodStart) return parseIso(data.periodStart)
  return new Date()
}

// ---- En-tete commun ----
function drawHeader(doc: jsPDF, data: PlanningExportData, count: number): number {
  const ent: PlanningExportEntreprise = data.entreprise || {}
  let titleX = M
  if (ent.logo_url && String(ent.logo_url).startsWith('data:image')) {
    try {
      const url = String(ent.logo_url)
      const fmt = url.includes('image/png') ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(url)
      const aspect = props.width / props.height
      let h = 15, w = h * aspect
      if (w > 44) { w = 44; h = w / aspect }
      doc.addImage(url, fmt, M, 9, w, h)
      titleX = M + w + 10
    } catch { titleX = M }
  }

  sf(doc, 'extrabold', 23, NAVY)
  doc.text('Planning', titleX, 19)
  sf(doc, 'normal', 9, MUTED)
  const genLe = new Date().toLocaleDateString('fr-FR')
  doc.text(`${data.periodeLabel}   ·   ${count} intervention${count > 1 ? 's' : ''}   ·   Généré le ${genLe}`, titleX, 26)

  // Bloc entreprise (haut droite)
  const rx = PAGE_W - M
  let ey = 10.5
  const line = (txt: string, size: number, bold: boolean, c: [number, number, number]) => {
    if (!txt) return
    sf(doc, bold ? 'bold' : 'normal', size, c)
    doc.text(txt, rx, ey, { align: 'right' })
    ey += size * 0.42 + 1.0
  }
  line(String(ent.nom || ''), 11, true, NAVY)
  line(String(ent.metier || ''), 8, false, MUTED)
  line(String(ent.adresse || ''), 8, false, MUTED)
  line([ent.code_postal, ent.ville].filter(Boolean).join(' '), 8, false, MUTED)
  line([ent.telephone, ent.email].filter(Boolean).join('  ·  '), 8, false, MUTED)
  if (ent.siret) line(`SIRET ${ent.siret}`, 7.5, false, MUTED)

  // Filet orange : sous le plus bas du titre et du bloc entreprise (marge).
  const barY = Math.max(ey + 1.5, 30)
  stroke(doc, ORANGE); doc.setLineWidth(0.8)
  doc.line(M, barY, PAGE_W - M, barY)
  return barY + 4
}

function drawFooter(doc: jsPDF, data: PlanningExportData, pageNumber: number) {
  sf(doc, 'normal', 7.5, MUTED)
  doc.text(`Nexartis · Planning`, M, PAGE_H - 7)
  doc.text(`p. ${pageNumber}`, PAGE_W - M, PAGE_H - 7, { align: 'right' })
}

// ---- Bloc intervention (chip) dans une cellule ----
// Retourne la hauteur consommee.
function drawChip(doc: jsPDF, r: PlanningExportRow, x: number, y: number, w: number, dense: boolean): number {
  const innerW = w - 5
  const time = horaireLabel(r) || ''
  const client = r.client || r.titre || typeLabel(r.type_intervention) || 'Intervention'
  const sub = (r.client && r.titre) ? r.titre : (r.client ? typeLabel(r.type_intervention) : '')
  const h = dense ? (sub ? 8.5 : 6) : (sub ? 12 : 8.5)

  fill(doc, CHIP_BG)
  doc.roundedRect(x, y, w, h, 1.2, 1.2, 'F')
  fill(doc, ORANGE)
  doc.rect(x, y, 1.1, h, 'F')

  const tx = x + 3
  // Ligne 1 : heure (orange) + client (navy)
  sf(doc, 'bold', dense ? 6.5 : 7.5, ORANGE)
  const tw = time ? doc.getTextWidth(time) + 1.5 : 0
  if (time) doc.text(time, tx, y + (dense ? 3 : 3.6))
  sf(doc, 'bold', dense ? 6.5 : 7.5, NAVY)
  doc.text(ellipsize(doc, client, innerW - tw), tx + tw, y + (dense ? 3 : 3.6))
  // Ligne 2 : sous-titre
  if (sub) {
    sf(doc, 'normal', dense ? 6 : 7, MUTED)
    doc.text(ellipsize(doc, sub, innerW), tx, y + (dense ? 6 : 7.2))
  }
  return h
}

// ---- Vue SEMAINE : 7 colonnes-jours ----
function drawWeekGrid(doc: jsPDF, data: PlanningExportData, top: number) {
  const start = data.periodStart ? parseIso(data.periodStart) : firstRowDate(data)
  const mon = mondayOf(start)
  const byDate = rowsByDate(data.rows)
  const colW = (PAGE_W - 2 * M) / 7
  const headH = 10
  const gridBottom = PAGE_H - 12
  const bodyTop = top + headH

  for (let i = 0; i < 7; i++) {
    const x = M + i * colW
    const d = addDays(mon, i)
    const weekend = i >= 5
    // fond corps
    if (weekend) { fill(doc, WEEKEND_BG); doc.rect(x, bodyTop, colW, gridBottom - bodyTop, 'F') }
    // en-tete jour (navy)
    fill(doc, NAVY); doc.rect(x, top, colW, headH, 'F')
    sf(doc, 'bold', 9, WHITE)
    doc.text(cap(d.toLocaleDateString('fr-FR', { weekday: 'short' })), x + 3, top + 4.2)
    sf(doc, 'normal', 8, WHITE_SOFT)
    doc.text(d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), x + 3, top + 8)
    // bordure colonne
    stroke(doc, GREY_LINE); doc.setLineWidth(0.2)
    doc.rect(x, top, colW, gridBottom - top)

    // interventions du jour
    const list = byDate.get(isoOf(d)) || []
    let y = bodyTop + 2.5
    for (let j = 0; j < list.length; j++) {
      const need = 8.5 + 2
      if (y + need > gridBottom - 4) {
        sf(doc, 'bold', 7, ORANGE)
        doc.text(`+${list.length - j} de plus`, x + 3, y + 3)
        break
      }
      const hh = drawChip(doc, list[j], x + 2, y, colW - 4, false)
      y += hh + 2
    }
  }
}

// ---- Vue MOIS : grille calendrier ----
function drawMonthGrid(doc: jsPDF, data: PlanningExportData, top: number) {
  const ref = data.periodStart ? parseIso(data.periodStart) : firstRowDate(data)
  const year = ref.getFullYear(), month = ref.getMonth()
  const first = new Date(year, month, 1)
  const startMon = mondayOf(first)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const nbWeeks = Math.ceil((offset + daysInMonth) / 7)
  const byDate = rowsByDate(data.rows)

  const colW = (PAGE_W - 2 * M) / 7
  const headH = 8
  const gridBottom = PAGE_H - 12
  const rowH = (gridBottom - (top + headH)) / nbWeeks

  const noms = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  for (let i = 0; i < 7; i++) {
    const x = M + i * colW
    fill(doc, NAVY); doc.rect(x, top, colW, headH, 'F')
    sf(doc, 'bold', 8.5, WHITE)
    doc.text(noms[i], x + 3, top + 5.4)
  }

  for (let w = 0; w < nbWeeks; w++) {
    for (let i = 0; i < 7; i++) {
      const x = M + i * colW
      const y = top + headH + w * rowH
      const d = addDays(startMon, w * 7 + i)
      const inMonth = d.getMonth() === month
      const weekend = i >= 5
      if (!inMonth) { fill(doc, OUT_BG); doc.rect(x, y, colW, rowH, 'F') }
      else if (weekend) { fill(doc, WEEKEND_BG); doc.rect(x, y, colW, rowH, 'F') }
      stroke(doc, GREY_LINE); doc.setLineWidth(0.2); doc.rect(x, y, colW, rowH)

      // numero du jour
      sf(doc, inMonth ? 'bold' : 'normal', 8.5, inMonth ? NAVY : MUTED)
      doc.text(String(d.getDate()), x + 2.5, y + 5)

      if (!inMonth) continue
      const list = byDate.get(isoOf(d)) || []
      let cy = y + 7
      const maxChipBottom = y + rowH - 2
      for (let j = 0; j < list.length; j++) {
        if (cy + 8.5 > maxChipBottom) {
          sf(doc, 'bold', 6.5, ORANGE)
          doc.text(`+${list.length - j}`, x + 2.5, cy + 2.5)
          break
        }
        const hh = drawChip(doc, list[j], x + 2, cy, colW - 4, true)
        cy += hh + 1.5
      }
    }
  }
}

// ---- Vue AN : resume mensuel ----
function drawYearSummary(doc: jsPDF, data: PlanningExportData, top: number) {
  const sorted = sortRows(data.rows)
  const byMonth = new Map<string, number>()
  for (const r of sorted) {
    const k = (r.date_debut || '').slice(0, 7)
    if (k) byMonth.set(k, (byMonth.get(k) || 0) + 1)
  }
  const keys = Array.from(byMonth.keys()).sort()
  const body = keys.map((k) => {
    const d = new Date(k + '-01T00:00:00')
    return [cap(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })), String(byMonth.get(k) || 0)]
  })
  autoTable(doc, {
    startY: top,
    margin: { left: M, right: M, top: 16, bottom: 14 },
    head: [['Mois', 'Interventions']],
    body,
    theme: 'plain',
    styles: { font: FONT, fontSize: 10, cellPadding: 3.5, textColor: NAVY, lineColor: GREY_LINE, lineWidth: { bottom: 0.1 } },
    headStyles: { font: FONT, fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: OUT_BG },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right' } },
    didDrawPage: (d) => drawFooter(doc, data, d.pageNumber),
  })
}

export function buildPlanningPdf(data: PlanningExportData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  registerPdfFonts(doc)
  const count = data.rows.length
  const top = drawHeader(doc, data, count)

  if (data.periodType === 'week') {
    drawWeekGrid(doc, data, top)
    drawFooter(doc, data, 1)
  } else if (data.periodType === 'month') {
    drawMonthGrid(doc, data, top)
    drawFooter(doc, data, 1)
  } else {
    drawYearSummary(doc, data, top)
  }
  return doc
}

export function downloadPlanningPdf(data: PlanningExportData): PdfDownloadResult {
  const doc = buildPlanningPdf(data)
  const blob = doc.output('blob')
  const today = new Date().toISOString().slice(0, 10)
  return downloadPdfBlob(blob, `planning-${today}.pdf`)
}
