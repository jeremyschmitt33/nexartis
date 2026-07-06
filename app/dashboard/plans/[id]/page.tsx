'use client'

/**
 * Éditeur de plan 2D — /dashboard/plans/[id] (Push 2, 03/07/2026).
 *
 * Page plein écran : superposée à la sidebar dashboard via un conteneur
 * `fixed inset-0 z-[60]` (sous les toasts z-[100] et confirms z-[200]).
 * Route sous /dashboard → auth déjà couverte par le middleware, pas de
 * modification de HIDDEN_ROUTES nécessaire.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PlanData } from '@/lib/plan/types'
import { normaliserPlanData } from '@/lib/plan/defaults'
import { profilDe, type MetierId } from '@/lib/plan/profils'
import PlanEditor from '@/components/plan/PlanEditor'

interface PlanCharge {
  id: string
  name: string
  data: PlanData
  metier: MetierId
  chantierId: string | null
}

export default function PageEditeurPlan() {
  const params = useParams()
  const planId = typeof params.id === 'string' ? params.id : ''
  const [plan, setPlan] = useState<PlanCharge | null>(null)
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'introuvable'>('chargement')

  useEffect(() => {
    if (!planId) {
      setEtat('introuvable')
      return
    }
    let annule = false
    async function charger() {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        if (!annule) setEtat('introuvable')
        return
      }
      const { data: row, error } = await supabase
        .from('plans')
        .select('id, name, data, metier_defaut, chantier_id, deleted_at')
        .eq('id', planId)
        .single()
      if (annule) return
      if (error || !row || row.deleted_at) {
        setEtat('introuvable')
        return
      }
      setPlan({
        id: String(row.id),
        name: String(row.name ?? 'Plan'),
        data: normaliserPlanData(row.data),
        // Vue métier mémorisée par plan : inconnu / null → 'tce' (Tous les métrés).
        metier: profilDe(row.metier_defaut ? String(row.metier_defaut) : null).id,
        chantierId: row.chantier_id ? String(row.chantier_id) : null,
      })
      setEtat('pret')
    }
    charger()
    return () => {
      annule = true
    }
  }, [planId])

  if (etat === 'chargement') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-orange" aria-hidden="true" />
          <p className="font-hanken text-sm font-semibold text-gray-500">Chargement du plan…</p>
        </div>
      </div>
    )
  }

  if (etat === 'introuvable' || !plan) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white px-4">
        <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <h1 className="font-hanken text-lg font-extrabold text-navy">Plan introuvable</h1>
          <p className="mt-2 font-hanken text-sm leading-relaxed text-gray-500">
            Ce plan n&apos;existe pas, a été supprimé, ou ne vous appartient pas.
          </p>
          <Link
            href="/dashboard/chantiers"
            className="mt-5 inline-block rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
          >
            Retour aux chantiers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white">
      <PlanEditor
        planId={plan.id}
        nomInitial={plan.name}
        dataInitiale={plan.data}
        metierInitial={plan.metier}
        chantierId={plan.chantierId}
        retourHref={plan.chantierId ? `/dashboard/chantiers/${plan.chantierId}` : '/dashboard/chantiers'}
      />
    </div>
  )
}
