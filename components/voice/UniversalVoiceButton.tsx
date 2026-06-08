'use client'
// components/voice/UniversalVoiceButton.tsx — V3.2 (2026-06-08)
//
// Bouton qui ouvre la commande vocale universelle. Place dans la topbar du
// dashboard. Visible sur toutes les pages (mobile + desktop).
//
// Feature gating (V3.2) :
//   Le devis vocal IA est une fonctionnalité réservée au plan Complet.
//   - Trial   → bouton visible (laisser tester)
//   - Complet → bouton visible
//   - Essentiel → bouton MASQUÉ
//
// Variants :
//   - 'icon'   : icone seule (mobile, dans la topbar a droite du titre)
//   - 'pill'   : icone + texte "Dicter" (desktop, dans la topbar a cote de la cloche)

import React from 'react'
import { Mic } from 'lucide-react'
import { useVoiceModal } from './VoiceProvider'
import { useEntreprise } from '@/lib/hooks'
import { getEffectivePlan } from '@/lib/plans'

interface UniversalVoiceButtonProps {
  variant?: 'icon' | 'pill'
  className?: string
}

export default function UniversalVoiceButton({ variant = 'icon', className = '' }: UniversalVoiceButtonProps) {
  const { openVoice } = useVoiceModal()
  const { entreprise, loading } = useEntreprise()

  // Tant que l'on charge l'entreprise, on n'affiche rien (évite un flash visuel)
  if (loading) return null

  // Feature gating : devis vocal IA réservé au plan Complet (et au trial pour test)
  const { plan, isTrial } = getEffectivePlan(entreprise)
  if (!isTrial && plan !== 'complete') {
    return null
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={openVoice}
        className={`inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-xl bg-gradient-to-br from-orange to-orange-hover hover:opacity-95 text-white font-manrope font-semibold text-sm shadow-[0_4px_12px_-2px_rgba(232,122,42,0.4)] hover:shadow-[0_6px_16px_-2px_rgba(232,122,42,0.5)] transition-all active:scale-95 ${className}`}
        aria-label="Ouvrir la commande vocale"
      >
        <Mic size={16} aria-hidden />
        <span>Dicter</span>
      </button>
    )
  }

  // variant icon (mobile)
  return (
    <button
      type="button"
      onClick={openVoice}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-orange to-orange-hover hover:opacity-95 text-white shadow-[0_4px_10px_-2px_rgba(232,122,42,0.4)] transition-all active:scale-95 ${className}`}
      aria-label="Ouvrir la commande vocale"
    >
      <Mic size={20} aria-hidden />
    </button>
  )
}
