'use client'

/**
 * CreatePlanWizard — Wizard de création d'un plan 2D (Push 3a — étape F, 04/07/2026).
 * Modal 2 étapes (maquette mockup_plan_2d_editeur_v2.html, section [1]) :
 *   1. « Quel est votre métier sur ce chantier ? » — grille des profils ACTIFS
 *      (lib/plan/profils), pré-sélection = metier_defaut du plan le plus récent
 *      de l'utilisateur (RLS), sinon électricien.
 *   2. « Comment démarrer ? » — Partir de zéro (INSERT + redirect) / Photo d'un
 *      plan (désactivé, badges IA + Bientôt) / Dupliquer un plan (si d'autres
 *      plans non supprimés existent sur CE chantier).
 * Échap ferme, focus déplacé sur la modal à l'ouverture et au changement d'étape.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { insertRow } from '@/lib/hooks'
import { toast } from '@/lib/toast'
import { METIERS_WIZARD, PROFILS, type MetierId } from '@/lib/plan/profils'
import { planDataVide, normaliserPlanData, nomAvecSuffixe } from '@/lib/plan/defaults'
import { calculerComputed } from './useAutosave'

export interface PlanExistant {
  id: string
  name: string
}

export interface CreatePlanWizardProps {
  open: boolean
  chantierId: string
  clientId: string | null
  /** Plans non supprimés déjà présents sur CE chantier (noms uniques + duplication). */
  plansExistants: PlanExistant[]
  onFermer: () => void
}

/** Icônes SVG inline par profil métier (mêmes libellés que VueMetierPill). */
function IconeMetier({ id }: { id: MetierId }) {
  const p = {
    className: 'h-6 w-6',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (id) {
    case 'electricien':
      return (
        <svg {...p}>
          <path d="M13 2L4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
        </svg>
      )
    case 'plombier':
      return (
        <svg {...p}>
          <path d="M12 3c3.5 4 6 7 6 10a6 6 0 01-12 0c0-3 2.5-6 6-10z" />
        </svg>
      )
    case 'peintre':
      return (
        <svg {...p}>
          <rect x="4" y="4" width="13" height="5" rx="1.5" />
          <path d="M17 6.5h3v4h-8.5V14" />
          <rect x="10.2" y="14" width="2.6" height="7" rx="1" />
        </svg>
      )
    case 'carreleur_solier':
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M12 4v16M4 12h16" />
        </svg>
      )
    case 'plaquiste':
      return (
        <svg {...p}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 14l9 5 9-5" />
        </svg>
      )
    case 'menuiserie':
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M4 12h16M12 4v16" />
        </svg>
      )
    case 'maconnerie':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="4.5" rx="0.5" />
          <rect x="3" y="14.5" width="18" height="4.5" rx="0.5" />
          <path d="M9 5v4.5M15 5v4.5M6 14.5V19M12 14.5V19M18 14.5V19" />
        </svg>
      )
    case 'chauffagiste':
      return (
        <svg {...p}>
          <rect x="5" y="4" width="14" height="16" rx="1.5" />
          <path d="M9 4v16M13 4v16M17 4v16" />
        </svg>
      )
    default:
      // 'tce' et repli : cube « Tous les métrés » (même icône que VueMetierPill)
      return (
        <svg {...p}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      )
  }
}

/** Badge doré (réservé IA / Bientôt, jamais pour un état de succès). */
function BadgeGold({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-navy">
      {children}
    </span>
  )
}

