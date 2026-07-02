'use client'

// ============================================================================
// components/documents/CopSendSection.tsx
// ----------------------------------------------------------------------------
// Envoi au client, par email, d'un lien vers sa copie du contrat d'ouverture
// de porte (page publique lecture seule). Poste vers /api/documents/cop/send.
// ============================================================================

import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { toast } from '@/lib/toast'

export default function CopSendSection({ copId }: { copId: string }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function handleSend() {
    if (!valid || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/documents/cop/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copId, email: email.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || 'L\'email n\'a pas pu etre envoye.')
        setSending(false)
        return
      }
      toast.success('Copie envoyee au client par email.')
      setSent(true)
      setSending(false)
    } catch {
      toast.error('Erreur reseau. Reessayez.')
      setSending(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#0f1a3a]">
          <Mail size={18} />
        </span>
        <h2 className="font-hanken text-base font-bold text-[#0f1a3a]">Envoyer la copie au client</h2>
      </div>
      <p className="mb-4 font-manrope text-sm text-gray-500">
        Le client recoit un lien pour consulter et imprimer sa copie du contrat signe.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSent(false) }}
          placeholder="email@du-client.fr"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 font-manrope text-sm text-[#0f1a3a]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!valid || sending}
          className={
            'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-hanken text-sm font-bold transition ' +
            (valid && !sending ? 'bg-[#0f1a3a] text-white hover:bg-[#1a2748]' : 'cursor-not-allowed bg-gray-200 text-gray-400')
          }
        >
          <Send size={16} /> {sending ? 'Envoi…' : sent ? 'Renvoyer' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}
