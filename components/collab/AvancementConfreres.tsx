'use client'

// ============================================================================
// components/collab/AvancementConfreres.tsx — Vue DONNEUR D'ORDRE (brique 3.3).
// ----------------------------------------------------------------------------
// Sur la fiche d'un chantier, affiche les CONFRÈRES à qui on a confié un lot
// (collaboration inter-comptes, à ne PAS confondre avec les « sous-traitants »
// financiers de la fiche). Pour chacun : son lot, son statut, et le dernier
// point d'avancement qu'il a publié — avec l'historique dépliable.
//
// Auto-masqué s'il n'y a aucun confrère : un chantier sans collaboration
// n'affiche pas de section vide. Aucun financier ici (décision produit).
// ============================================================================

import { useState } from 'react'
import { Users, Clock, ChevronDown, ChevronUp, HardHat } from 'lucide-react'
import {
  useCollaborateursChantier,
  usePointsAvancement,
  AVANCEMENT_LABELS,
  type AvancementStatut,
  type CollaborateurChantier,
} from '@/lib/hooks-collab'

const BADGE: Record<AvancementStatut, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-[#eaf6fd] text-[#2a94d6]',
  en_pause: 'bg-[#fff3e6] text-[#c2681a]',
  termine: 'bg-[#e7f7ee] text-[#1a8a4f]',
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

function formatDateHeure(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AvancementConfreres({ chantierId }: { chantierId: string }) {
  const { collaborateurs, loading } = useCollaborateursChantier(chantierId)

  // Rien tant qu'on charge, et rien s'il n'y a pas de confrère : pas de bloc vide.
  if (loading || collaborateurs.length === 0) return null

  return (
    <div className="bg-white border border-[#0f1a3a]/[0.06] rounded-2xl shadow-[0_2px_6px_rgba(15,26,58,0.04)] overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-[#0f1a3a]/[0.06] grid place-items-center">
          <Users className="w-4 h-4 text-[#0f1a3a]" />
        </span>
        <div>
          <h3 className="text-[15px] font-extrabold text-[#0f1a3a] leading-none font-hanken">Confrères en collaboration</h3>
          <p className="text-[11px] text-[#7b8ba3] mt-1">Lots confiés à des confrères de votre réseau et leur avancement.</p>
        </div>
      </div>
      <div className="divide-y divide-[#e6ecf2]">
        {collaborateurs.map((c) => <LigneConfrere key={c.partage_id} c={c} />)}
      </div>
    </div>
  )
}

function LigneConfrere({ c }: { c: CollaborateurChantier }) {
  const [ouvert, setOuvert] = useState(false)
  const enAttente = c.statut === 'invite'

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#0f1a3a] text-white text-[11px] font-bold grid place-items-center flex-shrink-0">
          {initials(c.collaborateur_nom)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-[#0f1a3a]">{c.collaborateur_nom || 'Confrère'}</span>
            {enAttente ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#fff3e6] text-[#c2681a]">
                Invitation en attente
              </span>
            ) : c.avancement_statut ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${BADGE[c.avancement_statut]}`}>
                {AVANCEMENT_LABELS[c.avancement_statut]}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-gray-100 text-gray-500">
                Pas encore d'avancement
              </span>
            )}
          </div>

          {c.lot && (
            <div className="mt-1 flex items-center gap-1 text-[12px] text-[#64748b]">
              <HardHat className="w-3.5 h-3.5 text-[#c2681a]" /> <span>{c.lot}</span>
            </div>
          )}

          {!enAttente && c.avancement_statut && (
            <div className="mt-1.5">
              {c.avancement_note && <p className="text-[12.5px] text-[#0f1a3a] leading-snug">{c.avancement_note}</p>}
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10.5px] text-[#7b8ba3] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Mis à jour le {formatDateHeure(c.avancement_maj_le)}
                </p>
                <button
                  type="button"
                  onClick={() => setOuvert((v) => !v)}
                  className="text-[10.5px] font-semibold text-[#2a94d6] hover:underline flex items-center gap-0.5"
                >
                  {ouvert ? <>Masquer <ChevronUp className="w-3 h-3" /></> : <>Historique <ChevronDown className="w-3 h-3" /></>}
                </button>
              </div>
            </div>
          )}

          {ouvert && <TimelineConfrere partageId={c.partage_id} />}
        </div>
      </div>
    </div>
  )
}

function TimelineConfrere({ partageId }: { partageId: string }) {
  const { points, loading } = usePointsAvancement(partageId)

  if (loading) return <p className="mt-2 text-[11px] text-[#7b8ba3]">Chargement…</p>
  if (points.length === 0) return <p className="mt-2 text-[11px] text-[#7b8ba3]">Aucun point d'avancement.</p>

  return (
    <div className="mt-2 pl-3 border-l-2 border-[#e6ecf2] space-y-2">
      {points.map((p) => (
        <div key={p.id} className="flex items-start gap-2">
          <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${BADGE[p.statut] || 'bg-gray-100 text-gray-600'}`}>
            {AVANCEMENT_LABELS[p.statut] || p.statut}
          </span>
          <div className="min-w-0 flex-1">
            {p.note && <p className="text-[12px] text-[#0f1a3a] leading-snug">{p.note}</p>}
            <p className="text-[10px] text-[#7b8ba3] flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" /> {formatDateHeure(p.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
