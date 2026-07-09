// lib/pdf/totals.ts - V3.0c.4
// Bloc CONDITIONS DE PAIEMENT (gauche, + mentions TVA legales + bloc IBAN si facture)
// + bloc RECAP (sous-total HT, lignes TVA, total TTC, acompte)
// + bloc NET A PAYER orange plein + encadre echelonnement (Fix 8)
// Marges uniformes (Fix 9), mentions TVA deplacees a gauche (Fix 10).

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
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
  /** V-AVOIR : true => remplace conditions de paiement par un encart "Avoir" et masque l'IBAN. */
  isAvoir?: boolean
  /** V2 imputation : deductions de reglement affichees sous le Total TTC (TTC plein). */
  deductions?: { label: string; montant: number }[]
  /** V2 imputation : net reel a payer apres deductions (sinon = montant_ttc). */
  netAPayer?: number
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
  palette: Palette = C,
): number {
  const P = palette
  // V3.0c.14 : si pas assez de place avant le footer (282mm), saut de page automatique.
  // Le bloc recap a besoin d'environ 75mm minimum (conditions + recap + Net + echelon).
  // Sans cette protection, le grand cadre bleu deborde sur le bandeau navy du footer.
  const FOOTER_TOP = 282
  const RECAP_MIN_NEED = 80 // marge de securite
  if (yStart + RECAP_MIN_NEED > FOOTER_TOP) {
    doc.addPage()
    yStart = 30
  }

  const leftStartY = yStart
  const rightStartY = yStart

  // --- Colonne gauche : CONDITIONS DE PAIEMENT (ou encart AVOIR) + mentions TVA + IBAN (si facture, hors avoir) ---
  let leftY = data.isAvoir
    ? drawAvoirEncart(doc, leftStartY, P)
    : drawConditions(doc, data, leftStartY, P)
  // Fix 10 : mentions TVA legales (Je certifie...) sous les conditions de paiement
  leftY = drawTvaCertifications(doc, lignes, leftY, P)
  if (data.notes_personnalisees && data.notes_personnalisees.trim()) {
    leftY = drawNotes(doc, data.notes_personnalisees.trim(), leftY, P)
  }
  // V-AVOIR : pas d'IBAN "a regler" sur un avoir (somme a crediter, pas a payer).
  if (isFacture && !data.isAvoir) {
    leftY = drawIbanBlock(doc, data.entreprise, LEFT_X, leftY, COL_W, P)
  }

  // --- Colonne droite : RECAP + NET A PAYER ---
  const rightY = drawRecap(doc, data, lignes, rightStartY, P)

  return Math.max(leftY, rightY) + 4
}

// ===========================================================================
// V-AVOIR : encart "Avoir" (remplace CONDITIONS DE PAIEMENT) — parite HTML.
// ===========================================================================
function drawAvoirEncart(doc: jsPDF, yStart: number, P: Palette): number {
  font(doc, 'Hanken Grotesk', 'semibold', 7, P.muted)
  doc.text('AVOIR', LEFT_X, yStart, { charSpace: 0.6 })
  font(doc, 'Hanken Grotesk', 'normal', 8.5, P.navy)
  const txt =
    "Cet avoir vient en déduction des sommes dues. Si la facture d'origine a déjà été réglée, le montant est à rembourser au client."
  const split = doc.splitTextToSize(txt, COL_W)
  doc.text(split, LEFT_X, yStart + 5)
  return yStart + 5 + split.length * 3.6 + 4
}

// ===========================================================================
// CONDITIONS DE PAIEMENT (gauche)
// ===========================================================================
// Supprime les lignes en doublon : certaines conditions ont ete enregistrees
// dupliquees en base ("A\nB\nA\nB"). On dedoublonne a l'affichage, ce qui repare
// tous les devis deja affectes sans re-sauvegarde.
function dedupeLines(txt: string): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of txt.split('\n')) {
    const key = raw.trim().toLowerCase()
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(raw)
  }
  return out.join('\n')
}

