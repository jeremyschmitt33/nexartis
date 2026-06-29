'use client'

/**
 * EmptyState
 * ----------------------------------------------------------------
 * Bloc pédagogique affiché quand une liste est VIDE (aucune donnée
 * du tout), pour guider l'artisan vers la première action au lieu
 * de lui montrer un écran vide.
 *
 * À NE PAS confondre avec un résultat de recherche vide : si l'artisan
 * a des données mais que son filtre/recherche ne renvoie rien, on garde
 * un simple message « Aucun résultat ». La distinction se fait dans la
 * page appelante (ex. `total === 0` -> EmptyState ; sinon -> message).
 */

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
  className = '',
}: {
  icon: LucideIcon
  title: string
  description?: string
  actionHref?: string
  actionLabel?: string
  className?: string
}) {
  return (
    <div
      className={`py-12 px-6 text-center bg-white rounded-2xl border border-navy/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06)] ${className}`}
    >
      <Icon size={40} className="mx-auto text-gray-300 mb-3" aria-hidden />
      <p className="text-base font-hanken font-bold text-navy mb-1">{title}</p>
      {description && (
        <p className="text-sm font-hanken text-gray-500 max-w-sm mx-auto mb-4">{description}</p>
      )}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-white font-hanken font-bold text-sm shadow-[0_6px_16px_rgba(232,122,42,0.3)] active:translate-y-px transition-all"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
