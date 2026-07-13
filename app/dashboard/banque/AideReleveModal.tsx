'use client'

// ============================================================================
// AideReleveModal — « Où télécharger mon relevé ? » (Lot 2a)
// ----------------------------------------------------------------------------
// Wording repris de la maquette validée (docs/depenses-banque/maquette-v1.html),
// ajusté au périmètre V1 : seul le CSV est accepté (l'OFX arrive en V1.5).
// ============================================================================

import { useEffect } from 'react'
import { X } from 'lucide-react'

const BANQUES: { nom: string; chemin: string }[] = [
  {
    nom: 'Crédit Agricole',
    chemin: 'Comptes → cliquez sur votre compte → « Télécharger les opérations » → format CSV.',
  },
  {
    nom: 'BNP Paribas',
    chemin: 'Comptes → bouton « Exporter » en haut de la liste des opérations → format CSV.',
  },
  {
    nom: 'Boursorama',
    chemin: 'Mon compte → icône de téléchargement au-dessus de la liste des opérations → CSV.',
  },
  { nom: 'Qonto', chemin: 'Transactions → bouton « Exporter » → CSV.' },
  { nom: 'Shine', chemin: 'Compte pro → « Exports comptables » → relevé CSV.' },
]

export default function AideReleveModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white rounded-[20px] w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Où télécharger mon relevé bancaire"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-hanken font-bold text-lg text-navy">Où télécharger mon relevé&nbsp;?</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="text-[13px] text-gray-600 mb-4">
          Le relevé CSV, c&rsquo;est le fichier que votre banque vous laisse télécharger, avec la liste de vos
          opérations (il s&rsquo;ouvre dans Excel). <strong>Vous n&rsquo;avez rien à modifier dedans</strong>&nbsp;:
          glissez-le tel quel dans Nexartis, on se débrouille avec.
        </p>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Où le trouver, banque par banque
        </p>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden text-[13px] mb-4">
          {BANQUES.map((b) => (
            <div key={b.nom} className="px-4 py-3">
              <p className="font-bold text-navy mb-0.5">{b.nom}</p>
              <p className="text-gray-500">{b.chemin}</p>
            </div>
          ))}
        </div>

        <p className="text-[12.5px] text-gray-500 mb-3">
          Votre banque n&rsquo;est pas dans la liste&nbsp;? Cherchez un bouton «&nbsp;Exporter&nbsp;» ou
          «&nbsp;Télécharger&nbsp;» près de la liste de vos opérations — c&rsquo;est presque toujours là. Si on
          vous propose plusieurs formats, choisissez <strong>CSV</strong> (le PDF et l&rsquo;OFX ne sont pas encore
          acceptés).
        </p>
        <p className="text-[12.5px] text-gray-500">
          Et rassurez-vous&nbsp;: Nexartis <strong>lit</strong> simplement ce fichier. Aucune connexion à votre
          banque, aucun paiement — jamais.
        </p>
      </div>
    </div>
  )
}
