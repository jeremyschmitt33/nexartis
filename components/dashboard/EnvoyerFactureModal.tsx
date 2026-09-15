'use client'

import { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'

interface EnvoyerFactureModalProps {
  open: boolean
  onClose: () => void
  factureId: string
  numeroFacture: string
  clientEmail?: string
  clientNom?: string
  montantTTC?: string
  onSuccess?: () => void
  /** 15/09/2026 : true = envoi de la version « facture acquittée ». */
  acquittee?: boolean
}

export default function EnvoyerFactureModal({
  open,
  onClose,
  factureId,
  numeroFacture,
  clientEmail = '',
  clientNom = '',
  montantTTC = '',
  onSuccess,
  acquittee = false,
}: EnvoyerFactureModalProps) {
  const defaultMessage = acquittee
    ? `Bonjour${clientNom ? ' ' + clientNom : ''},

Veuillez trouver ci-joint votre facture acquittée n° ${numeroFacture}${montantTTC ? ` d'un montant de ${montantTTC}` : ''}.

Nous vous remercions pour votre règlement et restons à votre disposition pour toute question.

Cordialement`
    : `Bonjour${clientNom ? ' ' + clientNom : ''},

Veuillez trouver ci-joint votre facture n° ${numeroFacture}${montantTTC ? ` d'un montant de ${montantTTC}` : ''}.

Dans l'attente de votre règlement, nous restons à votre disposition pour toute question.

Cordialement`

  const [email, setEmail] = useState(clientEmail)
  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (clientEmail) setEmail(clientEmail)
  }, [clientEmail])

  useEffect(() => {
    setMessage(defaultMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroFacture, clientNom, montantTTC, acquittee])

  if (!open) return null

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Veuillez saisir une adresse email.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/send-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factureId, emailDestinataire: email, messagePersonnalise: message, acquittee }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || "Erreur lors de l'envoi")
        setSending(false)
        return
      }
      setSent(true)
      setSending(false)
      onSuccess?.()
      setTimeout(() => {
        setSent(false)
        onClose()
      }, 2000)
    } catch {
      setError('Erreur de connexion')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="bg-white rounded-2xl w-full max-w-lg p-4 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="font-syne font-bold text-base sm:text-xl text-[#1a1a2e]">{acquittee ? 'Envoyer la facture acquittée' : 'Envoyer la facture par email'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={28} className="text-emerald-600" />
            </div>
            <p className="font-syne font-bold text-lg text-[#1a1a2e]">{acquittee ? 'Facture acquittée envoyée !' : 'Facture envoyée !'}</p>
            <p className="font-manrope text-sm text-gray-500 mt-1">{acquittee ? 'La facture acquittée' : 'La facture'} n° {numeroFacture} a été envoyée à {email}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">
                  Email du destinataire
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0]"
                />
              </div>
              <div>
                <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">
                  Message personnalisé
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-600 font-manrope">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-4 sm:mt-6">
              <button
                onClick={onClose}
                className="h-10 px-6 rounded-lg border border-gray-200 text-sm font-manrope hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="h-10 px-6 rounded-lg bg-[#e87a2a] text-white text-sm font-syne font-bold hover:bg-[#f09050] disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
