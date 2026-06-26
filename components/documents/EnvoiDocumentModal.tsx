'use client'

import { useState, useMemo } from 'react'
import { X, Mail, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'

type Row = Record<string, unknown>
function str(v: unknown): string { return v == null ? '' : String(v) }

interface Props {
  document: Row
  devis: Row[]
  clients: Row[]
  onClose: () => void
}

/**
 * Modale d'envoi d'un document du coffre-fort en piece jointe (Vague 2b).
 * Destinataire au choix : (a) lier a un devis (email recupere cote serveur),
 * (b) saisir un destinataire libre (nom + email) comme le planning.
 * Wording generique : "destinataire", jamais "client".
 */
export default function EnvoiDocumentModal({ document: doc, devis, clients, onClose }: Props) {
  const [mode, setMode] = useState<'devis' | 'manuel'>('devis')
  const [devisId, setDevisId] = useState('')
  const [destNom, setDestNom] = useState('')
  const [destEmail, setDestEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Index clients par id -> infos (pour afficher l'email dans le select devis)
  const clientById = useMemo(() => {
    const m = new Map<string, Row>()
    for (const c of clients) m.set(str(c.id), c)
    return m
  }, [clients])

  // Devis disposant d'un client AVEC email (sinon envoi impossible cote serveur)
  const devisOptions = useMemo(() => {
    return devis
      .map((d) => {
        const c = d.client_id ? clientById.get(str(d.client_id)) : undefined
        const email = c ? str(c.email) : ''
        const nomClient = c
          ? (str(c.raison_sociale) || `${str(c.prenom)} ${str(c.nom)}`.trim())
          : ''
        return { id: str(d.id), numero: str(d.numero), email, nomClient }
      })
      .filter((o) => o.email)
  }, [devis, clientById])

  async function handleSend() {
    if (mode === 'devis' && !devisId) { toast.error('Choisissez un devis.'); return }
    if (mode === 'manuel') {
      if (!destEmail.trim()) { toast.error('Saisissez un email de destinataire.'); return }
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destEmail.trim())
      if (!ok) { toast.error('Email du destinataire invalide.'); return }
    }
    setSending(true)
    try {
      const res = await fetch('/api/documents/envoyer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          document_id: str(doc.id),
          mode,
          devis_id: mode === 'devis' ? devisId : undefined,
          destinataire_email: mode === 'manuel' ? destEmail.trim() : undefined,
          destinataire_nom: mode === 'manuel' ? destNom.trim() : undefined,
          message: message.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || "Echec de l'envoi.")
      toast.success('Document envoye.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Echec de l'envoi.")
    } finally {
      setSending(false)
    }
  }

  const segBtn = (active: boolean) =>
    [
      'flex-1 py-2 px-3 rounded-lg font-hanken text-sm font-semibold transition-all',
      active ? 'bg-white text-[#0f1a3a] shadow-[0_1px_3px_rgba(15,26,58,0.1)]' : 'text-gray-500 hover:text-[#0f1a3a]',
    ].join(' ')

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
          <h2 className="font-hanken text-lg font-bold text-[#0f1a3a]">Envoyer un document</h2>
          <button onClick={onClose} disabled={sending} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0f1a3a] disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 font-manrope text-sm text-gray-500">
            Fichier : <span className="font-semibold text-[#0f1a3a]">{str(doc.nom)}</span>
          </p>

          <span className={lbl}>Destinataire</span>
          <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
            <button type="button" className={segBtn(mode === 'devis')} onClick={() => setMode('devis')}>
              Lier a un devis
            </button>
            <button type="button" className={segBtn(mode === 'manuel')} onClick={() => setMode('manuel')}>
              Saisir un destinataire
            </button>
          </div>

          {mode === 'devis' ? (
            <div>
              {devisOptions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-4 font-manrope text-sm text-gray-400">
                  Aucun devis avec un destinataire disposant d&apos;un email. Utilisez plutot &laquo; Saisir un destinataire &raquo;.
                </p>
              ) : (
                <>
                  <select className={field + ' cursor-pointer'} value={devisId} onChange={(e) => setDevisId(e.target.value)}>
                    <option value="">Choisir un devis...</option>
                    {devisOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        Devis {o.numero} — {o.nomClient} ({o.email})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 font-hanken text-xs text-gray-500">
                    L&apos;email du destinataire est recupere automatiquement depuis le devis.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div>
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
              <p className="mt-1.5 font-hanken text-xs text-gray-500">
                Pas besoin que le destinataire existe deja dans votre base.
              </p>
            </div>
          )}

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
