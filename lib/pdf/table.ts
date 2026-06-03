// lib/pdf/table.ts - V3.0c
// Tableau hierarchique 3 niveaux (section / sous_section / prestation)
// + mode forfait. Utilise jspdf-autotable avec hooks pour pastilles
// rondes orange (niveau 1) et styles par niveau.

import type { jsPDF } from 'jspdf'
import autoTable, { type CellHookData, type Styles } from 'jspdf-autotable'
import { C } from './palette'
import {
  fmt,
  fmtTvaCell,
  computeSubtotals,
  setFill,
  setText,
  type PdfLigne,
} from './utils'
import type { RGB } from './palette'

// jspdf-autotable n'accepte que des tuples mutables pour les couleurs.
// Notre palette est readonly : on copie en tableau mutable au point d'usage.
function mut(c: RGB): [number, number, number] {
  return [c[0], c[1], c[2]]
}

interface TableEntreprise {
  nom?: string
  metier?: string
}

interface RowMeta {
  kind: 'section' | 'sous_section' | 'prestation' | 'commentaire'
  ligneIdx: number
}

/**
 * Largeurs colonnes (en mm) — totale 174 = largeur utile.
 *
 * | N° | DESIGNATION | QTE | P.U. HT | TVA | TOTAL HT |
 * |  12|     90      |  14 |   22    | 14  |   22     |
 */
// V3.0c.14 : largeurs ajustees pour supporter des montants jusqu'a "9 999 999,99 €"
// (7 chiffres + decimales) sans wrapping. Designation reduite a 80mm pour compenser.
const COL_W = {
  num: 12,
  designation: 80,
  qte: 14,
  pu: 26,
  tva: 14,
  total: 28,
} as const

/**
 * Dessine le tableau hierarchique.
 *
 * @param lignes     Lignes normalisees (avec type / niveau remplis).
 * @param yStart     y de demarrage.
 * @param isForfait  Si true, le tableau est remplace par une ligne unique
 *                   "forfait global" (designation = label artisan / objet).
 * @param ent        Entreprise (pour le label forfait).
 * @param objet      Objet du document (pour le label forfait).
 *
 * @returns nouveau y apres le tableau.
 */
