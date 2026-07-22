'use client'

// ============================================================================
// app/dashboard/chantiers-confies/page.tsx — Vue SOUS-TRAITANT (Phase 3, 3.1).
// ----------------------------------------------------------------------------
// Les chantiers qu'un confrère (donneur d'ordre) m'a confiés. J'accepte ou je
// refuse ; une fois accepté, je verrai le lot (infos travail + client, JAMAIS
// de financier). Contribution photos/avancement = briques 3.2 / 3.3.
// ============================================================================

import { useState } from 'react'
import { HardHat, MapPin, Loader2, Check, X, UserCheck } from 'lucide-react'
import {
  useMesChantiersConfies,
  repondrePartageChantier,
  type ChantierConfie,
} from '@/lib/hooks-collab'

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ChantiersConfiesPage() {
  const { chantiers, loading, refetch } = useMesChantiersConfies()
  const [action, setAction] = useState<string | null>(null)

  const invitations = chantiers.filter((c) => c.statut === 'invite')
  const actifs = chantiers.filter((c) => c.statut === 'actif')

  async function repondre(partageId: string, rep: 'accepter' | 'refuser') {
    setAction(partageId)
    try {
      await repondrePartageChantier(partageId, rep)
      refetch()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy font-manrope tracking-tight">Chantiers qu'on m'a confiés</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les lots que des confrères vous confient en sous-traitance. Vous n'avez accès qu'aux
          informations de travail — jamais à leurs devis, factures ou finances.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : chantiers.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-navy/5 grid place-items-center mx-auto mb-4">
            <HardHat className="w-7 h-7 text-navy/40" />
          </div>
          <p className="text-sm font-semibold text-navy">Aucun chantier confié pour le moment</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Quand un confrère vous confie un lot d'un de ses chantiers, il apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {invitations.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-orange mb-2">
                Invitations en attente
              </h2>
              <div className="space-y-3">
                {invitations.map((c) => (
                  <ChantierConfieCarte key={c.partage_id} c={c}>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => repondre(c.partage_id, 'accepter')}
                        disabled={action === c.partage_id}
                        className="flex-1 h-10 rounded-xl bg-navy text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-navy-mid transition-colors disabled:opacity-50"
                      >
                        {action === c.partage_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Accepter
                      </button>
                      <button
                        onClick={() => repondre(c.partage_id, 'refuser')}
                        disabled={action === c.partage_id}
                        className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Refuser
                      </button>
                    </div>
                  </ChantierConfieCarte>
                ))}
              </div>
            </section>
          )}

          {actifs.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-sky mb-2">
                Chantiers en cours
              </h2>
              <div className="space-y-3">
                {actifs.map((c) => (
                  <ChantierConfieCarte key={c.partage_id} c={c}>
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-emerald-600 font-semibold">
                      <UserCheck className="w-3.5 h-3.5" /> Accepté — contribution photos et avancement bientôt disponible
                    </div>
                  </ChantierConfieCarte>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ChantierConfieCarte({ c, children }: { c: ChantierConfie; children?: React.ReactNode }) {
  const lieu = [c.chantier_adresse, c.chantier_ville].filter(Boolean).join(', ')
  const dd = formatDate(c.date_debut)
  const df = formatDate(c.date_fin_prevue)
  const periode = (dd || df) ? `${dd || '—'} → ${df || '—'}` : null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-navy/10 text-navy grid place-items-center flex-shrink-0">
          <HardHat className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-navy leading-snug">{c.chantier_titre || 'Chantier'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Confié par <span className="font-semibold text-navy">{c.proprietaire_nom || 'Un confrère'}</span>
          </p>
        </div>
      </div>
      {c.lot && (
        <div className="mt-3 rounded-lg bg-orange/[0.06] border border-orange/15 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange">Votre lot</p>
          <p className="text-[13px] text-navy mt-0.5">{c.lot}</p>
        </div>
      )}
      <div className="mt-2.5 space-y-1.5 text-[12.5px]">
        {lieu && (
          <div className="flex items-start gap-1.5 text-gray-600">
            <MapPin className="w-3.5 h-3.5 text-orange flex-shrink-0 mt-0.5" />
            <span>{lieu}</span>
          </div>
        )}
        {periode && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <span aria-hidden="true">📅</span><span>{periode}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
