'use client'

/**
 * Bouton flottant "Nous contacter" — affiché sur toutes les pages du dashboard.
 *
 * Positionné en bas à droite. Sur mobile, remonté de 24px pour ne pas
 * être masqué par <MobileBottomNav />.
 *
 * Animation de pulsation 3s au tout premier rendu (puis jamais), pour
 * attirer l'œil sans devenir gênant. Le state est persisté dans
 * localStorage (clé "contact-button-seen").
 *
 * Le bouton ouvre <ContactModal /> qui contient le vrai formulaire.
 */

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import ContactModal from './ContactModal'

export default function ContactFloatingButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [showPulse, setShowPulse] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem('contact-button-seen')
    if (!seen) {
      setShowPulse(true)
      const timer = setTimeout(() => setShowPulse(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClick = () => {
    setIsOpen(true)
    setShowPulse(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('contact-button-seen', '1')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Ouvrir le formulaire de contact"
        title="Une question ?"
        className={`
          fixed right-4 md:right-6 bottom-24 md:bottom-6 z-40
          flex items-center justify-center
          h-14 w-14 rounded-full
          bg-orange hover:bg-orange-hover
          text-cream shadow-lg hover:shadow-xl
          transition-all duration-200
          focus:outline-none focus:ring-4 focus:ring-orange/30
          ${showPulse ? 'animate-pulse' : ''}
        `}
      >
        <MessageCircle size={24} strokeWidth={2} />
      </button>

      <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
