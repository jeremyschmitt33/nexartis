'use client'

/**
 * PlanTab — Onglet « Plan 2D » de la page chantier (Push 2, 03/07/2026).
 * Liste des plans du chantier (deleted_at IS NULL), ouverture, soft delete
 * avec ConfirmDialog. Depuis le Push 3a (étape F), « Nouveau plan » ouvre le
 * wizard 2 étapes (métier puis méthode) : voir CreatePlanWizard.tsx.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { softDeleteRow } from '@/lib/hooks'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'
import { toast } from '@/lib/toast'
import CreatePlanWizard from './CreatePlanWizard'

interface LignePlan {
  id: string
  name: string
  updated_at: string | null
  computed: { habitableM2?: number; niveaux?: { pieces?: number }[] } | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function fmtM2(n: number | undefined): string {
  if (typeof n !== 'number') return '0'
  return n.toFixed(2).replace('.', ',')
}

export interface PlanTabProps {
  chantierId: string
  clientId: string | null
}

export default function PlanTab({ chantierId, clientId }: PlanTabProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const [plans, setPlans] = useState<LignePlan[]>([])
  const [chargement, setChargement] = useState(true)
  const [wizardOuvert, setWizardOuvert] = useState(false)

  const charger = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('plans')
      .select('id, name, updated_at, computed')
      .eq('chantier_id', chantierId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) {
      toast.error('Impossible de charger les plans du chantier')
      setChargement(false)
      return
    }
    setPlans((data ?? []) as LignePlan[])
    setChargement(false)
  }, [chantierId])

  useEffect(() => {
    charger()
  }, [charger])

  const supprimerPlan = async (plan: LignePlan) => {
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
    } catch (_e) {
      toast.error('Impossible de supprimer le plan')
    }
  }

  return (
    <div className="bg-white border border-[#0f1a3a]/[0.06] rounded-2xl shadow-[0_2px_6px_rgba(15,26,58,0.04)] p-5 mb-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-hanken text-base font-extrabold tracking-[-0.02em] text-navy">Plans 2D du chantier</h3>
          <p className="mt-0.5 font-hanken text-[12.5px] text-gray-500">
            Dessinez les pièces, l&apos;éditeur calcule les surfaces automatiquement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOuvert(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] px-4 py-2 font-hanken text-sm font-bold text-white shadow-[0_4px_12px_rgba(255,122,26,0.25)] transition-all hover:-translate-y-0.5"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouveau plan
        </button>
      </div>

      {chargement ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
          <p className="font-hanken text-sm font-semibold text-navy">Aucun plan pour ce chantier</p>
          <p className="mt-1 font-hanken text-[12.5px] text-gray-500">
            Créez un premier plan pour dessiner les pièces et obtenir leurs surfaces.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => {
            const pieces = (plan.computed?.niveaux ?? []).reduce((somme, n) => somme + (n.pieces ?? 0), 0)
            return (
              <li key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-[#fafbfc] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-hanken text-[14px] font-bold text-navy">{plan.name}</p>
                  <p className="mt-0.5 font-hanken text-[12px] text-gray-500">
                    <span className="font-spline-mono font-medium text-navy">{fmtM2(plan.computed?.habitableM2)} m²</span>
                    {' habitables • '}
                    {pieces} pièce{pieces > 1 ? 's' : ''} • modifié le{' '}
                    <span className="font-spline-mono">{fmtDate(plan.updated_at)}</span>
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/plans/${plan.id}`)}
                    className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3.5 py-1.5 font-hanken text-[13px] font-bold text-navy transition-colors hover:border-orange"
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimerPlan(plan)}
                    aria-label={`Supprimer le plan ${plan.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    </svg>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <CreatePlanWizard
        open={wizardOuvert}
        chantierId={chantierId}
        clientId={clientId}
        plansExistants={plans.map((p) => ({ id: p.id, name: p.name }))}
        onFermer={() => setWizardOuvert(false)}
      />
    </div>
  )
}
