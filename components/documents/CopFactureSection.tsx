'use client'

// ============================================================================
// components/documents/CopFactureSection.tsx
// ----------------------------------------------------------------------------
// Apres signature du contrat d'ouverture de porte : genere une VRAIE facture
// liee (F-YYYY-####) qui entre dans la compta. Option "encaisse sur place" =>
// facture 'payee', sinon 'brouillon' (a encaisser). Poste vers
// /api/documents/cop/facture.
// ============================================================================

import { useState } from 'react'
import { Receipt, Check } from 'lucide-react'
import { toast } from '@/lib/toast'

export default function CopFactureSection({ copId }: { copId: string }) {
  const [encaisse, setEncaisse] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleGenerate() {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/cop/facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copId, encaisse }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || 'La facture n\'a pas pu etre generee.')
        setSubmitting(false)
        return
      }
      toast.success(
        json?.factureNumero ? `Facture ${json.factureNumero} generee.` : 'Facture generee.',
      )
      if (typeof window !== 'undefined') window.location.reload()
    } catch {
      toast.error('Erreur reseau. Reessayez.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-[#dbe4ff] bg-[#fafbff] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#1d4ed8]">
          <Receipt size={18} />
        </span>
        <h2 className="font-hanken text-base font-bold text-[#0f1a3a]">Facturer l&apos;intervention</h2>
      </div>
      <p className="mb-4 font-manrope text-sm text-gray-500">
        Genere une facture liee a ce contrat. Elle apparaitra dans vos Factures et votre chiffre d&apos;affaires.
      </p>

      <button
        type="button"
        onClick={() => setEncaisse((v) => !v)}
        className="mb-4 flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left"
      >
        <span
          className={
            'mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border ' +
            (encaisse ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-gray-300 bg-white text-transparent')
          }
        >
          <Check size={13} />
        </span>
        <span className="font-manrope text-xs leading-relaxed text-[#374151]">
          <strong className="text-[#0f1a3a]">Encaisse sur place</strong> (especes / carte). Sinon la facture reste
          « a encaisser » et vous la marquerez payee plus tard.
        </span>
      </button>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={submitting}
        className={
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-hanken text-sm font-bold transition ' +
          (submitting ? 'cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-[#1d4ed8] text-white hover:bg-[#1a43bd]')
        }
      >
        <Receipt size={18} /> {submitting ? 'Generation…' : 'Generer la facture'}
      </button>
    </div>
  )
}
