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
  const headerH = 50 // V3.1.5 : reduit de 58 a 50mm (bandeau plus aere)

  // === Zone GAUCHE (navy) - trapeze : largeur 137 en haut, oblique 20mm a droite ===
  setFill(doc, P.navy)
  doc.lines(
    [[137, 0], [-20, headerH], [-117, 0], [0, -headerH]],
    0, 0, [1, 1], 'F', true,
  )

  // === Zone DROITE (navyDroite) - trapeze symetrique ===
  setFill(doc, P.navyDroite)
  doc.lines(
    [[pageW - 137, 0], [0, headerH], [-(pageW - 117), 0], [20, -headerH]],
    137, 0, [1, 1], 'F', true,
  )

  // === Barre doree (accent) - separateur diagonal de 4mm ===
  setFill(doc, P.orange)
  doc.lines(
    [[4, 0], [-20, headerH], [-4, 0], [20, -headerH]],
    135, 0, [1, 1], 'F', true,
  )

  // === Carte logo : V3.1.5 valeurs ajustees ===
  // V3.1.7 : si showCompanyName === false, le wordmark "Nom Société" n'est pas
  // dessine et on agrandit le logo (LOGO_LARGE_FACTOR), en plafonnant la taille
  // pour ne pas deborder du bandeau de 50mm.
  const showCompanyName = ent.document_show_company_name === false ? false : true
  const logoStyle = ent.doc_logo_style ?? 'carte-classique'
  const rawLogoSize = ent.doc_logo_size ?? 100
  const clampedLogoSize = Math.min(130, Math.max(70, rawLogoSize))
  const logoScale = clampedLogoSize / 100
  // V3.1.5 : baseSize classique 28->30, minimaliste 22->24 (logo plus present)
  const baseSize = logoStyle === 'carte-minimaliste' ? 24 : 30
  // Plafond strict pour rester dans le bandeau (headerH=50mm, marge haut/bas
  // de ~3mm de chaque cote). Sans ce plafond, 30 * 1.30 * 1.55 = 60.45mm > 50mm.
  const LOGO_CARD_MAX_MM = 44
  const sizeMultiplier = showCompanyName ? 1 : LOGO_LARGE_FACTOR
  const logoCardSize = Math.min(baseSize * logoScale * sizeMultiplier, LOGO_CARD_MAX_MM)
  const logoCardX = 12
  // Y dynamique : si le logo est plus grand, on le re-centre verticalement
  // dans le bandeau de 50mm (au lieu du Y=7mm historique cale en haut).
  const logoCardY = showCompanyName ? 7 : Math.max(3, (headerH - logoCardSize) / 2)
  const logoCardCenterY = logoCardY + logoCardSize / 2 // centre vertical du logo
  if (logoStyle !== 'sans-carte') {
    const radius = logoStyle === 'carte-minimaliste' ? 3 : 5
    roundedFill(doc, logoCardX, logoCardY, logoCardSize, logoCardSize, radius, P.white)
  }

  // Logo entreprise (image dans la carte)
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

  // === Nom artisan - V3.1.5 : 30pt, centre verticalement sur le logo ===
  // V3.1.7 : entierement saute si showCompanyName === false. Le logo, deja
  // agrandi en amont, occupe seul l'espace gauche du bandeau.
  if (showCompanyName) {
    const textLeftX = 12 + logoCardSize + 6
    const rawNomSize = ent.doc_nom_size ?? 100
    const clampedNomSize = Math.min(130, Math.max(70, rawNomSize))
    const nomScale = clampedNomSize / 100
    const nomBase = 30 // V3.1.5 : passe de 20 a 30pt (= titleSize "DEVIS")
    const nomMaxWidth = 133 - textLeftX // V3.1.5 : gagne 2mm (etait 135 - textLeftX - 2)
    let nomFontSize = nomBase * nomScale
    font(doc, 'Hanken Grotesk', 'extrabold', nomFontSize, P.white)
    // Auto-fit : reduit la police par paliers de 1pt jusqu'a tenir dans nomMaxWidth.
    // Plancher 14pt (au lieu de 11) pour eviter qu'un nom long devienne ridicule
    // en face d'un DEVIS a 30pt.
    while (doc.getTextWidth(ent.nom || '') > nomMaxWidth && nomFontSize > 14) {
      nomFontSize -= 1
      font(doc, 'Hanken Grotesk', 'extrabold', nomFontSize, P.white)
    }
    // V3.1.5 : y_nom calcule APRES l'auto-fit (utilise la fontSize finale) pour
    // que le centrage reste correct meme si le nom a ete reduit.
    const yNom = logoCardCenterY + nomFontSize * BASELINE_CENTER_FACTOR
    doc.text(ent.nom || 'Votre entreprise', textLeftX, yNom)
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
  const titleCenterY = 12
  const yTitle = titleCenterY + titleSize * BASELINE_CENTER_FACTOR
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, P.white)
  textCentered(doc, title, zoneRightCenter, yTitle)

  // V3.1.5 : pastille suit le titre (6mm sous la baseline)
  font(doc, 'Hanken Grotesk', 'bold', 10.5, P.navy)
  const numeroW = doc.getTextWidth(numero)
  const pillW = Math.max(numeroW + 10, 32)
  const pillH = 9
  const pillX = zoneRightCenter - pillW / 2
  const pillY = yTitle + 6
  roundedFill(doc, pillX, pillY, pillW, pillH, 3, P.orange)
  font(doc, 'Hanken Grotesk', 'bold', 10.5, P.navy)
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

  // Calcul des y des dates : on les place sous la pastille avec un gap de 4.5mm
  // pour la 1ere, puis interligne 4.5mm pour la 2eme. Plancher sur headerH - 2.
  const pillBottom = pillY + pillH // bas de la pastille
  const yDate1 = Math.max(headerH - 6.5, pillBottom + 4.5)
  const yDate2 = yDate1 + 4.5

  // Si les 2 lignes dates depassent le bandeau (cas logo 130% + 2 dates), on
  // fusionne en une seule ligne plus compacte pour eviter le debordement.
  const overflow = yDate2 > headerH - 1 && Boolean(dateGauche) && Boolean(dateDroite)

  if (overflow) {
    // Mode fusionne : "[label1] [date1]   [label2] [date2]" sur une ligne unique
    drawDateLine(
      [
        { txt: labelGauche + ' ', size: 8, weight: 'normal', color: P.whiteSoft },
        { txt: dateGauche, size: 8.5, weight: 'bold', color: P.white },
        { txt: '   ' + labelDroite + ' ', size: 8, weight: 'normal', color: P.whiteSoft },
        { txt: dateDroite, size: 8.5, weight: 'bold', color: P.white },
      ],
      headerH - 3,
    )
  } else {
    if (dateGauche) {
      drawDateLine(
        [
          { txt: labelGauche + ' ', size: 8, weight: 'normal', color: P.whiteSoft },
          { txt: dateGauche, size: 8.5, weight: 'bold', color: P.white },
        ],
        yDate1,
      )
    }
    if (dateDroite) {
      drawDateLine(
        [
          { txt: labelDroite + ' ', size: 8, weight: 'normal', color: P.whiteSoft },
          { txt: dateDroite, size: 8.5, weight: 'bold', color: P.white },
        ],
        yDate2,
      )
    }
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
