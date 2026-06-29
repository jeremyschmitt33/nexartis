'use client'

/**
 * MicDictee — petit bouton micro à placer à côté d'un champ du rapport.
 * Au clic : démarre/arrête la dictée vocale (Web Speech API). Le texte reconnu
 * est AJOUTÉ au champ via `onText` (l'appelant concatène, sans écraser).
 *
 * Le bouton ne s'affiche PAS si le navigateur ne supporte pas la dictée
 * (Firefox, anciens navigateurs) : dans ce cas, l'astuce "micro du clavier"
 * (mobile) reste le repli.
 */

import { useEffect } from 'react'
import { Mic } from 'lucide-react'
import { useDictee } from '@/lib/rapport/useDictee'
import { toast } from '@/lib/toast'

export default function MicDictee({ onText, className = '' }: { onText: (t: string) => void; className?: string }) {
  const { supported, listening, error, toggle } = useDictee(onText)

  useEffect(() => { if (error) toast.error(error) }, [error])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'Arrêter la dictée' : 'Dicter ce champ à la voix'}
      title={listening ? 'Arrêter la dictée' : 'Dicter à la voix'}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors flex-shrink-0 ${
        listening
          ? 'border-red-300 bg-red-50 text-red-600 animate-pulse'
          : 'border-gray-200 text-navy-mid hover:border-sky hover:text-sky'
      } ${className}`}
    >
      <Mic size={15} />
    </button>
  )
}
