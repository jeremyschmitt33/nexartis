// lib/pdf/utils.ts - V3.0c
// Helpers de dessin (couleurs, polices, texte) + helpers metier pure
// (normalize lignes, sous-totaux, regroupements TVA, detection forfait).
// Tout est server-safe (pas de DOM, pas de React).

import type { jsPDF } from 'jspdf'
import { C, type RGB } from './palette'

// ---------------------------------------------------------------------------
// 1. Formatage
// ---------------------------------------------------------------------------

export function fmt(n: number): string {
  // Intl.NumberFormat('fr-FR') retourne U+202F / U+00A0 comme separateur de
  // milliers. Hanken Grotesk / Helvetica de jsPDF n'ont pas ces glyphes -
  // on les normalise vers un espace ASCII standard.
  const raw = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  const safe = raw.replace(/[   ]/g, ' ')
  return safe + ' €'
}

export function fmtDate(d?: string): string {
  return d ? new Date(d).toLocaleDateString('fr-FR') : ''
}

// ---------------------------------------------------------------------------
// 2. Helpers couleurs / polices
// ---------------------------------------------------------------------------

export function setFill(doc: jsPDF, c: RGB): void {
  doc.setFillColor(c[0], c[1], c[2])
}
export function setDraw(doc: jsPDF, c: RGB): void {
  doc.setDrawColor(c[0], c[1], c[2])
}
export function setText(doc: jsPDF, c: RGB): void {
  doc.setTextColor(c[0], c[1], c[2])
}

export type FontFamily = 'Hanken Grotesk' | 'Spline Sans Mono'
export type FontStyle =
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold'

/**
 * Selectionne police + style + taille et applique une couleur si fournie.
 * Les polices sont enregistrees via registerPdfFonts() en debut de generateur.
 */
export function font(
  doc: jsPDF,
  family: FontFamily,
  style: FontStyle,
  size: number,
  color?: RGB,
): void {
  doc.setFont(family, style)
  doc.setFontSize(size)
  if (color) setText(doc, color)
}

// ---------------------------------------------------------------------------
// 3. Helpers texte aligne (jsPDF a deja align:'right'/'center' mais on
//    centralise pour homogeneite et eviter les options { align } eparpillees).
// ---------------------------------------------------------------------------

export function textCentered(
  doc: jsPDF,
  txt: string,
  x: number,
  y: number,
  opts?: { maxWidth?: number; charSpace?: number },
): void {
  doc.text(txt, x, y, { align: 'center', ...opts })
}

export function textRight(
  doc: jsPDF,
  txt: string,
  x: number,
  y: number,
  opts?: { maxWidth?: number; charSpace?: number },
): void {
  doc.text(txt, x, y, { align: 'right', ...opts })
}

// ---------------------------------------------------------------------------
// 4. Rectangles arrondis colores
// ---------------------------------------------------------------------------

