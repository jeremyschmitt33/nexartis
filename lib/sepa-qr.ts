// ---------------------------------------------------------------------------
// QR code de paiement SEPA (virement) pour les factures.
// Le client scanne le QR avec son application bancaire -> le virement est
// pre-rempli (beneficiaire, IBAN, montant, reference). Zero commission, zero
// prestataire de paiement : c'est un simple virement SEPA standard (norme EPC).
// ---------------------------------------------------------------------------

import type { jsPDF } from 'jspdf'
import * as QRCode from 'qrcode'

export interface SepaQrInput {
  /** Nom du beneficiaire (l'artisan / l'entreprise). */
  name: string
  /** IBAN du beneficiaire (espaces tolerees, retirees ici). */
  iban: string
  /** Montant a payer en euros (> 0). */
  amount: number
  /** Reference libre (ex: numero de facture). */
  reference: string
}

/**
 * Construit la charge utile EPC (European Payments Council) encodee dans le QR.
 * Format standard reconnu par les applications bancaires francaises/europeennes.
 */
export function buildSepaQrPayload(input: SepaQrInput): string {
  const name = (input.name || '').slice(0, 70)
  const iban = (input.iban || '').replace(/\s+/g, '').toUpperCase()
  const amount = `EUR${input.amount.toFixed(2)}`
  const remittance = (input.reference || '').slice(0, 140)
  return [
    'BCD', // Service Tag
    '002', // Version
    '1', // Jeu de caracteres (UTF-8)
    'SCT', // Identification (SEPA Credit Transfer)
    '', // BIC (optionnel : l'IBAN suffit)
    name, // Beneficiaire
    iban, // IBAN
    amount, // Montant
    '', // Purpose
    '', // Reference structuree
    remittance, // Reference non structuree (ex: Facture F001/2026)
  ].join('\n')
}

/** Indique si on peut generer un QR (IBAN + montant valides). */
export function canDrawSepaQr(iban?: string | null, amount?: number | null): boolean {
  const clean = (iban || '').replace(/\s+/g, '')
  return clean.length >= 15 && typeof amount === 'number' && amount >= 0.01 && amount <= 999999999.99
}

/** Dessine la matrice QR (carre sizeMm) en (x,y) avec des rectangles noirs. */
function drawQrMatrix(doc: jsPDF, x: number, y: number, sizeMm: number, payload: string): void {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const count = qr.modules.size
  const data = qr.modules.data
  const quiet = 2
  const total = count + quiet * 2
  const m = sizeMm / total
  doc.setFillColor(255, 255, 255)
  doc.rect(x, y, sizeMm, sizeMm, 'F')
  doc.setFillColor(0, 0, 0)
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (data[r * count + c]) {
        doc.rect(x + (c + quiet) * m, y + (r + quiet) * m, m, m, 'F')
      }
    }
  }
}

/**
 * Dessine le bloc "Paiement par virement" (titre + QR + infos) a partir de y.
 * Renvoie la nouvelle position y. Gere un saut de page si pas assez de place.
 */
export function drawSepaPaymentBlock(
  doc: jsPDF,
  input: SepaQrInput,
  y: number,
): number {
  const QR = 30 // mm
  const blockH = QR + 8
  // Saut de page si le bloc ne tient pas avant le pied de page.
  if (y + blockH > 280) {
    doc.addPage()
    y = 25
  }

  let top = y + 4
  // Titre
  doc.setDrawColor(220, 220, 220)
  doc.line(15, top, 195, top)
  top += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 26, 58)
  doc.text('PAIEMENT PAR VIREMENT', 15, top)

  // QR a gauche
  const qrY = top + 3
  drawQrMatrix(doc, 15, qrY, QR, buildSepaQrPayload(input))

  // Infos a droite
  const tx = 15 + QR + 6
  let ty = qrY + 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  const intro = doc.splitTextToSize(
    'Scannez ce QR avec votre application bancaire : le virement est pre-rempli (montant, beneficiaire et reference).',
    195 - tx,
  )
  doc.text(intro, tx, ty)
  ty += intro.length * 4 + 1
  doc.setTextColor(15, 26, 58)
  doc.text(`Beneficiaire : ${input.name}`, tx, ty)
  ty += 4
  doc.text(`IBAN : ${(input.iban || '').replace(/\s+/g, '')}`, tx, ty)
  ty += 4
  doc.setFont('helvetica', 'bold')
  doc.text(`Montant : ${input.amount.toFixed(2)} EUR`, tx, ty)
  ty += 4
  doc.setFont('helvetica', 'normal')
  doc.text(`Reference : ${input.reference}`, tx, ty)

  return qrY + QR + 4
}
