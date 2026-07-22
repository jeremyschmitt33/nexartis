'use client'

// ============================================================================
// lib/messagerie-fichiers.ts — Préparation des pièces jointes de la messagerie.
// ----------------------------------------------------------------------------
// On RÉUTILISE la préparation éprouvée des justificatifs (HEIC → JPEG,
// compression progressive des images, PDF accepté tel quel, contrôle de taille,
// messages d'erreur français prêts à afficher) plutôt que de dupliquer un
// pipeline canvas fragile. Le bucket privé 'messagerie' accepte
// jpeg/png/webp/heic + application/pdf (+ audio, réservé au vocal plus tard).
//
// L'upload lui-même et l'URL signée vivent dans lib/hooks-messagerie.ts (avec
// les autres actions de la messagerie), pour garder ici des fonctions PURES.
// ============================================================================

import { preparerJustificatif, JustificatifError } from '@/lib/banque/justificatifs'

export { JustificatifError }

/** Attribut `accept` de l'input fichier (photos + PDF ; HEIC converti avant upload). */
export const MESSAGERIE_FICHIER_ACCEPT = 'image/*,.pdf,.heic,.heif,application/pdf'

export interface FichierMessagePret {
  blob: Blob
  /** Nom final (extension corrigée si conversion HEIC→JPEG). */
  nom: string
  contentType: string
  /** 'photo' pour une image, 'document' pour un PDF. */
  typePj: 'photo' | 'document'
}

/**
 * Prépare une pièce jointe de message : conversion HEIC, compression des images
 * lourdes, validation du type et de la taille. Lève `JustificatifError` (message
 * français prêt à afficher) si le fichier n'est pas exploitable.
 */
export async function preparerFichierMessage(file: File): Promise<FichierMessagePret> {
  const p = await preparerJustificatif(file)
  const typePj: 'photo' | 'document' = p.contentType === 'application/pdf' ? 'document' : 'photo'
  return { blob: p.blob, nom: p.nomFichier, contentType: p.contentType, typePj }
}

/** Nettoie un nom de fichier pour le chemin de stockage (ASCII, 40 car. max). */
function slug(nom: string): string {
  const i = nom.lastIndexOf('.')
  const base = (i >= 0 ? nom.slice(0, i) : nom)
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '') // retire tout caractère non-ASCII (accents...)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
  const ext = (i >= 0 ? nom.slice(i + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  return `${base || 'fichier'}.${ext}`
}

/**
 * Chemin dans le bucket 'messagerie'. Le PREMIER segment DOIT être l'id de
 * conversation : la policy RLS du bucket lit `foldername(name)[1]` pour vérifier
 * l'appartenance. `${conversationId}/${timestamp}-${slug}`.
 */
export function cheminFichierMessage(conversationId: string, nom: string): string {
  return `${conversationId}/${Date.now()}-${slug(nom)}`
}