export function roundedFill(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: RGB,
): void {
  setFill(doc, color)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

// ---------------------------------------------------------------------------
// 5. Modeles metier - Ligne (type minimal duplique pour autonomie module)
// ---------------------------------------------------------------------------

export interface PdfLigne {
  id?: string
  type?: 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page'
  niveau?: 1 | 2 | 3
  numero?: string
  parent_id?: string | null
  ordre?: number
  designation: string
  quantite?: number
  unite?: string
  prix_unitaire_ht?: number
  taux_tva?: number
}

// ---------------------------------------------------------------------------
// 6. Helpers metier purs (repris de l'ancien lib/pdf.ts)
// ---------------------------------------------------------------------------

export function isPrestation(l: PdfLigne): boolean {
  if (!l.type && !l.niveau) return true
  if (l.type === 'prestation') return true
  if (l.niveau === 3 && l.type !== 'commentaire' && l.type !== 'saut_page') return true
  return false
}

/**
 * Normalise les lignes : ancien format (sans type/niveau) -> prestations
 * niveau 3 numerotees ; sinon on remplit les champs manquants au mieux.
 */
export function normalizeLignes(input: PdfLigne[]): PdfLigne[] {
  const hasHierarchy = input.some(l => l.type || l.niveau || l.numero || l.parent_id)
  if (!hasHierarchy) {
    return input.map((l, i) => ({
      ...l,
      type: 'prestation' as const,
      niveau: 3 as const,
      numero: String(i + 1),
    }))
  }
  return input.map((l) => {
    const niveau = (l.niveau ?? (l.type === 'section' ? 1 : l.type === 'sous_section' ? 2 : 3)) as 1 | 2 | 3
    const type = l.type ?? (niveau === 1 ? 'section' : niveau === 2 ? 'sous_section' : 'prestation')
    return { ...l, niveau, type, numero: l.numero ?? '' }
  })
}

/**
 * Sous-totaux par section/sous-section, rattachement implicite par ordre
 * (les parent_id ne sont pas persistes en DB).
 */
export function computeSubtotals(lignes: PdfLigne[]): Map<string, number> {
  const map = new Map<string, number>()
  const sorted = [...lignes].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
  let currentSectionId: string | null = null
  let currentSubSectionId: string | null = null
  for (const l of sorted) {
    if (l.type === 'section' && l.id) {
      currentSectionId = l.id
      currentSubSectionId = null
      if (!map.has(currentSectionId)) map.set(currentSectionId, 0)
    } else if (l.type === 'sous_section' && l.id) {
      currentSubSectionId = l.id
      if (!map.has(currentSubSectionId)) map.set(currentSubSectionId, 0)
    } else if (isPrestation(l)) {
      const ht = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
      if (currentSubSectionId) {
        map.set(currentSubSectionId, (map.get(currentSubSectionId) ?? 0) + ht)
      }
      if (currentSectionId) {
        map.set(currentSectionId, (map.get(currentSectionId) ?? 0) + ht)
      }
    }
  }
  return map
}

export function computeTvaGroups(lignes: PdfLigne[]): Record<number, number> {
  const groups: Record<number, number> = {}
  for (const l of lignes.filter(isPrestation)) {
    const rate = l.taux_tva ?? 20
    const ht = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
    groups[rate] = (groups[rate] || 0) + ht * (rate / 100)
  }
  return groups
}

export function computeTvaBases(lignes: PdfLigne[]): Record<number, number> {
  const bases: Record<number, number> = {}
  for (const l of lignes.filter(isPrestation)) {
    const rate = l.taux_tva ?? 20
    const ht = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
    bases[rate] = (bases[rate] || 0) + ht
  }
  return bases
}

/**
 * "Mode forfait global" : case cochee cote saisie, lignes a 0 EUR mais
 * montant_ht > 0. Garde fou pour eviter l'affichage de lignes a 0 EUR sans
 * raison apparente.
 */
export function detectForfaitMode(lignes: PdfLigne[], montantHt: number): boolean {
  const prest = lignes.filter(isPrestation)
  if (prest.length === 0) return false
  if (!(montantHt > 0)) return false
  const sumLignes = prest.reduce((s, l) => s + (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0), 0)
  return sumLignes < 0.01
}

/**
 * Renvoie les textes TVA standards (5,5 - 10 - AE) en fonction des taux
 * presents sur les prestations. Source unique : @/lib/legal-mentions.
 */
import {
  TVA_MENTION_10,
  TVA_MENTION_5_5,
  TVA_MENTION_AE,
} from '@/lib/legal-mentions'

export function getTvaMentions(lignes: PdfLigne[]): string[] {
  const prest = lignes.filter(isPrestation)
  const taux = new Set(prest.map((l) => l.taux_tva ?? 20))
  const mentions: string[] = []
  const allZero = prest.length > 0 && prest.every((l) => (l.taux_tva ?? 20) === 0)
  if (allZero) { mentions.push(TVA_MENTION_AE); return mentions }
  if (taux.has(10)) mentions.push(TVA_MENTION_10)
  if (taux.has(5.5)) mentions.push(TVA_MENTION_5_5)
  return mentions
}

// ---------------------------------------------------------------------------
// 7. Format TVA cellule tableau
// ---------------------------------------------------------------------------

export function fmtTvaCell(l: { taux_tva?: number | null }): string {
  if (l.taux_tva == null) return '—'
  const t = l.taux_tva
  if (t === 0) return '0 %'
  if (t === 5.5) return '5,5 %'
  if (t === 10) return '10 %'
  if (t === 20) return '20 %'
  return `${t} %`.replace('.', ',')
}

// Re-export palette pour confort
export { C }
