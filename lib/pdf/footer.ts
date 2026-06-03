// lib/pdf/footer.ts - V3.0c
// Footer pleine largeur sur TOUTES les pages : trait orange + bandeau navy
// + texte centre blanc (ligne 1 entreprise) + ligne 2 numero & pagination.

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
 * A appeler en FIN de generation (apres le rendu complet, quand on connait
 * le nombre total de pages).
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
  const pageH = 297

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    // 1. Trait horizontal orange 0.6 mm a y=282
    setDraw(doc, C.orange)
    doc.setLineWidth(0.6)
    doc.line(0, 282, pageW, 282)

    // 2. Bandeau navy plein y=282.6 -> y=297 (h=14.4)
    setFill(doc, C.navy)
    doc.rect(0, 282.6, pageW, 14.4, 'F')

    // 3. Ligne 1 (centree y=288) : nom + SIRET + TVA + RM + APE
    const ligne1Parts: string[] = []
    if (ent.nom) ligne1Parts.push(ent.nom)
    if (ent.siret) ligne1Parts.push(`SIRET ${ent.siret}`)
    if (ent.tva_intracommunautaire) ligne1Parts.push(`TVA ${ent.tva_intracommunautaire}`)
    if (ent.rcs_rm) ligne1Parts.push(`RM ${ent.rcs_rm}`)
    if (ent.code_naf) ligne1Parts.push(`APE ${ent.code_naf}`)
    if (ligne1Parts.length > 0) {
      font(doc, 'Hanken Grotesk', 'normal', 7, C.white)
      textCentered(doc, ligne1Parts.join('   ·   '), pageW / 2, 288, { maxWidth: pageW - 36 })
    }

    // 4. Coin bas-gauche y=292 : "Devis NUMERO" ou "Facture NUMERO"
    font(doc, 'Hanken Grotesk', 'normal', 7, C.whiteSoft)
    doc.text(`${prefix} ${numero}`, 10, 292)

    // 5. Coin bas-droit y=292 : "Page X / Y"
    textRight(doc, `Page ${i} / ${total}`, pageW - 10, 292)

    void pageH
  }
}

/**
 * Mini-header en haut des pages 2+ : trait fin + nom + numero + date emission.
 * Re-export pratique : on importe deja la version "lib/pdf/header.ts" depuis
 * l'orchestrateur, mais on garde une version ici pour cohesion module.
 *
 * Note : la version officielle est dans lib/pdf/header.ts (drawMiniHeaderPages2Plus).
 * Ce fichier la re-export pour confort import.
 */
export { drawMiniHeaderPages2Plus } from './header'
