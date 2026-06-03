// lib/pdf/identity.ts - V3.0c.2
// Cartes EMETTEUR (gauche, fond blanc + ombre) et ADRESSE A (droite, fond
// navyDeep). Badges orange pillules flottants chevauchant le haut de chaque
// carte.
//
// V3.0c.2 : badges uniformises (BADGE_W=28), nom 12pt extrabold, marge +2.5mm
// apres le nom pour mieux respirer dans la carte, hauteur carte 50mm.

import type { jsPDF } from 'jspdf'
import { C } from './palette'
import { font, setFill, setDraw, textCentered } from './utils'

interface IdentityEntreprise {
  nom?: string
  adresse?: string
  code_postal?: string
  ville?: string
  siret?: string
  tva_intracommunautaire?: string
  telephone?: string
  email?: string
}

interface IdentityClient {
  clientNom: string
  clientAdresse?: string
  clientSiret?: string
  clientTvaIntra?: string
}

const CARD_W = 84
const CARD_H = 50 // V3.0c.2 : +4mm pour absorber le nom plus gras + marge
const CARD_R = 5
const PAD_X = 6
const PAD_TOP = 11
const BADGE_W = 28 // V3.0c.2 : badges uniformises EMETTEUR/ADRESSE A
const BADGE_H = 5
const BADGE_R = 2.5
const GAP_NAME_AFTER = 2.5 // V3.0c.2 : marge supplementaire entre nom et adresse

interface ContentLine {
  text: string
  size: number
  weight: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  color: typeof C.white
  marginAfter?: number // V3.0c.2 : marge supplementaire optionnelle apres la ligne (mm)
}

/**
 * Dessine les 2 cartes identite cote a cote.
 *
 * @param yStart  y de demarrage des cartes (haut de la zone, badge inclus).
 *                Le badge orange chevauche 2.5 mm au-dessus du yStart.
 * @returns       y absolu apres les cartes.
 */
export function drawIdentityCards(
  doc: jsPDF,
  ent: IdentityEntreprise,
  client: IdentityClient,
  yStart: number,
): number {
  const leftX = 18
  const rightX = 108
  const yCard = yStart + 2.5 // marge pour que le badge ne sorte pas du papier

  drawEmetteurCard(doc, ent, leftX, yCard)
  drawAddresseCard(doc, client, rightX, yCard)

  return yCard + CARD_H + 8
}

// ===========================================================================
// EMETTEUR (gauche, fond blanc + ombre subtile)
// ===========================================================================
function drawEmetteurCard(
  doc: jsPDF,
  ent: IdentityEntreprise,
  x: number,
  y: number,
): void {
  // Ombre subtile (offset +1mm)
  setFill(doc, [230, 232, 235])
  doc.roundedRect(x + 1, y + 1, CARD_W, CARD_H, CARD_R, CARD_R, 'F')

  // Fond blanc + bordure
  setFill(doc, C.white)
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R, CARD_R, 'FD')

  // Badge orange "EMETTEUR" flottant (uniformise 28mm)
  const badgeX = x + 10
  const badgeY = y - BADGE_H / 2
  setFill(doc, C.orange)
  doc.roundedRect(badgeX, badgeY, BADGE_W, BADGE_H, BADGE_R, BADGE_R, 'F')
  font(doc, 'Hanken Grotesk', 'semibold', 6.5, C.navy)
  textCentered(doc, 'ÉMETTEUR', badgeX + BADGE_W / 2, badgeY + BADGE_H / 2 + 1.1)

  // Contenu — nom 12pt extrabold + marge avant adresse
  const lines: ContentLine[] = []
  if (ent.nom) lines.push({ text: ent.nom, size: 12, weight: 'extrabold', color: C.navy, marginAfter: GAP_NAME_AFTER })
  const adresseLines: string[] = []
  if (ent.adresse) adresseLines.push(ent.adresse)
  const ville = `${ent.code_postal || ''} ${ent.ville || ''}`.trim()
  if (ville) adresseLines.push(ville)
  for (const a of adresseLines) {
    lines.push({ text: a, size: 9, weight: 'normal', color: C.muted })
  }
  if (ent.siret) lines.push({ text: `SIRET ${ent.siret}`, size: 8, weight: 'normal', color: C.navyText })
  if (ent.tva_intracommunautaire) {
    lines.push({ text: `TVA ${ent.tva_intracommunautaire}`, size: 8, weight: 'normal', color: C.navyText })
  }
  const contactParts: string[] = []
  if (ent.telephone) contactParts.push(ent.telephone)
  if (ent.email) contactParts.push(ent.email)
  if (contactParts.length > 0) {
    lines.push({ text: contactParts.join('  •  '), size: 8, weight: 'normal', color: C.muted })
  }

  renderLines(doc, lines, x + PAD_X, y + PAD_TOP, CARD_W - PAD_X * 2)
}

// ===========================================================================
// ADRESSE A (droite, fond navyDeep, texte blanc)
// ===========================================================================
function drawAddresseCard(
  doc: jsPDF,
  client: IdentityClient,
  x: number,
  y: number,
): void {
  setFill(doc, C.navyDeep)
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R, CARD_R, 'F')

  // Badge orange "ADRESSE A" (uniformise 28mm)
  const badgeX = x + 10
  const badgeY = y - BADGE_H / 2
  setFill(doc, C.orange)
  doc.roundedRect(badgeX, badgeY, BADGE_W, BADGE_H, BADGE_R, BADGE_R, 'F')
  font(doc, 'Hanken Grotesk', 'semibold', 6.5, C.navy)
  textCentered(doc, 'ADRESSÉ À', badgeX + BADGE_W / 2, badgeY + BADGE_H / 2 + 1.1)

  // Contenu — nom 12pt extrabold + marge avant adresse
  const lines: ContentLine[] = []
  lines.push({ text: client.clientNom || '—', size: 12, weight: 'extrabold', color: C.white, marginAfter: GAP_NAME_AFTER })
  if (client.clientAdresse) {
    const parts = client.clientAdresse.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) {
      lines.push({ text: p, size: 9, weight: 'normal', color: C.whiteSoft })
    }
  }
  if (client.clientSiret) {
    lines.push({ text: `SIRET ${client.clientSiret}`, size: 8, weight: 'normal', color: C.whiteSoft })
  }
  if (client.clientTvaIntra) {
    lines.push({ text: `TVA ${client.clientTvaIntra}`, size: 8, weight: 'normal', color: C.whiteSoft })
  }

  renderLines(doc, lines, x + PAD_X, y + PAD_TOP, CARD_W - PAD_X * 2)
}

// ===========================================================================
// Helper rendu lignes
// ===========================================================================
function renderLines(
  doc: jsPDF,
  lines: ContentLine[],
  x: number,
  y: number,
  maxW: number,
): void {
  let cursorY = y
  for (const l of lines) {
    font(doc, 'Hanken Grotesk', l.weight, l.size, l.color)
    const split = doc.splitTextToSize(l.text, maxW)
    for (const part of split) {
      doc.text(part, x, cursorY)
      cursorY += l.size * 0.4 + 1.4
    }
    if (l.marginAfter) cursorY += l.marginAfter
  }
}
