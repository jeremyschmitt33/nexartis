'use client'
// components/voice/VoiceWaveform.tsx — V3.1
// Visualisation type "barres verticales" du niveau audio en cours.
// Branchee sur useAudioLevel pour les vraies valeurs, ou en mode "demo" si
// pas de stream (anime des barres factices).

import React from 'react'

interface VoiceWaveformProps {
  /** Tableau de valeurs 0..1 (longueur = nombre de barres). Si vide ou tout a 0 : etat repos. */
  levels: number[]
  /** Mode visuel : recording (vagues), processing (impulsion), idle (plat). */
  mode?: 'idle' | 'recording' | 'processing'
}

export default function VoiceWaveform({ levels, mode = 'recording' }: VoiceWaveformProps) {
  // Min height = 4% pour qu'on voit les barres meme en silence
  const safeLevels = levels.length > 0 ? levels : [0.04, 0.04, 0.04, 0.04, 0.04]

  return (
    <div
      className="flex items-center justify-center gap-2 h-16 px-4"
      role="img"
      aria-label="Visualisation du niveau audio"
    >
      {safeLevels.map((level, i) => {
        const heightPercent = Math.max(8, Math.min(100, level * 100 + 8))
        return (
          <div
            key={i}
            className={`w-2 rounded-full transition-all duration-75 ease-out ${
              mode === 'recording'
                ? 'bg-gradient-to-t from-orange via-orange-hover to-sky'
                : mode === 'processing'
                  ? 'bg-sky/60 animate-pulse'
                  : 'bg-navy-mid/40'
            }`}
            style={{ height: `${heightPercent}%` }}
            aria-hidden
          />
        )
      })}
    </div>
  )
}