export function drawTable(
  doc: jsPDF,
  lignes: PdfLigne[],
  yStart: number,
  isForfait: boolean,
  ent: TableEntreprise,
  objet: string | undefined,
  montantHt: number,
): number {
  const M = 18
  const subtotals = computeSubtotals(lignes)

  // En mode forfait : une seule ligne, plein largeur designation
  if (isForfait) {
    return drawForfaitTable(doc, ent, objet, montantHt, yStart, M)
  }

  const body: (string | { content: string; styles?: Partial<Styles> })[][] = []
  const meta: RowMeta[] = []

  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i]
    if (l.type === 'saut_page') continue

    if (l.type === 'section') {
      const sub = (l.id && subtotals.get(l.id)) || 0
      body.push([l.numero ?? '', l.designation, '', '', '', fmt(sub)])
      meta.push({ kind: 'section', ligneIdx: i })
    } else if (l.type === 'sous_section') {
      const sub = (l.id && subtotals.get(l.id)) || 0
      body.push([l.numero ?? '', l.designation, '', '', '', fmt(sub)])
      meta.push({ kind: 'sous_section', ligneIdx: i })
    } else if (l.type === 'commentaire') {
      body.push([l.numero ?? '', l.designation, '', '', '', ''])
      meta.push({ kind: 'commentaire', ligneIdx: i })
    } else {
      const q = l.quantite ?? 0
      const pu = l.prix_unitaire_ht ?? 0
      const unite = l.unite ?? ''
      const qLabel = unite ? `${q} ${unite}` : String(q)
      body.push([
        l.numero ?? '',
        l.designation,
        qLabel,
        fmt(pu),
        fmtTvaCell(l),
        fmt(q * pu),
      ])
      meta.push({ kind: 'prestation', ligneIdx: i })
    }
  }

  autoTable(doc, {
    startY: yStart,
    head: [['N°', 'DÉSIGNATION', 'QTÉ', 'P.U. HT', 'TVA', 'TOTAL HT']],
    body,
    theme: 'plain',
    margin: { left: M, right: M, top: 18, bottom: 22 },
    tableWidth: 174,
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'Hanken Grotesk',
      fontStyle: 'normal',
      fontSize: 8.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      lineColor: mut(C.border),
      lineWidth: 0,
      textColor: mut(C.navyText),
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: mut(C.white),
      textColor: mut(C.muted),
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: { top: 2, right: 2, bottom: 3, left: 2 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: COL_W.num },
      1: { halign: 'left',   cellWidth: COL_W.designation },
      2: { halign: 'center', cellWidth: COL_W.qte },
      3: { halign: 'right',  cellWidth: COL_W.pu },
      4: { halign: 'center', cellWidth: COL_W.tva },
      5: { halign: 'right',  cellWidth: COL_W.total },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section === 'head') return
      const m = meta[data.row.index]
      if (!m) return
      applyRowStyles(data, m)
    },
    didDrawCell: (data: CellHookData) => {
      // Trait fin sous-header (border-sky 0.4 mm)
      if (data.section === 'head' && data.column.index === 0) {
        const startX = data.cell.x
        const endX = startX + 174
        const y = data.cell.y + data.cell.height
        doc.setDrawColor(C.borderSky[0], C.borderSky[1], C.borderSky[2])
        doc.setLineWidth(0.4)
        doc.line(startX, y, endX, y)
      }

      // Pastille ronde orange niveau 1 (cellule colonne 0)
      if (data.section === 'body' && data.column.index === 0) {
        const m = meta[data.row.index]
        if (!m) return
        if (m.kind === 'section') {
          const cx = data.cell.x + data.cell.width / 2
          const cy = data.cell.y + data.cell.height / 2
          setFill(doc, C.orange)
          doc.circle(cx, cy, 2.8, 'F')
          // Numero centre dans la pastille
          doc.setFont('Hanken Grotesk', 'semibold')
          doc.setFontSize(8.5)
          setText(doc, C.navy)
          const num = String(lignes[m.ligneIdx]?.numero ?? '')
          const tw = doc.getTextWidth(num)
          doc.text(num, cx - tw / 2, cy + 1.1)
        }
      }

      // Border-bottom 0.2 mm sur prestations
      if (data.section === 'body' && data.column.index === 5) {
        const m = meta[data.row.index]
        if (m?.kind === 'prestation') {
          const y = data.cell.y + data.cell.height
          doc.setDrawColor(C.border[0], C.border[1], C.border[2])
          doc.setLineWidth(0.2)
          doc.line(18, y, 192, y)
        }
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 6
}

/**
 * Applique les styles par niveau a une cellule.
 */
function applyRowStyles(data: CellHookData, m: RowMeta): void {
  const col = data.column.index

  if (m.kind === 'section') {
    data.cell.styles.fillColor = mut(C.cream)
    data.cell.styles.cellPadding = { top: 4, right: 2, bottom: 4, left: 2 } as Styles['cellPadding']
    data.cell.styles.fontStyle = 'bold'
    data.cell.styles.textColor = mut(C.navy)
    if (col === 0) {
      // Le numero est dessine en pastille via didDrawCell : on masque le texte
      data.cell.text = ['']
    } else if (col === 1) {
      data.cell.styles.fontSize = 10
    } else if (col === 5) {
      data.cell.styles.fontSize = 10
    } else {
      data.cell.text = ['']
    }
  } else if (m.kind === 'sous_section') {
    data.cell.styles.fillColor = mut(C.grayPale)
    data.cell.styles.cellPadding = { top: 3, right: 2, bottom: 3, left: 2 } as Styles['cellPadding']
    data.cell.styles.fontStyle = 'bold'
    if (col === 0) {
      data.cell.styles.textColor = mut(C.orange)
      data.cell.styles.fontSize = 9
    } else if (col === 1) {
      data.cell.styles.textColor = mut(C.navy)
      data.cell.styles.fontSize = 9
    } else if (col === 5) {
      data.cell.styles.textColor = mut(C.navy)
      data.cell.styles.fontSize = 9
    } else {
      data.cell.text = ['']
    }
  } else if (m.kind === 'commentaire') {
    data.cell.styles.fillColor = mut(C.white)
    data.cell.styles.textColor = mut(C.muted)
    data.cell.styles.fontStyle = 'normal'
    data.cell.styles.fontSize = 8
  } else {
    // prestation
    data.cell.styles.fillColor = mut(C.white)
    data.cell.styles.cellPadding = { top: 2.5, right: 2, bottom: 2.5, left: 2 } as Styles['cellPadding']
    if (col === 0) {
      data.cell.styles.textColor = mut(C.muted)
      data.cell.styles.fontSize = 8
    } else if (col === 1) {
      data.cell.styles.textColor = mut(C.navy)
      data.cell.styles.fontSize = 8.5
    } else if (col === 5) {
      data.cell.styles.textColor = mut(C.navy)
      data.cell.styles.fontStyle = 'bold'
      data.cell.styles.fontSize = 8.5
    } else {
      data.cell.styles.textColor = mut(C.navy)
      data.cell.styles.fontSize = 8.5
    }
  }
}

/**
 * Mode forfait : une seule ligne pleine largeur designation.
 */
function drawForfaitTable(
  doc: jsPDF,
  ent: TableEntreprise,
  objet: string | undefined,
  montantHt: number,
  yStart: number,
  M: number,
): number {
  const label = buildForfaitLabel(ent, objet)
  autoTable(doc, {
    startY: yStart,
    head: [['DÉSIGNATION', 'TOTAL HT']],
    body: [[label, fmt(montantHt)]],
    theme: 'plain',
    margin: { left: M, right: M, top: 18, bottom: 22 },
    tableWidth: 174,
    styles: {
      font: 'Hanken Grotesk',
      fontStyle: 'normal',
      fontSize: 9,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      textColor: mut(C.navy),
      lineColor: mut(C.border),
      lineWidth: 0,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: mut(C.white),
      textColor: mut(C.muted),
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: { top: 2, right: 2, bottom: 3, left: 2 },
    },
    columnStyles: {
      0: { halign: 'left',  cellWidth: 142 },
      1: { halign: 'right', cellWidth: 32 },
    },
    didDrawCell: (data: CellHookData) => {
      // Trait fin sous le header
      if (data.section === 'head' && data.column.index === 0) {
        const y = data.cell.y + data.cell.height
        doc.setDrawColor(C.borderSky[0], C.borderSky[1], C.borderSky[2])
        doc.setLineWidth(0.4)
        doc.line(18, y, 192, y)
      }
      // Fond cream sur la ligne unique
      if (data.section === 'body' && data.column.index === 0) {
        // Le fond est cree avant la cellule via didParseCell
      }
    },
    didParseCell: (data: CellHookData) => {
      if (data.section === 'body') {
        data.cell.styles.fillColor = mut(C.cream)
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 6
}

function buildForfaitLabel(ent: TableEntreprise, objet: string | undefined): string {
  const metier = (ent.metier || '').trim()
  const obj = (objet || '').trim()
  if (metier && obj) return `${metier} — ${obj}`
  if (obj) return `Forfait global — ${obj}`
  return 'Forfait global'
}
