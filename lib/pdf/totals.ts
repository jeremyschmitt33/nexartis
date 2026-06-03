// lib/pdf/totals.ts - V3.0c.4
// Bloc CONDITIONS DE PAIEMENT (gauche, + mentions TVA legales + bloc IBAN si facture)
// + bloc RECAP (sous-total HT, lignes TVA, total TTC, acompte)
// + bloc NET A PAYER orange plein + encadre echelonnement (Fix 8)
// Marges uniformes (Fix 9), mentions TVA deplacees a gauche (Fix 10).

import type { jsPDF } from 'jspdf'
import { C } from './palette'
import {
  fmt,
  font,
  setFill,
  setDraw,
  setText,
  textRight,
  computeTvaGroups,
  computeTvaBases,
  detectForfaitMode,
  getTvaMentions,
  type PdfLigne,
} from './utils'

interface TotalsEntreprise {
  nom?: string
  iban?: string
  bic?: string
}

interface TotalsData {
  numero: string
  conditions_paiement?: string
  acompte_pourcent?: number
  acompte_montant_ht?: number
  acompte_montant_ttc?: number
  acompte_label?: string
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  entreprise: TotalsEntreprise
  notes_personnalisees?: string
  /** "Net à payer à la commande" pour devis avec acompte, sinon "Net à payer". */
  netLabel?: string
}

const DEFAULT_CONDITIONS_PAIEMENT =
  'Méthodes de paiement acceptées : Virement bancaire, Chèque.'

const LEFT_X = 18
const RIGHT_X = 108
const COL_W = 84
const RIGHT_VALUE_X = 192

/**
 * Dessine bloc CONDITIONS + RECAP + NET A PAYER + IBAN (si facture).
 *
 * @returns y absolu apres l'ensemble (max des 2 colonnes).
 */
export function drawTotals(
  doc: jsPDF,
  data: TotalsData,
  lignes: PdfLigne[],
  isFacture: boolean,
  yStart: number,
): number {
  const leftStartY = yStart
  const rightStartY = yStart

  // --- Colonne gauche : CONDITIONS DE PAIEMENT + mentions TVA + IBAN (si facture) ---
  let leftY = drawConditions(doc, data, leftStartY)
  // Fix 10 : mentions TVA legales (Je certifie...) sous les conditions de paiement
  leftY = drawTvaCertifications(doc, lignes, leftY)
  if (data.notes_personnalisees && data.notes_personnalisees.trim()) {
    leftY = drawNotes(doc, data.notes_personnalisees.trim(), leftY)
  }
  if (isFacture) {
    leftY = drawIbanBlock(doc, data.entreprise, LEFT_X, leftY, COL_W)
  }

  // --- Colonne droite : RECAP + NET A PAYER ---
  const rightY = drawRecap(doc, data, lignes, rightStartY)

  return Math.max(leftY, rightY) + 4
}

// ===========================================================================
// CONDITIONS DE PAIEMENT (gauche)
// ===========================================================================
function drawConditions(doc: jsPDF, data: TotalsData, yStart: number): number {
  const txt = (data.conditions_paiement && data.conditions_paiement.trim())
    || DEFAULT_CONDITIONS_PAIEMENT
  font(doc, 'Hanken Grotesk', 'semibold', 7, C.muted)
  doc.text('CONDITIONS DE PAIEMENT', LEFT_X, yStart, { charSpace: 0.6 })

  font(doc, 'Hanken Grotesk', 'normal', 8.5, C.navy)
  const split = doc.splitTextToSize(txt, COL_W)
  doc.text(split, LEFT_X, yStart + 5)
  return yStart + 5 + split.length * 3.6 + 4
}

// Fix 10 : Mentions TVA legales (Je certifie...) sous les conditions de paiement.
// 7pt italique muted, splitTextToSize sur COL_W. Espacement entre mentions : 1.6mm.
function drawTvaCertifications(
  doc: jsPDF,
  lignes: PdfLigne[],
  yStart: number,
): number {
  const tvaTexts = getTvaMentions(lignes)
  if (tvaTexts.length === 0) return yStart
  // -1mm pour compenser le +4mm bake-in dans drawConditions (separation 3mm souhaitee)
  let y = yStart - 1
  font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
  for (const t of tvaTexts) {
    const split = doc.splitTextToSize(t, COL_W)
    doc.text(split, LEFT_X, y)
    y += split.length * 2.8 + 1.6
  }
  return y + 2
}

function drawNotes(doc: jsPDF, notes: string, yStart: number): number {
  font(doc, 'Hanken Grotesk', 'semibold', 7, C.muted)
  doc.text('NOTES', LEFT_X, yStart, { charSpace: 0.6 })
  font(doc, 'Hanken Grotesk', 'normal', 8.5, C.navy)
  const split = doc.splitTextToSize(notes, COL_W)
  doc.text(split, LEFT_X, yStart + 5)
  return yStart + 5 + split.length * 3.6 + 4
}

