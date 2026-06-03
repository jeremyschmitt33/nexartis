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

  // === 2. Accent orange diagonal a droite (parallelogramme incline) ===
  // Points : (155, 0) -> (180, 0) -> (165, 58) -> (140, 58)
  setFill(doc, C.orange)
  // jsPDF n'a pas polygon natif fiable, on utilise lines() depuis un point de depart.
  // lines([[dx,dy],...], x, y, scale, style, closed)
  doc.lines(
    [
      [25, 0],    // (155,0) -> (180,0)
      [-15, 58],  // (180,0) -> (165,58)
      [-25, 0],   // (165,58) -> (140,58)
      [15, -58],  // (140,58) -> (155,0)  retour
    ],
    155, 0,
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

  // === 5. Titre + pastille numero (cote droit) ===
  const rightAnchorX = 174
  // Auto-resize pour titres longs ("FACTURE DE SITUATION")
  const titleSize = title.length > 14 ? 22 : 32
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, C.white)
  textRight(doc, title, rightAnchorX, 20)

  // Pastille orange numero
  const pillW = 70
  const pillX = rightAnchorX - pillW
  const pillY = 26
  roundedFill(doc, pillX, pillY, pillW, 8.5, 3, C.orange)
  font(doc, 'Hanken Grotesk', 'bold', 11, C.navy)
  textCentered(doc, numero, pillX + pillW / 2, pillY + 5.8)

  // === 6. Dates (ligne y=47, right-aligned a x=174) ===
  // Format compose : "Émis le 03/06/2026  ·  Valable jusqu'au 18/06/2026"
  // On mesure pour positionner correctement chaque morceau a droite.
  const datesY = 47

  // Construction des morceaux avec leur style cible
  type DatePiece = { txt: string; size: number; weight: 'normal' | 'bold'; color: typeof C.white }
  const pieces: DatePiece[] = []
  if (dateGauche) {
    pieces.push({ txt: labelGauche + ' ', size: 8, weight: 'normal', color: C.whiteSoft })
    pieces.push({ txt: dateGauche, size: 8.5, weight: 'bold', color: C.white })
  }
  if (dateDroite) {
    if (pieces.length > 0) {
      pieces.push({ txt: '   ·   ', size: 8, weight: 'normal', color: C.whiteSoft })
    }
    pieces.push({ txt: labelDroite + ' ', size: 8, weight: 'normal', color: C.whiteSoft })
    pieces.push({ txt: dateDroite, size: 8.5, weight: 'bold', color: C.white })
  }

  // Mesure totale de la ligne (en se posant en NORMAL pour la mesure)
  let totalW = 0
  for (const p of pieces) {
    font(doc, 'Hanken Grotesk', p.weight, p.size, p.color)
    totalW += doc.getTextWidth(p.txt)
  }

  let cursorX = rightAnchorX - totalW
  for (const p of pieces) {
    font(doc, 'Hanken Grotesk', p.weight, p.size, p.color)
    doc.text(p.txt, cursorX, datesY)
    cursorX += doc.getTextWidth(p.txt)
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
  const pageW = 210
  const M = 18
  const dateStr = dateEmission ? fmtDate(dateEmission) : ''

  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    // Trait border 0.3 mm a y=14
    doc.setDrawColor(C.border[0], C.border[1], C.border[2])
    doc.setLineWidth(0.3)
    doc.line(M, 14, pageW - M, 14)

    // Texte right-aligned x=192, y=10
    font(doc, 'Hanken Grotesk', 'normal', 8, C.muted)
    const parts: string[] = []
    if (ent.nom) parts.push(ent.nom)
    parts.push(`${title === 'DEVIS' ? 'Devis' : 'Facture'} ${numero}`)
    if (dateStr) parts.push(dateStr)
    textRight(doc, parts.join('   ·   '), 192, 10)
  }
}
