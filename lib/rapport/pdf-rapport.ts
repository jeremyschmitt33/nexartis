/**
 * Generateur PDF du rapport d'intervention (cote NAVIGATEUR, jsPDF).
 * SOURCE UNIQUE DE RENDU : l'apercu affiche ce meme PDF -> zero divergence.
 * Reutilise la charte (couleurs du theme entreprise) + les polices embarquees.
 * Photos passees en dataURL (binaires embarques) pour un PDF autonome.
 */
import { jsPDF } from 'jspdf'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { buildPalette } from '@/lib/pdf/palette'
import { themeFromEntreprise } from '@/lib/document-theme'
import { font, setFill, fmtDate } from '@/lib/pdf/utils'
import type { RGB } from '@/lib/pdf/palette'
import type {
  RapportPageData, PhotoRef,
  ConstatContent, PosteContent, Photo1Content, Photo2Content, AvapContent, FinContent,
} from './page-content'
import { photoRefsOf } from './page-content'

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
  const F = (fam: 'Hanken Grotesk', st: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold', size: number, c?: RGB) => font(doc, fam, st, size, c)

  let y = 0
  let firstOfPage = true

  function header(first: boolean) {
    const h = first ? 24 : 13
    setFill(doc, pal.navy); doc.rect(0, 0, A4.w, h, 'F')
    F('Hanken Grotesk', 'extrabold', first ? 15 : 10, pal.white)
    doc.text(opts.entrepriseNom || 'Rapport', M, first ? 14 : 8.5)
    F('Hanken Grotesk', 'medium', first ? 9 : 8, pal.white)
    const right = [opts.meta.numero, first && opts.meta.date ? fmtDate(opts.meta.date) : null].filter(Boolean).join('   ·   ')
    if (right) doc.text(right, A4.w - M, first ? 14 : 8.5, { align: 'right' })
    setFill(doc, pal.orange); doc.rect(0, h, A4.w, 1.4, 'F')
    y = h + (first ? 9 : 7)
    firstOfPage = true
  }

  function footer() {
    const fy = A4.h - 8
    F('Hanken Grotesk', 'normal', 8, GRAY)
    doc.text(opts.entrepriseNom || '', M, fy)
    doc.text('Rapport d’intervention', A4.w - M, fy, { align: 'right' })
  }

  function newPage() { footer(); doc.addPage(); header(false) }
  function ensure(need: number) { if (y + need > A4.h - 14) newPage() }

  // Bloc titre (page 1)
  function intro() {
    F('Hanken Grotesk', 'extrabold', 9.5, pal.orange)
    doc.text('RAPPORT D’INTERVENTION', M, y); y += 6
    F('Hanken Grotesk', 'extrabold', 19, pal.navy)
    const titre = doc.splitTextToSize(opts.meta.objet || 'Sans objet', CW)
    doc.text(titre, M, y); y += titre.length * 8.5 + 3
    F('Hanken Grotesk', 'normal', 11.5, DARK)
    const info: string[] = []
    if (opts.meta.clientNom) info.push('Client : ' + opts.meta.clientNom)
    if (opts.meta.adresse) info.push(opts.meta.adresse)
    if (opts.meta.date) info.push('Date d’intervention : ' + fmtDate(opts.meta.date))
    for (const line of info) { doc.text(line, M, y); y += 6 }
    y += 4
  }

  function sectionTitle(t: string) {
    ensure(12)
    F('Hanken Grotesk', 'extrabold', 13, pal.navy)
    doc.text(t, M, y); y += 2.5
    setFill(doc, LIGHT); doc.rect(M, y, CW, 0.4, 'F'); y += 5
  }

  function paragraph(t: string, size = 11.5, color = DARK) {
    if (!t) return
    F('Hanken Grotesk', 'normal', size, color)
    const lines = doc.splitTextToSize(t, CW)
    for (const ln of lines) { ensure(6); doc.text(ln, M, y); y += size * 0.62 }
    y += 2
  }

  function bullets(items: string[]) {
    F('Hanken Grotesk', 'normal', 11.5, DARK)
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
      F('Hanken Grotesk', 'normal', 8, GRAY)
      doc.text('Photo indisponible', x + boxW / 2, y + boxH / 2, { align: 'center' })
      return boxH
    }
    const ratio = img.w > 0 ? img.h / img.w : 0.72
    let w = boxW, h = w * ratio
    if (h > boxH) { h = boxH; w = h / ratio }
    const dx = x + (boxW - w) / 2
    try { doc.addImage(img.dataUrl, 'JPEG', dx, y, w, h) } catch { /* image illisible */ }
    return h
  }

  function legende(t: string | undefined, x: number, w: number) {
    if (!t || !t.trim()) return
    F('Hanken Grotesk', 'medium', 10, GRAY)
    const lines = doc.splitTextToSize(t, w)
    doc.text(lines, x, y + 3.5); y += lines.length * 4.6 + 1
  }

  // ----- Rendu -----
  header(true)
  intro()

  for (const p of opts.pages) {
    if (p.type === 'constat') {
      const c = p.contenu as ConstatContent
      if ((c.items ?? []).some((x) => x && x.trim())) { sectionTitle('Constatations'); bullets(c.items ?? []) }
    } else if (p.type === 'poste') {
      const c = p.contenu as PosteContent
      sectionTitle(c.titre || 'Travaux réalisés'); paragraph(c.texte || '')
    } else if (p.type === 'photo1') {
      const c = p.contenu as Photo1Content
      sectionTitle('Travaux réalisés')
      ensure(95); const hh = drawImage(c.photo ?? {}, M, CW, 90); y += hh; legende(c.photo?.legende, M, CW); y += 4
    } else if (p.type === 'photo2') {
      const c = p.contenu as Photo2Content
      sectionTitle('Travaux réalisés')
      for (const ref of (c.photos ?? [])) {
        ensure(78); const hh = drawImage(ref ?? {}, M, CW, 72); y += hh; legende(ref?.legende, M, CW); y += 3
      }
      y += 2
    } else if (p.type === 'avap') {
      const c = p.contenu as AvapContent
      sectionTitle('Avant / Après')
      ensure(70)
      const colW = (CW - 6) / 2
      F('Hanken Grotesk', 'extrabold', 9.5, GRAY); doc.text('AVANT', M, y)
      F('Hanken Grotesk', 'extrabold', 9.5, [22, 163, 74] as RGB); doc.text('APRÈS', M + colW + 6, y); y += 3
      const yTop = y
      const h1 = drawImage(c.avant ?? {}, M, colW, 60)
      y = yTop; const h2 = drawImage(c.apres ?? {}, M + colW + 6, colW, 60)
      y = yTop + Math.max(h1, h2) + 3
      const m = c.mesure
      if (m && (m.label || m.avant || m.apres)) {
        ensure(14)
        setFill(doc, CREAM); doc.roundedRect(M, y, CW, 11, 2, 2, 'F')
        F('Hanken Grotesk', 'bold', 11, pal.navy)
        const txt = `${m.label || 'Mesure'} : ${m.avant || '?'} ${m.unite || ''} → ${m.apres || '?'} ${m.unite || ''}`.replace(/\s+/g, ' ').trim()
        doc.text(txt, A4.w / 2, y + 7, { align: 'center' })
        y += 14
      }
      y += 2
    } else if (p.type === 'fin') {
      const c = p.contenu as FinContent
      if ((c.controles ?? []).some((x) => x && x.trim())) { sectionTitle('Contrôles finaux'); bullets(c.controles ?? []) }
      if ((c.observations ?? []).some((x) => x && x.trim())) { sectionTitle('Observations'); bullets(c.observations ?? []) }
      if (c.conclusion && c.conclusion.trim()) { sectionTitle('Conclusion'); paragraph(c.conclusion) }
    }
    void firstOfPage
  }

  footer()
  return doc
}
