// lib/pdf/identity.ts - V3.0c.3
// Cartes EMETTEUR (gauche, fond blanc + ombre) et ADRESSE A (droite, fond
// navyDeep). Badges orange pillules flottants chevauchant le haut.
//
// V3.0c.3 :
//  - Nouvel ordre : Nom / Adresse / Ville / Tel / Email / SIRET / TVA.
//  - SIRET + TVA sont ancres en BAS de la carte (rendus de bas en haut).
//  - Tel et Email sur leurs propres lignes (plus de bullet inline).
//  - Tel auto-formate si numero FR 10 chiffres sans espace.
//  - Cote CLIENT : clientAdresse vient en parts pipe-separated, on auto-detecte
//    le tel et l'email dans les parts pour les formater proprement.

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
const CARD_H = 50
const CARD_R = 5
const PAD_X = 6
const PAD_TOP = 11
const PAD_BOTTOM = 6
const BADGE_W = 28
const BADGE_H = 5
const BADGE_R = 2.5
const GAP_NAME_AFTER = 2.5

interface ContentLine {
  text: string
  size: number
  weight: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  color: typeof C.white
  marginAfter?: number
}

/**
 * Dessine les 2 cartes identite cote a cote.
 * @returns y absolu apres les cartes.
 */
export function drawIdentityCards(
  doc: jsPDF,
  ent: IdentityEntreprise,
  client: IdentityClient,
  yStart: number,
): number {
  const leftX = 18
  const rightX = 108
  const yCard = yStart + 2.5

  drawEmetteurCard(doc, ent, leftX, yCard)
  drawAddresseCard(doc, client, rightX, yCard)

  return yCard + CARD_H + 8
}

/**
 * Formate un numero de telephone FR (10 chiffres) en groupes de 2 :
 * "0622112551" -> "06 22 11 25 51". Sinon retourne tel quel (trim).
 */
function formatPhone(raw: string | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (/[\s.\-]/.test(trimmed)) return trimmed
  if (/^0\d{9}$/.test(trimmed)) {
    return trimmed.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }
  if (/^\+33\d{9}$/.test(trimmed)) {
    const d = trimmed.slice(3)
    return `+33 ${d.charAt(0)} ${d.slice(1).replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`
  }
  return trimmed
}

/** Detecte si une string ressemble a un numero de telephone. */
function looksLikePhone(s: string): boolean {
  const cleaned = s.replace(/[\s.\-]/g, '')
  return /^(\+?\d{9,15})$/.test(cleaned)
}

/** Detecte si une string ressemble a un email. */
function looksLikeEmail(s: string): boolean {
  return /^[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}$/.test(s.trim())
}

