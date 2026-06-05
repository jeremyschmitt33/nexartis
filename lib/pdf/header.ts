// lib/pdf/header.ts - V3.1.4
// Bandeau a 2 zones distinctes (gauche + droite) separees par la barre doree
// + carte logo + nom artisan + titre + pastille numero + dates.
//
// V3.1.4 : RESTAURATION valeurs d'origine (b9455df) qui marchaient.
//   - logoCardSize a 100% = 28mm (classique), 22mm (minimaliste)
//   - logoCardX = 12, logoCardY = 12 (fixe, pas de calcul dynamique)
//   - nomFontSize a 100% = 20pt, y = 24 (fixe)
//   - sliders clampes a 70-130 pour ne JAMAIS deborder du bandeau de 58mm

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
import { font, setFill, textRight, textCentered, roundedFill, fmtDate } from './utils'

interface HeaderEntreprise {
  nom?: string
  metier?: string
  logo_url?: string
  doc_logo_style?: 'carte-classique' | 'carte-minimaliste' | 'sans-carte' | null
  doc_logo_size?: number | null
  doc_nom_size?: number | null
}

export function drawHeader(
  doc: jsPDF,
  ent: HeaderEntreprise,
  title: string,
  numero: string,
  dateGauche: string,
  labelGauche: string,
  dateDroite: string,
  labelDroite: string,
  palette: Palette = C,
): number {
  const P = palette
  const pageW = 210
  const headerH = 58

  // Zone GAUCHE (navy)
  setFill(doc, P.navy)
  doc.lines(
    [[137, 0], [-20, 58], [-117, 0], [0, -58]],
    0, 0, [1, 1], 'F', true,
  )

  // Zone DROITE (navyDroite)
  setFill(doc, P.navyDroite)
  doc.lines(
    [[pageW - 137, 0], [0, 58], [-(pageW - 117), 0], [20, -58]],
    137, 0, [1, 1], 'F', true,
  )

  // Barre doree (accent) - separateur diagonal
  setFill(doc, P.orange)
  doc.lines(
    [[4, 0], [-20, 58], [-4, 0], [20, -58]],
    135, 0, [1, 1], 'F', true,
  )

  // === Carte logo : V3.1.4 RESTAURATION valeurs origine ===
  const logoStyle = ent.doc_logo_style ?? 'carte-classique'
  const rawLogoSize = ent.doc_logo_size ?? 100
  const clampedLogoSize = Math.min(130, Math.max(70, rawLogoSize))
  const logoScale = clampedLogoSize / 100
  const baseSize = logoStyle === 'carte-minimaliste' ? 22 : 28
  const logoCardSize = baseSize * logoScale
  const logoCardX = 12
  const logoCardY = 12
  if (logoStyle !== 'sans-carte') {
    const radius = logoStyle === 'carte-minimaliste' ? 3 : 5
    roundedFill(doc, logoCardX, logoCardY, logoCardSize, logoCardSize, radius, P.white)
  }

  // Logo entreprise
  if (ent.logo_url && ent.logo_url.startsWith('data:image')) {
    try {
      const logoFormat = ent.logo_url.includes('image/png') ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(ent.logo_url)
      const maxSide = logoCardSize * 0.78
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
      drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize, P)
    }
  } else {
    drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize, P)
  }

  // === Nom artisan — V3.1.4 RESTAURATION ===
  const textLeftX = 12 + logoCardSize + 6
  const rawNomSize = ent.doc_nom_size ?? 100
  const clampedNomSize = Math.min(130, Math.max(70, rawNomSize))
  const nomScale = clampedNomSize / 100
  const nomBase = 20
  const nomMaxWidth = 135 - textLeftX - 2
  let nomFontSize = nomBase * nomScale
  font(doc, 'Hanken Grotesk', 'extrabold', nomFontSize, P.white)
  while (doc.getTextWidth(ent.nom || '') > nomMaxWidth && nomFontSize > 11) {
    nomFontSize -= 1
    font(doc, 'Hanken Grotesk', 'extrabold', nomFontSize, P.white)
  }
  doc.text(ent.nom || 'Votre entreprise', textLeftX, 24)

  // === Titre + pastille numero (zone droite) ===
  const rightAnchorX = 200
  font(doc, 'Hanken Grotesk', 'bold', 10.5, P.navy)
  const numeroW = doc.getTextWidth(numero)
  const pillW = Math.max(numeroW + 10, 32)
  const pillH = 9
  const zoneRightCenter = 169.5
  const pillX = zoneRightCenter - pillW / 2
  const pillY = 32
  roundedFill(doc, pillX, pillY, pillW, pillH, 3, P.orange)
  textCentered(doc, numero, zoneRightCenter, pillY + 6.5)

  const titleSize = title.length > 14 ? 20 : 30
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, P.white)
  textCentered(doc, title, zoneRightCenter, 24)

  // === Dates sur 2 lignes ===
  type DatePiece = { txt: string; size: number; weight: 'normal' | 'bold'; color: typeof P.white }

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
        { txt: labelGauche + ' ', size: 8, weight: 'normal', color: P.whiteSoft },
        { txt: dateGauche, size: 8.5, weight: 'bold', color: P.white },
      ],
      48.5,
    )
  }
  if (dateDroite) {
    drawDateLine(
      [
        { txt: labelDroite + ' ', size: 8, weight: 'normal', color: P.whiteSoft },
        { txt: dateDroite, size: 8.5, weight: 'bold', color: P.white },
      ],
      53.5,
    )
  }

  return headerH
}

function drawLogoPlaceholder(
  doc: jsPDF,
  nomEntreprise: string | undefined,
  x: number,
  y: number,
  size: number,
  palette: Palette = C,
): void {
  setFill(doc, palette.placeholder)
  doc.roundedRect(x + 2, y + 2, size - 4, size - 4, 2, 2, 'F')
  const initiale = (nomEntreprise || 'A').trim().charAt(0).toUpperCase() || 'A'
  const fontSize = Math.round((size / 22) * 14)
  font(doc, 'Hanken Grotesk', 'extrabold', fontSize, palette.navy)
  textCentered(doc, initiale, x + size / 2, y + size / 2 + fontSize * 0.3)
}

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
    parts.push((title === 'DEVIS' ? 'Devis' : 'Facture') + ' ' + numero)
    if (dateStr) parts.push(dateStr)
    textRight(doc, parts.join('  -  '), 192, 10)
  }
}