// ===========================================================================
// IBAN (facture uniquement)
// ===========================================================================
export function drawIbanBlock(
  doc: jsPDF,
  ent: TotalsEntreprise,
  x: number,
  y: number,
  w: number,
): number {
  if (!ent.iban || !ent.iban.trim()) return y
  const h = 18

  setFill(doc, C.skyVeryPale)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  setFill(doc, C.orange)
  doc.rect(x, y, 1.6, h, 'F')

  font(doc, 'Hanken Grotesk', 'semibold', 7, C.orange)
  doc.text('POUR RÉGLER PAR VIREMENT', x + 5, y + 4.5, { charSpace: 0.6 })

  const ibanClean = ent.iban.replace(/\s+/g, '').toUpperCase()
  const ibanFormatted = ibanClean.match(/.{1,4}/g)?.join(' ') || ibanClean
  font(doc, 'Spline Sans Mono', 'semibold', 7.5, C.navy)
  doc.text(`IBAN  ${ibanFormatted}`, x + 5, y + 8.8)
  if (ent.bic && ent.bic.trim()) {
    doc.text(`BIC   ${ent.bic.trim().toUpperCase()}`, x + 5, y + 12.4)
  }

  font(doc, 'Hanken Grotesk', 'normal', 6.5, C.muted)
  doc.text(`Bénéficiaire : ${ent.nom || ''}`, x + 5, y + 16, { maxWidth: w - 7 })

  return y + h + 4
}

// ===========================================================================
// RECAP + NET A PAYER (droite) — Fix 9 : marges uniformes
// ===========================================================================
//   - Entre lignes de recap (sous-total HT, TVA, Total TTC) : 6 mm
//   - Avant le bloc orange Net a payer                       : 4 mm
//   - Entre le bloc orange et l'encadre echelonnement        : 2 mm
//   - Apres l'encadre echelonnement (retour de la fonction)  : 2 mm
const GAP_RECAP_ROW = 6
const GAP_BEFORE_NET = 4
const GAP_AFTER_NET = 2
const GAP_AFTER_ECHELON = 2

function drawRecap(
  doc: jsPDF,
  data: TotalsData,
  lignes: PdfLigne[],
  yStart: number,
): number {
  // V3.0c.5 Fix B — grand cadre fond skyVeryPale englobant tout le recap
  // (sous-total + TVA + Total TTC + Net a payer + echelonnement)
  const isForfait = detectForfaitMode(lignes, data.montant_ht)
  const acompteTTCpre = computeAcompteTTC(data)
  let tvaGroupsPre = computeTvaGroups(lignes)
  if (isForfait && data.montant_tva > 0 && data.montant_ht > 0) {
    const tauxBrutPre = (data.montant_tva / data.montant_ht) * 100
    const tauxPre = Math.round(tauxBrutPre * 10) / 10
    tvaGroupsPre = { [tauxPre]: data.montant_tva }
  }
  const nbTvaPre = Object.keys(tvaGroupsPre)
    .map(Number)
    .filter((r) => Number.isFinite(r) && r > 0 && (tvaGroupsPre[r] ?? 0) > 0.005).length
  const echelonH = acompteTTCpre > 0 ? 13 + GAP_AFTER_ECHELON : 0
  const recapH = GAP_RECAP_ROW * (1 + nbTvaPre + 1) + GAP_BEFORE_NET + 13 + GAP_AFTER_NET + echelonH
  const recapPad = 4
  setFill(doc, C.skyVeryPale)
  doc.roundedRect(RIGHT_X - 2, yStart - recapPad + 1, COL_W + 4, recapH + recapPad, 3, 3, 'F')

  let y = yStart
  drawRecapRow(
    doc,
    isForfait ? 'Forfait global HT' : 'Sous-total HT',
    fmt(data.montant_ht),
    y,
    { boldValue: true },
  )
  y += GAP_RECAP_ROW

  // Lignes TVA par taux (base entre parentheses si multi-taux)
  let tvaGroups = computeTvaGroups(lignes)
  if (isForfait && data.montant_tva > 0 && data.montant_ht > 0) {
    const tauxBrut = (data.montant_tva / data.montant_ht) * 100
    const taux = Math.round(tauxBrut * 10) / 10
    tvaGroups = { [taux]: data.montant_tva }
  }
  const tvaBases = computeTvaBases(lignes)
  const sortedRates = Object.keys(tvaGroups)
    .map(Number)
    .filter((r) => Number.isFinite(r) && r > 0 && (tvaGroups[r] ?? 0) > 0.005)
    .sort((a, b) => a - b)
  const isMulti = sortedRates.length > 1
  for (const r of sortedRates) {
    const base = tvaBases[r]
    const label = `TVA ${formatRate(r)}`
    const sub = isMulti && base !== undefined ? ` (base ${fmt(base)})` : ''
    drawTvaRow(doc, label, sub, fmt(tvaGroups[r]), y)
    y += GAP_RECAP_ROW
  }

  // Trait fin separateur (2mm avant Total TTC)
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(RIGHT_X, y - 2, RIGHT_VALUE_X, y - 2)

  // Total TTC
  drawRecapRow(doc, 'Total TTC', fmt(data.montant_ttc), y, {
    boldValue: true,
    labelBold: true,
    sizeBoost: true,
  })
  y += GAP_BEFORE_NET

  // Bloc NET A PAYER orange plein (montant = Total TTC complet, jamais l'acompte)
  const acompteTTC = acompteTTCpre
  const netH = 13
  setFill(doc, C.orange)
  doc.roundedRect(RIGHT_X, y, COL_W, netH, 3, 3, 'F')

  const netLabel = data.netLabel || 'Net à payer'
  font(doc, 'Hanken Grotesk', 'semibold', 9, C.white)
  doc.text(netLabel, RIGHT_X + 4, y + netH / 2 + 1.2)

  font(doc, 'Hanken Grotesk', 'extrabold', 15, C.white)
  textRight(doc, fmt(data.montant_ttc), RIGHT_VALUE_X - 4, y + netH / 2 + 2.2)
  y += netH + GAP_AFTER_NET

  // Fix 8 : encadre commun pour les 2 lignes echelonnement (parite HTML dashboard)
  if (acompteTTC > 0) {
    const pct = data.acompte_pourcent && data.acompte_pourcent > 0
      ? ` (${data.acompte_pourcent} %)`
      : ''
    const reste = Math.max(data.montant_ttc - acompteTTC, 0)

    const boxX = RIGHT_X
    const boxY = y
    const boxW = COL_W
    const padInner = 3
    const lineGap = 4.5
    const boxH = padInner * 2 + lineGap * 2 // 2 lignes + 2 paddings

    // V3.0c.5 Fix B : trait separateur fin au-dessus de l'echelonnement
    // (le grand cadre skyVeryPale gere deja le fond, on evite le double-fill)
    setDraw(doc, C.borderSky)
    doc.setLineWidth(0.3)
    doc.line(boxX + padInner, boxY, boxX + boxW - padInner, boxY)

    const lineX = boxX + padInner
    const valueX = boxX + boxW - padInner

    drawSplitRow(
      doc,
      `À verser à la commande${pct}`,
      fmt(acompteTTC),
      boxY + padInner + 3,
      lineX,
      valueX,
    )
    drawSplitRow(
      doc,
      'Reste dû à la livraison',
      fmt(reste),
      boxY + padInner + 3 + lineGap,
      lineX,
      valueX,
    )

    y = boxY + boxH + GAP_AFTER_ECHELON
  }

  return y
}

function drawSplitRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  xLabel: number = RIGHT_X,
  xValue: number = RIGHT_VALUE_X,
): void {
  font(doc, 'Hanken Grotesk', 'normal', 8, C.muted)
  doc.text(label, xLabel, y)
  font(doc, 'Hanken Grotesk', 'semibold', 8.5, C.navy)
  textRight(doc, value, xValue, y)
}

function computeAcompteTTC(data: TotalsData): number {
  if (data.acompte_montant_ttc !== undefined && data.acompte_montant_ttc > 0) {
    return data.acompte_montant_ttc
  }
  if (data.acompte_pourcent && data.acompte_pourcent > 0) {
    return data.montant_ttc * (data.acompte_pourcent / 100)
  }
  return 0
}

function drawRecapRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  opts: { boldValue?: boolean; labelBold?: boolean; sizeBoost?: boolean },
): void {
  const labelSize = opts.sizeBoost ? 9 : 8.5
  const valueSize = opts.sizeBoost ? 9 : 8.5
  font(
    doc,
    'Hanken Grotesk',
    opts.labelBold ? 'semibold' : 'normal',
    labelSize,
    opts.labelBold ? C.navy : C.muted,
  )
  doc.text(label, RIGHT_X, y)

  font(
    doc,
    'Hanken Grotesk',
    opts.boldValue ? 'bold' : 'normal',
    valueSize,
    C.navy,
  )
  textRight(doc, value, RIGHT_VALUE_X, y)
}

function drawTvaRow(
  doc: jsPDF,
  label: string,
  sub: string,
  value: string,
  y: number,
): void {
  font(doc, 'Hanken Grotesk', 'normal', 8.5, C.muted)
  doc.text(label, RIGHT_X, y)
  // V3.0c.2 fix : mesurer le label AVEC un espace pour eviter "%(base..."
  const labelW = doc.getTextWidth(label + ' ')
  if (sub) {
    font(doc, 'Hanken Grotesk', 'normal', 7.5, C.muted)
    doc.text(sub.trimStart(), RIGHT_X + labelW, y)
  }
  font(doc, 'Hanken Grotesk', 'bold', 8.5, C.navy)
  textRight(doc, value, RIGHT_VALUE_X, y)
}

function formatRate(r: number): string {
  if (r === 5.5) return '5,5 %'
  return `${String(r).replace('.', ',')} %`
}