// ===========================================================================
// EMETTEUR (gauche, fond blanc + ombre)
// ===========================================================================
function drawEmetteurCard(
  doc: jsPDF,
  ent: IdentityEntreprise,
  x: number,
  y: number,
): void {
  setFill(doc, [230, 232, 235])
  doc.roundedRect(x + 1, y + 1, CARD_W, CARD_H, CARD_R, CARD_R, 'F')
  setFill(doc, C.white)
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, CARD_W, CARD_H, CARD_R, CARD_R, 'FD')
  drawBadge(doc, 'ÉMETTEUR', x + 10, y)

  // V3.0c.7 : uniformisation - tout en 9pt normal navy sauf nom (13pt extrabold)
  // pour des marges entre lignes parfaitement constantes.
  const top: ContentLine[] = []
  if (ent.nom) top.push({ text: ent.nom, size: 13, weight: 'extrabold', color: C.navy, marginAfter: GAP_NAME_AFTER })
  if (ent.adresse) top.push({ text: ent.adresse, size: 9, weight: 'normal', color: C.navy })
  const ville = `${ent.code_postal || ''} ${ent.ville || ''}`.trim()
  if (ville) top.push({ text: ville, size: 9, weight: 'normal', color: C.navy })
  if (ent.telephone) top.push({ text: formatPhone(ent.telephone), size: 9, weight: 'normal', color: C.navy })
  if (ent.email) top.push({ text: ent.email, size: 9, weight: 'normal', color: C.navy })

  // Bloc BAS (SIRET, TVA) — 9pt normal navy uniforme
  const bottom: ContentLine[] = []
  if (ent.siret) bottom.push({ text: `SIRET ${ent.siret}`, size: 9, weight: 'normal', color: C.navy })
  if (ent.tva_intracommunautaire) {
    bottom.push({ text: `TVA ${ent.tva_intracommunautaire}`, size: 9, weight: 'normal', color: C.navy })
  }

  renderLinesTop(doc, top, x + PAD_X, y + PAD_TOP, CARD_W - PAD_X * 2)
  renderLinesBottom(doc, bottom, x + PAD_X, y + CARD_H - PAD_BOTTOM, CARD_W - PAD_X * 2)
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
  drawBadge(doc, 'ADRESSÉ À', x + 10, y)

  // V3.0c.7 : uniformisation - tout en 9pt normal whiteSoft sauf nom (13pt extrabold white)
  const top: ContentLine[] = []
  top.push({ text: client.clientNom || '—', size: 13, weight: 'extrabold', color: C.white, marginAfter: GAP_NAME_AFTER })

  if (client.clientAdresse) {
    const parts = client.clientAdresse.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) {
      const text = looksLikePhone(p) ? formatPhone(p) : p
      top.push({ text, size: 9, weight: 'normal', color: C.whiteSoft })
    }
  }

  // Bloc BAS (rare pour particulier) — 9pt normal whiteSoft uniforme
  const bottom: ContentLine[] = []
  if (client.clientSiret) {
    bottom.push({ text: `SIRET ${client.clientSiret}`, size: 9, weight: 'normal', color: C.whiteSoft })
  }
  if (client.clientTvaIntra) {
    bottom.push({ text: `TVA ${client.clientTvaIntra}`, size: 9, weight: 'normal', color: C.whiteSoft })
  }

  renderLinesTop(doc, top, x + PAD_X, y + PAD_TOP, CARD_W - PAD_X * 2)
  renderLinesBottom(doc, bottom, x + PAD_X, y + CARD_H - PAD_BOTTOM, CARD_W - PAD_X * 2)
}

// ===========================================================================
// Helpers
// ===========================================================================
function drawBadge(doc: jsPDF, label: string, badgeX: number, cardY: number): void {
  const badgeY = cardY - BADGE_H / 2
  setFill(doc, C.orange)
  doc.roundedRect(badgeX, badgeY, BADGE_W, BADGE_H, BADGE_R, BADGE_R, 'F')
  font(doc, 'Hanken Grotesk', 'semibold', 6.5, C.navy)
  textCentered(doc, label, badgeX + BADGE_W / 2, badgeY + BADGE_H / 2 + 1.1)
}

function renderLinesTop(
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

/** Rendu des lignes ancrees en BAS du conteneur (yBottom = bord bas). */
function renderLinesBottom(
  doc: jsPDF,
  lines: ContentLine[],
  x: number,
  yBottom: number,
  maxW: number,
): void {
  if (lines.length === 0) return
  let totalH = 0
  for (const l of lines) {
    font(doc, 'Hanken Grotesk', l.weight, l.size, l.color)
    const split = doc.splitTextToSize(l.text, maxW)
    totalH += split.length * (l.size * 0.4 + 1.4)
  }
  let cursorY = yBottom - totalH + lines[0].size * 0.4 + 1
  for (const l of lines) {
    font(doc, 'Hanken Grotesk', l.weight, l.size, l.color)
    const split = doc.splitTextToSize(l.text, maxW)
    for (const part of split) {
      doc.text(part, x, cursorY)
      cursorY += l.size * 0.4 + 1.4
    }
  }
}
