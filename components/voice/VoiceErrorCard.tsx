'use client'
// components/voice/VoiceErrorCard.tsx — V3.1
// Carte d'erreur unifiee pour la commande vocale. Affiche un message clair
// adapte au cas d'erreur, et propose 2 actions standardisees :
//   - "Reessayer" : relance le pipeline complet
//   - "Taper plutot" : bascule sur l'input texte (si le micro est cassé)

import React from 'react'
import { AlertTriangle, RotateCcw, Keyboard } from 'lucide-react'

interface VoiceErrorCardProps {
  message: string
  onRetry: () => void
  onSwitchToText?: () => void
  /** Affiche le bouton "Taper plutot" si true. Inutile pour erreurs serveur. */
  showTextFallback?: boolean
}

export default function VoiceErrorCard({
  message,
  onRetry,
  onSwitchToText,
  showTextFallback = true,
}: VoiceErrorCardProps) {
  return (
    <div
      className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 sm:p-5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} aria-hidden />
        <div className="flex-1">
          <h4 className="font-syne font-bold text-red-700 text-base mb-1">Une erreur est survenue</h4>
          <p className="text-sm font-manrope text-red-700 leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-navy hover:bg-navy-mid text-white font-manrope font-semibold text-sm transition-all active:scale-95"
          aria-label="Reessayer"
        >
          <RotateCcw size={16} aria-hidden />
          Reessayer
        </button>
        {showTextFallback && onSwitchToText && (
          <button
            type="button"
            onClick={onSwitchToText}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-white border-2 border-navy/20 hover:border-navy/40 text-navy font-manrope font-semibold text-sm transition-all active:scale-95"
            aria-label="Taper le texte plutot que parler"
          >
            <Keyboard size={16} aria-hidden />
            Taper plutot
          </button>
        )}
      </div>
    </div>
  )
}
