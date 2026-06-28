/**
 * Generateur PDF du rapport d'intervention (cote NAVIGATEUR, jsPDF).
 * SOURCE UNIQUE DE RENDU. 1re page soignee (logo + grand titre + cadre client).
 * Photos jamais rognees/deformees (ajustees a leurs proportions), rotation deja
 * appliquee dans l'image fournie. Mise en page auto selon le nombre de photos.
 */
import { jsPDF } from 'jspdf'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { buildPalette, type RGB } from '@/lib/pdf/palette'
import { themeFromEntreprise } from '@/lib/document-theme'
import { font, setFill, setDraw, fmtDate } from '@/lib/pdf/utils'
import {
  type RapportPageData, type PhotoRef,
  type PhotosContent, type TexteContent, type ConstatContent, type FinContent,
  photoRefsOf,
} from './page-content'

export interface PdfImage { dataUrl: string; w: number; h: number }
export interface RapportPdfMeta {
  numero: string | null; objet: string | null
  clientNom: string | null; adresse: string | null; date: string | null
}
export interface GenerateOpts {
  meta: RapportPdfMeta
  pages: RapportPageData[]
  images: Map<string, PdfImage>
  entrepriseNom: string
  entreprise: unknown
  logoDataUrl?: string | null
}

const A4 = { w: 210, h: 297 }
const M = 16
const CW = A4.w - 2 * M
const GRAY: RGB = [120, 130, 150]
const DARK: RGB = [40, 55, 80]
const LIGHT: RGB = [228, 234, 242]
const CREAM: RGB = [247, 243, 236]

export function imageKeyOf(ref: PhotoRef): string { return ref.photoId || ref.localId || '' }
export function imgMapKey(ref: PhotoRef): string { const k = imageKeyOf(ref); return k ? `${k}:${ref.rotation || 0}` : '' }

export function collectPhotoRefs(pages: RapportPageData[]): PhotoRef[] {
  const out: PhotoRef[] = []
  for (const p of pages) for (const r of photoRefsOf(p.type, p.contenu)) if (r && (r.photoId || r.localId)) out.push(r)
  return out
}

