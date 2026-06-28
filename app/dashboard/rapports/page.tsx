'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, ChevronRight, Loader2, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { PremiumButton } from '@/components/ui/v4'

interface RapportRow {
  id: string
  numero: string | null
  objet: string | null
  statut: string
  date_intervention: string | null
  client_nom_snapshot: string | null
  chantier_id: string | null
  created_at: string
}
interface DevisOpt { id: string; label: string }
type DevisRaw = { id: string; numero: string | null; objet: string | null; clients: { nom: string | null; prenom: string | null; raison_sociale: string | null } | { nom: string | null; prenom: string | null; raison_sociale: string | null }[] | null }

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  finalise: { label: 'Finalise', cls: 'bg-sky/15 text-sky-dark' },
  envoye: { label: 'Envoye', cls: 'bg-emerald-100 text-emerald-700' },
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RapportsPage() {
  const router = useRouter()
  const [rapports, setRapports] = useState<RapportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [devisList, setDevisList] = useState<DevisOpt[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [devisId, setDevisId] = useState('')
  const [objet, setObjet] = useState('')
  const [dateInter, setDateInter] = useState('')
  const [dateFin, setDateFin] = useState('')

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rapports')
      const json = await res.json()
      setRapports(json.rapports ?? [])
    } catch { setRapports([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { charger() }, [charger])
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const dv = await supabase.from('devis')
          .select('id, numero, objet, clients(nom, prenom, raison_sociale)')
          .order('created_at', { ascending: false })
        const rows = (dv.data ?? []) as unknown as DevisRaw[]
        setDevisList(rows.map((d) => {
          const cl = Array.isArray(d.clients) ? d.clients[0] : d.clients
          const nom = cl ? (cl.raison_sociale || [cl.prenom, cl.nom].filter(Boolean).join(' ').trim()) : ''
          const base = nom || d.numero || 'Devis'
          return { id: d.id, label: d.objet ? `${base} — ${d.objet}` : base }
        }))
      } catch { /* liste optionnelle */ }
    })()
  }, [])

  const supprimer = async (e: React.MouseEvent, rid: string) => {
    e.preventDefault(); e.stopPropagation()
    if (!window.confirm('Supprimer ce rapport ?')) return
    setRapports((prev) => prev.filter((r) => r.id !== rid))
    try {
      const res = await fetch(`/api/rapports/${rid}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Suppression impossible'); charger() }
    } catch { toast.error('Suppression impossible (reseau)'); charger() }
  }

  const creer = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/rapports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devis_id: devisId || null, objet: objet || null, date_intervention: dateInter || null, date_fin: dateFin || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.id) { toast.error(json.message || 'Creation impossible'); return }
      router.push(`/dashboard/rapports/${json.id}`)
    } catch { toast.error('Creation impossible (reseau)') } finally { setCreating(false) }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-hanken font-extrabold text-2xl text-navy tracking-[-0.02em] flex items-center gap-2">
            <FileText className="text-orange" size={24} /> Rapports d&apos;intervention
          </h1>
          <p className="font-hanken text-sm text-gray-500 mt-1">Compte-rendus illustres remis a vos clients.</p>
        </div>
        <PremiumButton variant="primary" icon={<Plus size={18} />} onClick={() => setShowCreate(true)}>
          Nouveau rapport
        </PremiumButton>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 font-hanken py-16 justify-center">
          <Loader2 className="animate-spin" size={18} /> Chargement...
        </div>
      ) : rapports.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <FileText className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="font-hanken text-gray-500">Aucun rapport pour l&apos;instant.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 font-hanken font-semibold text-orange hover:underline">
            Creer mon premier rapport
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rapports.map((r) => {
            const b = STATUT_BADGE[r.statut] ?? STATUT_BADGE.brouillon
            return (
              <Link key={r.id} href={`/dashboard/rapports/${r.id}`}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-sky hover:shadow-sm transition group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-spline-mono text-xs text-gray-400">{r.numero || '-'}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                  </div>
                  <p className="font-hanken font-semibold text-navy truncate mt-0.5">{r.objet || 'Sans objet'}</p>
                  <p className="font-hanken text-xs text-gray-500 truncate">
                    {r.client_nom_snapshot || 'Sans client'}{r.date_intervention ? ` - ${fmtDate(r.date_intervention)}` : ''}
                  </p>
                </div>
                <button aria-label="Supprimer le rapport" onClick={(e) => supprimer(e, r.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                <ChevronRight className="text-gray-300 group-hover:text-sky flex-shrink-0" size={20} />
              </Link>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !creating && setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-hanken font-extrabold text-lg text-navy">Nouveau rapport</h2>
              <button aria-label="Fermer" onClick={() => !creating && setShowCreate(false)} className="text-gray-400 hover:text-navy"><X size={20} /></button>
            </div>

<label className="block font-hanken text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Devis lie (optionnel)</label>
            <select value={devisId} onChange={(e) => setDevisId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 mb-1">
              <option value="">- Aucun (saisie libre) -</option>
              {devisList.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <p className="font-hanken text-xs text-gray-400 mb-4">Reprend le client, l&apos;adresse et l&apos;objet. Sinon, vous remplissez l&apos;en-tete a la main.</p>

            <label className="block font-hanken text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objet</label>
            <input value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex : Mise aux normes tableau electrique"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50 mb-3" />

            <div className="grid grid-cols-2 gap-2 mb-5">
              <div>
                <label className="block font-hanken text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date d&apos;intervention</label>
                <input type="date" value={dateInter} onChange={(e) => setDateInter(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50" />
              </div>
              <div>
                <label className="block font-hanken text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fin (plusieurs jours)</label>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-hanken text-sm text-navy bg-gray-50" />
              </div>
            </div>

            <PremiumButton variant="primary" loading={creating} onClick={creer} className="w-full justify-center">
              Creer le rapport
            </PremiumButton>
          </div>
        </div>
      )}
    </div>
  )
}
