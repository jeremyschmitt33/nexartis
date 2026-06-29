// lib/pdf/table.ts - V3.0c
// Tableau hierarchique 3 niveaux (section / sous_section / prestation)
// + mode forfait. Utilise jspdf-autotable avec hooks pour pastilles
// rondes orange (niveau 1) et styles par niveau.

import type { jsPDF } from 'jspdf'
import autoTable, { type CellHookData, type Styles } from 'jspdf-autotable'
import { C, type Palette } from './palette'
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
  palette: Palette = C,
): number {
  const P = palette
  const M = 18
  const subtotals = computeSubtotals(lignes)

  // En mode forfait : une seule ligne, plein largeur designation
  if (isForfait) {
    return drawForfaitTable(doc, ent, objet, montantHt, yStart, M, P)
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
      // Ligne facultative (optionnel=true + inclus_par_defaut!=false) : marqueur discret.
      const isFacultatif = !!l.optionnel && l.inclus_par_defaut !== false
      const desig = isFacultatif ? `${l.designation}  (facultatif)` : l.designation
      body.push([
        l.numero ?? '',
        desig,
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
      lineColor: mut(P.border),
      lineWidth: 0,
      textColor: mut(P.navyText),
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: mut(P.white),
      textColor: mut(P.muted),
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
      applyRowStyles(data, m, P)
    },
    didDrawCell: (data: CellHookData) => {
      // Trait fin sous-header (border-sky 0.4 mm)
      if (data.section === 'head' && data.column.index === 0) {
        const startX = data.cell.x
        const endX = startX + 174
        const y = data.cell.y + data.cell.height
        doc.setDrawColor(P.borderSky[0], P.borderSky[1], P.borderSky[2])
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
          setFill(doc, P.orange)
          doc.circle(cx, cy, 2.8, 'F')
          // Numero centre dans la pastille
          doc.setFont('Hanken Grotesk', 'semibold')
          doc.setFontSize(8.5)
          setText(doc, P.navy)
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
          doc.setDrawColor(P.border[0], P.border[1], P.border[2])
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
function applyRowStyles(data: CellHookData, m: RowMeta, P: Palette): void {
  const col = data.column.index

  if (m.kind === 'section') {
    data.cell.styles.fillColor = mut(P.cream)
    data.cell.styles.cellPadding = { top: 4, right: 2, bottom: 4, left: 2 } as Styles['cellPadding']
    data.cell.styles.fontStyle = 'bold'
    data.cell.styles.textColor = mut(P.navy)
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
    data.cell.styles.fillColor = mut(P.grayPale)
    data.cell.styles.cellPadding = { top: 3, right: 2, bottom: 3, left: 2 } as Styles['cellPadding']
    data.cell.styles.fontStyle = 'bold'
    if (col === 0) {
      data.cell.styles.textColor = mut(P.orange)
      data.cell.styles.fontSize = 9
    } else if (col === 1) {
      data.cell.styles.textColor = mut(P.navy)
      data.cell.styles.fontSize = 9
    } else if (col === 5) {
      data.cell.styles.textColor = mut(P.navy)
      data.cell.styles.fontSize = 9
    } else {
      data.cell.text = ['']
    }
  } else if (m.kind === 'commentaire') {
    data.cell.styles.fillColor = mut(P.white)
    data.cell.styles.textColor = mut(P.muted)
    data.cell.styles.fontStyle = 'normal'
    data.cell.styles.fontSize = 8
  } else {
    // prestation
    data.cell.styles.fillColor = mut(P.white)
    data.cell.styles.cellPadding = { top: 2.5, right: 2, bottom: 2.5, left: 2 } as Styles['cellPadding']
    if (col === 0) {
      data.cell.styles.textColor = mut(P.muted)
      data.cell.styles.fontSize = 8
    } else if (col === 1) {
      data.cell.styles.textColor = mut(P.navy)
      data.cell.styles.fontSize = 8.5
    } else if (col === 5) {
      data.cell.styles.textColor = mut(P.navy)
      data.cell.styles.fontStyle = 'bold'
      data.cell.styles.fontSize = 8.5
    } else {
      data.cell.styles.textColor = mut(P.navy)
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
  P: Palette,
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
      textColor: mut(P.navy),
      lineColor: mut(P.border),
      lineWidth: 0,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: mut(P.white),
      textColor: mut(P.muted),
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
        doc.setDrawColor(P.borderSky[0], P.borderSky[1], P.borderSky[2])
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
        data.cell.styles.fillColor = mut(P.cream)
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

/**
 * Bloc "Options +" du PDF (devis) : postes proposés en plus, NON comptés dans
 * le total principal. Parité avec le bloc options du rendu HTML (DocumentRender).
 * @returns nouveau y après le bloc.
 */
export function drawOptionsBlock(
  doc: jsPDF,
  optionLignes: PdfLigne[],
  yStart: number,
  palette: Palette = C,
): number {
  const P = palette
  const M = 18
  let y = yStart
  // Saut de page si trop bas pour le titre + au moins une ligne.
  if (y > 245) { doc.addPage(); y = 25 }

  // Titre du bloc
  doc.setFont('Hanken Grotesk', 'bold')
  doc.setFontSize(8.5)
  setText(doc, P.orange)
  doc.text('OPTIONS PROPOSÉES (non comprises dans le total ci-dessus)', M, y)
  y += 2.5

  let optionsHt = 0
  let optionsTva = 0
  const body: string[][] = optionLignes.map((l, i) => {
    const q = l.quantite ?? 0
    const pu = l.prix_unitaire_ht ?? 0
    const taux = l.taux_tva ?? 0
    const lineHt = q * pu
    optionsHt += lineHt
    optionsTva += lineHt * (taux / 100)
    const unite = l.unite ?? ''
    const qLabel = unite ? `${q} ${unite}` : String(q)
    return [String(i + 1), l.designation, qLabel, fmt(pu), fmtTvaCell(l), fmt(lineHt)]
  })
  const optionsTtc = optionsHt + optionsTva

  autoTable(doc, {
    startY: y,
    head: [['N°', 'DÉSIGNATION', 'QTÉ', 'P.U. HT', 'TVA', 'TOTAL HT']],
    body,
    theme: 'plain',
    margin: { left: M, right: M, top: 18, bottom: 22 },
    tableWidth: 174,
    rowPageBreak: 'avoid',
    styles: {
      font: 'Hanken Grotesk',
      fontStyle: 'normal',
      fontSize: 8.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      textColor: mut(P.navy),
      lineWidth: 0,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: mut(P.white),
      textColor: mut(P.muted),
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: { top: 2, right: 2, bottom: 3, left: 2 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: COL_W.num },
      1: { halign: 'left',   cellWidth: COL_W.designation },
      2: { halign: 'center', cellWidth: COL_W.qte },
      3: { halign: 'right',  cellWidth: COL_W.pu },
      4: { halign: 'center', cellWidth: COL_W.tva },
      5: { halign: 'right',  cellWidth: COL_W.total },
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section === 'head' && data.column.index === 0) {
        const yy = data.cell.y + data.cell.height
        doc.setDrawColor(P.borderSky[0], P.borderSky[1], P.borderSky[2])
        doc.setLineWidth(0.4)
        doc.line(18, yy, 192, yy)
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterY = (doc as any).lastAutoTable.finalY
  // Total des options (aligné à droite, en gras)
  doc.setFont('Hanken Grotesk', 'bold')
  doc.setFontSize(9)
  setText(doc, P.navy)
  const totalLabel = `Total des options (si toutes ajoutées) :  + ${fmt(optionsTtc)} TTC`
  const tw = doc.getTextWidth(totalLabel)
  doc.text(totalLabel, 192 - tw, afterY + 5)
  return afterY + 11
}

/**
 * Annexe "postes non retenus" du PDF (devis SIGNÉ) : trace les prestations
 * proposées mais écartées par le client. Hors total, style atténué + barré.
 * @returns nouveau y après le bloc.
 */
export function drawNonRetenuesBlock(
  doc: jsPDF,
  nonRetenuesLignes: PdfLigne[],
  yStart: number,
  palette: Palette = C,
): number {
  const P = palette
  const M = 18
  let y = yStart
  if (y > 248) { doc.addPage(); y = 25 }

  doc.setFont('Hanken Grotesk', 'bold')
  doc.setFontSize(8.5)
  setText(doc, P.muted)
  doc.text('POSTES PROPOSÉS NON RETENUS PAR LE CLIENT (hors total)', M, y)
  y += 2.5

  const body: string[][] = nonRetenuesLignes.map((l, i) => {
    const q = l.quantite ?? 0
    const pu = l.prix_unitaire_ht ?? 0
    const unite = l.unite ?? ''
    const qLabel = unite ? `${q} ${unite}` : String(q)
    return [String(i + 1), l.designation, qLabel, fmt(pu), fmtTvaCell(l), fmt(q * pu)]
  })

  autoTable(doc, {
    startY: y,
    head: [['N°', 'DÉSIGNATION', 'QTÉ', 'P.U. HT', 'TVA', 'TOTAL HT']],
    body,
    theme: 'plain',
    margin: { left: M, right: M, top: 18, bottom: 22 },
    tableWidth: 174,
    rowPageBreak: 'avoid',
    styles: {
      font: 'Hanken Grotesk',
      fontStyle: 'normal',
      fontSize: 8.5,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      textColor: mut(P.muted),
      lineWidth: 0,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: mut(P.white),
      textColor: mut(P.muted),
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: { top: 2, right: 2, bottom: 3, left: 2 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: COL_W.num },
      1: { halign: 'left',   cellWidth: COL_W.designation },
      2: { halign: 'center', cellWidth: COL_W.qte },
      3: { halign: 'right',  cellWidth: COL_W.pu },
      4: { halign: 'center', cellWidth: COL_W.tva },
      5: { halign: 'right',  cellWidth: COL_W.total },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 8
}
