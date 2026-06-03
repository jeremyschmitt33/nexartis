// lib/pdf/signatures.ts - V3.0c
// 2 encadres blancs traits PLEINS (pas pointilles) cote a cote.
// Insertion signature client (gauche) et signature/tampon artisan (droite).

import type { jsPDF } from 'jspdf'
import { C } from './palette'
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
 * Dessine la zone signatures sur la page COURANTE (le caller decide si une
 * nouvelle page est necessaire). Retourne le nouveau y.
 */
export function drawSignatures(
  doc: jsPDF,
  ent: SigEntreprise,
  data: SigData,
  yStart: number,
): number {
  const M = 18
  const W = 174
  const sigW = (W - 6) / 2
  const sigH = 35

  const leftX = M
  const rightX = M + sigW + 6
  const y = yStart

  // === Cadre gauche : Bon pour accord — Le client ===
  drawSignatureCard(
    doc,
    leftX, y, sigW, sigH,
    'Bon pour accord — Le client',
    'Date, mention "Bon pour accord" et signature',
  )
  // Si signature client presente, l'inserer dans le cadre
  if (data.client_signature_base64) {
    insertImage(doc, data.client_signature_base64, leftX + 4, y + 10, sigW - 8, sigH - 16)
  }
  // Si signe : on peut afficher la date de signature en bas
  const isAccepte = data.statut === 'signe' || data.statut === 'facture'
  if (isAccepte && !data.client_signature_base64) {
    font(doc, 'Hanken Grotesk', 'bold', 9, C.navy)
    textCentered(doc, 'Bon pour accord', leftX + sigW / 2, y + sigH / 2 + 1)
  }
  if (isAccepte && data.date_signature) {
    font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
    textCentered(doc, `Le ${fmtDate(data.date_signature)}`, leftX + sigW / 2, y + sigH - 3)
  }

  // === Cadre droit : Nom artisan + Signature & cachet ===
  drawSignatureCard(
    doc,
    rightX, y, sigW, sigH,
    ent.nom || '',
    'Signature & cachet de l\'entreprise',
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
): void {
  // Fond blanc + traits PLEINS border
  setFill(doc, C.white)
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 4, 4, 'FD')

  // Titre
  font(doc, 'Hanken Grotesk', 'bold', 8.5, C.navy)
  doc.text(title, x + 4, y + 5)

  // Sous-titre
  font(doc, 'Hanken Grotesk', 'normal', 7.5, C.muted)
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
