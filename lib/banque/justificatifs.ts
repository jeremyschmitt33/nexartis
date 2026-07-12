// ============================================================================
// lib/banque/justificatifs.ts — Justificatifs (tickets, factures fournisseur)
// ----------------------------------------------------------------------------
// Bucket Supabase Storage PRIVÉ « justificatifs » (sql/2026-07-12-banque-07).
// Convention de chemins (fichier 07, à respecter À L'IDENTIQUE) :
//   {user_id}/{aaaa}/{mm}/{entite}-{entite_id}/{timestamp}-{nom}.{ext}
// Décision jeremy n°4 (SPEC §6) : les photos iPhone (HEIC) sont converties en
// JPEG côté navigateur AVANT upload (+ compression). Le bucket n'accepte que
// pdf / jpeg / png / webp, 5 Mo max APRÈS compression.
// Affichage : URL SIGNÉE temporaire (createSignedUrl) — jamais d'URL publique,
// on ne stocke que le path en base (banque_mouvements.justificatif_path,
// achats.justificatif_url).
// Fichier CLIENT uniquement (canvas / createImageBitmap) — ne pas importer
// depuis une route API.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/** 5 Mo — aligné sur file_size_limit du bucket (fichier 07). */
export const JUSTIFICATIF_MAX_OCTETS = 5 * 1024 * 1024

/** Entités porteuses d'un justificatif (segment {entite} du chemin). */
export type EntiteJustificatif = 'mouvement' | 'achat'

/** Types acceptés par le bucket (allowed_mime_types du fichier 07). */
const TYPES_BUCKET = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

/** Attribut accept des <input type="file"> de justificatif (HEIC inclus : converti avant upload). */
export const JUSTIFICATIF_ACCEPT = 'image/*,.pdf,.heic,.heif,application/pdf'

/** Erreur « métier » avec message français prêt à afficher. */
export class JustificatifError extends Error {}

// ---------------------------------------------------------------------------
// Détection de type
// ---------------------------------------------------------------------------

function extensionDe(nom: string): string {
  const i = nom.lastIndexOf('.')
  return i >= 0 ? nom.slice(i + 1).toLowerCase() : ''
}

function estHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence') return true
  const ext = extensionDe(file.name)
  return ext === 'heic' || ext === 'heif'
}

function estPdf(file: File): boolean {
  return (file.type || '').toLowerCase() === 'application/pdf' || extensionDe(file.name) === 'pdf'
}

function estImage(file: File): boolean {
  return (file.type || '').toLowerCase().startsWith('image/') || estHeic(file)
}

// ---------------------------------------------------------------------------
// Décodage + ré-encodage JPEG (canvas)
// ---------------------------------------------------------------------------

/**
 * Décode un blob image en bitmap. Essaie createImageBitmap (rapide, décode le
 * HEIC nativement sur Safari/iOS — là d'où viennent les photos HEIC), puis
 * retombe sur un <img>. Renvoie null si le navigateur ne sait pas décoder.
 */
async function decoderImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(blob)
  } catch {
    /* on tente le <img> ci-dessous */
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/** Dessine la source dans un canvas (côté max 2200 px) et exporte en JPEG. */
async function versJpeg(
  source: ImageBitmap | HTMLImageElement,
  qualite: number,
): Promise<Blob | null> {
  const largeur = 'naturalWidth' in source ? source.naturalWidth : source.width
  const hauteur = 'naturalHeight' in source ? source.naturalHeight : source.height
  if (!largeur || !hauteur) return null

  const MAX_COTE = 2200 // suffisant pour lire un ticket, léger à stocker
  const ratio = Math.min(1, MAX_COTE / Math.max(largeur, hauteur))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largeur * ratio))
  canvas.height = Math.max(1, Math.round(hauteur * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // Fond blanc : les PNG transparents ré-encodés en JPEG ne deviennent pas noirs.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', qualite)
  })
}

/**
 * Conversion HEIC → JPEG. Deux étages :
 *  1. décodage natif (Safari / iOS décodent le HEIC directement) → canvas ;
 *  2. sinon, bibliothèque heic2any chargée À LA DEMANDE (import dynamique :
 *     elle ne pèse rien tant qu'aucun HEIC n'est déposé).
 */
