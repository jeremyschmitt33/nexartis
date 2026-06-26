// lib/export/pdf-achats.ts - Vague 1.1
// -------------------------------------------------------------------
// Export PDF des achats / depenses — generation CLIENT-SIDE.
//
// Pourquoi cote client (et pas via une route API) :
//   - Les achats sont DEJA charges dans la page via useAchats().
//   - On evite jsPDF en serverless (cold start, timeout, poids du bundle Node).
//   - jsPDF + jspdf-autotable fonctionnent parfaitement dans le navigateur.
//
// Police : on utilise la police integree "helvetica" de jsPDF (toujours
// disponible cote client, aucun enregistrement de fonte requis). Couleurs :
// charte Nexartis (navy #0f1a3a, orange #ff7a1a). Document sobre, lisible :
// titre, periode, tableau Date/Fournisseur/Description/Chantier/HT/TVA/TTC,
// total en bas, montants alignes a droite.
// -------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'

// ===== Palette Nexartis (RGB) =====
const NAVY: [number, number, number] = [15, 26, 58] // #0f1a3a
const ORANGE: [number, number, number] = [255, 122, 26] // #ff7a1a
const MUTED: [number, number, number] = [123, 139, 163]
const GREY_LINE: [number, number, number] = [230, 236, 242]
const HEAD_BG: [number, number, number] = [250, 251, 252] // #fafbfc

// Donnees brutes attendues (sous-ensemble de la ligne "achats")
export interface AchatRow {
  id?: string
  date_achat?: string | null
  fournisseur_id?: string | null
  description?: string | null
  chantier_id?: string | null
  montant_ht?: number | string | null
  taux_tva?: number | string | null
  montant_ttc?: number | string | null
}

export interface AchatsPdfData {
  achats: AchatRow[]
  fournisseurMap: Record<string, string>
  chantierMap: Record<string, string>
  /** Libelle de periode affiche sous le titre (ex: "Tous", "Ce mois"). */
  periodeLabel?: string
}

// ===== Helpers =====

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function fmtEur(n: number): string {
  // Espace fine insecable non geree par helvetica -> on utilise un espace simple.
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
}

function fmtDateFr(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR')
}

/**
 * Construit le PDF des achats et retourne le document jsPDF.
 * Separe de la fonction de download pour faciliter les tests/usages futurs.
 */
export function buildAchatsPdf(data: AchatsPdfData): jsPDF {
  const { achats, fournisseurMap, chantierMap, periodeLabel } = data

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 12

  // ===== En-tete =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Mes depenses', M, 18)

  // Filet orange sous le titre
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.setLineWidth(0.8)
  doc.line(M, 21.5, M + 38, 21.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  const genLe = new Date().toLocaleDateString('fr-FR')
  const periodeTxt = periodeLabel && periodeLabel !== 'Tous' ? `Periode : ${periodeLabel}` : 'Periode : toutes les depenses'
  doc.text(periodeTxt, M, 28)
  doc.text(`Genere le ${genLe} - ${achats.length} ligne${achats.length > 1 ? 's' : ''}`, M, 33)

  // ===== Corps : tableau =====
  let totalHT = 0
  let totalTVA = 0
  let totalTTC = 0

  const body = achats.map((a) => {
    const ht = num(a.montant_ht)
    const taux = num(a.taux_tva ?? 20)
    const ttc = a.montant_ttc != null ? num(a.montant_ttc) : ht * (1 + taux / 100)
    const tva = ttc - ht

    totalHT += ht
    totalTVA += tva
    totalTTC += ttc

    const fournisseur = fournisseurMap[(a.fournisseur_id as string) ?? ''] || '-'
    const chantier = chantierMap[(a.chantier_id as string) ?? ''] || '-'

    return [
      fmtDateFr(a.date_achat),
      fournisseur,
      String(a.description ?? ''),
      chantier,
      fmtEur(ht),
      `${taux}%`,
      fmtEur(ttc),
    ]
  })

  autoTable(doc, {
    startY: 38,
    head: [['Date', 'Fournisseur', 'Description', 'Chantier', 'Montant HT', 'TVA', 'Montant TTC']],
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: NAVY,
      lineColor: GREY_LINE,
      lineWidth: { bottom: 0.1 },
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: MUTED,
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: NAVY,
      lineWidth: { bottom: 0.4 },
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 45 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 42 },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: M, right: M },
  })

  // ===== Total =====
  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 38
  let y = afterTable + 6

  // Trait separateur
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
  doc.setLineWidth(0.3)
  doc.line(pageW - M - 100, y, pageW - M, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  doc.text('Total HT', pageW - M - 100, y)
  doc.text('Total TVA', pageW - M - 60, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Total TTC', pageW - M - 100, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text(fmtEur(totalHT), pageW - M, y, { align: 'right' })
  doc.text(fmtEur(totalTVA), pageW - M - 60 + 38, y, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.text(fmtEur(totalTTC), pageW - M, y + 7, { align: 'right' })

  return doc
}

/**
 * Genere le PDF des achats et declenche le telechargement (cross-platform iOS/Android/desktop).
 * Appelle ce helper depuis un handler onClick synchrone cote page Achats.
 */
export function downloadAchatsPdf(data: AchatsPdfData): PdfDownloadResult {
  const doc = buildAchatsPdf(data)
  const blob = doc.output('blob')
  const today = new Date().toISOString().slice(0, 10)
  return downloadPdfBlob(blob, `mes-depenses-${today}.pdf`)
}
