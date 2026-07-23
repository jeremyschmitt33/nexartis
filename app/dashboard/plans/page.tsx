'use client'

// ============================================================================
// app/dashboard/plans/page.tsx — Accueil « Plans 2D/3D » (Bêta).
// ----------------------------------------------------------------------------
// Regroupe TOUS les plans de l'artisan (tous chantiers confondus) au même
// endroit, pour les ouvrir/éditer. La création reste rattachée à un chantier
// (un plan appartient à un chantier), donc « Nouveau plan » demande d'abord de
// choisir le chantier, puis lance le wizard existant (CreatePlanWizard), qui
// crée le plan et ouvre l'éditeur plein écran /dashboard/plans/[id].
//
// Accès : ouvert à tous les artisans (fonctionnalité en Bêta). Sécurité en base
// (RLS plans_*_own : chacun ne voit que ses plans).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useChantiers, softDeleteRow } from '@/lib/hooks'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'
import { toast } from '@/lib/toast'
import CreatePlanWizard from '@/components/plan/CreatePlanWizard'
import { Layers, Plus, Search, X, HardHat, Trash2 } from 'lucide-react'

interface LignePlan {
  id: string
  name: string
  updated_at: string | null
  chantier_id: string | null
  computed: { habitableM2?: number; niveaux?: { pieces?: number }[] } | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

function fmtM2(n: number | undefined): string {
  if (typeof n !== 'number') return '0'
  return n.toFixed(2).replace('.', ',')
}

export default function PlansIndexPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const { data: chantiers } = useChantiers()
  const [plans, setPlans] = useState<LignePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOuvert, setPickerOuvert] = useState(false)
  const [wizardChantier, setWizardChantier] = useState<{ id: string; clientId: string | null } | null>(null)

  const charger = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('plans')
      .select('id, name, updated_at, chantier_id, computed')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) {
      toast.error('Impossible de charger vos plans.')
      setLoading(false)
      return
    }
    setPlans((data ?? []) as LignePlan[])
    setLoading(false)
  }, [])

  useEffect(() => { charger() }, [charger])

  // Nom du chantier associé à un plan (pour donner du contexte dans la liste).
  const nomChantier = useMemo(() => {
    const m = new Map<string, string>()
    ;(chantiers as Array<Record<string, unknown>> | undefined)?.forEach((c) => {
      m.set(String(c.id), String(c.titre ?? 'Chantier'))
    })
    return m
  }, [chantiers])

  async function supprimer(plan: LignePlan) {
    const ok = await confirm({
      title: `Supprimer « ${plan.name} » ?`,
      message: 'Le plan sera déplacé dans la corbeille.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await softDeleteRow('plans', plan.id)
      setPlans((liste) => liste.filter((p) => p.id !== plan.id))
      toast.success('Plan supprimé')
    } catch {
      toast.error('Impossible de supprimer le plan')
    }
  }

  return (
    <div className="font-hanken max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#0f1a3a] tracking-[-0.02em]">Plans 2D/3D</h1>
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5ab4e0]/15 text-[#2a94d6] border border-[#5ab4e0]/25">
              Bêta
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Dessinez les pièces d'un chantier, l'éditeur calcule les surfaces automatiquement.
            Fonctionnalité en test — vos retours sont les bienvenus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOuvert(true)}
          className="h-10 pl-3 pr-4 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white flex items-center gap-2 text-sm font-bold shadow-[0_4px_12px_rgba(255,122,26,0.25)] transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Nouveau plan
        </button>
      </div>

      {/* Liste des plans */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#5ab4e0]/10 grid place-items-center mx-auto mb-4">
            <Layers className="w-7 h-7 text-[#2a94d6]" />
          </div>
          <p className="text-sm font-semibold text-navy">Aucun plan pour le moment</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Créez votre premier plan pour dessiner les pièces d'un chantier et obtenir leurs surfaces.
          </p>
          <button
            type="button"
            onClick={() => setPickerOuvert(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange text-white text-sm font-semibold hover:bg-orange-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouveau plan
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => {
            const pieces = (plan.computed?.niveaux ?? []).reduce((somme, n) => somme + (n.pieces ?? 0), 0)
            const chantierNom = plan.chantier_id ? nomChantier.get(plan.chantier_id) : null
            return (
              <li key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_2px_6px_rgba(15,26,58,0.04)]">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-navy">{plan.name}</p>
                  <p className="mt-0.5 text-[12px] text-gray-500">
                    <span className="font-spline-mono font-medium text-navy">{fmtM2(plan.computed?.habitableM2)} m²</span>
                    {' habitables • '}
                    {pieces} pièce{pieces > 1 ? 's' : ''} • modifié le <span className="font-spline-mono">{fmtDate(plan.updated_at)}</span>
                  </p>
                  {chantierNom && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-gray-400">
                      <HardHat className="w-3 h-3 text-orange" /> {chantierNom}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/plans/${plan.id}`)}
                    className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-navy transition-colors hover:border-orange"
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimer(plan)}
                    aria-label={`Supprimer le plan ${plan.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Choix du chantier avant de créer un plan */}
      {pickerOuvert && (
        <ChantierPickerModal
          chantiers={(chantiers as Array<Record<string, unknown>> | undefined) ?? []}
          onClose={() => setPickerOuvert(false)}
          onPick={(id, clientId) => { setPickerOuvert(false); setWizardChantier({ id, clientId }) }}
        />
      )}

      {/* Wizard de création (rattaché au chantier choisi) : crée + ouvre l'éditeur */}
      {wizardChantier && (
        <CreatePlanWizard
          open
          chantierId={wizardChantier.id}
          clientId={wizardChantier.clientId}
          plansExistants={plans.filter((p) => p.chantier_id === wizardChantier.id).map((p) => ({ id: p.id, name: p.name }))}
          onFermer={() => setWizardChantier(null)}
        />
      )}
    </div>
  )
}

// ─── Choix du chantier ───────────────────────────────────────────────────────

function ChantierPickerModal({ chantiers, onClose, onPick }: {
  chantiers: Array<Record<string, unknown>>
  onClose: () => void
  onPick: (chantierId: string, clientId: string | null) => void
}) {
  const [recherche, setRecherche] = useState('')

  const filtres = useMemo(() => {
    const actifs = chantiers.filter((c) => c.statut !== 'archive')
    const q = recherche.trim().toLowerCase()
    if (!q) return actifs
    return actifs.filter((c) => String(c.titre ?? '').toLowerCase().includes(q))
  }, [chantiers, recherche])

  return (
    <div className="fixed inset-0 z-[10000] bg-navy/40 flex items-end md:items-center justify-center p-0 md:p-4 font-hanken" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-extrabold text-[#0f1a3a]">Pour quel chantier ?</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">Un plan est rattaché à un chantier.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center text-gray-400 hover:text-navy transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un chantier…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtres.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-orange/10 grid place-items-center mx-auto mb-3">
                <HardHat className="w-7 h-7 text-orange" />
              </div>
              <p className="text-sm font-semibold text-navy">
                {recherche ? 'Aucun chantier trouvé.' : 'Aucun chantier disponible'}
              </p>
              {!recherche && (
                <p className="text-xs text-gray-400 mt-1">Créez d'abord un chantier pour y ajouter un plan.</p>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtres.map((c) => (
                <li key={String(c.id)}>
                  <button
                    onClick={() => onPick(String(c.id), c.client_id ? String(c.client_id) : null)}
                    className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-left hover:border-orange hover:bg-orange/[0.03] transition-colors"
                  >
                    <span className="w-9 h-9 rounded-lg bg-navy/10 text-navy grid place-items-center flex-shrink-0">
                      <HardHat className="w-4.5 h-4.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-navy text-sm truncate">{String(c.titre ?? 'Chantier')}</span>
                    </span>
                    <Plus className="w-4 h-4 text-gray-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