async function convertirHeicEnJpeg(file: File): Promise<Blob> {
  // 1) Décodage natif (le cas réel : photo iPhone déposée depuis un iPhone).
  const bitmap = await decoderImage(file)
  if (bitmap) {
    const jpeg = await versJpeg(bitmap, 0.85)
    if (jpeg) return jpeg
  }

  // 2) Fallback navigateur sans décodeur HEIC (Chrome/Firefox sur ordinateur).
  try {
    const mod = await import('heic2any')
    const converti = await mod.default({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    const blob = Array.isArray(converti) ? converti[0] : converti
    if (blob) {
      // Repasse par le canvas pour appliquer la même limite de taille.
      const rebitmap = await decoderImage(blob)
      if (rebitmap) {
        const jpeg = await versJpeg(rebitmap, 0.85)
        if (jpeg) return jpeg
      }
      return blob
    }
  } catch {
    /* module absent ou conversion impossible → message clair ci-dessous */
  }

  throw new JustificatifError(
    'Cette photo iPhone (HEIC) n’a pas pu être convertie sur cet appareil. Réessayez depuis votre téléphone, ou déposez un JPG, PNG ou PDF.',
  )
}

// ---------------------------------------------------------------------------
// Préparation (conversion + compression) avant upload
// ---------------------------------------------------------------------------

export interface FichierPrepare {
  blob: Blob
  /** Nom final (extension corrigée si conversion). */
  nomFichier: string
  contentType: string
}

/**
 * Prépare un fichier de justificatif : HEIC → JPEG, compression des images
 * trop lourdes, contrôle des 5 Mo. Lève JustificatifError (message français).
 */
export async function preparerJustificatif(file: File): Promise<FichierPrepare> {
  if (!file.size) throw new JustificatifError('Ce fichier est vide.')

  // ── PDF : accepté tel quel, dans la limite des 5 Mo ──
  if (estPdf(file)) {
    if (file.size > JUSTIFICATIF_MAX_OCTETS) {
      throw new JustificatifError('Ce PDF dépasse 5 Mo. Exportez-le en plus léger, ou photographiez le document.')
    }
    return { blob: file, nomFichier: file.name, contentType: 'application/pdf' }
  }

  if (!estImage(file)) {
    throw new JustificatifError('Format non pris en charge. Déposez une photo (JPG, PNG, HEIC) ou un PDF.')
  }

  // ── HEIC : conversion obligatoire (le bucket le refuse) ──
  if (estHeic(file)) {
    const jpeg = await convertirHeicEnJpeg(file)
    if (jpeg.size > JUSTIFICATIF_MAX_OCTETS) {
      throw new JustificatifError('La photo reste trop lourde après conversion (5 Mo max). Réessayez avec une photo moins grande.')
    }
    const base = file.name.replace(/\.(heic|heif)$/i, '')
    return { blob: jpeg, nomFichier: `${base}.jpg`, contentType: 'image/jpeg' }
  }

  // ── JPEG / PNG / WebP : compressé seulement si lourd ──
  const type = (file.type || '').toLowerCase()
  const typeConnu = TYPES_BUCKET.has(type) ? type : 'image/jpeg'
  const SEUIL_COMPRESSION = 1.5 * 1024 * 1024
  if (file.size <= SEUIL_COMPRESSION && TYPES_BUCKET.has(type)) {
    return { blob: file, nomFichier: file.name, contentType: typeConnu }
  }

  const bitmap = await decoderImage(file)
  if (!bitmap) {
    // Image illisible mais déjà dans un format accepté et sous 5 Mo → on la garde.
    if (TYPES_BUCKET.has(type) && file.size <= JUSTIFICATIF_MAX_OCTETS) {
      return { blob: file, nomFichier: file.name, contentType: type }
    }
    throw new JustificatifError('Cette image n’a pas pu être lue. Déposez un JPG, PNG ou PDF.')
  }

  // Compression progressive : 85 % puis 70 % puis 60 % jusqu'à passer sous 5 Mo.
  for (const qualite of [0.85, 0.7, 0.6]) {
    const jpeg = await versJpeg(bitmap, qualite)
    if (jpeg && jpeg.size <= JUSTIFICATIF_MAX_OCTETS) {
      const base = file.name.replace(/\.[a-z0-9]+$/i, '') || 'photo'
      return { blob: jpeg, nomFichier: `${base}.jpg`, contentType: 'image/jpeg' }
    }
  }
  throw new JustificatifError('Cette photo est trop lourde même après compression (5 Mo max).')
}

// ---------------------------------------------------------------------------
// Chemin dans le bucket
// ---------------------------------------------------------------------------

/** Nettoie un nom de fichier pour le chemin (ASCII simple, 40 caractères max). */
function slugFichier(nom: string): string {
  const i = nom.lastIndexOf('.')
  const base = (i >= 0 ? nom.slice(0, i) : nom)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents décomposés par NFD
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
  const ext = (i >= 0 ? nom.slice(i + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  return `${base || 'justificatif'}.${ext}`
}

/** Convention du fichier 07 : {user_id}/{aaaa}/{mm}/{entite}-{entite_id}/{timestamp}-{nom}.{ext} */
export function construireCheminJustificatif(
  userId: string,
  entite: EntiteJustificatif,
  entiteId: string,
  nomFichier: string,
): string {
  const maintenant = new Date()
  const aaaa = maintenant.getFullYear()
  const mm = String(maintenant.getMonth() + 1).padStart(2, '0')
  return `${userId}/${aaaa}/${mm}/${entite}-${entiteId}/${Date.now()}-${slugFichier(nomFichier)}`
}

// ---------------------------------------------------------------------------
// Upload / URL signée / suppression
// ---------------------------------------------------------------------------

/**
 * Prépare (conversion + compression) puis téléverse un justificatif.
 * @returns le path stocké en base (jamais d'URL publique).
 */
export async function uploaderJustificatif(
  supabase: SupabaseClient,
  params: { file: File; entite: EntiteJustificatif; entiteId: string },
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new JustificatifError('Votre session a expiré. Rechargez la page et reconnectez-vous.')

  const prepare = await preparerJustificatif(params.file)
  const chemin = construireCheminJustificatif(user.id, params.entite, params.entiteId, prepare.nomFichier)

  const { error } = await supabase.storage.from('justificatifs').upload(chemin, prepare.blob, {
    contentType: prepare.contentType,
    upsert: false,
  })
  if (error) {
    console.error('Upload justificatif impossible', error)
    throw new JustificatifError('Impossible d’envoyer le justificatif. Vérifiez votre connexion et réessayez.')
  }
  return chemin
}

/** URL signée temporaire (60 s, convention fichier 07) pour afficher le justificatif. */
export async function urlSigneeJustificatif(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from('justificatifs').createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    console.error('URL signée justificatif impossible', error)
    return null
  }
  return data.signedUrl
}

/** Supprime le fichier du bucket (les erreurs sont loguées, jamais bloquantes). */
export async function supprimerJustificatif(supabase: SupabaseClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from('justificatifs').remove([path])
  if (error) console.error('Suppression justificatif impossible', error)
}
