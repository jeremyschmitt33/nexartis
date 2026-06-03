// lib/pdf/identity.ts - V3.0c
// Cartes EMETTEUR (gauche, fond blanc + ombre) et ADRESSE A (droite, fond
// navyDeep). Badges orange pillules flottants chevauchant le haut de chaque
// carte.

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
const CARD_H = 46
const CARD_R = 5
const PAD_X = 6
const PAD_TOP = 10
const BADGE_H = 5
const BADGE_R = 2.5

interface ContentLine {
  text: string
  size: number
  weight: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  color: typeof C.white
}

/**
 * Dessine les 2 cartes identite cote a cote.
 *
 * @param yStart  y de demarrage des cartes (haut de la zone, badge inclus).
 *                Le badge orange chevauche 2.5 mm au-dessus du yStart.
 * @returns       y absolu apres les cartes (= yStart + 46 + marge).
 */
export function drawIdentityCards(
  doc: jsPDF,
  ent: IdentityEntreprise,
  client: IdentityClient,
  yStart: number,
): number {
  const leftX = 18
  const rightX = 108
  const yCard = yStart + 2.5 // 2.5 mm de marge pour que le badge ne sorte pas du papier

  // ============= CARTE EMETTEUR (gauche, fond blanc + ombre) =============
  drawEmetteurCard(doc, ent, leftX, yCard)

  // ============= CARTE ADRESSE A (droite, fond navyDeep) =================
  drawAddresseCard(doc, client, rightX, yCard)

  return yCard + CARD_H + 8
}

// ===========================================================================
// EMETTEUR
// ===========================================================================
function drawEmetteurCard(
  doc: jsPDF,
  ent: IdentityEntreprise,
  x: number,
  y: number,
): void {
  // Ombre subtile (offset +1mm vers le bas/droite)
  setFill(doc, [230, 232, 235])
  doc.roundedRect(x + 1, y + 1, CARD_W, CARD_H, CARD_R, CARD_R, 'F')

  // Fond blanc + bordure border
  setFill(doc, C.white)
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R, CARD_R, 'FD')

  // Badge orange "EMETTEUR" flottant (chevauche le haut)
  const badgeW = 24
  const badgeX = x + 10
  const badgeY = y - BADGE_H / 2
  setFill(doc, C.orange)
  doc.roundedRect(badgeX, badgeY, badgeW, BADGE_H, BADGE_R, BADGE_R, 'F')
  font(doc, 'Hanken Grotesk', 'semibold', 6.5, C.navy)
  textCentered(doc, 'ÉMETTEUR', badgeX + badgeW / 2, badgeY + BADGE_H / 2 + 1.1)

  // Contenu
  const lines: ContentLine[] = []
  if (ent.nom) lines.push({ text: ent.nom, size: 11, weight: 'bold', color: C.navy })
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
    lines.push({ text: contactParts.join('   ·   '), size: 8, weight: 'normal', color: C.muted })
  }

  renderLines(doc, lines, x + PAD_X, y + PAD_TOP, CARD_W - PAD_X * 2)
}

// ===========================================================================
// ADRESSE A
// ===========================================================================
function drawAddresseCard(
  doc: jsPDF,
  client: IdentityClient,
  x: number,
  y: number,
): void {
  // Fond navyDeep (pas d'ombre, fond fonce suffit)
  setFill(doc, C.navyDeep)
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R, CARD_R, 'F')

  // Badge orange "ADRESSE A"
  const badgeW = 26
  const badgeX = x + 10
  const badgeY = y - BADGE_H / 2
  setFill(doc, C.orange)
  doc.roundedRect(badgeX, badgeY, badgeW, BADGE_H, BADGE_R, BADGE_R, 'F')
  font(doc, 'Hanken Grotesk', 'semibold', 6.5, C.navy)
  textCentered(doc, 'ADRESSÉ À', badgeX + badgeW / 2, badgeY + BADGE_H / 2 + 1.1)

  // Contenu
  const lines: ContentLine[] = []
  lines.push({ text: client.clientNom || '—', size: 11, weight: 'bold', color: C.white })
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
  }
}
