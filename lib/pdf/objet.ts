// lib/pdf/objet.ts - V3.0c.1
// Bandeau OBJET + ADRESSE DU CHANTIER (fond skyVeryPale + trait orange gauche).

import type { jsPDF } from 'jspdf'
import { C } from './palette'
import { font, setFill } from './utils'

const FULL_W = 174
const COL_W = 84
const GAP = 6
const X = 18
const LEFT_BAR_W = 2

function drawBandeau(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  valeur: string,
): number {
  const innerX = x + LEFT_BAR_W + 4
  const innerW = w - LEFT_BAR_W - 8
  const split = doc.splitTextToSize(valeur, innerW)
  const lines = Math.max(split.length, 1)
  const h = Math.max(14, 10 + lines * 4.5)

  setFill(doc, C.skyVeryPale)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')
  setFill(doc, C.orange)
  doc.rect(x, y, LEFT_BAR_W, h, 'F')

  font(doc, 'Hanken Grotesk', 'semibold', 7.5, C.muted)
  doc.text(label, innerX, y + 5, { charSpace: 0.6 })

  font(doc, 'Hanken Grotesk', 'bold', 12, C.navy)
  doc.text(split, innerX, y + 10)

  return h
}

export function drawObjet(
  doc: jsPDF,
  objet: string | undefined,
  chantierAdresse: string | undefined,
  yStart: number,
): number {
  if (!objet && !chantierAdresse) return yStart
  const objetLen = (objet || '').length
  const twoCols = !!objet && !!chantierAdresse && objetLen < 100
  if (twoCols) {
    const hL = drawBandeau(doc, X, yStart, COL_W, 'OBJET', objet!)
    const hR = drawBandeau(doc, X + COL_W + GAP, yStart, COL_W, 'ADRESSE DU CHANTIER', chantierAdresse!)
    return yStart + Math.max(hL, hR)
  }
  let y = yStart
  if (objet) y += drawBandeau(doc, X, y, FULL_W, 'OBJET', objet)
  if (chantierAdresse) {
    if (objet) y += 4
    y += drawBandeau(doc, X, y, FULL_W, 'ADRESSE DU CHANTIER', chantierAdresse)
  }
  return y
}
