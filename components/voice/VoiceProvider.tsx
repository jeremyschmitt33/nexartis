'use client'
// components/voice/VoiceProvider.tsx — V3.1
// Context React qui permet d'ouvrir la commande vocale depuis n'importe quel
// composant enfant via useVoiceCommandModal().openVoice().
//
// Usage : wrap <VoiceProvider> autour du dashboard layout. Le modal est rendu
// une seule fois au niveau du provider, partage entre toutes les pages.

import React, { createContext, useContext, useState, useCallback } from 'react'
import VoiceCommandModal from './VoiceCommandModal'

interface VoiceContextValue {
  openVoice: () => void
  closeVoice: () => void
  isOpen: boolean
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const openVoice = useCallback(() => setIsOpen(true), [])
  const closeVoice = useCallback(() => setIsOpen(false), [])

  return (
    <VoiceContext.Provider value={{ openVoice, closeVoice, isOpen }}>
      {children}
      <VoiceCommandModal open={isOpen} onClose={closeVoice} />
    </VoiceContext.Provider>
  )
}

export function useVoiceModal(): VoiceContextValue {
  const ctx = useContext(VoiceContext)
  if (!ctx) {
    throw new Error('useVoiceModal must be used inside <VoiceProvider>')
  }
  return ctx
}