function drawConditions(doc: jsPDF, data: TotalsData, yStart: number, P: Palette): number {
  const txt = dedupeLines((data.conditions_paiement && data.conditions_paiement.trim())
    || DEFAULT_CONDITIONS_PAIEMENT)
  font(doc, 'Hanken Grotesk', 'semibold', 7, P.muted)
  doc.text('CONDITIONS DE PAIEMENT', LEFT_X, yStart, { charSpace: 0.6 })

  font(doc, 'Hanken Grotesk', 'normal', 8.5, P.navy)
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
  P: Palette,
): number {
  const tvaTexts = getTvaMentions(lignes)
  if (tvaTexts.length === 0) return yStart
  // -1mm pour compenser le +4mm bake-in dans drawConditions (separation 3mm souhaitee)
  let y = yStart - 1
  font(doc, 'Hanken Grotesk', 'normal', 7, P.muted)
  for (const t of tvaTexts) {
    const split = doc.splitTextToSize(t, COL_W)
    doc.text(split, LEFT_X, y)
    y += split.length * 2.8 + 1.6
  }
  return y + 2
}

function drawNotes(doc: jsPDF, notes: string, yStart: number, P: Palette): number {
  font(doc, 'Hanken Grotesk', 'semibold', 7, P.muted)
  doc.text('NOTES', LEFT_X, yStart, { charSpace: 0.6 })
  font(doc, 'Hanken Grotesk', 'normal', 8.5, P.navy)
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
  palette: Palette = C,
): number {
  if (!ent.iban || !ent.iban.trim()) return y
  const P = palette
  const h = 18

  setFill(doc, P.skyVeryPale)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  setFill(doc, P.orange)
  doc.rect(x, y, 1.6, h, 'F')

  font(doc, 'Hanken Grotesk', 'semibold', 7, P.orange)
  doc.text('POUR RÉGLER PAR VIREMENT', x + 5, y + 4.5, { charSpace: 0.6 })

  const ibanClean = ent.iban.replace(/\s+/g, '').toUpperCase()
  const ibanFormatted = ibanClean.match(/.{1,4}/g)?.join(' ') || ibanClean
  font(doc, 'Spline Sans Mono', 'semibold', 7.5, P.navy)
  doc.text(`IBAN  ${ibanFormatted}`, x + 5, y + 8.8)
  if (ent.bic && ent.bic.trim()) {
    doc.text(`BIC   ${ent.bic.trim().toUpperCase()}`, x + 5, y + 12.4)
  }

  font(doc, 'Hanken Grotesk', 'normal', 6.5, P.muted)
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
  P: Palette,
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
  // V2 imputation : reserver la hauteur des lignes de deduction (ex. avoir impute).
  const nbDeductionsPre = (!data.isAvoir && data.deductions) ? data.deductions.length : 0
  // V3.0c.15 : estimation hauteur recap corrigee (le +1 pour Total TTC etait double-compte
  // avec GAP_BEFORE_NET). Sous-total + N lignes TVA = 6 * (1 + nbTva), Total TTC bascule
  // directement sur GAP_BEFORE_NET sans GAP_RECAP_ROW supplementaire.
  const recapH = GAP_RECAP_ROW * (1 + nbTvaPre + nbDeductionsPre) + 2 + GAP_BEFORE_NET + 13 + GAP_AFTER_NET + echelonH
  // V3.0c.15 : marges symetriques top=bottom=5mm pour cadre "pile-poil" sur le contenu.
  const recapPadTop = 0
  const recapPadInternalTop = 5
  const recapPadBottom = 5
  setFill(doc, P.skyVeryPale)
  doc.roundedRect(
    RIGHT_X - 2,
    yStart - recapPadTop,
    COL_W + 4,
    recapH + recapPadInternalTop + recapPadBottom,
    3,
    3,
    'F',
  )

  // Contenu : commence 7mm sous le sommet du cadre
  let y = yStart + recapPadInternalTop
  drawRecapRow(
    doc,
    isForfait ? 'Forfait global HT' : 'Sous-total HT',
    fmt(data.montant_ht),
    y,
    { boldValue: true },
    P,
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
    drawTvaRow(doc, label, sub, fmt(tvaGroups[r]), y, P)
    y += GAP_RECAP_ROW
  }

  // V3.0c.6 Fix D : trait fin separateur, decale pour ne pas chevaucher Total TTC
  // (le texte 9pt s'etend de y-3.2 a y, donc trait a y-4 laisse 0.8mm de marge)
  y += 2 // marge supplementaire entre derniere TVA et Total TTC
  setDraw(doc, P.border)
  doc.setLineWidth(0.3)
  doc.line(RIGHT_X, y - 4, RIGHT_VALUE_X, y - 4)

  // Total TTC
  drawRecapRow(doc, 'Total TTC', fmt(data.montant_ttc), y, {
    boldValue: true,
    labelBold: true,
    sizeBoost: true,
  }, P)
  y += GAP_BEFORE_NET

  // V2 imputation — Deductions de reglement (ex. avoir d'un autre dossier impute
  // en paiement). Affichees APRES le Total TTC (qui reste plein = CA/TVA justes),
  // AVANT le bloc Net a payer. Jamais sur un avoir.
  const deductions = (!data.isAvoir && data.deductions) ? data.deductions : []
  for (const d of deductions) {
    drawRecapRow(doc, d.label, `- ${fmt(d.montant)}`, y, {}, P)
    y += GAP_RECAP_ROW
  }
  // Net reel a afficher dans le bloc orange : net apres deductions si fourni.
  const netToShow = (!data.isAvoir && data.netAPayer != null) ? data.netAPayer : data.montant_ttc

  // Bloc NET A PAYER orange plein (montant = Total TTC complet, jamais l'acompte)
  // V3.0d : fond = P.netPayer (configurable), texte = P.netPayerInk (auto contraste).
  // Note : en mode default Nexartis (P.netPayer = #e87a2a orange clair), l'ink calcule
  // est sombre #1c1304 (calque exact du rendu HTML --accent2-ink), donc parite HTML/PDF.
  const acompteTTC = acompteTTCpre
  const netH = 13
  setFill(doc, P.netPayer)
  doc.roundedRect(RIGHT_X, y, COL_W, netH, 3, 3, 'F')

  const netLabel = data.netLabel || 'Net à payer'
  font(doc, 'Hanken Grotesk', 'semibold', 9, P.netPayerInk)
  doc.text(netLabel, RIGHT_X + 4, y + netH / 2 + 1.2)

  font(doc, 'Hanken Grotesk', 'extrabold', 15, P.netPayerInk)
  textRight(doc, fmt(netToShow), RIGHT_VALUE_X - 4, y + netH / 2 + 2.2)
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
    setDraw(doc, P.borderSky)
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
      P,
    )
    drawSplitRow(
      doc,
      'Reste dû à la livraison',
      fmt(reste),
      boxY + padInner + 3 + lineGap,
      lineX,
      valueX,
      P,
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
  P: Palette = C,
): void {
  font(doc, 'Hanken Grotesk', 'normal', 8, P.muted)
  doc.text(label, xLabel, y)
  font(doc, 'Hanken Grotesk', 'semibold', 8.5, P.navy)
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
  P: Palette = C,
): void {
  const labelSize = opts.sizeBoost ? 9 : 8.5
  const valueSize = opts.sizeBoost ? 9 : 8.5
  font(
    doc,
    'Hanken Grotesk',
    opts.labelBold ? 'semibold' : 'normal',
    labelSize,
    opts.labelBold ? P.navy : P.muted,
  )
  doc.text(label, RIGHT_X, y)

  font(
    doc,
    'Hanken Grotesk',
    opts.boldValue ? 'bold' : 'normal',
    valueSize,
    P.navy,
  )
  textRight(doc, value, RIGHT_VALUE_X, y)
}

function drawTvaRow(
  doc: jsPDF,
  label: string,
  sub: string,
  value: string,
  y: number,
  P: Palette = C,
): void {
  font(doc, 'Hanken Grotesk', 'normal', 8.5, P.muted)
  doc.text(label, RIGHT_X, y)
  // V3.0c.2 fix : mesurer le label AVEC un espace pour eviter "%(base..."
  const labelW = doc.getTextWidth(label + ' ')
  if (sub) {
    font(doc, 'Hanken Grotesk', 'normal', 7.5, P.muted)
    doc.text(sub.trimStart(), RIGHT_X + labelW, y)
  }
  font(doc, 'Hanken Grotesk', 'bold', 8.5, P.navy)
  textRight(doc, value, RIGHT_VALUE_X, y)
}

function formatRate(r: number): string {
  if (r === 5.5) return '5,5 %'
  return `${String(r).replace('.', ',')} %`
}
