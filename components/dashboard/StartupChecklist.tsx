'use client'

/**
 * StartupChecklist — Checklist de démarrage (onboarding d'activation)
 * ------------------------------------------------------------------
 * Carte affichée sur le dashboard d'un artisan qui débute, pour le
 * guider vers ses premières actions clés.
 *
 * PERFORMANCE : ce composant est purement présentational. Il NE FAIT
 * AUCUNE requête. Les items (avec leur état `done` déjà calculé) sont
 * fournis en props par le dashboard, à partir de données déjà chargées
 * (entreprise, devis, factures). Aucun useEffect, aucun fetch.
 *
 * La VISIBILITÉ (afficher / masquer / disparaître quand tout est fait)
 * est gérée par le dashboard (page.tsx), qui est la seule source de
 * vérité — c'est lui qui sait aussi masquer la bannière « profil
 * incomplet » pendant que cette checklist est affichée.
 */

import { type CSSProperties } from 'react'
import Link from 'next/link'
import { Rocket, Check, ChevronRight } from 'lucide-react'

export interface ChecklistItem {
  key: string
  label: string
  labelDone: string
  soustexte?: string
  href: string
  done: boolean
}

export default function StartupChecklist({
  items,
  doneCount,
  onDismiss,
  style,
}: {
  items: ChecklistItem[]
  doneCount: number
  onDismiss: () => void
  style?: CSSProperties
}) {
  const total = items.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const progressLabel =
    doneCount === 0 ? 'Aucune étape terminée' : `${doneCount} étape${doneCount > 1 ? 's' : ''} sur ${total}`

  return (
    <div className="mb-6" style={style}>
      <div
        role="region"
        aria-label="Checklist de démarrage"
        className="bg-white rounded-2xl border border-navy/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06)] p-5 sm:p-6"
      >
        {/* En-tête */}
        <div className="flex items-start gap-3 sm:items-center">
          <span
            aria-hidden
            className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white shadow-[0_4px_12px_rgba(255,122,26,0.3)]"
          >
            <Rocket size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-hanken font-extrabold text-lg sm:text-xl text-navy leading-tight">
              Vos premières étapes sur Nexartis
            </p>
            <p className="font-hanken text-sm text-gray-500 mt-0.5">
              Quatre étapes pour émettre votre premier devis et votre première facture.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Masquer la checklist de démarrage"
            className="flex-shrink-0 font-hanken text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a] focus-visible:ring-offset-2"
          >
            Masquer cette aide
          </button>
        </div>

        {/* Barre de progression */}
        <div className="mt-4 mb-1 flex items-center gap-3">
          <div
            className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuetext={doneCount === 0 ? 'Aucune étape terminée' : `${doneCount} étape${doneCount > 1 ? 's' : ''} sur ${total} complétée${doneCount > 1 ? 's' : ''}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="flex-shrink-0 font-spline-mono text-xs font-semibold text-[#d9690f]">
            {progressLabel}
          </span>
        </div>

        {/* Items */}
        <ul className="mt-2 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-label={`${item.done ? item.labelDone : item.label} — ${item.done ? 'fait' : 'à faire'}`}
                className="group flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-[#fafbfc] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a] focus-visible:ring-offset-2"
              >
                {item.done ? (
                  <span
                    aria-hidden
                    className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white"
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300"
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-hanken text-sm ${
                      item.done ? 'text-gray-400' : 'text-navy font-semibold'
                    }`}
                  >
                    {item.done ? item.labelDone : item.label}
                  </span>
                  {item.soustexte && !item.done && (
                    <span className="block font-hanken text-xs text-gray-400 mt-0.5">
                      {item.soustexte}
                    </span>
                  )}
                </span>

                <ChevronRight
                  size={16}
                  aria-hidden
                  className={`flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                    item.done ? 'text-gray-200' : 'text-gray-300 group-hover:text-[#ff7a1a]'
                  }`}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
