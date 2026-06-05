// lib/pdf/header.ts - V3.0c.2
// Bandeau navy plein largeur de la page 1 + accent orange parallelogramme
// + carte blanche logo + nom artisan + baseline + titre + pastille numero + dates.
//
// V3.0c.2 : logo agrandi 28mm, nom 20pt, baseline 11pt, pastille adaptative,
// DEVIS centre sur l'axe de la pastille.

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
import { font, setFill, textRight, textCentered, roundedFill, fmtDate } from './utils'

interface HeaderEntreprise {
  nom?: string
  metier?: string
  logo_url?: string
  // V3.1 : personnalisation logo (alignes avec colonnes DB)
  doc_logo_style?: 'carte-classique' | 'carte-minimaliste' | 'sans-carte' | null
  doc_logo_size?: number | null  // 60-140
  doc_nom_size?: number | null   // 60-140
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
  palette: Palette = C,
): number {
  const P = palette
  const pageW = 210
  const headerH = 58

  // === V3.1 : bandeau a 2 zones distinctes separees par la barre doree ===
  // Zone GAUCHE : polygone qui couvre tout a gauche de la barre doree
  // Points : (0,0) -> (137,0) -> (117,58) -> (0,58)
  setFill(doc, P.navy)
  doc.lines(
    [
      [137, 0],    // (0,0) -> (137,0)
      [-20, 58],   // (137,0) -> (117,58)
      [-117, 0],   // (117,58) -> (0,58)
      [0, -58],    // retour (0,58) -> (0,0)
    ],
    0, 0,
    [1, 1],
    'F',
    true,
  )

  // Zone DROITE : polygone qui couvre tout a droite de la barre doree, avec bandeauHautDroite
  // Points : (137,0) -> (pageW,0) -> (pageW,58) -> (117,58)
  setFill(doc, P.navyDroite)
  doc.lines(
    [
      [pageW - 137, 0],     // (137,0) -> (pageW,0)
      [0, 58],              // (pageW,0) -> (pageW,58)
      [-(pageW - 117), 0],  // (pageW,58) -> (117,58)
      [20, -58],            // retour (117,58) -> (137,0)
    ],
    137, 0,
    [1, 1],
    'F',
    true,
  )

  // === Barre doree (accent) - separateur diagonal net entre les 2 zones ===
  // Points : (135,0) -> (139,0) -> (119,58) -> (115,58)
  setFill(doc, P.orange)
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

  // === 3. Carte logo : taille et style pilotes par config artisan V3.1 ===
  const logoStyle = ent.doc_logo_style ?? 'carte-classique'
  const logoScale = (ent.doc_logo_size && ent.doc_logo_size >= 60 && ent.doc_logo_size <= 140) ? ent.doc_logo_size / 100 : 1
  const baseSize = logoStyle === 'carte-minimaliste' ? 24 : 30  // V3.1.1 : agrandies
  const logoCardSize = baseSize * logoScale
  const logoCardX = 8  // V3.1.1 : reduit pour rapprocher du bord gauche
  const logoCardY = (headerH - logoCardSize) / 2  // V3.1.3 : centre vertical absolu  // recentrer verticalement si carte plus petite
  if (logoStyle !== 'sans-carte') {
    const radius = logoStyle === 'carte-minimaliste' ? 3 : 5
    roundedFill(doc, logoCardX, logoCardY, logoCardSize, logoCardSize, radius, P.white)
  }

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
      drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize, P)
    }
  } else {
    drawLogoPlaceholder(doc, ent.nom, logoCardX, logoCardY, logoCardSize, P)
  }

  // === 4. Nom artisan + baseline (a droite de la carte logo) — V3.0c.2 ===
  // Logo 28mm + 6mm de gap = nom commence a x=46
  const textLeftX = 12 + logoCardSize + 6  // V3.1 : s'adapte a la taille de carte
  const nomScale = (ent.doc_nom_size && ent.doc_nom_size >= 60 && ent.doc_nom_size <= 140) ? ent.doc_nom_size / 100 : 1
  // V3.1.3 : auto-fit du nom si trop large (la zone gauche va jusqu'a x=135, marge 2mm avant barre doree)
  const nomMaxWidth = 135 - textLeftX - 2
  let nomFontSize = 30 * nomScale  // base 30pt = taille DEVIS
  font(doc, 'Hanken Grotesk', 'extrabold', nomFontSize, P.white)
  while (doc.getTextWidth(ent.nom || '') > nomMaxWidth && nomFontSize > 14) {
    nomFontSize -= 1.5
    font(doc, 'Hanken Grotesk', 'extrabold', nomFontSize, P.white)
  }
  // Y : centre vertical du bandeau (baseline visuelle approximative)
  const nomY = headerH / 2 + nomFontSize * 0.12
  doc.text(ent.nom || 'Votre entreprise', textLeftX, nomY)

  // V3.1.2 : metier retire du bandeau a la demande (toujours visible dans la carte EMETTEUR plus bas)

  // === 5. Titre + pastille numero (zone droite x=139→210) — V3.0c.2 ===
  // Pastille compacte adaptative + DEVIS centre sur l'axe de la pastille.
  const rightAnchorX = 200
  font(doc, 'Hanken Grotesk', 'bold', 10.5, P.navy)
  const numeroW = doc.getTextWidth(numero)
  const pillW = Math.max(numeroW + 10, 32) // padding 5mm chaque cote, min 32mm
  const pillH = 9
  // Zone droite utile : x=139 -> x=200, centre = 169.5
  const zoneRightCenter = 169.5
  const pillX = zoneRightCenter - pillW / 2
  const pillY = 32
  roundedFill(doc, pillX, pillY, pillW, pillH, 3, P.orange)
  textCentered(doc, numero, zoneRightCenter, pillY + 6.5)

  // Titre DEVIS / FACTURE centre sur le meme axe vertical que la pastille
  // (au-dessus). Auto-resize pour "FACTURE DE SITUATION".
  const titleSize = title.length > 14 ? 20 : 30
  font(doc, 'Hanken Grotesk', 'extrabold', titleSize, P.white)
  textCentered(doc, title, zoneRightCenter, 24)

  // === 6. Dates sur 2 lignes (y=48.5 et y=53.5), right-aligned a x=200 ===
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
  palette: Palette = C,
): void {
  setFill(doc, palette.placeholder)
  doc.roundedRect(x + 2, y + 2, size - 4, size - 4, 2, 2, 'F')

  const initiale = (nomEntreprise || 'A').trim().charAt(0).toUpperCase() || 'A'
  // V3.0c.2 : 14pt etait dimensionne pour size=22, on extrapole.
  const fontSize = Math.round((size / 22) * 14)
  // V3.0d : initiale en couleur principale (= bandeauHaut du theme).
  font(doc, 'Hanken Grotesk', 'extrabold', fontSize, palette.navy)
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
