/**
 * Generateur PDF du rapport d'intervention (cote NAVIGATEUR, jsPDF).
 * 1re page = MEME bandeau que devis/facture (couleurs societe + logo) via
 * drawHeader, puis grand titre "RAPPORT D'INTERVENTION" + cadre client.
 * Photos jamais rognees/deformees ; rotation deja appliquee ; chaque photo a
 * sa disposition (texte dessous ou texte a cote).
 */
import { jsPDF } from 'jspdf'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { buildPalette, type RGB } from '@/lib/pdf/palette'
import { themeFromEntreprise } from '@/lib/document-theme'
import { font, setFill, setDraw, fmtDate } from '@/lib/pdf/utils'
import { drawHeader } from '@/lib/pdf/header'
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

  const e = (opts.entreprise || {}) as Record<string, unknown>
  const ent = {
    nom: opts.entrepriseNom,
    logo_url: (e.logo_url as string | undefined) ?? undefined,
    doc_logo_style: e.doc_logo_style as 'carte-classique' | 'carte-minimaliste' | 'sans-carte' | null | undefined,
    doc_logo_size: (e.doc_logo_size as number | null | undefined) ?? null,
    doc_nom_size: (e.doc_nom_size as number | null | undefined) ?? null,
    document_show_company_name: (e.document_show_company_name as boolean | null | undefined) ?? null,
  }

  let y = 0

  function miniHeader() {
    const h = 12
    setFill(doc, pal.navy); doc.rect(0, 0, A4.w, h, 'F')
    F('extrabold', 9, pal.white); doc.text(opts.entrepriseNom || 'Rapport', M, 8)
    F('medium', 8, pal.white); doc.text(opts.meta.numero || '', A4.w - M, 8, { align: 'right' })
    setFill(doc, pal.orange); doc.rect(0, h, A4.w, 1.2, 'F')
    y = h + 8
  }
  function footer() {
    F('normal', 8, GRAY)
    doc.text(opts.entrepriseNom || '', M, A4.h - 8)
    doc.text('Rapport d’intervention', A4.w - M, A4.h - 8, { align: 'right' })
  }
  function newPage() { footer(); doc.addPage(); miniHeader() }
  function ensure(need: number) { if (y + need > A4.h - 14) newPage() }

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
  function photoFull(ref: PhotoRef) {
    ensure(125)
    const ih = drawImage(ref, M, CW, 115); y += ih
    if (ref.legende && ref.legende.trim()) {
      F('medium', 10, GRAY)
      const lines = doc.splitTextToSize(ref.legende, CW)
      doc.text(lines, M, y + 4.5); y += lines.length * 4.6 + 2
    }
    y += 5
  }
  function photoSide(ref: PhotoRef) {
    ensure(64)
    const imgW = Math.round(CW * 0.52)
    const yTop = y
    const ih = drawImage(ref, M, imgW, 58)
    let ch = 0
    if (ref.legende && ref.legende.trim()) {
      F('normal', 11, DARK)
      const tw = CW - imgW - 8
      const lines = doc.splitTextToSize(ref.legende, tw)
      doc.text(lines, M + imgW + 8, yTop + 6)
      ch = lines.length * 5.6 + 6
    }
    y = yTop + Math.max(ih, ch) + 5
  }

  // ----- Page 1 : bandeau societe (drawHeader) + titre + cadre client -----
  y = drawHeader(doc, ent, 'RAPPORT', opts.meta.numero || '', opts.meta.date ? fmtDate(opts.meta.date) : '', 'Intervention le', '', '', pal) + 12

  F('extrabold', 30, pal.navy)
  for (const ln of doc.splitTextToSize('RAPPORT D’INTERVENTION', CW)) { doc.text(ln, M, y); y += 12 }
  y += 1
  if (opts.meta.objet && opts.meta.objet.trim()) {
    F('semibold', 15, DARK)
    for (const ln of doc.splitTextToSize(opts.meta.objet, CW)) { doc.text(ln, M, y); y += 7 }
  }
  y += 4
  {
    const lines: string[] = []
    if (opts.meta.clientNom) lines.push(opts.meta.clientNom)
    if (opts.meta.adresse) for (const l of doc.splitTextToSize(opts.meta.adresse, CW - 16)) lines.push(l)
    if (opts.meta.date) lines.push('Date d’intervention : ' + fmtDate(opts.meta.date))
    if (lines.length) {
      const cardH = 12 + lines.length * 5.6 + 3
      setFill(doc, CREAM); setDraw(doc, LIGHT); doc.setLineWidth(0.3)
      doc.roundedRect(M, y, CW, cardH, 3, 3, 'FD')
      let cy = y + 8
      F('extrabold', 8, pal.orange); doc.text('CLIENT', M + 6, cy); cy += 6
      F('normal', 11, DARK)
      for (const l of lines) { doc.text(l, M + 6, cy); cy += 5.6 }
      y += cardH + 8
    }
  }

  // ----- Pages -----
  for (const p of opts.pages) {
    if (p.type === 'photos') {
      const c = p.contenu as PhotosContent
      const list = (c.photos ?? []).filter((r) => r && (r.photoId || r.localId))
      if (list.length === 0 && !(c.titre && c.titre.trim())) continue
      if (c.titre && c.titre.trim()) sectionTitle(c.titre)
      else { ensure(4); y += 1 }
      for (const ref of list) { if (ref.layout === 'side') photoSide(ref); else photoFull(ref) }
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
