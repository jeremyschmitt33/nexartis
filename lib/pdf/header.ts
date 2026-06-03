// lib/pdf/header.ts - V3.0c
// Bandeau navy plein largeur de la page 1 + accent orange parallelogramme
// + carte blanche logo + nom artisan + baseline + titre + pastille numero + dates.

import type { jsPDF } from 'jspdf'
import { C } from './palette'
import { font, setFill, textRight, textCentered, roundedFill, fmtDate } from './utils'

interface HeaderEntreprise {
  nom?: string
  metier?: string
  logo_url?: string
}

/**
 * Dessine le header pleine largeur (58 mm de haut) sur la page courante.
 *
 * @param title       "DEVIS" | "FACTURE" | "FACTURE DE SITUATION"
 * @param numero      numero du document (ex "D-2026-001")
 * @param dateGauche  date emission (ex "03/06/2026")
 * @param labelGauche "Émis le" par defaut
 * @param dateDroite  2e date (validite ou echeance)
 * @param labelDroite "Valable jusqu'au" pour devis, "Échéance" pour facture
 *
 * @returns y absolu apres le header (= 58 si header dessine).
 */
export function drawHeader(
  doc: jsPDF,
  ent: HeaderEntreprise,
  title: string,
  numero: string,
  dateGauche: string,
  labelGauche: string,
  dateDroite: string,
  labelDroite: string,
): number {
  const pageW = 210
  const headerH = 58

  // === 1. Bandeau navy plein largeur ===
  setFill(doc, C.navy)
  doc.rect(0, 0, pageW, headerH, 'F')

  // === 2. Accent orange : bande diagonale etroite (4mm) qui SEPARE la zone
  // gauche (logo + nom) de la zone droite (DEVIS + pastille + dates).
  // Points : (135, 0) -> (139, 0) -> (119, 58) -> (115, 58)
  setFill(doc, C.orange)
  doc.lines(
    [
      [4, 0],     // (135,0) -> (139,0)
      [-20, 58],  // (139,0) -> (119,58)
      [-4, 0],    // (119,58) -> (115,58)
      [20, -58],  // (115,58) -> (135,0) retour
    ],
    135, 0,
    [1, 1],
    'F',
    true,
  )

  // === 3. Carte blanche logo (22x22 mm) ===
  const logoCardX = 12
  const logoCardY = 14
  const logoCardSize = 22
  roundedFill(doc, logoCardX, logoCardY, logoCardSize, logoCardSize, 4, C.white)

  // Logo entreprise (data:image base64 seulement, sinon placeholder discret)
  if (ent.logo_url && ent.logo_url.startsWith('data:image')) {
    try {
      const logoFormat = ent.logo_url.includes('image/png') ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(ent.logo_url)
      const maxSide = 16
      let lw = maxSide
      let lh = maxSide
      if (props.width >= props.height) {
        lh = (props.height / props.width) * maxSide
      } else {
        lw = (props.width / props.height) * maxSide
      }
      const lx = logoCardX + (logoCardSize - lw) / 2
      const ly = logoCardY + (logoCardSize - lh) / 2
      doc.addImage(ent.logo_url, logoFormat, lx, ly, lw, lh)
    } catch {
      // Placeholder discret : initiale du nom artisan
      drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize)
    }
  } else {
    drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize)
  }

  // === 4. Nom artisan + baseline (a droite de la carte logo) ===
  const textLeftX = 40
  font(doc, 'Hanken Grotesk', 'extrabold', 16, C.white)
  doc.text(ent.nom || 'Votre entreprise', textLeftX, 23)

  if (ent.metier && ent.metier.trim()) {
    font(doc, 'Hanken Grotesk', 'normal', 9, C.whiteSoft)
    doc.text(ent.metier.trim(), textLeftX, 29)
  }

  // === 5. Titre + pastille numero (cote droit, apres la bande orange a x>=139) ===
  const rightAnchorX = 200
  // Auto-resize pour titres longs ("FACTURE DE SITUATION")
  const titleSize = title.length > 14 ? 22 : 32
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, C.white)
  textRight(doc, title, rightAnchorX, 24)

  // Pastille orange numero (centree dans la zone droite : x=143 -> x=198)
  const pillX = 143
  const pillY = 32
  const pillW = 55
  const pillH = 9
  roundedFill(doc, pillX, pillY, pillW, pillH, 3, C.orange)
  font(doc, 'Hanken Grotesk', 'bold', 10.5, C.navy)
  textCentered(doc, numero, pillX + pillW / 2, pillY + 6.5)

  // === 6. Dates sur 2 lignes (y=48 et y=53), right-aligned a x=200 ===
  // Ligne 1 : "Émis le 03/06/2026"
  // Ligne 2 : "Valable jusqu'au 18/06/2026"
  type DatePiece = { txt: string; size: number; weight: 'normal' | 'bold'; color: typeof C.white }

  function drawDateLine(pieces: DatePiece[], yLine: number): void {
    let totalW = 0
    for (const p of pieces) {
      font(doc, 'Hanken Grotesk', p.weight, p.size, p.color)
      totalW += doc.getTextWidth(p.txt)
    }
    let cursorX = rightAnchorX - totalW
    for (const p of pieces) {
      font(doc, 'Hanken Grotesk', p.weight, p.size, p.color)
      doc.text(p.txt, cursorX, yLine)
      cursorX += doc.getTextWidth(p.txt)
    }
  }

  if (dateGauche) {
    drawDateLine(
      [
        { txt: labelGauche + ' ', size: 8, weight: 'normal', color: C.whiteSoft },
        { txt: dateGauche, size: 8.5, weight: 'bold', color: C.white },
      ],
      48,
    )
  }
  if (dateDroite) {
    drawDateLine(
      [
        { txt: labelDroite + ' ', size: 8, weight: 'normal', color: C.whiteSoft },
        { txt: dateDroite, size: 8.5, weight: 'bold', color: C.white },
      ],
      53,
    )
  }

  return headerH
}

