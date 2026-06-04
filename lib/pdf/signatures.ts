// lib/pdf/signatures.ts - V3.0c.1
// 2 encadres blancs traits PLEINS cote a cote. Saut de page auto si y > 230.

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
import { font, setDraw, setFill, textCentered, fmtDate } from './utils'

interface SigEntreprise {
  nom?: string
  signature_base64?: string
  tampon_base64?: string
}

interface SigData {
  statut?: string
  date_signature?: string
  client_signature_base64?: string
}

/**
 * Dessine la zone signatures. Si yStart > 230 (manque de place pour les 35mm
 * + 20mm de marge basse), ajoute automatiquement une page et dessine a y=30.
 */
export function drawSignatures(
  doc: jsPDF,
  ent: SigEntreprise,
  data: SigData,
  yStart: number,
  palette: Palette = C,
): number {
  const P = palette
  const M = 18
  const W = 174
  const sigW = (W - 6) / 2
  const sigH = 35

  let y = yStart
  if (y > 230) {
    doc.addPage()
    y = 30
  }

  const leftX = M
  const rightX = M + sigW + 6

  // Cadre gauche : Bon pour accord — Le client
  drawSignatureCard(
    doc,
    leftX, y, sigW, sigH,
    'Bon pour accord — Le client',
    'Date, mention "Bon pour accord" et signature',
    P,
  )
  if (data.client_signature_base64) {
    insertImage(doc, data.client_signature_base64, leftX + 4, y + 10, sigW - 8, sigH - 16)
  }
  const isAccepte = data.statut === 'signe' || data.statut === 'facture'
  if (isAccepte && !data.client_signature_base64) {
    font(doc, 'Hanken Grotesk', 'bold', 9, P.navy)
    textCentered(doc, 'Bon pour accord', leftX + sigW / 2, y + sigH / 2 + 1)
  }
  if (isAccepte && data.date_signature) {
    font(doc, 'Hanken Grotesk', 'normal', 7, P.muted)
    textCentered(doc, `Le ${fmtDate(data.date_signature)}`, leftX + sigW / 2, y + sigH - 3)
  }

  // Cadre droit : Nom artisan + Signature & cachet
  drawSignatureCard(
    doc,
    rightX, y, sigW, sigH,
    ent.nom || '',
    'Signature & cachet de l\'entreprise',
    P,
  )
  const artisanVisual = ent.signature_base64 || ent.tampon_base64
  if (artisanVisual) {
    insertImage(doc, artisanVisual, rightX + 4, y + 10, sigW - 8, sigH - 16)
  }

  return y + sigH + 4
}

function drawSignatureCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  P: Palette,
): void {
  setFill(doc, P.white)
  setDraw(doc, P.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 4, 4, 'FD')

  font(doc, 'Hanken Grotesk', 'bold', 8.5, P.navy)
  doc.text(title, x + 4, y + 5)

  font(doc, 'Hanken Grotesk', 'normal', 7.5, P.muted)
  doc.text(subtitle, x + 4, y + 8.5, { maxWidth: w - 8 })
}

function insertImage(
  doc: jsPDF,
  imgB64: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): void {
  if (!imgB64 || !imgB64.startsWith('data:image')) return
  try {
    const props = doc.getImageProperties(imgB64)
    const ratio = props.width / props.height
    let w = maxW
    let h = w / ratio
    if (h > maxH) { h = maxH; w = h * ratio }
    const cx = x + (maxW - w) / 2
    const cy = y + (maxH - h) / 2
    const fmt = imgB64.includes('image/png') ? 'PNG' : 'JPEG'
    doc.addImage(imgB64, fmt, cx, cy, w, h)
  } catch {
    // image corrompue : on ignore
  }
}
