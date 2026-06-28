/**
 * Traitement d'image cote NAVIGATEUR pour les photos de RAPPORT.
 *
 * Dedie au rapport (isole) : compresse + redimensionne, SANS watermark
 * (le rapport est deja date/identifie). Ne touche pas au pipeline photo
 * des chantiers (PhotoSection/traiterPhoto) qui garde son tampon.
 *
 * Memoire : on libere agressivement bitmap / object URL / canvas
 * (astuce iOS: canvas.width=height=0) pour eviter les crashs sur vieux mobiles.
 */

export interface ProcessedImage {
  original: Blob
  thumb: Blob
  largeur: number
  hauteur: number
}

interface Drawable {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void
  close: () => void
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', quality)
  })
}

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { width: bmp.width, height: bmp.height, draw: (ctx, dw, dh) => ctx.drawImage(bmp, 0, 0, dw, dh), close: () => bmp.close?.() }
    } catch { /* repli ci-dessous */ }
  }
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Image illisible'))
    i.src = url
  })
  return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, dw, dh) => ctx.drawImage(img, 0, 0, dw, dh), close: () => URL.revokeObjectURL(url) }
}

function freeCanvas(c: HTMLCanvasElement): void {
  c.width = 0; c.height = 0   // libere le backing store immediatement (iOS/Safari)
}

/**
 * Compresse une photo et produit un original (<= maxOriginal px) + une
 * miniature (<= maxThumb px), tous deux en JPEG. Aucun watermark.
 */
export async function processRapportImage(
  file: File,
  opts?: { maxOriginal?: number; maxThumb?: number; qualityOriginal?: number; qualityThumb?: number },
): Promise<ProcessedImage> {
  const maxOriginal = opts?.maxOriginal ?? 2000
  const maxThumb = opts?.maxThumb ?? 480
  const qOriginal = opts?.qualityOriginal ?? 0.82
  const qThumb = opts?.qualityThumb ?? 0.7

  const src = await loadDrawable(file)
  try {
    const ratio = Math.min(1, maxOriginal / Math.max(src.width, src.height))
    const ow = Math.max(1, Math.round(src.width * ratio))
    const oh = Math.max(1, Math.round(src.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = ow; canvas.height = oh
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponible')
    src.draw(ctx, ow, oh)
    const original = await canvasToBlob(canvas, qOriginal)

    const tRatio = Math.min(1, maxThumb / Math.max(ow, oh))
    const tw = Math.max(1, Math.round(ow * tRatio))
    const th = Math.max(1, Math.round(oh * tRatio))
    const tCanvas = document.createElement('canvas')
    tCanvas.width = tw; tCanvas.height = th
    const tctx = tCanvas.getContext('2d')
    if (!tctx) throw new Error('Canvas indisponible')
    tctx.drawImage(canvas, 0, 0, tw, th)
    const thumb = await canvasToBlob(tCanvas, qThumb)

    freeCanvas(tCanvas)
    freeCanvas(canvas)
    return { original, thumb, largeur: ow, hauteur: oh }
  } finally {
    src.close()
  }
}
