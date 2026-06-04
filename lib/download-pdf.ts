// lib/download-pdf.ts - V3.0d
// Helper de telechargement PDF cross-platform (Android Chrome / iOS Safari / iPad / desktop).
//
// Pourquoi cet helper :
//   - iOS Safari IGNORE l'attribut <a download> (caniuse.com/download).
//   - iOS Safari REFUSE les data:application/pdf;base64,... depuis Safari 15+.
//   - Le seul pattern qui marche sur iOS = Blob URL + window.open(_blank), l'utilisateur
//     enregistre ensuite via Partager -> Enregistrer dans Fichiers.
//   - Sur Android/desktop, le pattern classique <a download> + Blob URL marche tres bien.
//
// Toast UX : on retourne un PdfDownloadResult avec un helpMessage adapte a la plateforme
// pour que le composant appelant affiche une confirmation visuelle dans tous les cas.

/**
 * Detecte iOS Safari (iPhone/iPad/iPod) et iOS Chrome (qui partage le moteur WebKit).
 * A jour iOS 13+ (iPad envoie "MacIntel" depuis iPadOS 13 -> on teste aussi maxTouchPoints).
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOSDevice = /iPad|iPhone|iPod/.test(ua)
  // iPad sur iPadOS 13+ se declare comme MacIntel
  const nav = navigator as Navigator & { maxTouchPoints?: number }
  const iPadOS = nav.platform === 'MacIntel' && nav.maxTouchPoints != null && nav.maxTouchPoints > 1
  return iOSDevice || iPadOS
}

export type PdfDownloadResult = {
  success: boolean
  // true sur iOS quand on a du ouvrir le PDF dans un nouvel onglet au lieu de telecharger.
  openedInNewTab: boolean
  // Message d'aide a afficher a l'utilisateur (vide si rien a dire).
  helpMessage: string
}

/**
 * Convertit une chaine base64 en Blob PDF.
 * V3.0d.1 : reecrit pour satisfaire TS 5.7+ qui distingue ArrayBuffer / ArrayBufferLike.
 * On alloue explicitement un ArrayBuffer puis on remplit via Uint8Array, et on passe
 * le ArrayBuffer (pas le Uint8Array) au constructor Blob — typage strict garanti.
 */
export function base64ToBlob(base64: string, mimeType = 'application/pdf'): Blob {
  const binaryString = atob(base64)
  const len = binaryString.length
  const buffer = new ArrayBuffer(len)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([buffer], { type: mimeType })
}

/**
 * Telecharge un Blob PDF de facon cross-platform.
 * - Android/desktop : <a download> + clic synthetique -> fichier dans Downloads.
 * - iOS Safari/Chrome/iPad : window.open(blobUrl) -> PDF s'ouvre dans Safari,
 *   l'utilisateur enregistre manuellement via Partager -> Enregistrer dans Fichiers.
 *
 * IMPORTANT : a appeler depuis un handler synchrone d'evenement utilisateur
 * (onClick), sinon iOS bloque window.open (pop-up blocker).
 */
export function downloadPdfBlob(blob: Blob, filename: string): PdfDownloadResult {
  const url = URL.createObjectURL(blob)

  if (isIOS()) {
    // Sur iOS, window.open est la seule voie qui marche.
    // Doit etre dans le meme tick que le clic utilisateur.
    const win = window.open(url, '_blank')
    // Best-effort : si pop-up bloque, fallback location.href (l'app perd son state
    // mais au moins le PDF s'ouvre).
    if (!win) {
      window.location.href = url
    }
    // On laisse l'URL active 60s pour que Safari ait le temps de la lire,
    // puis on la libere.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return {
      success: true,
      openedInNewTab: true,
      helpMessage: 'Le PDF s’est ouvert dans Safari. Touchez l’icône Partager puis « Enregistrer dans Fichiers » pour le garder.',
    }
  }

  // Android / desktop / autres : pattern <a download> classique.
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke apres un court delai pour laisser le browser entamer le download.
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
  return {
    success: true,
    openedInNewTab: false,
    helpMessage: 'PDF téléchargé. Vérifie ton dossier Téléchargements.',
  }
}

/**
 * Helper haut niveau : fetch une route API qui renvoie soit un blob binaire,
 * soit un JSON { pdfBase64, filename }. Detecte automatiquement.
 */
export async function fetchAndDownloadPdf(
  url: string,
  init?: RequestInit,
  fallbackFilename = 'document.pdf',
): Promise<PdfDownloadResult> {
  const res = await fetch(url, init)
  if (!res.ok) {
    // Essayer de recuperer un message d'erreur lisible
    let msg = `Erreur ${res.status}`
    try {
      const json = await res.json()
      if (json?.error) msg = json.error
    } catch { /* pas de JSON, on garde le code HTTP */ }
    throw new Error(msg)
  }

  const contentType = res.headers.get('content-type') || ''

  // Cas 1 : le serveur renvoie un PDF binaire (recommande)
  if (contentType.startsWith('application/pdf')) {
    const blob = await res.blob()
    // Extraire le filename du header Content-Disposition si present
    let filename = fallbackFilename
    const disposition = res.headers.get('content-disposition')
    if (disposition) {
      const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition)
      if (m && m[1]) filename = decodeURIComponent(m[1])
    }
    return downloadPdfBlob(blob, filename)
  }

  // Cas 2 : legacy - le serveur renvoie { pdfBase64, filename } en JSON
  const json = await res.json()
  if (!json.pdfBase64) throw new Error(json.error || 'PDF manquant dans la reponse')
  const blob = base64ToBlob(json.pdfBase64, 'application/pdf')
  return downloadPdfBlob(blob, json.filename || fallbackFilename)
}
