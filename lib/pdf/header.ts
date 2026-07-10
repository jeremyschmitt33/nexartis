// lib/pdf/header.ts - V3.1.5
// Bandeau a 2 zones distinctes (gauche + droite) separees par la barre doree
// + carte logo + nom artisan + titre + pastille numero + dates.
//
// V3.1.5 : Refonte des proportions du bandeau pour resoudre 3 bugs visuels :
//   1. Bandeau trop epais (58mm) -> reduit a 50mm
//   2. Nom artisan trop petit (20pt) -> passe a 30pt (= titleSize "DEVIS")
//   3. Nom artisan pas centre verticalement avec le logo -> y dynamique sur
//      logoCardCenterY + fontSize_pt * 0.124 (formule de centrage typographique).
//
// Nouvelles valeurs cles :
//   - headerH = 50mm (au lieu de 58) : bandeau plus aere, ratio elegant
//   - logoCardY = 7mm (au lieu de 12) : logo remonte de 5mm
//   - baseSize classique = 30mm (au lieu de 28) : logo legerement plus present
//   - baseSize minimaliste = 24mm (au lieu de 22) : coherence
//   - nomBase = 30pt (au lieu de 20) : match strict avec "DEVIS" 30pt
//   - Plancher auto-fit = 14pt (au lieu de 11) : evite que le nom devienne ridicule
//   - nomMaxWidth = 133 - textLeftX (gagne 2mm de largeur utile)
//   - y_nom = logoCardCenterY + nomFontSize_final * 0.124 (centrage VISUEL)
//   - y_title = logoCardCenterY + titleSize * 0.124 (nom et DEVIS sur meme baseline)
//   - pillY = y_title + 6 (pastille suit le titre)
//   - Dates : adaptatif, bascule 1 ligne si chevauchement
//
// Sliders bornes a 70-130 (inchange) pour ne JAMAIS deborder du bandeau de 50mm.

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
import { font, setFill, textRight, textCentered, roundedFill, fmtDate } from './utils'
import { LOGO_LARGE_FACTOR } from '../logo-config'

interface HeaderEntreprise {
  nom?: string
  metier?: string
  logo_url?: string
  doc_logo_style?: 'carte-classique' | 'carte-minimaliste' | 'sans-carte' | null
  doc_logo_size?: number | null
  doc_nom_size?: number | null
  // V3.1.7 : toggle d'affichage du wordmark "Nom Société". NULL/TRUE = affiche
  // (backward-compat). FALSE = masque et agrandit le logo.
  document_show_company_name?: boolean | null
}

