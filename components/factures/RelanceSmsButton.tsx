'use client'

// ---------------------------------------------------------------------------
// Bouton "Relancer par SMS" — l'artisan envoie le SMS depuis SON telephone
// (inclus dans son forfait, donc gratuit ; Nexartis ne facture aucun SMS).
// Sur mobile : "Ouvrir Messages" pre-remplit le numero + le texte (lien sms:).
// Sur ordinateur : "Copier le texte" (l'app Messages n'existe pas sur PC).
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { MessageSquare, Copy, Check, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface Props {
  telephone: string
  clientNom?: string
  numero: string
  resteAPayer: number
  entrepriseNom?: string
}

function fmtEur(n: number): string {
  return (
    (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
  )
}

export default function RelanceSmsButton({
  telephone,
  clientNom,
  numero,
  resteAPayer,
  entrepriseNom,
}: Props) {
  const defaultMsg = useMemo(() => {
    const hello = clientNom ? `Bonjour ${clientNom},` : 'Bonjour,'
    const sign = entrepriseNom ? ` ${entrepriseNom}` : ''
    return `${hello} petit rappel : la facture ${numero} d'un montant de ${fmtEur(resteAPayer)} reste a regler. Merci de votre reglement.${sign}`
  }, [clientNom, numero, resteAPayer, entrepriseNom])

  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(defaultMsg)
  const [copied, setCopied] = useState(false)

  const phoneClean = telephone.replace(/[^\d+]/g, '')
  const smsHref = `sms:${phoneClean}?&body=${encodeURIComponent(msg)}`

  function copy() {
    try {
      navigator.clipboard?.writeText(msg)
    } catch {
      /* clipboard indisponible */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <>
      <button
        onClick={() => {
          setMsg(defaultMsg)
          setOpen(true)
        }}
        title="Preparer un SMS de relance a envoyer depuis ton telephone (gratuit, ton forfait)"
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-blue-200 bg-blue-50 hover:bg-blue-100 font-hanken text-[13.5px] font-semibold text-blue-700 transition-colors"
        aria-label="Relancer par SMS"
      >
        <MessageSquare size={14} /> Relancer par SMS
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-hanken font-bold text-[15px] text-[#0f1a3a]">Relance par SMS</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-[12px] text-gray-500 mb-3">
              A <span className="font-spline-mono">{telephone}</span> · gratuit depuis ton telephone
            </p>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              className="w-full rounded-xl border-2 border-gray-200 p-3 text-[14px] text-[#0f1a3a] outline-none focus:border-[#ff7a1a]"
            />
            {/* MOBILE : ouvre l'appli Messages pre-remplie (envoi depuis le forfait, gratuit). */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <a
                href={smsHref}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#ff7a1a] hover:bg-[#f0913f] text-white font-semibold text-sm transition-colors"
              >
                <MessageSquare size={16} /> Ouvrir Messages (mobile)
              </a>
              <button
                onClick={copy}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border-2 border-gray-200 hover:bg-gray-50 text-[#0f1a3a] font-semibold text-sm transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copie' : 'Copier le texte'}
              </button>
            </div>

            {/* ORDINATEUR : QR a scanner avec le telephone -> ouvre le SMS pre-rempli sur le mobile. */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
              <div className="shrink-0 rounded-xl bg-white p-2 border border-gray-200">
                <QRCodeSVG value={smsHref} size={104} />
              </div>
              <p className="text-[12px] text-gray-600 leading-snug">
                <span className="font-semibold text-[#0f1a3a]">Sur ordinateur :</span> scannez ce QR code
                avec l&apos;appareil photo de votre telephone. Le SMS s&apos;ouvre pre-rempli sur le mobile,
                vous n&apos;avez plus qu&apos;a l&apos;envoyer (gratuit, depuis votre forfait).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
