/**
 * Generateur PDF du rapport d'intervention (cote NAVIGATEUR, jsPDF).
 * SOURCE UNIQUE DE RENDU. Photos jamais rognees ni deformees (ajustees a leurs
 * vraies proportions). Mise en page auto selon le nombre de photos.
 */
import { jsPDF } from 'jspdf'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { buildPalette, type RGB } from '@/lib/pdf/palette'
import { themeFromEntreprise } from '@/lib/document-theme'
import { font, setFill, fmtDate } from '@/lib/pdf/utils'
import {
  type RapportPageData, type PhotoRef,
  type PhotosContent, type AvapContent, type TexteContent, type ConstatContent, type FinContent,
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
}

const A4 = { w: 210, h: 297 }
const M = 16
const CW = A4.w - 2 * M
const GRAY: RGB = [120, 130, 150]
const DARK: RGB = [40, 55, 80]
const LIGHT: RGB = [228, 234, 242]
const CREAM: RGB = [247, 243, 236]
const GREEN: RGB = [22, 163, 74]

export function imageKeyOf(ref: PhotoRef): string { return ref.photoId || ref.localId || '' }

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

  let y = 0

  function header(first: boolean) {
    const h = first ? 24 : 13
    setFill(doc, pal.navy); doc.rect(0, 0, A4.w, h, 'F')
    F('extrabold', first ? 15 : 10, pal.white)
    doc.text(opts.entrepriseNom || 'Rapport', M, first ? 14 : 8.5)
    F('medium', first ? 9 : 8, pal.white)
    const right = [opts.meta.numero, first && opts.meta.date ? fmtDate(opts.meta.date) : null].filter(Boolean).join('   ·   ')
    if (right) doc.text(right, A4.w - M, first ? 14 : 8.5, { align: 'right' })
    setFill(doc, pal.orange); doc.rect(0, h, A4.w, 1.4, 'F')
    y = h + (first ? 9 : 7)
  }
  function footer() {
    const fy = A4.h - 8
    F('normal', 8, GRAY)
    doc.text(opts.entrepriseNom || '', M, fy)
    doc.text('Rapport d’intervention', A4.w - M, fy, { align: 'right' })
  }
  function newPage() { footer(); doc.addPage(); header(false) }
  function ensure(need: number) { if (y + need > A4.h - 14) newPage() }

  function intro() {
    F('extrabold', 9.5, pal.orange); doc.text('RAPPORT D’INTERVENTION', M, y); y += 6
    F('extrabold', 19, pal.navy)
    const titre = doc.splitTextToSize(opts.meta.objet || 'Sans objet', CW)
    doc.text(titre, M, y); y += titre.length * 8.5 + 3
    F('normal', 11, DARK)
    const info: string[] = []
    if (opts.meta.clientNom) info.push('Client : ' + opts.meta.clientNom)
    if (opts.meta.adresse) info.push(opts.meta.adresse)
    if (opts.meta.date) info.push('Date d’intervention : ' + fmtDate(opts.meta.date))
    for (const line of info) { const ls = doc.splitTextToSize(line, CW); doc.text(ls, M, y); y += ls.length * 6 }
    y += 4
  }
  function sectionTitle(t: string) {
    ensure(14)
    F('extrabold', 13, pal.navy); doc.text(t, M, y); y += 2.5
    setFill(doc, LIGHT); doc.rect(M, y, CW, 0.4, 'F'); y += 5
  }
  function paragraph(t: string, size = 11.5) {
    if (!t) return
    F('normal', size, DARK)
    const lines = doc.splitTextToSize(t, CW)
    for (const ln of lines) { ensure(7); doc.text(ln, M, y); y += size * 0.62 }
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
    const img = opts.images.get(imageKeyOf(ref))
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

  // ----- Pages -----
  header(true)
  intro()

  for (const p of opts.pages) {
    if (p.type === 'photos') {
      const c = p.contenu as PhotosContent
      const list = (c.photos ?? []).filter((r) => r && (r.photoId || r.localId))
      if (list.length === 0 && !(c.commentaire && c.commentaire.trim())) continue
      sectionTitle('Travaux réalisés')
      if (list.length <= 2) {
        const boxH = list.length === 1 ? 130 : 92
        for (const ref of list) { ensure(boxH + 6); const h = drawImage(ref, M, CW, boxH); y += h + 4 }
      } else {
        const colW = (CW - 6) / 2
        for (let i = 0; i < list.length; i += 2) {
          ensure(62)
          const yTop = y
          const h1 = drawImage(list[i], M, colW, 56)
          let h2 = 0
          if (list[i + 1]) { y = yTop; h2 = drawImage(list[i + 1], M + colW + 6, colW, 56) }
          y = yTop + Math.max(h1, h2) + 4
        }
      }
      if (c.commentaire && c.commentaire.trim()) { paragraph(c.commentaire) }
      y += 2
    } else if (p.type === 'avap') {
      const c = p.contenu as AvapContent
      sectionTitle('Avant / Après')
      ensure(90)
      F('extrabold', 9.5, GRAY); doc.text('AVANT', M, y); y += 4
      y += drawImage(c.avant ?? {}, M, CW, 78) + 5
      ensure(90)
      F('extrabold', 9.5, GREEN); doc.text('APRÈS', M, y); y += 4
      y += drawImage(c.apres ?? {}, M, CW, 78) + 5
      const m = c.mesure
      if (m && (m.label || m.avant || m.apres)) {
        ensure(14)
        setFill(doc, CREAM); doc.roundedRect(M, y, CW, 11, 2, 2, 'F')
        F('bold', 11, pal.navy)
        const txt = `${m.label || 'Mesure'} : ${m.avant || '?'} ${m.unite || ''} → ${m.apres || '?'} ${m.unite || ''}`.replace(/\s+/g, ' ').trim()
        doc.text(txt, A4.w / 2, y + 7, { align: 'center' })
        y += 14
      }
      y += 2
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
