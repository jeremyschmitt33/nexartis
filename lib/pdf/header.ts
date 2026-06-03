// lib/pdf/header.ts - V3.0c.2
// Bandeau navy plein largeur de la page 1 + accent orange parallelogramme
// + carte blanche logo + nom artisan + baseline + titre + pastille numero + dates.
//
// V3.0c.2 : logo agrandi 28mm, nom 20pt, baseline 11pt, pastille adaptative,
// DEVIS centre sur l'axe de la pastille.

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

  // === 3. Carte blanche logo (28x28 mm) — V3.0c.2 agrandie ===
  const logoCardX = 12
  const logoCardY = 12
  const logoCardSize = 28
  roundedFill(doc, logoCardX, logoCardY, logoCardSize, logoCardSize, 5, C.white)

  // Logo entreprise (data:image base64 seulement, sinon placeholder discret)
  if (ent.logo_url && ent.logo_url.startsWith('data:image')) {
    try {
      const logoFormat = ent.logo_url.includes('image/png') ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(ent.logo_url)
      const maxSide = 22
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
      drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize)
    }
  } else {
    drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize)
  }

  // === 4. Nom artisan + baseline (a droite de la carte logo) — V3.0c.2 ===
  // Logo 28mm + 6mm de gap = nom commence a x=46
  const textLeftX = 46
  font(doc, 'Hanken Grotesk', 'extrabold', 20, C.white)
  doc.text(ent.nom || 'Votre entreprise', textLeftX, 24)

  if (ent.metier && ent.metier.trim()) {
    font(doc, 'Hanken Grotesk', 'normal', 11, C.whiteSoft)
    doc.text(ent.metier.trim(), textLeftX, 32)
  }

  // === 5. Titre + pastille numero (zone droite x=139→210) — V3.0c.2 ===
  // Pastille compacte adaptative + DEVIS centre sur l'axe de la pastille.
  const rightAnchorX = 200
  font(doc, 'Hanken Grotesk', 'bold', 10.5, C.navy)
  const numeroW = doc.getTextWidth(numero)
  const pillW = Math.max(numeroW + 10, 32) // padding 5mm chaque cote, min 32mm
  const pillH = 9
  // Zone droite utile : x=139 -> x=200, centre = 169.5
  const zoneRightCenter = 169.5
  const pillX = zoneRightCenter - pillW / 2
  const pillY = 32
  roundedFill(doc, pillX, pillY, pillW, pillH, 3, C.orange)
  textCentered(doc, numero, zoneRightCenter, pillY + 6.5)

  // Titre DEVIS / FACTURE centre sur le meme axe vertical que la pastille
  // (au-dessus). Auto-resize pour "FACTURE DE SITUATION".
  const titleSize = title.length > 14 ? 20 : 30
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, C.white)
  textCentered(doc, title, zoneRightCenter, 24)

  // === 6. Dates sur 2 lignes (y=48.5 et y=53.5), right-aligned a x=200 ===
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
      48.5,
    )
  }
  if (dateDroite) {
    drawDateLine(
      [
        { txt: labelDroite + ' ', size: 8, weight: 'normal', color: C.whiteSoft },
        { txt: dateDroite, size: 8.5, weight: 'bold', color: C.white },
      ],
      53.5,
    )
  }

  return headerH
}

/**
 * Placeholder discret : carre cream avec initiale du nom artisan en navy.
 * Utilise quand entreprise.logo_url est absent ou invalide.
 * V3.0c.2 : taille de l'initiale proportionnelle a la carte.
 */
function drawLogoPlaceholder(
  doc: jsPDF,
  nomEntreprise: string | undefined,
  x: number,
  y: number,
  size: number,
): void {
  setFill(doc, C.placeholder)
  doc.roundedRect(x + 2, y + 2, size - 4, size - 4, 2, 2, 'F')

  const initiale = (nomEntreprise || 'A').trim().charAt(0).toUpperCase() || 'A'
  // V3.0c.2 : 14pt etait dimensionne pour size=22, on extrapole.
  const fontSize = Math.round((size / 22) * 14)
  font(doc, 'Hanken Grotesk', 'extrabold', fontSize, C.navy)
  textCentered(doc, initiale, x + size / 2, y + size / 2 + fontSize * 0.3)
}

/**
 * Mini-header pages 2+ : nom artisan + numero + date emission, en haut a droite.
 * V3.0c.2 : reduit a 7pt, separateur bullet, pas de trait sous.
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
    font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
    const parts: string[] = []
    if (ent.nom) parts.push(ent.nom)
    parts.push(`${title === 'DEVIS' ? 'Devis' : 'Facture'} ${numero}`)
    if (dateStr) parts.push(dateStr)
    textRight(doc, parts.join('  •  '), 192, 10)
  }
}
