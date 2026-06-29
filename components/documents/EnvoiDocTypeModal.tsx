'use client'

import { useState, useMemo } from 'react'
import { X, Mail, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'

type Row = Record<string, unknown>
function str(v: unknown): string { return v == null ? '' : String(v) }

/**
 * Fenêtre d'envoi d'un DOCUMENT GÉNÉRÉ (CGV, courrier, PV…) par email.
 * Le PDF est généré côté serveur à partir du contenu stocké, puis joint à
 * l'email (Brevo). Pré-remplit le destinataire depuis le client lié au
 * document, si renseigné. L'envoi est journalisé (« Historique des envois »).
 */
export default function EnvoiDocTypeModal({ doc, clients, onClose }: {
  doc: Row
  clients: Row[]
  onClose: () => void
}) {
  // Pré-remplissage depuis le client lié, si dispo.
  const clientLie = useMemo(() => {
    const cid = str(doc.client_id)
    return cid ? clients.find((c) => str(c.id) === cid) || null : null
  }, [doc, clients])

  const nomClientLie = clientLie
    ? (str(clientLie.raison_sociale) || `${str(clientLie.prenom)} ${str(clientLie.nom)}`.trim())
    : ''

  const [destNom, setDestNom] = useState(nomClientLie)
  const [destEmail, setDestEmail] = useState(clientLie ? str(clientLie.email) : '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!destEmail.trim()) { toast.error('Saisissez un email de destinataire.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destEmail.trim())) { toast.error('Email du destinataire invalide.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/documents-types/envoyer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          document_id: str(doc.id),
          destinataire_email: destEmail.trim(),
          destinataire_nom: destNom.trim() || undefined,
          message: message.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || "Echec de l'envoi.")
      toast.success('Document envoyé.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Echec de l'envoi.")
    } finally {
      setSending(false)
    }
  }

  const field =
    'w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white transition-all'
  const lbl = 'block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a]" />
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-hanken text-lg font-bold text-[#0f1a3a]">Envoyer le document</h2>
          <button onClick={onClose} disabled={sending} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0f1a3a] disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 font-manrope text-sm text-gray-500">
            Document : <span className="font-semibold text-[#0f1a3a]">{str(doc.titre)}</span>
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Nom du destinataire</label>
              <input className={field} value={destNom} onChange={(e) => setDestNom(e.target.value)} placeholder="M. Martin / Societe X" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={field} type="email" value={destEmail} onChange={(e) => setDestEmail(e.target.value)} placeholder="destinataire@email.fr" />
            </div>
          </div>

          <div className="mt-4">
            <label className={lbl}>Message (optionnel)</label>
            <textarea
              className={field + ' resize-y leading-[1.5]'}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bonjour, veuillez trouver ci-joint le document demande..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-xl border-[1.5px] border-gray-200 bg-white px-5 py-2.5 font-hanken text-sm font-bold text-[#0f1a3a] hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,122,26,0.35)] disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}
