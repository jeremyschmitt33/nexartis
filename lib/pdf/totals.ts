// lib/pdf/totals.ts - V3.0c
// Bloc CONDITIONS DE PAIEMENT (gauche, + bloc IBAN encadre si facture)
// + bloc RECAP (sous-total HT, lignes TVA, total TTC, acompte)
// + bloc NET A PAYER orange plein + mention reste du.

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
 * @param data        Donnees devis ou facture (champs communs)
 * @param lignes      Lignes normalisees (pour TVA)
 * @param isFacture   true => bloc IBAN affiche dans la colonne gauche
 * @param yStart      y de demarrage
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

  // --- Colonne gauche : CONDITIONS DE PAIEMENT (+ IBAN si facture) ---
  let leftY = drawConditions(doc, data, leftStartY)
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
/**
 * Bloc IBAN encadre `skyVeryPale` + trait gauche orange 1.6 mm.
 * Spline Sans Mono pour IBAN/BIC. A appeler dans la colonne gauche apres
 * les conditions de paiement (facture uniquement).
 */
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
// RECAP + NET A PAYER (droite)
// ===========================================================================
function drawRecap(
  doc: jsPDF,
  data: TotalsData,
  lignes: PdfLigne[],
  yStart: number,
): number {
  let y = yStart

  // Sous-total HT
  const isForfait = detectForfaitMode(lignes, data.montant_ht)
  drawRecapRow(
    doc,
    isForfait ? 'Forfait global HT' : 'Sous-total HT',
    fmt(data.montant_ht),
    y,
    { boldValue: true },
  )
  y += 6

  // Lignes TVA par taux (avec base entre parentheses si multi-taux)
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
    const sub = isMulti && base !== undefined ? `(base ${fmt(base)})` : ''
    drawTvaRow(doc, label, sub, fmt(tvaGroups[r]), y)
    y += 6
  }

  // Trait fin border
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(RIGHT_X, y, RIGHT_VALUE_X, y)
  y += 4

  // Total TTC
  drawRecapRow(doc, 'Total TTC', fmt(data.montant_ttc), y, {
    boldValue: true,
    labelBold: true,
    sizeBoost: true,
  })
  y += 6

  // Acompte (si > 0)
  const acompteTTC = computeAcompteTTC(data)
  if (acompteTTC > 0) {
    setDraw(doc, C.border)
    doc.setLineWidth(0.3)
    doc.line(RIGHT_X, y - 2, RIGHT_VALUE_X, y - 2)
    const pct = data.acompte_pourcent && data.acompte_pourcent > 0
      ? ` (${data.acompte_pourcent} %)`
      : ''
    const label = (data.acompte_label && data.acompte_label.trim()) || `Acompte${pct}`
    drawRecapRow(doc, label, `- ${fmt(acompteTTC)}`, y, {})
    y += 6
  }

  // Bloc NET A PAYER orange plein
  y += 2
  const netH = 13
  setFill(doc, C.orange)
  doc.roundedRect(RIGHT_X, y, COL_W, netH, 3, 3, 'F')

  const netLabel = data.netLabel
    || (acompteTTC > 0 ? 'Net à payer à la commande' : 'Net à payer')
  font(doc, 'Hanken Grotesk', 'semibold', 9, C.white)
  doc.text(netLabel, RIGHT_X + 4, y + netH / 2 + 1.2)

  font(doc, 'Hanken Grotesk', 'extrabold', 15, C.white)
  const netAmount = acompteTTC > 0 ? acompteTTC : data.montant_ttc
  textRight(doc, fmt(netAmount), RIGHT_VALUE_X - 4, y + netH / 2 + 2.2)
  y += netH + 3

  // Mention reste du
  if (acompteTTC > 0) {
    const reste = Math.max(data.montant_ttc - acompteTTC, 0)
    font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
    const txt = `Reste dû à la livraison : ${fmt(reste)}   ·   Total TTC : ${fmt(data.montant_ttc)}`
    textRight(doc, txt, RIGHT_VALUE_X, y)
    y += 4
  }

  return y
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
  if (sub) {
    font(doc, 'Hanken Grotesk', 'normal', 7.5, C.muted)
    const labelW = doc.getTextWidth(label + ' ')
    doc.text(sub, RIGHT_X + labelW, y)
  }
  font(doc, 'Hanken Grotesk', 'bold', 8.5, C.navy)
  textRight(doc, value, RIGHT_VALUE_X, y)
}

function formatRate(r: number): string {
  if (r === 5.5) return '5,5 %'
  return `${String(r).replace('.', ',')} %`
}
