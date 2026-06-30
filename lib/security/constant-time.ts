import { timingSafeEqual } from 'crypto'

/**
 * Comparaison de chaines a temps constant (anti timing-attack).
 * Renvoie true si a === b, sans fuite de timing liee au contenu/longueur.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      timingSafeEqual(bufA, bufA)
      return false
    }
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
