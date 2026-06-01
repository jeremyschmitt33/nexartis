'use client'

/**
 * components/legal/LegalMentionsBlock.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bloc de mentions légales partagé entre tous les rendus HTML d'un devis ou
 * d'une facture (dashboard + page client /signer/[token]).
 *
 * Source de vérité texte : lib/legal-mentions.ts (façades
 * getLegalMentionsDevis / getLegalMentionsFacture).
 *
 * V2.4a — Câblé sur :
 *   - app/dashboard/devis/[id]/page.tsx       (variant="dashboard")
 *   - app/dashboard/factures/[id]/page.tsx    (variant="dashboard")
 *   - app/signer/[token]/page.tsx             (variant="signer", V2.4b)
 *
 * Le style reproduit la zone "Mentions légales" historique :
 * petite police (~10px), couleur gris froid #9ca3af, leading-relaxed, espaces
 * verticaux fins.
 */

import {
  getLegalMentionsDevis,
  getLegalMentionsFacture,
  type LegalContext,
} from '@/lib/legal-mentions'

type Variant = 'dashboard' | 'signer'

type Props = {
  /** Contexte : kind (devis|facture) + entreprise + client + lignes + flags. */
  ctx: LegalContext
  /**
   * Style du bloc :
   *   - 'dashboard' : style discret bas de page (par défaut)
   *   - 'signer'    : idem, légèrement plus contrasté pour la page client
   */
  variant?: Variant
  /** Classes additionnelles. */
  className?: string
}

export default function LegalMentionsBlock({ ctx, variant = 'dashboard', className = '' }: Props) {
  const mentions = ctx.kind === 'devis' ? getLegalMentionsDevis(ctx) : getLegalMentionsFacture(ctx)
  if (mentions.length === 0) return null

  // Style aligné sur les zones "Mentions légales" historiques des dashboards
  // (taille 10px, couleur gris froid, leading-relaxed). La variant 'signer'
  // peut être personnalisée plus tard si besoin (V2.4b).
  const baseClass =
    variant === 'signer'
      ? 'text-[10px] text-[#6b7280] font-manrope leading-relaxed space-y-1'
      : 'text-[10px] text-[#9ca3af] font-manrope leading-relaxed space-y-1'

  return (
    <div className={`${baseClass} ${className}`}>
      {mentions.map((m) => (
        <p key={m.key} className={m.italique ? 'italic' : ''}>
          {m.text}
        </p>
      ))}
    </div>
  )
}
