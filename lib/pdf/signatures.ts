// lib/pdf/signatures.ts - V3.0d
// 2 encadres blancs traits PLEINS cote a cote. Saut de page auto si y > 215.
// V3.0d : signatures AGRANDIES (35mm -> 50mm, image x2 surface visible).
// Quand une image artisan est presente, le sous-titre disparait pour donner
// toute la place au visuel (parite HTML : .dv-sign-img max-height augmente).

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
 * Dessine la zone signatures. Si yStart > 215 (manque de place pour les 50mm
 * + ~17mm de footer + marge basse), ajoute automatiquement une page.
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
  // V3.0d : 35mm -> 50mm. Garde-fou saut de page abaisse de 230 -> 215mm.
  const sigH = 50

  let y = yStart
  if (y > 215) {
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
    !!data.client_signature_base64,
  )
  if (data.client_signature_base64) {
    // V3.0d : zone image agrandie (passe de 19mm a 38mm de hauteur).
    insertImage(doc, data.client_signature_base64, leftX + 4, y + 8, sigW - 8, sigH - 12)
  }
  const isAccepte = data.statut === 'signe' || data.statut === 'facture'
  if (isAccepte && !data.client_signature_base64) {
    font(doc, 'Hanken Grotesk', 'bold', 11, P.navy)
    textCentered(doc, 'Bon pour accord', leftX + sigW / 2, y + sigH / 2 + 1)
  }
  if (isAccepte && data.date_signature) {
    font(doc, 'Hanken Grotesk', 'normal', 7, P.muted)
    textCentered(doc, `Le ${fmtDate(data.date_signature)}`, leftX + sigW / 2, y + sigH - 3)
  }

  // Cadre droit : Nom artisan + Signature & cachet
  const artisanVisual = ent.signature_base64 || ent.tampon_base64
  drawSignatureCard(
    doc,
    rightX, y, sigW, sigH,
    ent.nom || '',
    'Signature & cachet de l\'entreprise',
    P,
    !!artisanVisual,
  )
  if (artisanVisual) {
    // V3.0d : zone image agrandie (passe de 19mm a 38mm de hauteur).
    insertImage(doc, artisanVisual, rightX + 4, y + 8, sigW - 8, sigH - 12)
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
  // V3.0d : si une image est dessinee dans le cadre, on cache le sous-titre pour
  // donner toute la zone visuelle a la signature (sinon elle se retrouve coincee
  // entre le titre et le sous-titre, donc rapetissee).
  hasImage: boolean = false,
): void {
  setFill(doc, P.white)
  setDraw(doc, P.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 4, 4, 'FD')

  font(doc, 'Hanken Grotesk', 'bold', 8.5, P.navy)
  doc.text(title, x + 4, y + 5)

  if (!hasImage) {
    font(doc, 'Hanken Grotesk', 'normal', 7.5, P.muted)
    doc.text(subtitle, x + 4, y + 8.5, { maxWidth: w - 8 })
  }
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
