import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// ======================================================================
// AUTHENTIFICATION — Vérifie que l'utilisateur est connecté
// ======================================================================

/**
 * Récupère l'utilisateur connecté via les cookies de session Supabase.
 * Retourne null si l'utilisateur n'est pas connecté.
 */
export async function getAuthenticatedUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ======================================================================
// ADMIN — Vérifie que l'utilisateur est un administrateur
// ======================================================================

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@nexartis.fr').split(',').map(e => e.trim().toLowerCase())

/**
 * Vérifie que l'utilisateur connecté est un admin.
 * Utilise une variable d'environnement ADMIN_EMAILS (liste séparée par virgules).
 */
export async function getAdminUser() {
  const user = await getAuthenticatedUser()
  if (!user?.email) return null
  // SÉCURITÉ (R1-004) : on se base d'abord sur le rôle stocké dans app_metadata
  // (non modifiable par l'utilisateur, car écrit uniquement côté serveur/DB).
  // L'email reste un filet de sécurité transitoire, à retirer une fois le rôle
  // validé en production.
  const isAdminByRole = (user.app_metadata as Record<string, unknown> | undefined)?.role === 'admin'
  const isAdminByEmail = ADMIN_EMAILS.includes(user.email.toLowerCase())
  return (isAdminByRole || isAdminByEmail) ? user : null
}

// ======================================================================
// RATE LIMITING — Protection anti brute-force (en mémoire)
// ======================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Nettoyage périodique pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of Array.from(rateLimitStore)) {
    if (now > entry.resetAt) rateLimitStore.delete(key)
  }
}, 60_000) // Nettoyer toutes les 60 secondes

/**
 * Rate limiter simple en mémoire.
 * Pour une solution production robuste, utiliser Upstash Redis.
 *
 * @param identifier - Identifiant unique (IP, user_id, etc.)
 * @param maxRequests - Nombre max de requêtes
 * @param windowMs - Fenêtre en millisecondes
 * @returns true si autorisé, false si bloqué
 */
export function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

/**
 * Récupère l'IP du client (compatible Vercel)
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// ======================================================================
// VALIDATION — Fonctions de validation d'input
// ======================================================================

/**
 * Valide qu'une chaîne ressemble à un UUID v4
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Valide qu'une chaîne est un email basique
 */
export function isValidEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) && str.length <= 320
}

/**
 * Nettoie une chaîne pour éviter les injections XSS basiques
 */
export function sanitizeString(str: string, maxLength = 1000): string {
  return str.slice(0, maxLength).replace(/[<>"'&]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '&': '&amp;',
    }
    return entities[char] || char
  })
}

// ======================================================================
// RÉPONSES SÉCURISÉES — Headers de sécurité sur les réponses API
// ======================================================================

/**
 * Crée une réponse JSON sécurisée avec les headers appropriés
 */
export function secureJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

/**
 * Crée une réponse d'erreur sécurisée
 */
export function secureError(message: string, status = 400) {
  return secureJson({ error: message }, status)
}

/**
 * Réponse 429 Too Many Requests
 */
export function rateLimitError() {
  return secureError('Trop de requêtes. Réessayez dans quelques minutes.', 429)
}

/**
 * Réponse 401 Non authentifié
 */
export function unauthorizedError() {
  return secureError('Non autorisé', 401)
}

/**
 * Réponse 403 Accès refusé
 */
export function forbiddenError() {
  return secureError('Accès refusé', 403)
}