export function generateRapportPdf(opts: GenerateOpts): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerPdfFonts(doc)
  const pal = buildPalette(themeFromEntreprise(opts.entreprise))
  const F = (st: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold', size: number, c?: RGB) => font(doc, 'Hanken Grotesk', st, size, c)
  const logo = opts.logoDataUrl || null

  let y = 0

  function header(first: boolean) {
    const h = first ? (logo ? 34 : 28) : 13
    setFill(doc, pal.navy); doc.rect(0, 0, A4.w, h, 'F')
    let drew = false
    if (logo) {
      try {
        const pr = (doc as unknown as { getImageProperties: (d: string) => { width: number; height: number; fileType: string } }).getImageProperties(logo)
        const lh = first ? 18 : 9
        const lw = pr.height > 0 ? lh * (pr.width / pr.height) : lh
        doc.addImage(logo, pr.fileType || 'PNG', M, (h - lh) / 2, Math.min(lw, 70), lh)
        drew = true
      } catch { drew = false }
    }
    if (!drew) {
      F('extrabold', first ? 16 : 10, pal.white)
      doc.text(opts.entrepriseNom || 'Rapport', M, first ? h / 2 + 2 : 8.5)
    }
    F('medium', first ? 9 : 8, pal.white)
    const right = [opts.meta.numero, first && opts.meta.date ? fmtDate(opts.meta.date) : null].filter(Boolean).join('   ·   ')
    if (right) doc.text(right, A4.w - M, first ? h / 2 + 2 : 8.5, { align: 'right' })
    setFill(doc, pal.orange); doc.rect(0, h, A4.w, 1.6, 'F')
    y = h + (first ? 12 : 7)
  }
  function footer() {
    const fy = A4.h - 8
    F('normal', 8, GRAY)
    doc.text(opts.entrepriseNom || '', M, fy)
    doc.text('Rapport d’intervention', A4.w - M, fy, { align: 'right' })
  }
  function newPage() { footer(); doc.addPage(); header(false) }
  function ensure(need: number) { if (y + need > A4.h - 14) newPage() }

  function cover() {
    F('extrabold', 11, pal.orange); doc.text('RAPPORT D’INTERVENTION', M, y); y += 9
    F('extrabold', 23, pal.navy)
    const titre = doc.splitTextToSize(opts.meta.objet || 'Sans objet', CW)
    doc.text(titre, M, y); y += titre.length * 9.5 + 6

    // Cadre client
    const lines: string[] = []
    if (opts.meta.clientNom) lines.push(opts.meta.clientNom)
    if (opts.meta.adresse) { for (const l of doc.splitTextToSize(opts.meta.adresse, CW - 16)) lines.push(l) }
    if (opts.meta.date) lines.push('Date d’intervention : ' + fmtDate(opts.meta.date))
    const cardH = 12 + lines.length * 5.6 + 4
    setFill(doc, CREAM); setDraw(doc, LIGHT); doc.setLineWidth(0.3)
    doc.roundedRect(M, y, CW, cardH, 3, 3, 'FD')
    let cy = y + 8
    F('extrabold', 8, pal.orange); doc.text('CLIENT', M + 6, cy); cy += 6
    F('normal', 11, DARK)
    for (const l of lines) { doc.text(l, M + 6, cy); cy += 5.6 }
    y += cardH + 8
  }

  function sectionTitle(t: string) {
    ensure(14)
    F('extrabold', 13, pal.navy); doc.text(t, M, y); y += 2.5
    setFill(doc, LIGHT); doc.rect(M, y, CW, 0.4, 'F'); y += 5
  }
  function paragraph(t: string, size = 11.5) {
    if (!t) return
    F('normal', size, DARK)
    for (const ln of doc.splitTextToSize(t, CW)) { ensure(7); doc.text(ln, M, y); y += size * 0.62 }
    y += 2
  }
  function bullets(items: string[]) {
    F('normal', 11.5, DARK)
    for (const it of items.filter((x) => x && x.trim())) {
      const lines = doc.splitTextToSize(it, CW - 5)
      ensure(lines.length * 5.8 + 1)
      setFill(doc, pal.orange); doc.circle(M + 1, y - 1.3, 0.7, 'F')
      doc.text(lines, M + 4, y); y += lines.length * 5.8
    }
    y += 2
  }
  function drawImage(ref: PhotoRef, x: number, boxW: number, boxH: number): number {
    const img = opts.images.get(imgMapKey(ref))
    if (!img) {
      setFill(doc, LIGHT); doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F')
      F('normal', 8, GRAY); doc.text('Photo indisponible', x + boxW / 2, y + boxH / 2, { align: 'center' })
      return boxH
    }
    const ratio = img.w > 0 ? img.h / img.w : 0.72
    let w = boxW, h = w * ratio
    if (h > boxH) { h = boxH; w = h / ratio }
    const dx = x + (boxW - w) / 2
    try { doc.addImage(img.dataUrl, 'JPEG', dx, y, w, h) } catch { /* image illisible */ }
    return h
  }
  // Dessine une photo + sa legende a une position donnee ; renvoie la hauteur totale.
  function photoCell(ref: PhotoRef, x: number, yStart: number, colW: number, imgBoxH: number): number {
    const saved = y; y = yStart
    const ih = drawImage(ref, x, colW, imgBoxH)
    let total = ih
    const leg = ref.legende
    if (leg && leg.trim()) {
      F('medium', 9, GRAY)
      const lines = doc.splitTextToSize(leg, colW)
      doc.text(lines, x, yStart + ih + 4)
      total = ih + 4 + lines.length * 4
    }
    y = saved
    return total
  }

  // ----- Pages -----
  header(true)
  cover()

  for (const p of opts.pages) {
    if (p.type === 'photos') {
      const c = p.contenu as PhotosContent
      const list = (c.photos ?? []).filter((r) => r && (r.photoId || r.localId))
      if (list.length === 0 && !(c.titre && c.titre.trim())) continue
      if (c.titre && c.titre.trim()) sectionTitle(c.titre)
      else { ensure(4); y += 1 }
      if (list.length <= 2) {
        const imgBoxH = list.length === 1 ? 125 : 90
        for (const ref of list) { ensure(imgBoxH + 16); const hh = photoCell(ref, M, y, CW, imgBoxH); y += hh + 5 }
      } else {
        const colW = (CW - 6) / 2
        for (let i = 0; i < list.length; i += 2) {
          ensure(70)
          const yTop = y
          const h1 = photoCell(list[i], M, yTop, colW, 52)
          const h2 = list[i + 1] ? photoCell(list[i + 1], M + colW + 6, yTop, colW, 52) : 0
          y = yTop + Math.max(h1, h2) + 5
        }
      }
      y += 1
    } else if (p.type === 'texte') {
      const c = p.contenu as TexteContent
      if (c.titre && c.titre.trim()) sectionTitle(c.titre)
      else { ensure(4); y += 2 }
      paragraph(c.texte || '')
    } else if (p.type === 'constat') {
      const c = p.contenu as ConstatContent
      if ((c.items ?? []).some((x) => x && x.trim())) { sectionTitle('Constatations'); bullets(c.items ?? []) }
    } else if (p.type === 'fin') {
      const c = p.contenu as FinContent
      if ((c.controles ?? []).some((x) => x && x.trim())) { sectionTitle('Contrôles finaux'); bullets(c.controles ?? []) }
      if ((c.observations ?? []).some((x) => x && x.trim())) { sectionTitle('Observations'); bullets(c.observations ?? []) }
      if (c.conclusion && c.conclusion.trim()) { sectionTitle('Conclusion'); paragraph(c.conclusion) }
    }
  }

  footer()
  return doc
}