export default function CreatePlanWizard({
  open,
  chantierId,
  clientId,
  plansExistants,
  onFermer,
}: CreatePlanWizardProps) {
  const router = useRouter()
  const [etape, setEtape] = useState<1 | 2>(1)
  const [metier, setMetier] = useState<MetierId>('electricien')
  const [sourceId, setSourceId] = useState('')
  const [creation, setCreation] = useState(false)
  const panneauRef = useRef<HTMLDivElement>(null)

  // À chaque ouverture : reset + pré-sélection du métier du plan le plus récent
  // de l'utilisateur (toutes chantiers confondus, la RLS limite aux siens).
  useEffect(() => {
    if (!open) return
    setEtape(1)
    setCreation(false)
    let annule = false
    const precharger = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('plans')
        .select('metier_defaut')
        .is('deleted_at', null)
        .not('metier_defaut', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
      if (annule) return
      const dernier = data?.[0]?.metier_defaut as string | undefined
      const profil = dernier ? PROFILS[dernier as MetierId] : undefined
      setMetier(profil && profil.actif ? profil.id : 'electricien')
    }
    precharger()
    return () => {
      annule = true
    }
  }, [open])

  // Sélecteur de plan source : 1er plan du chantier par défaut.
  useEffect(() => {
    if (open) setSourceId(plansExistants[0]?.id ?? '')
  }, [open, plansExistants])

  // Échap ferme ; focus déplacé sur la modal à l'ouverture et à chaque étape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onFermer])

  useEffect(() => {
    if (open) panneauRef.current?.focus()
  }, [open, etape])

  if (!open) return null

  const nomsExistants = plansExistants.map((pl) => pl.name)

  const creerDeZero = async () => {
    if (creation) return
    setCreation(true)
    try {
      const nom = nomAvecSuffixe('Plan ' + (plansExistants.length + 1), nomsExistants)
      const data = planDataVide()
      const cree = (await insertRow('plans', {
        chantier_id: chantierId,
        client_id: clientId || null,
        name: nom,
        metier_defaut: metier,
        data,
        computed: calculerComputed(data),
      })) as { id: string }
      router.push(`/dashboard/plans/${cree.id}`)
    } catch (_e) {
      toast.error('Impossible de créer le plan')
      setCreation(false)
    }
  }

  const dupliquerPlan = async () => {
    if (creation || !sourceId) return
    setCreation(true)
    try {
      const supabase = createClient()
      const { data: src, error } = await supabase
        .from('plans')
        .select('name, data, metier_defaut')
        .eq('id', sourceId)
        .single()
      if (error || !src) throw new Error('plan source introuvable')
      const nom = nomAvecSuffixe(`${src.name} (copie)`, nomsExistants)
      const data = normaliserPlanData(src.data)
      const cree = (await insertRow('plans', {
        chantier_id: chantierId,
        client_id: clientId || null,
        name: nom,
        metier_defaut: src.metier_defaut ?? null,
        data,
        computed: calculerComputed(data),
      })) as { id: string }
      router.push(`/dashboard/plans/${cree.id}`)
    } catch (_e) {
      toast.error('Impossible de dupliquer le plan')
      setCreation(false)
    }
  }

  const spinner = (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"
      aria-hidden="true"
    />
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-plan-titre"
      className="fixed inset-0 z-[95] flex items-end justify-center px-0 font-hanken sm:items-center sm:px-4"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onFermer}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={panneauRef}
        tabIndex={-1}
        className="relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl outline-none sm:rounded-2xl sm:p-6"
      >
        {etape === 1 ? (
          <>
            <h2 id="wizard-plan-titre" className="text-[17px] font-extrabold tracking-tight text-navy">
              Quel est votre métier sur ce chantier ?
            </h2>
            <p className="mt-1 text-[12.5px] leading-snug text-gray-500">
              Vous ne verrez que les outils et métrés utiles à votre métier — modifiable à tout moment.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {METIERS_WIZARD.filter((m) => PROFILS[m].actif).map((m) => {
                const sel = m === metier
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetier(m)}
                    aria-pressed={sel}
                    className={`relative flex flex-col items-start gap-2 rounded-xl border-[1.5px] px-3 py-3 text-left transition-colors ${
                      sel
                        ? 'border-orange bg-orange/5 text-orange'
                        : 'border-gray-200 bg-white text-navy hover:border-gray-300'
                    }`}
                  >
                    {sel && (
                      <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                    <IconeMetier id={m} />
                    <span className="text-[13px] font-bold leading-tight">{PROFILS[m].label}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setEtape(2)}
                className="h-11 rounded-[12px] bg-gradient-to-r from-accent-2 to-accent px-6 text-[14px] font-bold text-white shadow-lg transition-all hover:brightness-105"
              >
                Continuer
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="wizard-plan-titre" className="text-[17px] font-extrabold tracking-tight text-navy">
              Comment démarrer ?
            </h2>
            <p className="mt-1 text-[12.5px] leading-snug text-gray-500">
              Vue métier choisie : <span className="font-bold text-navy">{PROFILS[metier].label}</span>.
            </p>

            <div className="mt-4 space-y-2.5">
              {/* Partir de zéro */}
              <button
                type="button"
                onClick={creerDeZero}
                disabled={creation}
                className="flex w-full items-start gap-3 rounded-xl border-[1.5px] border-gray-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-orange disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                  {creation ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange border-r-transparent" aria-hidden="true" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-navy">Partir de zéro</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
                    Dessinez vos pièces avec vos mesures télémètre. Le plus rapide pour un relevé sur place.
                  </span>
                </span>
              </button>

              {/* Photo d'un plan — à venir */}
              <div
                aria-disabled="true"
                className="flex w-full items-start gap-3 rounded-xl border-[1.5px] border-dashed border-gray-200 bg-gray-50/60 px-4 py-3.5 text-left opacity-70"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-bold text-navy">
                    Photo d&apos;un plan
                    <BadgeGold>IA</BadgeGold>
                    <BadgeGold>Bientôt</BadgeGold>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
                    Photographiez un plan coté existant : l&apos;IA lira les dimensions écrites, vous validerez pièce par pièce.
                  </span>
                </span>
              </div>

              {/* Dupliquer un plan */}
              {plansExistants.length > 0 ? (
                <div className="rounded-xl border-[1.5px] border-gray-200 bg-white px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="12" height="12" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-navy">Dupliquer un plan</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
                        Repartez d&apos;un plan existant de ce chantier (pièces, niveaux et vue métier copiés).
                      </span>
                      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                        <select
                          value={sourceId}
                          onChange={(e) => setSourceId(e.target.value)}
                          aria-label="Plan à dupliquer"
                          className="h-10 min-w-0 flex-1 rounded-xl border-[1.5px] border-gray-200 bg-white px-3 text-[13px] font-semibold text-navy focus:border-orange focus:outline-none"
                        >
                          {plansExistants.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={dupliquerPlan}
                          disabled={creation || !sourceId}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-[13px] font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {creation && spinner}
                          Dupliquer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  aria-disabled="true"
                  className="flex w-full items-start gap-3 rounded-xl border-[1.5px] border-dashed border-gray-200 bg-gray-50/60 px-4 py-3.5 opacity-70"
                >
                  <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="12" height="12" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-navy">Dupliquer un plan</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
                      Aucun autre plan sur ce chantier pour l&apos;instant.
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEtape(1)}
                disabled={creation}
                className="h-11 rounded-[12px] border-[1.5px] border-gray-200 bg-white px-5 text-[14px] font-bold text-navy transition-colors hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Métier
              </button>
              <button
                type="button"
                onClick={onFermer}
                disabled={creation}
                className="h-11 rounded-[12px] px-4 text-[14px] font-bold text-gray-500 transition-colors hover:text-navy disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
