'use client'

// ============================================================
//  Etape 4 e-facture (ADMIN, beta) : carte de suivi du cycle de
//  vie d'une facture envoyee a SUPER PDP.
//
//  Affiche les evenements (status_text fourni par SUPER PDP) du
//  plus recent au plus ancien, avec un bouton "Rafraichir".
//  Composant ISOLE : n'alourdit pas la page facture et n'est rendu
//  que pour l'admin sur une facture deja envoyee.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Zap } from 'lucide-react'

interface EvenementEfacture {
  code: string | null
  text: string | null
  date: string | null
}

/** Couleur du badge selon le code de statut (heuristique douce, sans risque). */
function tonFromCode(code: string | null): string {
  const c = (code || '').toLowerCase()
  if (c.includes('reject') || c.includes('invalid') || c.includes('refus') || c === 'fr:210' || c === 'fr:211') {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  if (c.includes('received') || c.includes('accept') || c.includes('validated') || c === 'fr:212') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  return 'bg-[#5ab4e0]/10 text-[#2b6c91] border-[#5ab4e0]/30'
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function EfactureStatutCard({ factureId }: { factureId: string }) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<EvenementEfacture[]>([])
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superpdp/facture-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factureId }),
      })
      const data = (await res.json().catch(() => null)) as
        | { sent?: boolean; invoiceId?: string | null; events?: EvenementEfacture[]; error?: string }
        | null
      if (!res.ok || !data) {
        setError(data?.error || 'Statut indisponible pour le moment.')
        return
      }
      setEvents(Array.isArray(data.events) ? data.events : [])
      setInvoiceId(data.invoiceId ?? null)
    } catch {
      setError('Erreur reseau lors de la lecture du statut.')
    } finally {
      setLoading(false)
    }
  }, [factureId])

  useEffect(() => {
    charger()
  }, [charger])

  // Du plus recent au plus ancien pour l'affichage.
  const ordered = [...events].reverse()
  const latest = ordered[0]

  return (
    <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-[#5ab4e0]" />
          <h3 className="font-hanken font-bold text-[14px] text-[#0f1a3a]">
            Suivi facture électronique
          </h3>
        </div>
        <button
          onClick={charger}
          disabled={loading}
          title="Rafraîchir le statut"
          aria-label="Rafraîchir le statut de la facture électronique"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-[1.5px] border-gray-200 bg-white hover:border-[#5ab4e0] hover:bg-[#fafbfc] transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin text-gray-500" />
          ) : (
            <RefreshCw size={14} className="text-gray-600" />
          )}
        </button>
      </div>

      <p className="font-hanken text-[11.5px] text-gray-400 mb-3">
        Bêta admin{invoiceId ? ` · réf. SUPER PDP ${invoiceId}` : ''}
      </p>

      {error && (
        <div className="rounded-xl bg-amber-50/80 border border-amber-200/70 px-3 py-2 mb-2">
          <p className="font-hanken text-[12.5px] text-amber-800">{error}</p>
        </div>
      )}

      {!error && loading && events.length === 0 && (
        <p className="font-hanken text-[13px] text-gray-500">Lecture du statut…</p>
      )}

      {!error && !loading && events.length === 0 && (
        <p className="font-hanken text-[13px] text-gray-500">
          Aucun événement pour le moment. La facture vient peut-être d'être déposée ;
          réessayez dans quelques instants.
        </p>
      )}

      {events.length > 0 && (
        <>
          {/* Statut le plus récent, mis en avant */}
          {latest && (
            <div className="mb-3">
              <span
                className={`inline-block px-2.5 py-1 rounded-full font-hanken text-[11.5px] font-bold border ${tonFromCode(latest.code)}`}
                title={latest.code || undefined}
              >
                {latest.text || latest.code || 'Statut inconnu'}
              </span>
              {latest.date && (
                <span className="font-hanken text-[11.5px] text-gray-400 ml-2">
                  {formatDate(latest.date)}
                </span>
              )}
            </div>
          )}

          {/* Historique complet */}
          <ul className="space-y-2">
            {ordered.map((ev, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5ab4e0] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-hanken text-[12.5px] text-[#0f1a3a]" title={ev.code || undefined}>
                    {ev.text || ev.code || 'Événement'}
                  </p>
                  {ev.date && (
                    <p className="font-hanken text-[11px] text-gray-400">{formatDate(ev.date)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
