// lib/pdf/plan.ts - Push 5 (Module Plan 2D, 06/07/2026)
// Annexe « Plan du chantier » : pages ajoutées EN FIN de devis, une par image
// (PNG data URL générée à l'injection, stockée dans plans.export_images).
// Module ADDITIF partagé par les DEUX PDF (download + email) via lib/pdf.ts :
// même code, même image => parité par construction avec le HTML et /signer.
// Appelé AVANT drawMiniHeaderPages2Plus/drawFooterAllPages pour que les pages
// de plan reçoivent aussi le mini-header et le footer.
// Best-effort strict : une image absente/corrompue est ignorée, jamais d'erreur.

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
import { font, setDraw, setFill } from './utils'
import { MAX_IMAGES_PLAN_DEVIS, MENTION_PLAN_INDICATIF } from '@/lib/plan/plan-images'

export interface PdfPlanImage {
  titre: string
  dataUrl: string
}

/** Marges identiques aux autres modules PDF (M=18, largeur utile 174mm). */
const M = 18
const W = 174
/** Y de départ sous le mini-header des pages 2+. */
const Y_DEBUT = 30
/** Limite basse : au-dessus du footer (dessiné vers ~278mm) + mention. */
const Y_MAX_IMAGE = 252

export function drawPlanAnnexe(
  doc: jsPDF,
  images: PdfPlanImage[],
  palette: Palette = C,
): void {
  const P = palette
  const valides = (images ?? []).filter(
    (i) => i && typeof i.dataUrl === 'string' && i.dataUrl.startsWith('data:image')
  )
  for (const img of valides.slice(0, MAX_IMAGES_PLAN_DEVIS)) {
    // Propriétés AVANT addPage : une image illisible ne crée pas de page vide.
    let props: { width: number; height: number }
    try {
      props = doc.getImageProperties(img.dataUrl)
      if (!props || !props.width || !props.height) continue
    } catch {
      continue
    }

    doc.addPage()
    let y = Y_DEBUT
    font(doc, 'Hanken Grotesk', 'bold', 12, P.navy)
    doc.text('Plan du chantier', M, y)
    if (img.titre) {
      font(doc, 'Hanken Grotesk', 'normal', 8.5, P.muted)
      doc.text(img.titre, M, y + 5.5, { maxWidth: W })
      y += 5.5
    }
    y += 7

    // Image aux proportions préservées, centrée horizontalement, dans un
    // cadre discret (même style que les encadrés signature).
    const maxW = W
    const maxH = Y_MAX_IMAGE - y
    const ratio = props.width / props.height
    let w = maxW
    let h = w / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    const x = M + (maxW - w) / 2
    setFill(doc, P.white)
    setDraw(doc, P.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(x - 2, y - 2, w + 4, h + 4, 3, 3, 'FD')
    try {
      const fmt = img.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(img.dataUrl, fmt, x, y, w, h)
    } catch {
      // image illisible : le cadre reste vide, le devis n'est jamais cassé
    }

    font(doc, 'Hanken Grotesk', 'normal', 7.5, P.muted)
    doc.text(MENTION_PLAN_INDICATIF, M, y + h + 8, { maxWidth: W })
  }
}
