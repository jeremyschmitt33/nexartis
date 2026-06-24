'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, RefreshCw, ChevronLeft, Users } from 'lucide-react'
import { useUser } from '@/lib/hooks'

const ADMIN_EMAIL = 'admin@nexartis.fr'

interface Filleul {
  nom: string | null
  email: string | null
  statut: string
  inscrit_le: string
  recompense_le: string | null
}
interface ParrainBloc {
  parrain_id: string
  parrain_nom: string | null
  parrain_email: string | null
  filleuls: Filleul[]
  mois_gagnes: number
}
interface AdminData {
  total_parrainages: number
  total_parrains: number
  parrains: ParrainBloc[]
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statutBadge(statut: string): { label: string; cls: string } {
  switch (statut) {
    case 'recompense':
      return { label: 'Récompensé (les 2)', cls: 'bg-green-100 text-green-700' }
    case 'recompense_filleul_seul':
      return { label: 'Filleul payé — crédit parrain en attente', cls: 'bg-amber-100 text-amber-800' }
    case 'non_recompense_plafond':
      return { label: 'Filleul payé — plafond parrain', cls: 'bg-blue-100 text-blue-700' }
    case 'annule':
      return { label: 'Annulé', cls: 'bg-red-100 text-red-700' }
    default:
      return { label: 'Inscrit — pas encore payé', cls: 'bg-gray-100 text-gray-600' }
  }
}

export default function AdminParrainagesPage() {
  const { user, loading: loadingUser } = useUser()
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loadingUser && user?.email !== ADMIN_EMAIL) router.replace('/dashboard')
  }, [user, loadingUser, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/parrainages')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) fetchData()
  }, [user, fetchData])

  if (loadingUser || user?.email !== ADMIN_EMAIL) return null

  return (
    <div className="min-h-screen">
      {/* En-tete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
            aria-label="Retour à l'admin"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
            <Gift size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="font-syne font-bold text-xl text-[#1a1a2e]">Parrainages</h1>
            <p className="text-xs text-gray-400 font-manrope">
              {data ? `${data.total_parrains} parrain(s) · ${data.total_parrainages} parrainage(s)` : '—'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-[#1a1a2e]"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400 font-manrope">Chargement…</div>
      ) : !data || data.parrains.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 font-manrope">Aucun parrainage pour l’instant.</div>
      ) : (
        <div className="space-y-4">
          {data.parrains.map((p) => (
            <div key={p.parrain_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Parrain */}
              <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-syne font-bold text-sm flex-shrink-0">
                    {(p.parrain_nom || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-manrope font-bold text-sm text-[#1a1a2e] truncate">
                      {p.parrain_nom || '(sans nom)'} <span className="text-xs font-medium text-purple-600">· Parrain</span>
                    </div>
                    <div className="text-xs text-gray-400 font-manrope truncate">{p.parrain_email || '—'}</div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-syne font-bold text-green-600">{p.mois_gagnes} mois</div>
                  <div className="text-[10px] text-gray-400 font-manrope">{p.filleuls.length} filleul(s)</div>
                </div>
              </div>

              {/* Filleuls en dessous */}
              <ul className="divide-y divide-gray-50">
                {p.filleuls.map((f, i) => {
                  const badge = statutBadge(f.statut)
                  return (
                    <li key={i} className="px-5 py-3 flex items-center justify-between gap-3 pl-8">
                      <div className="flex items-center gap-3 min-w-0">
                        <Users size={14} className="text-gray-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-manrope text-[#1a1a2e] truncate">{f.nom || '(sans nom)'}</div>
                          <div className="text-xs text-gray-400 font-manrope truncate">
                            {f.email || '—'} · inscrit le {formatDate(f.inscrit_le)}
                          </div>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-manrope font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
