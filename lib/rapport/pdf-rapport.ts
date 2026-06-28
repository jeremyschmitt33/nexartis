/**
 * Generateur PDF du rapport d'intervention (cote NAVIGATEUR, jsPDF).
 * Page 1 : bandeau COULEURS SOCIETE (2 tons + diagonale orange), logo a gauche,
 * "RAPPORT / D'INTERVENTION" + numero a droite. Puis DATE (grosse) > CADRE CLIENT
 * (adresse rue + CP ville) > OBJET. Photos en CADRE FIXE (cover), legendes navy.
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
  clientNom: string | null
  adresseRue: string | null; adresseCp: string | null; adresseVille: string | null
  date: string | null; dateFin: string | null
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
const HEADER_H = 43.5
const GRAY: RGB = [120, 130, 150]
const GRAYTX: RGB = [68, 68, 68]
const DARK: RGB = [40, 55, 80]
const LIGHT: RGB = [228, 234, 242]
const CREAM: RGB = [250, 246, 239]
const NUMCOL: RGB = [216, 225, 240]

// Cadres FIXES (mm). cover -> meme empreinte quelle que soit la photo source.
const FULL_W = CW, FULL_H = Math.round((CW * 107 / 178) * 10) / 10  // 107 mm
const SIDE_W = 80, SIDE_H = 60

export function imageKeyOf(ref: PhotoRef): string { return ref.photoId || ref.localId || '' }
export function imgMapKey(ref: PhotoRef): string {
  const k = imageKeyOf(ref)
  return k ? `${k}:${ref.rotation || 0}:${ref.layout || 'below'}` : ''
}

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
  const logo = (e.logo_url as string | undefined) || ''
  const numero = opts.meta.numero || ''

  let y = 0

  function bandeauPage1() {
    setFill(doc, pal.navy)
    doc.lines([[125, 0], [-20, HEADER_H], [-105, 0], [0, -HEADER_H]], 0, 0, [1, 1], 'F', true)
    setFill(doc, pal.navyDroite)
    doc.lines([[A4.w - 125, 0], [0, HEADER_H], [-(A4.w - 105), 0], [20, -HEADER_H]], 125, 0, [1, 1], 'F', true)
    setFill(doc, pal.orange)
    doc.lines([[4, 0], [-20, HEADER_H], [-4, 0], [20, -HEADER_H]], 123, 0, [1, 1], 'F', true)

    let drew = false
    if (logo && logo.startsWith('data:image')) {
      try {
        const pr = (doc as unknown as { getImageProperties: (d: string) => { width: number; height: number; fileType: string } }).getImageProperties(logo)
        let lh = 16, lw = pr.height > 0 ? lh * (pr.width / pr.height) : 16
        const maxW = 52
        if (lw > maxW) { lw = maxW; lh = pr.width > 0 ? maxW * (pr.height / pr.width) : 16 }
        const pad = 2.5, cardX = 12
        const cardW = lw + 2 * pad, cardH = lh + 2 * pad
        const cardY = (HEADER_H - cardH) / 2
        setFill(doc, pal.white); doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, 'F')
        doc.addImage(logo, pr.fileType || 'PNG', cardX + pad, cardY + pad, lw, lh)
        drew = true
      } catch { drew = false }
    }
    if (!drew) { F('extrabold', 15, pal.white); doc.text(opts.entrepriseNom || 'Rapport', 14, HEADER_H / 2 + 2) }

    F('extrabold', 22, pal.white)
    doc.text('RAPPORT', 194, 14, { align: 'right' })
    doc.text('D’INTERVENTION', 194, 23.5, { align: 'right' })
    if (numero) { F('medium', 12, NUMCOL); doc.text(numero, 194, 32, { align: 'right' }) }
    y = HEADER_H + 8
  }

  function miniHeader() {
    const h = 12
    setFill(doc, pal.navy); doc.rect(0, 0, A4.w, h, 'F')
    F('extrabold', 9, pal.white); doc.text(opts.entrepriseNom || 'Rapport', M, 8)
    F('medium', 8, pal.white); doc.text(numero, A4.w - M, 8, { align: 'right' })
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
  function paragraph(t: string, size = 11) {
    if (!t) return
    F('normal', size, DARK)
    for (const ln of doc.splitTextToSize(t, CW)) { ensure(7); doc.text(ln, M, y); y += size * 0.62 }
    y += 2
  }
  function bullets(items: string[]) {
    F('normal', 11, DARK)
    for (const it of items.filter((x) => x && x.trim())) {
      const lines = doc.splitTextToSize(it, CW - 5)
      ensure(lines.length * 5.6 + 1)
      setFill(doc, pal.orange); doc.circle(M + 1, y - 1.3, 0.7, 'F')
      doc.text(lines, M + 4, y); y += lines.length * 5.6
    }
    y += 2
  }
  // Image en CADRE FIXE : l'image est deja recadree "cover" au bon ratio cote editeur.
  function drawFixed(ref: PhotoRef, x: number, boxW: number, boxH: number) {
    const img = opts.images.get(imgMapKey(ref))
    if (!img) {
      setFill(doc, LIGHT); doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F')
      F('normal', 8, GRAY); doc.text('Photo indisponible', x + boxW / 2, y + boxH / 2, { align: 'center' })
    } else {
      try { doc.addImage(img.dataUrl, 'JPEG', x, y, boxW, boxH) } catch { /* illisible */ }
    }
    setDraw(doc, LIGHT); doc.setLineWidth(0.3); doc.rect(x, y, boxW, boxH)
  }
  function legendeBlock(txt: string | undefined, x: number, w: number, yPos: number, size = 9.5): number {
    if (!txt || !txt.trim()) return 0
    F('medium', size, pal.navy)
    const lines = doc.splitTextToSize(txt, w)
    doc.text(lines, x, yPos)
    return lines.length * (size * 0.5) + 2
  }
  function photoFull(ref: PhotoRef) {
    ensure(FULL_H + 16)
    drawFixed(ref, M, FULL_W, FULL_H)
    y += FULL_H + 4
    y += legendeBlock(ref.legende, M, FULL_W, y, 9.5)
    y += 6
  }
  function photoSide(ref: PhotoRef) {
    ensure(SIDE_H + 10)
    const gut = 6, txtW = CW - SIDE_W - gut
    const yTop = y
    drawFixed(ref, M, SIDE_W, SIDE_H)
    const ch = legendeBlock(ref.legende, M + SIDE_W + gut, txtW, yTop + 5, 10)
    y = yTop + Math.max(SIDE_H, ch + 5) + 8
  }

  // ===== PAGE 1 =====
  bandeauPage1()

  // DATE (au-dessus du cadre client, plus grosse). Journee unique ou plage.
  if (opts.meta.date) {
    F('extrabold', 8.5, pal.orange); doc.text('DATE D’INTERVENTION', M, y); y += 5.5
    const d1 = fmtDate(opts.meta.date)
    const dtxt = (opts.meta.dateFin && opts.meta.dateFin !== opts.meta.date)
      ? `Du ${d1} au ${fmtDate(opts.meta.dateFin)}` : d1
    F('bold', 15, pal.navy); doc.text(dtxt, M, y); y += 9
  }

  // CADRE CLIENT (adresse rue + "CP ville")
  const addrLines: string[] = []
  if (opts.meta.adresseRue && opts.meta.adresseRue.trim()) addrLines.push(opts.meta.adresseRue.trim())
  const cpville = [opts.meta.adresseCp, opts.meta.adresseVille].map((x) => (x || '').trim()).filter(Boolean).join(' ')
  if (cpville) addrLines.push(cpville)
  const rows = (opts.meta.clientNom ? 1 : 0) + addrLines.length
  if (rows > 0) {
    const cardH = 9 + 6.8 + rows * 5.4 + 3
    setFill(doc, CREAM); setDraw(doc, LIGHT); doc.setLineWidth(0.3)
    doc.roundedRect(M, y, CW, cardH, 2.5, 2.5, 'FD')
    let cy = y + 8.5
    F('bold', 11, pal.orange); doc.text('CLIENT', M + 6, cy); cy += 7
    if (opts.meta.clientNom) { F('bold', 13, pal.navy); doc.text(opts.meta.clientNom, M + 6, cy); cy += 5.8 }
    F('normal', 10.5, GRAYTX); for (const l of addrLines) { doc.text(l, M + 6, cy); cy += 5.2 }
    y += cardH + 6
  }

  // OBJET (hors cadre, souligne)
  if (opts.meta.objet && opts.meta.objet.trim()) {
    F('extrabold', 11, pal.navy)
    const lab = 'OBJET :'; doc.text(lab, M, y)
    const lw = doc.getTextWidth(lab)
    setDraw(doc, pal.navy); doc.setLineWidth(0.4); doc.line(M, y + 1.4, M + lw, y + 1.4)
    F('bold', 13, DARK); doc.text(' ' + opts.meta.objet.trim(), M + lw, y)
    y += 9
  }
  y += 3

  // ===== PAGES =====
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
      if ((c.controles ?? []).some((x) => x && x.trim())) { sectionTitle(c.titreControles || 'Contrôles finaux'); bullets(c.controles ?? []) }
      if ((c.observations ?? []).some((x) => x && x.trim())) { sectionTitle(c.titreObservations || 'Observations'); bullets(c.observations ?? []) }
      if (c.conclusion && c.conclusion.trim()) { sectionTitle(c.titreConclusion || 'Conclusion'); paragraph(c.conclusion) }
    }
  }

  footer()
  return doc
}
