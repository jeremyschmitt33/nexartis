// lib/pdf/footer.ts - V3.0c.2
// Footer pleine largeur sur TOUTES les pages : trait orange + bandeau navy
// + texte centre blanc (ligne 1 entreprise) + ligne 2 numero & pagination.
// Anti-doublon prefixes SIRET / TVA / RM / APE.
//
// V3.0c.2 : separateur bullet U+2022 (baseline alignee Hanken Grotesk) + font
// 7.5pt medium pour la ligne 1 (plus lisible + plus stable visuellement).

import type { jsPDF } from 'jspdf'
import { C } from './palette'
import { font, setFill, setDraw, textCentered, textRight } from './utils'

interface FooterEntreprise {
  nom?: string
  siret?: string
  tva_intracommunautaire?: string
  rcs_rm?: string
  code_naf?: string
}

/**
 * Dessine le footer sur toutes les pages du document.
 *
 * @param prefix "Devis" ou "Facture" pour l'identifiant en bas-gauche.
 */
export function drawFooterAllPages(
  doc: jsPDF,
  ent: FooterEntreprise,
  numero: string,
  prefix: string,
): void {
  const total = doc.getNumberOfPages()
  const pageW = 210

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    // Trait orange de separation
    setDraw(doc, C.orange)
    doc.setLineWidth(0.6)
    doc.line(0, 282, pageW, 282)

    // Bandeau navy plein largeur (14.4mm de haut)
    setFill(doc, C.navy)
    doc.rect(0, 282.6, pageW, 14.4, 'F')

    const ligne1Parts: string[] = []
    if (ent.nom) ligne1Parts.push(ent.nom)
    if (ent.siret) ligne1Parts.push(withPrefix('SIRET', ent.siret))
    if (ent.tva_intracommunautaire) ligne1Parts.push(withPrefix('TVA', ent.tva_intracommunautaire))
    if (ent.rcs_rm) ligne1Parts.push(withPrefix('RM', ent.rcs_rm, ['RM', 'RCS']))
    if (ent.code_naf) ligne1Parts.push(withPrefix('APE', ent.code_naf, ['APE', 'NAF']))

    if (ligne1Parts.length > 0) {
      // V3.0c.2 : medium 7.5pt + separateur bullet (baseline propre)
      font(doc, 'Hanken Grotesk', 'medium', 7.5, C.white)
      textCentered(doc, ligne1Parts.join('  •  '), pageW / 2, 288.5, { maxWidth: pageW - 24 })
    }

    // Ligne 2 : prefixe + numero a gauche, pagination a droite
    font(doc, 'Hanken Grotesk', 'normal', 7, C.whiteSoft)
    doc.text(`${prefix} ${numero}`, 12, 293.5)
    textRight(doc, `Page ${i} / ${total}`, pageW - 12, 293.5)
  }
}

/**
 * Ajoute un prefixe a une valeur si elle ne commence pas deja par ce prefixe
 * (ou un prefixe alternatif accepte). Gere casse + tolere virgule/deux-points.
 */
function withPrefix(prefix: string, value: string, accepts?: string[]): string {
  const trimmed = value.trim()
  const upper = trimmed.toUpperCase()
  const candidates = [prefix, ...(accepts || [])]
  for (const c of candidates) {
    const cu = c.toUpperCase()
    if (upper.startsWith(cu + ' ') || upper.startsWith(cu + ':') || upper === cu) {
      return trimmed
    }
  }
  return `${prefix} ${trimmed}`
}

export { drawMiniHeaderPages2Plus } from './header'
