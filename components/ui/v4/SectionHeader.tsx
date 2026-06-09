import type { ReactNode } from 'react'

/**
 * SectionHeader — En-tête de section V4 Light Premium.
 * Icône carrée 40x40 en gradient orange + titre Hanken extrabold + sous-titre
 * optionnel + badge "Configuré" (ou label custom) optionnel.
 *
 * À placer en haut de chaque PremiumCard pour introduire la section.
 */
export function SectionHeader({
  icon,
  title,
  subtitle,
  configured = false,
  badgeLabel,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  configured?: boolean
  badgeLabel?: string
}) {
  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Bloc icône — gradient orange + inner highlight */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white inline-flex items-center justify-center shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>{subtitle}</span>
            {configured && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-br from-emerald-100/80 to-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11.5px] font-hanken font-bold tracking-wider uppercase">
                {'✓'} {badgeLabel ?? 'Configuré'}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default SectionHeader