/**
 * Placeholder discret : carre cream avec initiale du nom artisan en navy.
 * Utilise quand entreprise.logo_url est absent ou invalide.
 */
function drawLogoPlaceholder(
  doc: jsPDF,
  nomEntreprise: string | undefined,
  x: number,
  y: number,
  size: number,
): void {
  // Fond cream (deja blanc par la carte au-dessus, on dessine une fine bordure)
  setFill(doc, C.placeholder)
  doc.roundedRect(x + 2, y + 2, size - 4, size - 4, 2, 2, 'F')

  const initiale = (nomEntreprise || 'A').trim().charAt(0).toUpperCase() || 'A'
  font(doc, 'Hanken Grotesk', 'extrabold', 14, C.navy)
  textCentered(doc, initiale, x + size / 2, y + size / 2 + 4)
}

/**
 * Mini-header pages 2+ : un trait fin border + nom artisan + numero + date emission.
 * A appeler APRES le rendu complet (toutes pages connues).
 */
export function drawMiniHeaderPages2Plus(
  doc: jsPDF,
  ent: HeaderEntreprise,
  title: string,
  numero: string,
  dateEmission?: string,
): void {
  const total = doc.getNumberOfPages()
  if (total < 2) return
  const dateStr = dateEmission ? fmtDate(dateEmission) : ''

  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    // Mini-header discret : pas de trait, texte 7pt muted right-aligned x=192, y=10
    font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
    const parts: string[] = []
    if (ent.nom) parts.push(ent.nom)
    parts.push(`${title === 'DEVIS' ? 'Devis' : 'Facture'} ${numero}`)
    if (dateStr) parts.push(dateStr)
    textRight(doc, parts.join('   ·   '), 192, 10)
  }
}
