'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Plus,
  X,
  Upload,
  Paperclip,
  ShoppingCart,
  Euro,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import {
  useAchats,
  useFournisseurs,
  useChantiers,
  useFacturesRecues,
  insertRow,
  updateRow,
  deleteRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import FacturesRecuesTab from '@/components/dashboard/FacturesRecuesTab'
import ExportComptableModal from '@/components/dashboard/ExportComptableModal'
import { downloadAchatsPdf } from '@/lib/export/pdf-achats'
// V4 light premium : on remplace Input/Select legacy par PremiumInput/PremiumSelect/PremiumButton.
import { PremiumInput, PremiumSelect, PremiumButton, FieldLabel } from '@/components/ui/v4'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type FilterPeriod = 'Tous' | 'Ce mois' | 'Ce trimestre'

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

// Wrapper en Suspense (requis par Next.js 14 pour useSearchParams() en client component)
export default function AchatsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Chargement...</div>}>
      <AchatsPageInner />
    </Suspense>
  )
}

function AchatsPageInner() {
  const askConfirm = useConfirm()
  const { data: achats, loading: achatsLoading, error: achatsError, refetch: refetchAchats } = useAchats()
  const { data: fournisseurs, loading: fournisseursLoading } = useFournisseurs()
  const { data: chantiers, loading: chantiersLoading } = useChantiers()
  const { data: facturesRecues } = useFacturesRecues()

  // Onglet actif : achats (saisie manuelle) ou factures recues (reception e-facture)
  const [tab, setTab] = useState<'achats' | 'recues'>('achats')
  const nbNouvellesRecues = useMemo(
    () => facturesRecues.filter((f) => (f as Record<string, unknown>).statut === 'recue').length,
    [facturesRecues],
  )

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterPeriod>('Tous')
  const [showModal, setShowModal] = useState(false)
  const [showExport, setShowExport] = useState(false)
  // Menu déroulant "Exporter" : choix entre CSV (modal comptable) et PDF (client-side).
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  // Position du menu d'actions "..." : rendu en position:fixed (jamais clippé par
  // l'overflow-x-auto du wrapper de table). Calculée au clic via getBoundingClientRect.
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Modal state
  const [modalFournisseur, setModalFournisseur] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalMontant, setModalMontant] = useState('')
  const [modalTva, setModalTva] = useState('20')
  const [modalDescription, setModalDescription] = useState('')
  const [modalChantier, setModalChantier] = useState('')

  const resetModal = () => {
    setModalFournisseur('')
    setModalDate('')
    setModalMontant('')
    setModalTva('20')
    setModalDescription('')
    setModalChantier('')
    setEditingId(null)
  }

  // ─── Menu d'actions "..." en position:fixed (anti-clipping overflow-x-auto) ───
  const closeActionMenu = useCallback(() => {
    setOpenActionId(null)
    setActionMenuPos(null)
  }, [])

  // Fermer le menu au scroll / resize / clic extérieur (pattern aligné sur factures).
  useEffect(() => {
    if (!openActionId) return
    const handleClose = () => closeActionMenu()
    document.addEventListener('click', handleClose)
    window.addEventListener('scroll', handleClose, true)
    window.addEventListener('resize', handleClose)
    return () => {
      document.removeEventListener('click', handleClose)
      window.removeEventListener('scroll', handleClose, true)
      window.removeEventListener('resize', handleClose)
    }
  }, [openActionId, closeActionMenu])

  // Ouvre/ferme le menu d'actions et calcule sa position (fixed, ancré sous le bouton).
  const openActionMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (openActionId === id) {
      closeActionMenu()
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    const menuHeight = 110
    const spaceBelow = window.innerHeight - r.bottom
    const top = spaceBelow < menuHeight ? r.top - menuHeight : r.bottom + 6
    const left = Math.max(8, r.right - 160)
    setActionMenuPos({ top, left })
    setOpenActionId(id)
  }

  // Auto-ouverture de la modal si on arrive depuis ?new=1 (bouton "Ajouter un achat"
  // depuis la page chantier détail). Pré-remplit le chantier si ?chantier_id=X est fourni.
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const chId = searchParams.get('chantier_id') || ''
      setModalChantier(chId)
      setModalDate(new Date().toISOString().split('T')[0])
      setShowModal(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Name resolution maps
  const fournisseurMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of fournisseurs) {
      const rec = f as Record<string, unknown>
      map[rec.id as string] = (rec.nom ?? rec.name ?? '') as string
    }
    return map
  }, [fournisseurs])

  const chantierMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of chantiers) {
      const rec = c as Record<string, unknown>
      map[rec.id as string] = (rec.nom ?? rec.name ?? '') as string
    }
    return map
  }, [chantiers])

  // Computed stats
  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    let depensesMois = 0
    let totalAnnee = 0
    const fournisseursActifs = new Set<string>()

    for (const a of achats) {
      const rec = a as Record<string, unknown>
      const dateStr = rec.date_achat as string | undefined
      const montant = Number(rec.montant_ht ?? 0)
      if (dateStr) {
        const d = new Date(dateStr)
        if (d.getFullYear() === currentYear) {
          totalAnnee += montant
          if (d.getMonth() === currentMonth) {
            depensesMois += montant
          }
        }
      }
      if (rec.fournisseur_id) fournisseursActifs.add(rec.fournisseur_id as string)
    }

    return {
      depensesMois,
      totalAnnee,
      nbFournisseurs: fournisseursActifs.size,
    }
  }, [achats])

  // Filtering
  const filtered = useMemo(() => {
    return achats.filter((a) => {
      const rec = a as Record<string, unknown>
      const dateStr = rec.date_achat as string | undefined

      // Period filter
      if (filter !== 'Tous' && dateStr) {
        const d = new Date(dateStr)
        const now = new Date()
        if (filter === 'Ce mois') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
        }
        if (filter === 'Ce trimestre') {
          const currentQ = Math.floor(now.getMonth() / 3)
          const itemQ = Math.floor(d.getMonth() / 3)
          if (itemQ !== currentQ || d.getFullYear() !== now.getFullYear()) return false
        }
      }

      // Search
      if (search) {
        const q = search.toLowerCase()
        const fournisseurNom = fournisseurMap[rec.fournisseur_id as string] ?? ''
        const chantierNom = chantierMap[rec.chantier_id as string] ?? ''
        const description = ((rec.description ?? '') as string).toLowerCase()
        return (
          fournisseurNom.toLowerCase().includes(q) ||
          description.includes(q) ||
          chantierNom.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [achats, search, filter, fournisseurMap, chantierMap])

  const handleSave = async () => {
    if (!modalMontant || !modalDate) return
    setSaving(true)
    try {
      const values: Record<string, unknown> = {
        fournisseur_id: modalFournisseur || null,
        date_achat: modalDate,
        montant_ht: parseFloat(modalMontant),
        taux_tva: parseFloat(modalTva),
        description: modalDescription,
        chantier_id: modalChantier || null,
      }
      if (editingId) {
        await updateRow('achats', editingId, values)
      } else {
        await insertRow('achats', values)
      }
      refetchAchats()
      setShowModal(false)
      resetModal()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (achat: Record<string, unknown>) => {
    setEditingId(achat.id as string)
    setModalFournisseur((achat.fournisseur_id ?? '') as string)
    setModalDate((achat.date_achat ?? '') as string)
    setModalMontant(String(achat.montant_ht ?? ''))
    setModalTva(String(achat.taux_tva ?? '20'))
    setModalDescription((achat.description ?? '') as string)
    setModalChantier((achat.chantier_id ?? '') as string)
    closeActionMenu()
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!(await askConfirm({ title: 'Supprimer cet achat ?', variant: 'danger', confirmLabel: 'Supprimer' }))) return
    try {
      await deleteRow('achats', id)
      refetchAchats()
    } catch (err) {
      toast.error((err as Error).message)
    }
    closeActionMenu()
  }

  // Téléchargement PDF des achats (client-side, données déjà chargées via useAchats).
  // On exporte la liste FILTRÉE (mêmes lignes que celles affichées à l'écran).
  const handleDownloadPdf = () => {
    setShowExportMenu(false)
    try {
      const res = downloadAchatsPdf({
        achats: filtered as Parameters<typeof downloadAchatsPdf>[0]['achats'],
        fournisseurMap,
        chantierMap,
        periodeLabel: filter,
      })
      if (res.openedInNewTab && res.helpMessage) {
        toast.success(res.helpMessage)
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la génération du PDF')
    }
  }

  // Référence à l'achat actuellement ciblé par le menu "..." (pour le menu fixe partagé).
  const activeAchat = useMemo(
    () => (openActionId ? (achats.find((a) => (a as Record<string, unknown>).id === openActionId) as Record<string, unknown> | undefined) : undefined),
    [openActionId, achats],
  )

  const loading = achatsLoading || fournisseursLoading || chantiersLoading

  return (
    <div className="space-y-6">
      {/* Onglets : Achats (saisie manuelle) / Factures reçues (réception e-facture) */}
      <div className="flex items-center gap-1 border-b border-[#0f1a3a]/[0.08]">
        <button
          onClick={() => setTab('achats')}
          className={`relative px-4 py-2.5 font-hanken text-[14px] font-semibold transition-colors ${tab === 'achats' ? 'text-[#0f1a3a]' : 'text-gray-500 hover:text-[#0f1a3a]'}`}
        >
          Achats
          {tab === 'achats' && <span aria-hidden className="absolute left-2 right-2 -bottom-px h-[2.5px] bg-[#ff7a1a] rounded-full" />}
        </button>
        <button
          onClick={() => setTab('recues')}
          className={`relative px-4 py-2.5 font-hanken text-[14px] font-semibold transition-colors inline-flex items-center gap-2 ${tab === 'recues' ? 'text-[#0f1a3a]' : 'text-gray-500 hover:text-[#0f1a3a]'}`}
        >
          Factures reçues
          {nbNouvellesRecues > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff7a1a] text-white font-spline-mono text-[10.5px] font-bold">
              {nbNouvellesRecues}
            </span>
          )}
          {tab === 'recues' && <span aria-hidden className="absolute left-2 right-2 -bottom-px h-[2.5px] bg-[#ff7a1a] rounded-full" />}
        </button>
      </div>

      {tab === 'recues' ? (
        <FacturesRecuesTab />
      ) : loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <LoadingSkeleton rows={6} />
        </div>
      ) : achatsError ? (
        <ErrorBanner message={achatsError} onRetry={refetchAchats} />
      ) : (
      <>
      {/* Stats bar V4 light : 3 cartes blanches avec icône premium + accent line orange à l'état actif */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<ShoppingCart size={20} />}
          label="Dépenses ce mois"
          value={`${stats.depensesMois.toLocaleString('fr-FR')} € HT`}
          color="#ff7a1a"
        />
        <StatCard
          icon={<Euro size={20} />}
          label="Total année"
          value={`${stats.totalAnnee.toLocaleString('fr-FR')} € HT`}
          color="#15803d"
        />
        <StatCard
          icon={<Building2 size={20} />}
          label="Fournisseurs actifs"
          value={String(stats.nbFournisseurs)}
          color="#0f1a3a"
        />
      </div>

      {/* Action bar : recherche + filtre + CTA orange "Nouvel achat" */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
          <PremiumInput
            type="text"
            placeholder="Rechercher un achat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="[&_input]:pl-10"
          />
        </div>

        <PremiumSelect
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterPeriod)}
          className="sm:w-auto"
        >
          <option value="Tous">Tous</option>
          <option value="Ce mois">Ce mois</option>
          <option value="Ce trimestre">Ce trimestre</option>
        </PremiumSelect>

        {/* Bouton "Exporter" → menu déroulant : CSV (modal comptable) ou PDF (client-side). */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowExportMenu((v) => !v) }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white font-hanken font-semibold text-sm text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all"
            aria-haspopup="menu"
            aria-expanded={showExportMenu}
          >
            <Download size={16} />
            Exporter
          </button>
          {showExportMenu && (
            <>
              {/* Backdrop transparent : ferme le menu au clic extérieur. */}
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-white rounded-xl border border-[#0f1a3a]/[0.08] shadow-2xl py-1.5">
                <button
                  onClick={() => { setShowExportMenu(false); setShowExport(true) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 font-hanken text-[13.5px] font-medium text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"
                >
                  <FileSpreadsheet size={15} className="text-[#ff7a1a]" /> Export CSV (comptable)
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 font-hanken text-[13.5px] font-medium text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"
                >
                  <FileText size={15} className="text-[#ff7a1a]" /> Télécharger en PDF
                </button>
              </div>
            </>
          )}
        </div>

        <PremiumButton
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => { resetModal(); setShowModal(true) }}
          className="shrink-0"
        >
          Nouvel achat
        </PremiumButton>
      </div>

      {/* Cartes mobile V4 light : fond blanc, bord 2xl, montants en Spline Sans Mono. */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-hanken text-sm text-gray-500">Aucun achat trouvé</p>
          </div>
        ) : (
          filtered.map((a) => {
            const achat = a as Record<string, unknown>
            const id = achat.id as string
            const montantHT = Number(achat.montant_ht ?? 0)
            const tauxTva = Number(achat.taux_tva ?? 20)
            const montantTTC = Number(achat.montant_ttc ?? montantHT * (1 + tauxTva / 100))
            const dateStr = achat.date_achat as string | undefined
            const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : ''
            const fournisseurNom = fournisseurMap[achat.fournisseur_id as string] ?? '—'

            return (
              <div
                key={id}
                className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3.5 hover:border-[#ff7a1a]/40 active:bg-[#fafbfc] transition-all shadow-[0_2px_6px_rgba(15,26,58,0.04)]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-hanken font-bold text-[14.5px] text-[#0f1a3a] truncate">{fournisseurNom}</p>
                    <p className="font-spline-mono text-[11px] text-gray-500 truncate">{dateFormatted}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-spline-mono font-medium text-[15px] text-[#0f1a3a] tracking-[0.5px]">
                      {montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;€
                    </p>
                    <p className="font-spline-mono text-[11px] text-gray-500">{montantHT.toLocaleString('fr-FR')}&nbsp;€ HT</p>
                  </div>
                </div>
                {String(achat.description ?? '') && (
                  <p className="font-hanken text-xs text-gray-600 mb-2 truncate">{String(achat.description ?? '')}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!!achat.justificatif_url && (
                      <span className="inline-flex items-center gap-1 font-hanken text-xs font-semibold text-[#ff7a1a]">
                        <Paperclip size={12} />
                        Justificatif
                      </span>
                    )}
                  </div>
                  <div>
                    <button
                      onClick={(e) => openActionMenu(e, id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Table desktop V4 light — fond blanc, ombre douce, hover ligne #fafbfc, chiffres Spline Sans Mono. */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-x-auto shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
              {['Date', 'Fournisseur', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Chantier', 'Justificatif', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3.5 text-left font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const achat = a as Record<string, unknown>
              const id = achat.id as string
              const montantHT = Number(achat.montant_ht ?? 0)
              const tauxTva = Number(achat.taux_tva ?? 20)
              const montantTTC = Number(achat.montant_ttc ?? montantHT * (1 + tauxTva / 100))
              const dateStr = achat.date_achat as string | undefined
              const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : ''
              const fournisseurNom = fournisseurMap[achat.fournisseur_id as string] ?? '—'
              const chantierNom = chantierMap[achat.chantier_id as string] ?? '—'

              return (
                <tr
                  key={id}
                  className="border-b border-[#0f1a3a]/[0.04] last:border-b-0 hover:bg-[#fafbfc] transition-colors"
                >
                  <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{dateFormatted}</td>
                  <td className="px-4 py-3 font-hanken text-[14px] font-semibold text-[#0f1a3a]">{fournisseurNom}</td>
                  <td className="px-4 py-3 font-hanken text-sm text-gray-600">{String(achat.description ?? '')}</td>
                  <td className="px-4 py-3 font-spline-mono font-medium text-[13.5px] text-[#0f1a3a]">{montantHT.toLocaleString('fr-FR')}&nbsp;€</td>
                  <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{tauxTva}%</td>
                  <td className="px-4 py-3 font-spline-mono font-medium text-[14px] text-[#0f1a3a]">
                    {montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;€
                  </td>
                  <td className="px-4 py-3">
                    {/* Badge chantier : couleur sémantique pastel */}
                    <span className="inline-block px-2.5 py-1 rounded-full font-hanken text-[11.5px] font-semibold bg-[#fafbfc] border border-gray-200 text-[#0f1a3a]">
                      {chantierNom}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {achat.justificatif_url ? (
                      <span className="inline-flex items-center gap-1 text-[#ff7a1a]" title="Justificatif joint">
                        <Paperclip size={14} />
                      </span>
                    ) : (
                      <span className="font-spline-mono text-sm text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => openActionMenu(e, id)}
                      className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-500"
                      aria-label="Actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-hanken text-sm text-gray-500">Aucun achat trouvé</p>
          </div>
        )}
      </div>

      {/* Modale ajout/modification achat — V4 light, backdrop blur, accent line orange */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl w-full max-w-lg mx-4 p-6 sm:p-8 space-y-5 overflow-hidden shadow-2xl border border-[#0f1a3a]/[0.06] max-h-[90vh] overflow-y-auto">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
            {/* Header de la modale */}
            <div className="flex items-center justify-between">
              <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.025em]">{editingId ? 'Modifier l\u0027achat' : 'Nouvel achat'}</h2>
              <button
                onClick={() => { setShowModal(false); resetModal() }}
                className="p-1.5 hover:bg-[#fafbfc] rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Fournisseur */}
            <PremiumSelect
              label="Fournisseur"
              value={modalFournisseur}
              onChange={(e) => setModalFournisseur(e.target.value)}
            >
              <option value="">Sélectionner un fournisseur...</option>
              {fournisseurs.map((f) => {
                const rec = f as Record<string, unknown>
                return (
                  <option key={String(rec.id)} value={String(rec.id)}>
                    {String(rec.nom ?? rec.name ?? '')}
                  </option>
                )
              })}
            </PremiumSelect>

            {/* Date + Montant HT (chiffres en Spline Sans Mono) */}
            <div className="grid grid-cols-2 gap-3">
              <PremiumInput
                label="Date"
                type="date"
                value={modalDate}
                onChange={(e) => setModalDate(e.target.value)}
                mono
              />
              <PremiumInput
                label="Montant HT"
                type="number"
                value={modalMontant}
                onChange={(e) => setModalMontant(e.target.value)}
                placeholder="0,00 €"
                mono
              />
            </div>

            {/* TVA */}
            <PremiumSelect
              label="TVA"
              value={modalTva}
              onChange={(e) => setModalTva(e.target.value)}
            >
              <option value="5.5">5,5%</option>
              <option value="10">10%</option>
              <option value="20">20%</option>
            </PremiumSelect>

            {/* Description */}
            <PremiumInput
              label="Description"
              type="text"
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder="Ex : Tubes cuivre + raccords"
            />

            {/* Chantier */}
            <PremiumSelect
              label="Associer au chantier"
              value={modalChantier}
              onChange={(e) => setModalChantier(e.target.value)}
            >
              <option value="">Sélectionner un chantier...</option>
              {chantiers.map((c) => {
                const rec = c as Record<string, unknown>
                return (
                  <option key={String(rec.id)} value={String(rec.id)}>
                    {String(rec.nom ?? rec.name ?? '')}
                  </option>
                )
              })}
            </PremiumSelect>

            {/* Upload justificatif — wrapping V4 (logique d'upload non touchée). */}
            <div>
              <FieldLabel>Justificatif</FieldLabel>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-[#ff7a1a] hover:bg-[#fff5ec]/30 transition-all cursor-pointer">
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="font-hanken text-sm text-gray-600">
                  Glisser un fichier ou <span className="text-[#ff7a1a] font-semibold">parcourir</span>
                </p>
                <p className="font-hanken text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 5 Mo)</p>
              </div>
            </div>

            {/* Actions : Annuler (outline) + Enregistrer (CTA orange) */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); resetModal() }}
                className="h-10 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white font-hanken text-[13.5px] font-semibold text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13.5px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Menu d'actions "..." partagé, rendu en position:fixed (jamais clippé par
          l'overflow-x-auto de la table). Ancré sous le bouton via actionMenuPos. */}
      {openActionId && actionMenuPos && activeAchat && (
        <div
          className="fixed z-[9999] w-40 bg-white rounded-xl border border-[#0f1a3a]/[0.08] shadow-2xl py-1.5"
          style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleEdit(activeAchat)}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 font-hanken text-[13.5px] font-medium text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"
          >
            <Pencil size={14} /> Modifier
          </button>
          <button
            onClick={() => handleDelete(activeAchat.id as string)}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 font-hanken text-[13.5px] font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      )}

      {/* Export comptable CSV des achats (lecture seule, flux dedie) */}
      <ExportComptableModal open={showExport} onClose={() => setShowExport(false)} type="achats" />
    </div>
  )
}

// StatCard V4 light premium — carte statique avec icône colorée + chiffre Hanken/Spline.
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: str