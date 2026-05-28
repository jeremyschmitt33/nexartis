'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  SendHorizonal,
  Trash2,
  Plus,
} from 'lucide-react'
import { useFactures, useClients, softDeleteRow, insertRow, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import EnvoyerFactureModal from '@/components/dashboard/EnvoyerFactureModal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type FactureFilter = 'Toutes' | 'Encaissées' | 'Partielles' | 'En attente' | 'En retard' | 'Archivées'

const FILTER_OPTIONS: string[] = ['Toutes', 'Encaissées', 'Partielles', 'En attente', 'En retard', 'Archivées']

function getFactureCategory(f: Record<string, unknown>): FactureFilter {
  const statut = (f.statut as string) ?? ''
  if (statut === 'payee' || statut === 'Encaissée') return 'Encaissées'
  if (statut === 'partielle') return 'Partielles'
  if (statut === 'en_retard') return 'En retard'
  if (statut === 'archivee') return 'Archivées'
  return 'En attente'
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' \u20ac'
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function daysOverdue(dateEcheance: string | null): number {
  if (!dateEcheance) return 0
  const diff = Date.now() - new Date(dateEcheance).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

export default function FacturesListPage() {
  const router = useRouter()
  const { data: factures, loading: loadingF, error: errorF, refetch: refetchF } = useFactures()
  const { data: clients, loading: loadingC } = useClients()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Toutes')
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [sendTarget, setSendTarget] = useState<{ id: string; numero: string; email: string; clientNom: string; montantTtcLabel: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loading = loadingF || loadingC

  // Fermer le menu au scroll ou clic extérieur
  const closeMenu = useCallback(() => { setOpenActions(null); setMenuPos(null) }, [])
  useEffect(() => {
    if (!openActions) return
    const handleClickOutside = () => closeMenu()
    const handleScroll = () => closeMenu()
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [openActions, closeMenu])

  const clientMap = new Map<string, string>()
  for (const c of clients) {
    const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || (c.raison_sociale as string) || ''
    clientMap.set(c.id as string, nom)
  }

  type EnrichedFacture = Record<string, unknown> & { paidPercent: number; overdue: number; category: FactureFilter; clientName: string; montantTtc: number; montantPaye: number }
  const enriched: EnrichedFacture[] = factures.map((f) => {
    const montantTtc = (f.montant_ttc as number) ?? 0
    const montantPaye = (f.montant_paye as number) ?? 0
    const paidPercent = montantTtc > 0 ? Math.round((montantPaye / montantTtc) * 100) : 0
    const overdue = daysOverdue(f.date_echeance as string | null)
    const category = getFactureCategory(f)
    const clientName = clientMap.get(f.client_id as string) || (f.client_nom as string) || (f.notes_client as string)?.split(' | ')[0]?.trim() || '\u2014'
    return { ...f, paidPercent, overdue, category, clientName, montantTtc, montantPaye } as EnrichedFacture
  })

  const filtered = enriched.filter((f) => {
    if (filter !== 'Toutes' && f.category !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        ((f.numero as string) ?? '').toLowerCase().includes(q) ||
        f.clientName.toLowerCase().includes(q) ||
        ((f.objet as string) ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalCount = enriched.length
  const totalHT = enriched.reduce((s, f) => s + ((f.montant_ht as number) ?? 0), 0)
  const encaissees = enriched.filter((f) => f.category === 'Encaissées' || f.category === 'Archivées')
  const encaisseesHT = encaissees.reduce((s, f) => s + (f.montantTtc), 0)
  const resteList = enriched.filter((f) => f.category === 'Partielles' || f.category === 'En attente')
  const resteHT = resteList.reduce((s, f) => s + (f.montantTtc - f.montantPaye), 0)
  const retardList = enriched.filter((f) => f.category === 'En retard')
  const retardHT = retardList.reduce((s, f) => s + (f.montantTtc - f.montantPaye), 0)

  const handleDelete = async (id: string) => {
    if (!confirm('Envoyer cette facture à la corbeille ?')) return
    setDeleting(id)
    try {
      await softDeleteRow('factures', id)
      refetchF()
    } catch (err) {
      alert('Erreur lors de la suppression : ' + (err as Error).message)
    } finally {
      setDeleting(null)
      closeMenu()
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(f => f.id as string)))
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Envoyer ${selected.size} facture${selected.size > 1 ? 's' : ''} à la corbeille ?`)) return
    setBulkDeleting(true)
    try {
      for (const id of Array.from(selected)) {
        await softDeleteRow('factures', id)
      }
      setSelected(new Set())
      refetchF()
    } catch (err: unknown) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    }
    setBulkDeleting(false)
  }

  // ── Dupliquer : copie de la facture (en-tête + lignes) en brouillon, nouveau numéro et nouvelles dates ──
  async function handleDuplicate(sourceId: string) {
    closeMenu()
    if (duplicating) return
    setDuplicating(sourceId)
    try {
      const supabase = createClient()

      // 1) Récupère la source
      const { data: src, error: srcErr } = await supabase.from('factures').select('*').eq('id', sourceId).maybeSingle()
      if (srcErr || !src) throw new Error(srcErr?.message || 'Facture source introuvable')

      // 2) Construit le payload sans les champs auto / historiques
      const source = src as Record<string, unknown>
      const excluded = new Set([
        'id', 'created_at', 'updated_at', 'numero', 'statut',
        'date_emission', 'date_echeance', 'date_envoi', 'sent_at', 'paid_at',
        'montant_paye', 'archivee', 'deleted_at',
      ])
      const newFacture: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(source)) {
        if (!excluded.has(k)) newFacture[k] = v
      }

      const yearNow = new Date().getFullYear()
      newFacture.numero = `F-${yearNow}-${String(Date.now()).slice(-5)}`
      newFacture.statut = 'brouillon'
      newFacture.date_emission = new Date().toISOString().slice(0, 10)
      // date_echeance laissée vide volontairement (sera reposée lors de l'édition)

      const inserted = (await insertRow('factures', newFacture)) as Record<string, unknown>
      const newId = inserted.id as string

      // 3) Copie des lignes (table sans user_id, RLS via parent)
      const { data: lignes } = await supabase
        .from('facture_lignes')
        .select('designation, quantite, unite, prix_unitaire_ht, taux_tva, ordre, type, niveau, numero')
        .eq('facture_id', sourceId)
        .order('ordre')

      if (lignes && lignes.length > 0) {
        const rows = (lignes as Array<Record<string, unknown>>).map(l => ({ ...l, facture_id: newId }))
        const { error: liErr } = await supabase.from('facture_lignes').insert(rows)
        if (liErr) throw new Error(liErr.message)
      }

      refetchF()
      router.push(`/dashboard/factures/${newId}/modifier`)
    } catch (err) {
      alert('Erreur lors de la duplication : ' + (err as Error).message)
    } finally {
      setDuplicating(null)
    }
  }

  // ── Envoyer : ouvre la modale partagée EnvoyerFactureModal avec les bonnes infos ──
  function handleSend(facture: EnrichedFacture) {
    closeMenu()
    const id = facture.id as string
    const numero = (facture.numero as string) ?? ''
    // Email : champ direct, puis lookup clientMap → email via clients
    const clientId = facture.client_id as string | undefined
    let email = (facture.client_email as string) || ''
    if (!email && clientId) {
      const c = clients.find(cl => (cl.id as string) === clientId)
      if (c && c.email) email = c.email as string
    }
    if (!email && typeof facture.notes_client === 'string') {
      email = facture.notes_client.split(' | ').find((p: string) => p.includes('@')) || ''
    }
    const montantTtcLabel = formatCurrency(facture.montantTtc)
    setSendTarget({ id, numero, email, clientNom: facture.clientName, montantTtcLabel })
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, factureId: string) {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (openActions === factureId) { closeMenu(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const menuHeight = 220
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4
    const left = rect.right - 176
    setMenuPos({ top, left: Math.max(8, left) })
    setOpenActions(factureId)
  }

  if (errorF) {
    return <ErrorBanner message={errorF} onRetry={refetchF} />
  }

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  const activeFacture = openActions ? filtered.find(f => (f.id as string) === openActions) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FileText size={20} />} label="Toutes" value={String(totalCount)} sub={`${formatCurrency(totalHT)} HT`} accent="#5ab4e0" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Encaissées" value={String(encaissees.length)} sub={`${formatCurrency(encaisseesHT)} HT`} accent="#22c55e" />
        <StatCard icon={<Clock size={20} />} label="Reste à encaisser" value={String(resteList.length)} sub={`${formatCurrency(resteHT)} HT`} accent="#e87a2a" />
        <StatCard icon={<AlertTriangle size={20} />} label="En retard" value={String(retardList.length)} sub={`${formatCurrency(retardHT)} HT`} accent="#ef4444" bg="bg-red-50" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input type="text" placeholder="Rechercher une facture..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} containerClassName="sm:w-auto">
          {FILTER_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
        </Select>
        <Link href="/dashboard/factures/nouveau" className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors">
          <Plus size={16} /> Nouvelle facture
        </Link>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-manrope font-semibold text-blue-700">{selected.size} facture{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}</span>
          <button onClick={handleBulkDelete} disabled={bulkDeleting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-manrope font-semibold transition-colors disabled:opacity-50">
            <Trash2 size={13} /> {bulkDeleting ? 'Suppression...' : 'Supprimer la sélection'}
          </button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-manrope font-medium text-gray-600 hover:bg-gray-50 transition-colors">Tout désélectionner</button>
        </div>
      )}

      {/* Mobile cards (visible < md) */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucune facture trouvée</p>
          </div>
        ) : (
          filtered.map((facture) => {
            const id = facture.id as string
            const restant = facture.montantTtc - facture.montantPaye
            const retardLabel = facture.category === 'En retard' && facture.overdue > 0 ? `En retard ${facture.overdue}j` : undefined
            const paidColor = facture.paidPercent === 100 ? '#22c55e' : facture.category === 'En retard' ? '#ef4444' : '#5ab4e0'
            return (
              <div
                key={id}
                onClick={() => router.push(`/dashboard/factures/${id}`)}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-manrope font-bold text-[#1a1a2e] truncate">{facture.clientName || (facture.numero as string)}</p>
                    <p className="text-xs font-manrope text-gray-500">{(facture.objet as string) || (facture.numero as string)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-manrope font-bold text-[#1a1a2e]">{formatCurrency(facture.montantTtc)}</p>
                    {retardLabel && <p className="text-xs font-manrope text-red-500 font-medium">{retardLabel}</p>}
                    {!retardLabel && facture.paidPercent < 100 && facture.paidPercent > 0 && (
                      <p className="text-xs font-manrope text-[#5ab4e0]">{formatCurrency(restant)} restants</p>
                    )}
                  </div>
                </div>
                {/* Barre de paiement */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width: `${facture.paidPercent}%`, background: paidColor}} />
                  </div>
                  <span className="text-xs font-manrope text-gray-500">{facture.paidPercent}%</span>
                  <button onClick={(e) => { e.stopPropagation(); openMenu(e, id) }} className="p-1 rounded-md hover:bg-gray-100 ml-1">
                    <MoreHorizontal size={15} className="text-gray-500" />
                  </button>
                </div>
                <p className="text-xs font-manrope text-gray-400">{formatDate((facture.date_emission || facture.created_at) as string | null)}</p>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop table (visible ≥ md) */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-[#5ab4e0] focus:ring-[#5ab4e0] cursor-pointer" /></th>
              {['Numéro', 'Règlements', 'Client / Chantier', 'Modifié', 'Date', 'Net à payer', 'Actions'].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((facture, idx) => {
              const id = facture.id as string
              const restant = facture.montantTtc - facture.montantPaye
              const restantLabel = facture.paidPercent > 0 && facture.paidPercent < 100 ? `${formatCurrency(restant)} restants` : undefined
              const retardLabel = facture.category === 'En retard' && facture.overdue > 0 ? `En retard ${facture.overdue}j` : undefined
              return (
                <tr key={id} onClick={() => router.push(`/dashboard/factures/${id}`)} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-[#f8f9fa]' : ''}`}>
                  <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} className="w-4 h-4 rounded border-gray-300 text-[#5ab4e0] focus:ring-[#5ab4e0] cursor-pointer" /></td>
                  <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e]">{(facture.numero as string) ?? '\u2014'}</td>
                  <td className="px-4 py-3"><PaymentBar percent={facture.paidPercent} restant={restantLabel} retard={retardLabel} /></td>
                  <td className="px-4 py-3"><div className="text-sm font-manrope font-medium text-[#1a1a2e]">{facture.clientName}</div><div className="text-xs font-manrope text-gray-500">{(facture.objet as string) ?? ''}</div></td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate(facture.updated_at as string | null)}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate((facture.date_emission || facture.created_at) as string | null)}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-bold text-[#1a1a2e]">{formatCurrency(facture.montantTtc)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => openMenu(e, id)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><MoreHorizontal size={16} className="text-gray-500" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center"><FileText size={40} className="mx-auto text-gray-300 mb-3" /><p className="text-sm font-manrope text-gray-500">Aucune facture trouvée</p></div>
        )}
      </div>

      {/* Menu flottant en position fixed — sort du conteneur */}
      {openActions && menuPos && activeFacture && (
        <div
          className="fixed z-[9999] w-44 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { closeMenu(); router.push(`/dashboard/factures/${activeFacture.id}`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Eye size={14} /> Voir</button>
          {(activeFacture.statut as string) === 'brouillon' ? (
            <button onClick={() => { closeMenu(); router.push(`/dashboard/factures/${activeFacture.id}/modifier`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Pencil size={14} /> Modifier</button>
          ) : (
            <button disabled title="Facture émise : modification interdite (art. L441-9 C. comm.)" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope text-gray-400 cursor-not-allowed"><Pencil size={14} /> Modifier (verrouillée)</button>
          )}
          <button onClick={() => { handleDuplicate(activeFacture.id as string) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Copy size={14} /> Dupliquer</button>
          <button onClick={() => { handleSend(activeFacture) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><SendHorizonal size={14} /> Envoyer</button>
          <button onClick={() => { handleDelete(activeFacture.id as string) }} disabled={deleting === (activeFacture.id as string)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-red-600"><Trash2 size={14} /> {deleting === (activeFacture.id as string) ? 'Suppression...' : 'Supprimer'}</button>
        </div>
      )}

      {duplicating && (
        <div className="fixed bottom-6 right-6 bg-[#1a1a2e] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-manrope z-50">Duplication en cours...</div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#1a1a2e] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-manrope z-50">{toastMsg}</div>
      )}

      {sendTarget && (
        <EnvoyerFactureModal
          open={!!sendTarget}
          onClose={() => setSendTarget(null)}
          factureId={sendTarget.id}
          numeroFacture={sendTarget.numero}
          clientEmail={sendTarget.email}
          clientNom={sendTarget.clientNom}
          montantTTC={sendTarget.montantTtcLabel}
          onSuccess={() => {
            setToastMsg('Facture envoyée avec succès !')
            setTimeout(() => setToastMsg(null), 3000)
            setSendTarget(null)
            refetchF()
          }}
        />
      )}
    </div>
  )
}

function PaymentBar({ percent, restant, retard }: { percent: number; restant?: string; retard?: string }) {
  let barColor = 'bg-gray-300'
  if (percent === 100) barColor = 'bg-green-500'
  else if (percent > 0) barColor = 'bg-[#5ab4e0]'
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} /></div>
        <span className="text-xs font-manrope text-gray-500 whitespace-nowrap">{percent}%</span>
      </div>
      {restant && <p className="text-xs font-manrope text-[#5ab4e0]">{restant}</p>}
      {retard && <p className="text-xs font-manrope text-red-500 font-medium">{retard}</p>}
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent, bg }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; bg?: string }) {
  return (
    <div className={`${bg || 'bg-white'} rounded-xl border border-gray-200 p-4 flex items-center gap-3`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + '15', color: accent }}>{icon}</div>
      <div>
        <p className="text-xs font-manrope text-gray-500">{label}</p>
        <p className="text-lg font-syne font-bold text-[#1a1a2e]">{value}</p>
        {sub && <p className="text-xs font-manrope text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}
