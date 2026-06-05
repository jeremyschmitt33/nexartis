// lib/voice/routeIntent.ts — V3.1 Commande vocale universelle
// Mappe un intent + payload vers la route Next.js cible et serialise le payload
// en query string pour pre-remplir les formulaires.
//
// Convention : on encode le payload en base64url(JSON) dans le parametre ?voicePayload=.
// La page cible decode et utilise le payload pour pre-remplir. Avantages :
//   - URL propre (1 seul parametre)
//   - Pas d'echappement complique d'accents francais
//   - Limite a ~2000 caracteres (largement assez pour un payload de devis)

import type { VoiceIntent } from './types'

/**
 * Encode un payload JSON en base64url (URL-safe, sans padding).
 * Utilise pour transmettre le payload dans l'URL sans casser les caracteres reserves.
 */
export function encodePayload(payload: unknown): string {
  const json = JSON.stringify(payload)
  // base64url : remplace + par -, / par _, supprime le padding =
  const base64 = typeof window !== 'undefined'
    ? window.btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf-8').toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode un payload base64url vers un objet JS. Renvoie null si invalide.
 * A appeler dans la page cible cote client : `JSON.parse(decodePayload(searchParams.voicePayload))`.
 */
export function decodePayload<T = unknown>(encoded: string | null | undefined): T | null {
  if (!encoded) return null
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    // re-ajoute le padding =
    while (base64.length % 4) base64 += '='
    const json = typeof window !== 'undefined'
      ? decodeURIComponent(escape(window.atob(base64)))
      : Buffer.from(base64, 'base64').toString('utf-8')
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/**
 * Mappe un intent vers la route Next.js cible.
 * Pour 'unknown', on renvoie null (le composant doit demander a l'artisan).
 */
export function getRouteForIntent(intent: VoiceIntent): string | null {
  switch (intent) {
    case 'devis':    return '/dashboard/devis/nouveau'
    case 'facture':  return '/dashboard/factures/nouveau'
    case 'planning': return '/dashboard/planning'
    case 'unknown':  return null
    default:         return null
  }
}

/**
 * Construit l'URL complete (route + query string) pour rediriger l'utilisateur
 * apres validation de l'intent et du payload.
 *
 * @param intent  Intent detecte
 * @param payload Donnees a pre-remplir (peut etre null pour planning vide etc.)
 * @returns       URL complete prete a passer a router.push(), ou null si intent inconnu
 */
export function buildVoiceRedirectUrl(intent: VoiceIntent, payload: unknown): string | null {
  const route = getRouteForIntent(intent)
  if (!route) return null
  if (!payload) return route
  const encoded = encodePayload(payload)
  // Limite de securite : URL > 4000 caracteres risque d'etre tronquee par certains proxies.
  // 4000 chars en query = ~3 KB de payload base64 = ~2.25 KB JSON = largement assez.
  if (encoded.length > 4000) {
    // Trop gros pour l'URL : on redirige sans payload, l'artisan re-remplira manuellement.
    // Cas pathologique (ex: 50 lignes de devis avec noms tres longs).
    console.warn('[voice] Payload trop volumineux pour l URL, redirect sans payload')
    return route
  }
  return `${route}?voicePayload=${encoded}`
}

/**
 * Etiquette humaine pour un intent (affichee dans le badge de confirmation).
 */
export function getIntentLabel(intent: VoiceIntent): string {
  switch (intent) {
    case 'devis':    return 'Devis détecté'
    case 'facture':  return 'Facture détectée'
    case 'planning': return 'Événement planning détecté'
    case 'unknown':  return 'Impossible de déterminer l\'action'
    default:         return 'Action inconnue'
  }
}

/**
 * Emoji associe a un intent (utilise dans les badges et exemples).
 */
export function getIntentEmoji(intent: VoiceIntent): string {
  switch (intent) {
    case 'devis':    return '📄'
    case 'facture':  return '🧾'
    case 'planning': return '📅'
    case 'unknown':  return '❓'
    default:         return '❓'
  }
}
