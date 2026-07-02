'use client'

// ============================================================================
// components/documents/CopSignSection.tsx
// ----------------------------------------------------------------------------
// Signature SUR PLACE d'un contrat d'ouverture de porte : l'artisan passe son
// telephone au client, qui coche les 3 reconnaissances, signe au doigt, et
// valide. Poste vers /api/documents/cop/sign (journal de preuve serveur).
// ============================================================================

import { useState } from 'react'
import { PenLine, Check } from 'lucide-react'
import SignaturePad from '@/components/ui/SignaturePad'
import { toast } from '@/lib/toast'

const RENONCIATIONS = [
  "Je suis informe(e) que, s'agissant d'un contrat conclu hors etablissement, je dispose en principe d'un delai de retractation de 14 jours.",
  "Je demande expressement l'execution immediate de l'ouverture, avant la fin de ce delai, en raison de son caractere urgent.",
  "Je reconnais qu'une fois l'ouverture d'urgence executee, je ne beneficie plus du droit de retractation pour cette prestation.",
]

export default function CopSignSection({
  copId,
  defaultSignedBy,
}: {
  copId: string
  defaultSignedBy: string
}) {
  const [checks, setChecks] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null)
  const [signedBy, setSignedBy] = useState(defaultSignedBy)
  const [submitting, setSubmitting] = useState(false)

  const allChecked = checks[0] && checks[1] && checks[2]
  const ready = allChecked && !!signatureBase64 && signedBy.trim().length > 0 && !submitting

  function toggle(i: number) {
    setChecks((prev) => {
      const next = [...prev] as [boolean, boolean, boolean]
      next[i] = !next[i]
      return next
    })
  }

  async function handleSubmit() {
    if (!ready) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/cop/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copId,
          signatureBase64,
          signedBy: signedBy.trim(),
          renonciationInfo: checks[0],
          renonciationExecution: checks[1],
          renonciationPerte: checks[2],
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || 'La signature n\'a pas pu etre enregistree.')
        setSubmitting(false)
        return
      }
      toast.success('Contrat signe et enregistre.')
      // Rechargement pour afficher l'etat signe (source de verite serveur).
      if (typeof window !== 'undefined') window.location.reload()
    } catch {
      toast.error('Erreur reseau. Reessayez.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-[#ffd7b5] bg-[#fffaf3] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff1e6] text-[#ff7a1a]">
          <PenLine size={18} />
        </span>
        <h2 className="font-hanken text-base font-bold text-[#0f1a3a]">Faire signer le client</h2>
      </div>
      <p className="mb-4 font-manrope text-sm text-gray-500">
        Passez le telephone au client : il coche les trois cases, signe au doigt, puis valide.
      </p>

      <div className="space-y-2">
        {RENONCIATIONS.map((txt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left"
          >
            <span
              className={
                'mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border ' +
                (checks[i] ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-gray-300 bg-white text-transparent')
              }
            >
              <Check size={13} />
            </span>
            <span className="font-manrope text-xs leading-relaxed text-[#374151]">{txt}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block font-manrope text-xs font-semibold uppercase tracking-wide text-gray-400">
          Signature du client
        </label>
        <SignaturePad onSignature={setSignatureBase64} onClear={() => setSignatureBase64(null)} />
      </div>

      <div className="mt-3">
        <label className="mb-1.5 block font-manrope text-xs font-semibold uppercase tracking-wide text-gray-400">
          Nom du signataire
        </label>
        <input
          value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)}
          placeholder="Nom et prenom"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-manrope text-sm text-[#0f1a3a]"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!ready}
        className={
          'mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-hanken text-sm font-bold transition ' +
          (ready ? 'bg-[#ff7a1a] text-white hover:bg-[#e86d0f]' : 'cursor-not-allowed bg-gray-200 text-gray-400')
        }
      >
        <Check size={18} /> {submitting ? 'Enregistrement…' : 'Valider la signature'}
      </button>
      <p className="mt-2 text-center font-manrope text-[11px] text-gray-400">
        Contrat horodate et scelle. Aucun numero de piece n&apos;est conserve.
      </p>
    </div>
  )
}
