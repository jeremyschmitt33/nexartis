'use client'

import { useEffect } from 'react'

/**
 * Filet de securite (invisible) de la capture de parrainage.
 *
 * Monte une seule fois dans le dashboard. Si le cookie `nexartis_ref` est present
 * (pose a l'atterrissage sur /register?ref=CODE), on appelle l'endpoint qui
 * rattache le parrainage pour l'utilisateur connecte (utile notamment pour les
 * inscriptions Google qui ne passent pas par /api/auth/register).
 *
 * Cout nul pour les utilisateurs sans cookie (sortie immediate, aucun fetch).
 * L'endpoint efface le cookie en cas de succes => ne se redeclenche pas.
 */
export default function ParrainageCapture() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const hasRef = document.cookie
      .split('; ')
      .some((c) => c.startsWith('nexartis_ref='))
    if (!hasRef) return
    fetch('/api/parrainage/capter', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
