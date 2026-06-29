'use client'

/**
 * HistoriqueEnvoisSection — Journal des envois du coffre-fort.
 * ------------------------------------------------------------------
 * Liste, du plus récent au plus ancien, tous les documents envoyés depuis
 * le coffre (qui a reçu quoi et quand). Lecture seule : la table
 * `documents_envois` n'a qu'une policy SELECT (le journal ne peut être ni
 * modifié ni supprimé côté utilisateur — il est alimenté côté serveur).
 *
 * Vocabulaire neutre : « historique des envois ». On ne promet pas une
 * « preuve juridique » — c'est un registre fiable de traçabilité.
 */

import { useMemo } from 'react'
import { Send, FileText } from 'lucide-react'
import { useDocumentsEnvois, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'

type Row = Record<string, unknown>
function str(v: unknown): string { return v == null ? '' : String(v) }

export default function HistoriqueEnvoisSection() {
  const { data: envois, loading, error, refetch } = useDocumentsEnvois()

  const sorted = useMemo(
    () => [...envois].sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))),
    [envois],
  )

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">
        Historique des envois
      </h2>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="font-manrope text-sm text-gray-400">
            Aucun envoi pour le moment. Les documents que vous envoyez depuis votre coffre
            apparaîtront ici (destinataire et date), pour garder une trace.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((e) => {
            const lieDevis = str(e.mode) === 'devis'
            const dateFmt = str(e.created_at)
              ? new Date(str(e.created_at)).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : ''
            const dest = str(e.destinataire_nom) || str(e.destinataire_email)
            return (
              <div
                key={str(e.id)}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,26,58,0.04)]"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff1e6] text-[#ff7a1a]">
                  <Send size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-hanken text-sm font-semibold text-[#0f1a3a]">
                    <FileText size={14} className="shrink-0 text-gray-400" aria-hidden />
                    {str(e.document_nom)}
                  </p>
                  <p className="mt-0.5 font-manrope text-xs text-gray-500">
                    Envoyé à <span className="font-semibold text-[#0f1a3a]">{dest}</span>
                    {str(e.destinataire_nom) && str(e.destinataire_email) && (
                      <span className="text-gray-400"> ({str(e.destinataire_email)})</span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-manrope text-xs text-gray-400">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${lieDevis ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {lieDevis ? 'Lié à un devis' : 'Destinataire saisi'}
                    </span>
                    {dateFmt && <span>{dateFmt}</span>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
