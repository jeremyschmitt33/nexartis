'use client'

/**
 * AstuceDictee
 * ----------------------------------------------------------------
 * Petit bandeau d'aide discret qui rappelle à l'artisan qu'il peut
 * REMPLIR N'IMPORTE QUEL CHAMP À LA VOIX en utilisant le micro du
 * clavier de son téléphone (iOS / Android), au lieu de taper.
 *
 * Aucune techno de reconnaissance vocale n'est embarquée : les champs
 * du rapport sont des <input>/<textarea> standards, donc déjà dictables
 * par le micro natif du clavier (gratuit, robuste, fonctionne hors-ligne
 * sur iPhone récent). On se contente de le rendre visible.
 *
 * Réutilisable : à placer une fois en haut d'un éditeur (rapport,
 * et plus tard commentaires de devis/factures).
 */

import { Mic } from 'lucide-react'

export default function AstuceDictee({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl bg-sky/5 border border-sky/20 px-3 py-2 ${className}`}
      role="note"
    >
      <Mic size={15} className="text-orange flex-shrink-0" aria-hidden />
      <p className="font-hanken text-xs text-navy-mid">
        Astuce : sur mobile, touchez le{' '}
        <span className="font-semibold text-navy">micro de votre clavier</span> pour dicter un
        champ à la voix au lieu de le taper.
      </p>
    </div>
  )
}
