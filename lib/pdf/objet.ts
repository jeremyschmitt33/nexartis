// lib/pdf/objet.ts - V3.0c
// Bloc OBJET + ADRESSE DU CHANTIER en 2 colonnes a plat (sans cadre).
// Labels uppercase muted, valeurs navy.

import type { jsPDF } from 'jspdf'
import { C } from './palette'
import { font } from './utils'

/**
 * Dessine le bloc Objet + Adresse chantier.
 *
 * @param objet            Objet du devis/facture.
 * @param chantierAdresse  Adresse du chantier (optionnelle).
 * @param yStart           y absolu pour demarrer (label en haut).
 *
 * @returns nouveau y apres le bloc.
 */
export function drawObjet(
  doc: jsPDF,
  objet: string | undefined,
  chantierAdresse: string | undefined,
  yStart: number,
): number {
  if (!objet && !chantierAdresse) return yStart

  const leftX = 18
  const rightX = 108
  const colW = 84
  const labelY = yStart
  const valueY = yStart + 4

  // Colonne gauche : OBJET
  if (objet) {
    font(doc, 'Hanken Grotesk', 'semibold', 7, C.muted)
    doc.text('OBJET', leftX, labelY, { charSpace: 0.6 })
    font(doc, 'Hanken Grotesk', 'normal', 10, C.navy)
    const split = doc.splitTextToSize(objet, colW)
    doc.text(split, leftX, valueY)
  }

  // Colonne droite : ADRESSE DU CHANTIER
  if (chantierAdresse) {
    font(doc, 'Hanken Grotesk', 'semibold', 7, C.muted)
    doc.text('ADRESSE DU CHANTIER', rightX, labelY, { charSpace: 0.6 })
    font(doc, 'Hanken Grotesk', 'normal', 10, C.navy)
    const split = doc.splitTextToSize(chantierAdresse, colW)
    doc.text(split, rightX, valueY)
  }

  // Hauteur consommee : on prend 12 mm de base (label 4 + 2 lignes max)
  // S'il y a beaucoup de texte, on calcule.
  const leftLines = objet ? doc.splitTextToSize(objet, colW).length : 0
  const rightLines = chantierAdresse ? doc.splitTextToSize(chantierAdresse, colW).length : 0
  const maxLines = Math.max(leftLines, rightLines, 1)
  const consumed = 4 + maxLines * 4 + 4

  return yStart + Math.max(12, consumed)
}
