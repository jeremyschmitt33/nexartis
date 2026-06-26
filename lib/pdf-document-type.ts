// ---------------------------------------------------------------------------
// lib/pdf-document-type.ts
// Generation PDF CLIENT-side d'un document type (CGV / PV de reception).
// jsPDF natif (helvetica), sobre, navy/orange. En-tete entreprise + logo si
// dispo, corps multi-pages du texte edite, pied de page avec disclaimer.
// Telechargement via lib/download-pdf.ts (cross-plateforme iOS/Android/desktop).
// ---------------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import { downloadPdfBlob, type PdfDownloadResult } from './download-pdf'
import { DOC_TYPE_DISCLAIMER } from './documents-types/context'

const NAVY: [number, number, number] = [15, 26, 58]      // #0f1a3a
const ORANGE: [number, number, number] = [255, 122, 26]  // #ff7a1a
const SLATE: [number, number, number] = [71, 85, 105]    // #475569
const MUTED: [number, number, number] = [120, 130, 150]
const BORDER: [number, number, number] = [226, 232, 240]

interface PdfEntreprise {
  nom?: string | null
  siret?: string | null
  code_naf?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  logo_url?: string | null
}

const M = 16            // marge laterale (mm)
const PAGE_W = 210      // A4 portrait
const PAGE_H = 297
const CONTENT_W = PAGE_W - M * 2
const BODY_TOP = 46     // y de depart du corps apres l'en-tete
const BODY_BOTTOM = 282 // y max avant pied de page

/** Construit le jsPDF document. Exporte pour tests/reutilisation. */
export function buildDocumentTypePdf(
  titre: string,
  contenu: string,
  entreprise: PdfEntreprise | null | undefined,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const e = entreprise || {}

  // -------- En-tete (page 1) --------
  let logoW = 0
  if (e.logo_url && e.logo_url.startsWith('data:image')) {
    try {
      const fmt = e.logo_url.indexOf('image/png') >= 0 ? 'PNG' : 'JPEG'
      const props = doc.getImageProperties(e.logo_url)
      const ratio = props.width / props.height
      let w = 18
      let h = w / ratio
      if (h > 18) { h = 18; w = h * ratio }
      if (w > 34) w = 34
      doc.addImage(e.logo_url, fmt, M, 12, w, h)
      logoW = w + 6
    } catch { /* logo ignore si invalide */ }
  }

  const infoX = M + logoW
  let y = 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text((e.nom || 'Entreprise').toString(), infoX, y)
  y += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2])
  const adr = [e.adresse, [e.code_postal, e.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  if (adr) { doc.text(adr, infoX, y); y += 3.6 }
  const siret = (e.siret || '').toString().trim()
  if (siret) { doc.text(`SIRET ${siret}`, infoX, y); y += 3.6 }
  const contact = [e.telephone, e.email].filter(Boolean).join(' - ')
  if (contact) { doc.text(contact, infoX, y); y += 3.6 }

  // Trait separateur sous l'en-tete
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
  doc.setLineWidth(0.3)
  doc.line(M, 36, PAGE_W - M, 36)

  // Titre du document (barre orange + titre)
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.rect(M, 40, 3, 4.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text((titre || 'Document').toString(), M + 6, 43.6)

  // -------- Corps multi-pages --------
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])

  let cy = BODY_TOP
  const lineH = 4.6
  // On respecte les sauts de ligne saisis par l'artisan, puis on wrappe.
  const rawLines = (contenu || '').replace(/\r\n/g, '\n').split('\n')

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    // Detection simple de "titre de section" : ligne en majuscules, courte.
    const trimmed = raw.trim()
    const isHeading =
      trimmed.length > 0 &&
      trimmed.length <= 70 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed)

    if (isHeading) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
    }

    const wrapped: string[] = trimmed === ''
      ? ['']
      : (doc.splitTextToSize(raw, CONTENT_W) as string[])

    for (let j = 0; j < wrapped.length; j++) {
      if (cy > BODY_BOTTOM) {
        doc.addPage()
        cy = 20
      }
      if (wrapped[j] !== '') doc.text(wrapped[j], M, cy)
      cy += lineH
    }
  }

  // -------- Pied de page (disclaimer) sur toutes les pages --------
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
    doc.setLineWidth(0.2)
    doc.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
    const footLines = doc.splitTextToSize(DOC_TYPE_DISCLAIMER, CONTENT_W - 20) as string[]
    doc.text(footLines, M, PAGE_H - 10)
    doc.text(`${p}/${pageCount}`, PAGE_W - M, PAGE_H - 10, { align: 'right' })
  }

  return doc
}

/** Slugifie un titre pour le nom de fichier (ASCII safe). */
function slugify(s: string): string {
  return (s || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 50) || 'document'
}

/**
 * Genere et telecharge le PDF du document type.
 * A appeler depuis un handler synchrone de clic (contrainte iOS).
 */
export function generateDocumentTypePdf(
  titre: string,
  contenuEdite: string,
  entreprise: PdfEntreprise | null | undefined,
): PdfDownloadResult {
  const doc = buildDocumentTypePdf(titre, contenuEdite, entreprise)
  const blob = doc.output('blob') as Blob
  const filename = `${slugify(titre)}.pdf`
  return downloadPdfBlob(blob, filename)
}