// Formule de centrage typographique : pour qu'un texte de fontSize s (pt) soit
// visuellement centre sur un point cy (mm), on positionne sa baseline a :
//   y_baseline = cy + s * 0.124
// (= cy + (s * 0.3528 * 0.70) / 2, ou 0.3528 = pt->mm et 0.70 = cap-height)
const BASELINE_CENTER_FACTOR = 0.124

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
  const headerH = 41 // V3.4 : reduit 43.5 -> 41mm (retour client : bandeau plus compact)

  // === Zone GAUCHE (navy) - trapeze : largeur 137 en haut, oblique 20mm a droite ===
  setFill(doc, P.navy)
  doc.lines(
    [[125, 0], [-20, headerH], [-105, 0], [0, -headerH]],
    0, 0, [1, 1], 'F', true,
  )

  // === Zone DROITE (navyDroite) - trapeze symetrique ===
  setFill(doc, P.navyDroite)
  doc.lines(
    [[pageW - 125, 0], [0, headerH], [-(pageW - 105), 0], [20, -headerH]],
    125, 0, [1, 1], 'F', true,
  )

  // === Barre doree (accent) - separateur diagonal de 4mm ===
  setFill(doc, P.orange)
  doc.lines(
    [[4, 0], [-20, headerH], [-4, 0], [20, -headerH]],
    123, 0, [1, 1], 'F', true,
  )

  // === Carte logo : V3.1.5 valeurs ajustees ===
  // V3.1.7 : si showCompanyName === false, le wordmark "Nom Société" n'est pas
  // dessine et on agrandit le logo (LOGO_LARGE_FACTOR), en plafonnant la taille
  // pour ne pas deborder du bandeau de 50mm.
  const showCompanyName = ent.document_show_company_name === true ? true : false // V3.2 : logo seul par defaut
  const logoStyle = ent.doc_logo_style ?? 'carte-classique'
  const rawLogoSize = ent.doc_logo_size ?? 100
  const clampedLogoSize = Math.min(130, Math.max(70, rawLogoSize))
  const logoScale = clampedLogoSize / 100
  // V3.x : "la carte epouse le logo". La taille est pilotee par la HAUTEUR
  // (coherent avec le bandeau de 50mm), la largeur suit les PROPORTIONS reelles
  // du logo, et la carte blanche n'est qu'une petite marge autour -> plus de
  // grand carre blanc gaspille, surtout pour les logos larges (wordmark).
  const sizeMultiplier = showCompanyName ? 1 : LOGO_LARGE_FACTOR
  // V3.2 : bandeau 43.5mm (au lieu de 50). Bases logo legerement reduites
  // (26->23, 22->20) + plafond 38->33mm pour rester dans le bandeau raccourci.
  const baseH = logoStyle === 'carte-minimaliste' ? 20 : 23
  const LOGO_H_MAX_MM = 33 // plafond hauteur logo (bandeau 43.5mm, marges ~5mm)
  const targetLogoH = Math.min(baseH * logoScale * sizeMultiplier, LOGO_H_MAX_MM)
  // Marge de la carte autour du logo : classique un peu plus genereuse,
  // minimaliste serree, sans-carte aucune (pas de carte dessinee).
  const cardPad = logoStyle === 'sans-carte' ? 0 : logoStyle === 'carte-minimaliste' ? 1.5 : 2.5
  // V3.2 : le nom passe SOUS le logo (plus a cote), donc pas besoin de reserver
  // de la largeur a droite. Logo large dans les deux cas (zone gauche ~115mm).
  const maxLogoW = 64

  let logoW = targetLogoH
  let logoH = targetLogoH
  let hasLogoImage = false
  let logoFormat = 'PNG'
  if (ent.logo_url && ent.logo_url.startsWith('data:image')) {
    try {
      logoFormat = ent.logo_url.includes('image/png') ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(ent.logo_url)
      const aspect = props.width / props.height
      logoH = targetLogoH
      logoW = targetLogoH * aspect
      if (logoW > maxLogoW) {
        logoW = maxLogoW
        logoH = maxLogoW / aspect
      }
      hasLogoImage = true
    } catch {
      hasLogoImage = false
    }
  }

  const cardW = logoW + 2 * cardPad
  const cardH = logoH + 2 * cardPad
  const logoCardX = 12
  // V3.2 : si le nom est affiche, il va EN PETIT SOUS le logo. On reserve une
  // bande basse (NAME_BAND_H) et on centre la carte logo dans l'espace restant.
  // Sinon (logo seul, vedette), la carte est centree verticalement dans tout le bandeau.
  const NAME_BAND_H = showCompanyName ? 7 : 0
  const logoZoneH = headerH - NAME_BAND_H
  const logoCardY = Math.max(3, (logoZoneH - cardH) / 2)
  const logoCardCenterX = logoCardX + cardW / 2 // centre horizontal (alignement nom dessous)

  if (logoStyle !== 'sans-carte') {
    const radius = logoStyle === 'carte-minimaliste' ? 3 : 5
    roundedFill(doc, logoCardX, logoCardY, cardW, cardH, radius, P.white)
  }

  if (hasLogoImage) {
    doc.addImage(ent.logo_url as string, logoFormat, logoCardX + cardPad, logoCardY + cardPad, logoW, logoH)
  } else {
    drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, cardW, P)
  }

  // === Nom artisan - V3.2 : EN PETIT, centre SOUS le logo ===
  // Saute entierement si showCompanyName === false (logo seul, defaut V3.2).
  // Le nom reste dans la zone gauche (bordee bien avant la diagonale doree a
  // x~115mm) : on plafonne sa largeur pour eviter tout chevauchement.
  if (showCompanyName) {
    const rawNomSize = ent.doc_nom_size ?? 100
    const clampedNomSize = Math.min(130, Math.max(70, rawNomSize))
    const nomScale = clampedNomSize / 100
    const nomBase = 11 // ~ equivalent du 15px HTML (parite visuelle)
    // Largeur max : on borne sur la zone gauche pour ne JAMAIS toucher la barre
    // doree (qui demarre a x~115mm en bas du bandeau). Marge de securite a 100mm.
    const nomMaxWidth = 100 - logoCardX
    let nomFontSize = nomBase * nomScale
    font(doc, 'Hanken Grotesk', 'bold', nomFontSize, P.white)
    // Auto-fit : reduit par paliers de 0.5pt jusqu'a tenir, plancher 7pt.
    while (doc.getTextWidth(ent.nom || '') > nomMaxWidth && nomFontSize > 7) {
      nomFontSize -= 0.5
      font(doc, 'Hanken Grotesk', 'bold', nomFontSize, P.white)
    }
    // Baseline du nom : sous la carte logo, dans la bande basse reservee.
    const yNom = logoCardY + cardH + 1.5 + nomFontSize * 0.3528 * 0.7
    textCentered(doc, ent.nom || 'Votre entreprise', logoCardCenterX, yNom)
  }

  // === Titre + pastille numero (zone droite) ===
  const rightAnchorX = 200
  const zoneRightCenter = 169.5

  // V3.1.5 : titleSize 30pt si court, 20pt si long (>14 car, ex "FACTURE DE SITUATION")
  const titleSize = title.length > 14 ? 20 : 30
  // V3.1.6 : DEVIS centre sur cy=12mm (haut du bandeau) pour reduire la marge
  // au-dessus du titre. Calcul : cy + titleSize * 0.124.
  //   - 30pt -> yTitle = 12 + 3.72 = 15.72mm (top du caractere a ~8.3mm)
  //   - 20pt -> yTitle = 12 + 2.48 = 14.48mm (top a ~9.6mm)
  // Le titre n'est plus aligne avec le nom artisan (qui suit le centre du logo),
  // mais c'est volontaire : les 2 zones sont separees par la barre doree.
  // V3.2 : bandeau raccourci (43.5mm) -> titre remonte legerement (12 -> 10.5mm).
  const titleCenterY = 10.5
  const yTitle = titleCenterY + titleSize * BASELINE_CENTER_FACTOR
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, P.white)
  textCentered(doc, title, zoneRightCenter, yTitle)

  // V3.1.5 : pastille suit le titre (6mm sous la baseline)
  // Le numero est en BLANC pour ressortir sur la pastille accent (orange par
  // defaut, mais rose/autre selon le theme de l'artisan) — sinon invisible quand
  // le texte et l'accent sont proches.
  font(doc, 'Hanken Grotesk', 'bold', 10.5, P.white)
  const numeroW = doc.getTextWidth(numero)
  const pillW = Math.max(numeroW + 10, 32)
  const pillH = 9
  const pillX = zoneRightCenter - pillW / 2
  const pillY = yTitle + 6
  roundedFill(doc, pillX, pillY, pillW, pillH, 3, P.orange)
  font(doc, 'Hanken Grotesk', 'bold', 10.5, P.white)
  textCentered(doc, numero, zoneRightCenter, pillY + 6.5)

  // === Dates : V3.1.5 mode adaptatif (single line si chevauchement) ===
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

  // === Dates : V3.2 — TOUJOURS sur UNE seule ligne (parite dashboard HTML) ===
  // Format : "[label1] [date1]  ·  [label2] [date2]", separateur point median,
  // aligne a droite (rightAnchorX=200) -> reste dans la zone bleue, jamais sur
  // la diagonale doree (qui demarre a x~115mm en bas du bandeau, soit 85mm a
  // gauche de l'ancre droite, bien plus que la largeur du texte des dates).
  //
  // Marge basse : on place la ligne sous la pastille (gap 5mm) puis on PLAFONNE a
  // headerH - 6 pour garder ~6mm de marge sous "Valable jusqu'au …" (le PDF avait
  // un texte colle au bord bas a headerH-3 ; le dashboard, lui, est bien espace).
  const pillBottom = pillY + pillH
  const yDates = Math.min(pillBottom + 5, headerH - 6)

  const datePieces: DatePiece[] = []
  if (dateGauche) {
    datePieces.push({ txt: labelGauche + ' ', size: 8, weight: 'normal', color: P.whiteSoft })
    datePieces.push({ txt: dateGauche, size: 8.5, weight: 'bold', color: P.white })
  }
  if (dateDroite) {
    if (datePieces.length > 0) {
      datePieces.push({ txt: '   ·   ', size: 8, weight: 'normal', color: P.whiteSoft })
    }
    datePieces.push({ txt: labelDroite + ' ', size: 8, weight: 'normal', color: P.whiteSoft })
    datePieces.push({ txt: dateDroite, size: 8.5, weight: 'bold', color: P.white })
  }
  if (datePieces.length > 0) {
    drawDateLine(datePieces, yDates)
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
