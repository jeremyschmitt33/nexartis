// lib/safe-redirect.ts
// ============================================================================
// Helper partage anti « Open Redirect ».
// ----------------------------------------------------------------------------
// Un parametre `next` (ou renvoyer l'utilisateur apres connexion / confirmation
// d'email) ne doit JAMAIS pouvoir pointer ailleurs que sur notre propre site.
// Sinon un attaquant construit /login?next=https://phishing.com et detourne
// l'internaute juste apres qu'il se soit authentifie.
//
// Regle : on n'accepte QUE des chemins relatifs internes (commencent par un
// seul '/'), et on rejette tout ce qui ressemble a une URL absolue, un schema
// (http:, javascript:, data:...) ou une adresse « protocol-relative » (//evil).
//
// Fonction PURE, sans dependance : utilisable cote serveur (route callback,
// API register, middleware) ET cote client (pages login / register / confirm).
// La meme logique existe historiquement dans app/auth/callback/route.ts ; ce
// module la mutualise pour les nouveaux appelants.
// ============================================================================

/** Vrai si `path` est un chemin interne sur (relatif, meme origine). */
export function isSafeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false
  if (!path.startsWith('/')) return false // doit etre relatif
  if (path.startsWith('//')) return false // //evil.com (protocol-relative)
  if (path.startsWith('/\\')) return false // /\evil.com (astuce backslash)
  // Tout schema (http:, javascript:, data:, mailto:...) — rejete.
  if (/^\/?[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false
  return true
}

/**
 * Renvoie `raw` s'il s'agit d'un chemin interne sur, sinon `fallback`.
 * `fallback` vaut /dashboard par defaut.
 */
export function safeNextPath(raw: unknown, fallback = '/dashboard'): string {
  return isSafeRedirectPath(raw) ? raw : fallback
}

/** Nom du cookie de secours qui transporte `next` a travers la confirmation email. */
export const NEXT_COOKIE = 'nexartis_next'
