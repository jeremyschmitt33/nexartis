"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FilePenLine,
  Banknote,
  Clock,
  Search,
} from "lucide-react"
import {
  useDeletedDevis,
  useDeletedFactures,
  restoreRow,
  permanentDeleteRow,
  purgeCorbeille,
  LoadingSkeleton,
  ErrorBanner,
} from "@/lib/hooks"
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

type CorbeilleFilter = "tous" | "devis" | "factures"

// ── Helpers ─────────────────────────────────────────────────

function formatDate(d: unknown): string {
  if (!d) return ""
  const date = new Date(d as string)
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function daysLeft(deletedAt: unknown): number {
  if (!deletedAt) return 7
  const deleted = new Date(deletedAt as string).getTime()
  const now = Date.now()
  const elapsed = (now - deleted) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(7 - elapsed))
}

function daysLeftLabel(deletedAt: unknown): string {
  const days = daysLeft(deletedAt)
  if (days <= 0) return "Suppression imminente"
  if (days === 1) return "1 jour restant"
  return `${days} jours restants`
}

// ── Component ───────────────────────────────────────────────

export default async function CorbeillePage() {
  const confirm = useConfirm()
  const { data: deletedDevis, loading: loadingD, error: errorD, refetch: refetchD } = useDeletedDevis()
  const { data: deletedFactures, loading: loadingF, error: errorF, refetch: refetchF } = useDeletedFactures()

  const [filter, setFilter] = useState<CorbeilleFilter>("tous")
  const [search, setSearch] = useState("")
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState(false)

  const loading = loadingD || loadingF
  const error = errorD || errorF

  // Lancer la purge automatique au chargement de la page
  useEffect(() => {
    purgeCorbeille().then(() => {
      refetchD()
      refetchF()
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Combiner devis et factures dans une seule liste
  const allItems = useMemo(() => {
    const devisItems = deletedDevis.map(d => ({
      ...d,
      id: d.id as string,
      _type: "devis" as const,
      _label: `Devis ${d.numero || "sans numéro"}`,
      _client: (d.notes_client as string)?.split("|")[0]?.trim() || "Client inconnu",
      _montant: d.montant_ttc as number || 0,
      _deletedAt: d.deleted_at,
      _createdAt: d.created_at,
    }))
    const factureItems = deletedFactures.map(f => ({
      ...f,
      id: f.id as string,
      _type: "factures" as const,
      _label: `Facture ${f.numero || "sans numéro"}`,
      _client: (f.notes_client as string)?.split("|")[0]?.trim() || "Client inconnu",
      _montant: f.montant_ttc as number || 0,
      _deletedAt: f.deleted_at,
      _createdAt: f.created_at,
    }))
    return [...devisItems, ...factureItems].sort((a, b) => {
      const da = new Date(a._deletedAt as string).getTime()
      const db = new Date(b._deletedAt as string).getTime()
      return db - da // Plus récent en premier
    })
  }, [deletedDevis, deletedFactures])

  // Filtrer
  const filtered = useMemo(() => {
    let items = allItems
    if (filter === "devis") items = items.filter(i => i._type === "devis")
    if (filter === "factures") items = items.filter(i => i._type === "factures")
    if (search.trim()) {
      const s = search.toLowerCase()
      items = items.filter(i =>
        i._label.toLowerCase().includes(s) ||
        i._client.toLowerCase().includes(s)
      )
    }
    return items
  }, [allItems, filter, search])

  // Actions
  async function handleRestore(type: string, id: string) {
    setRestoring(id)
    try {
      await restoreRow(type, id)
      refetchD()
      refetchF()
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
    } catch (err) {
      toast.error("Erreur lors de la restauration : " + (err as Error).message)
    } finally {
      setRestoring(null)
    }
  }

  async function handlePermanentDelete(type: string, id: string) {
    if (!(await confirm({ title: "Supprimer definitivement ?", message: "Cette action est irreversible.", variant: "danger", confirmLabel: "Supprimer" }))) return
    setDeleting(id)
    try {
      await permanentDeleteRow(type, id)
      refetchD()
      refetchF()
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
    } catch (err) {
      toast.error("Erreur : " + (err as Error).message)
    } finally {
      setDeleting(null)
    }
  }

  async function handleEmptyTrash() {
    if (!(await confirm({ title: "Vider la corbeille ?", message: `${allItems.length} element${allItems.length > 1 ? "s" : ""} seront supprimes definitivement.`, variant: "danger", confirmLabel: "Vider" }))) return
    setPurging(true)
    try {
      for (const item of allItems) {
        await permanentDeleteRow(item._type, item.id)
      }
      refetchD()
      refetchF()
      setSelected(new Set())
    } catch (err) {
      toast.error("Erreur : " + (err as Error).message)
    } finally {
      setPurging(false)
    }
  }

  async function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(i => i.id)))
  }

  async function handleBulkRestore() {
    setBulkAction(true)
    try {
      for (const id of Array.from(selected)) {
        const item = allItems.find(i => i.id === id)
        if (item) await restoreRow(item._type, id)
      }
      setSelected(new Set())
      refetchD()
      refetchF()
    } catch (err) {
      toast.error("Erreur : " + (err as Error).message)
    }
    setBulkAction(false)
  }

  async function handleBulkPermanentDelete() {
    if (!(await confirm({ title: `Supprimer definitivement ${selected.size} element${selected.size > 1 ? "s" : ""} ?`, message: "Cette action est irreversible.", variant: "danger", confirmLabel: "Supprimer" }))) return
    setBulkAction(true)
    try {
      for (const id of Array.from(selected)) {
        const item = allItems.find(i => i.id === id)
        if (item) await permanentDeleteRow(item._type, id)
      }
      setSelected(new Set())
      refetchD()
      refetchF()
    } catch (err) {
      toast.error("Erreur : " + (err as Error).message)
    }
    setBulkAction(false)
  }

  const devisCount = allItems.filter(i => i._type === "devis").length
  const facturesCount = allItems.filter(i => i._type === "factures").length

  if (loading) return <div className="max-w-5xl mx-auto"><LoadingSkeleton rows={6} /></div>
  if (error) return <div className="max-w-5xl mx-auto"><ErrorBanner message={error} onRetry={() => { refetchD(); refetchF() }} /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header info ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-manrope font-semibold text-amber-800">
            Les éléments dans la corbeille sont automatiquement supprimés après 7 jours.
          </p>
          <p className="text-xs font-manrope text-amber-600 mt-1">
            Vous pouvez restaurer un élément à tout moment avant sa suppression définitive.
          </p>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilter("tous")}
          className={`rounded-xl border px-4 py-3 text-left transition-all ${
            filter === "tous"
              ? "border-[#e87a2a] bg-orange-50 shadow-sm"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-syne font-bold text-[#1a1a2e]">{allItems.length}</p>
          <p className="text-xs font-manrope text-gray-500 mt-0.5">Total</p>
        </button>
        <button
          onClick={() => setFilter("devis")}
          className={`rounded-xl border px-4 py-3 text-left transition-all ${
            filter === "devis"
              ? "border-[#e87a2a] bg-orange-50 shadow-sm"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-syne font-bold text-[#1a1a2e]">{devisCount}</p>
          <p className="text-xs font-manrope text-gray-500 mt-0.5">Devis</p>
        </button>
        <button
          onClick={() => setFilter("factures")}
          className={`rounded-xl border px-4 py-3 text-left transition-all ${
            filter === "factures"
              ? "border-[#e87a2a] bg-orange-50 shadow-sm"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-syne font-bold text-[#1a1a2e]">{facturesCount}</p>
          <p className="text-xs font-manrope text-gray-500 mt-0.5">Factures</p>
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans la corbeille..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 pl-9 pr-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0]/30 transition-all"
          />
        </div>

        {/* Vider la corbeille */}
        {allItems.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            disabled={purging}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-manrope font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={15} />
            {purging ? "Suppression..." : "Vider la corbeille"}
          </button>
        )}
      </div>

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-manrope font-semibold text-blue-700">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={handleBulkRestore}
            disabled={bulkAction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-manrope font-semibold transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} /> Restaurer
          </button>
          <button
            onClick={handleBulkPermanentDelete}
            disabled={bulkAction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-manrope font-semibold transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} /> Supprimer définitivement
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} className="text-gray-300" />
          </div>
          <p className="font-syne font-bold text-lg text-[#1a1a2e]">La corbeille est vide</p>
          <p className="text-sm font-manrope text-gray-500 mt-1">
            {search ? "Aucun résultat pour cette recherche." : "Aucun élément supprimé."}
          </p>
        </div>
      )}

      {/* ── List ── */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_140px_120px_150px_100px] items-center px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selected.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 accent-[#e87a2a]"
              />
            </div>
            <span className="text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wide">Élément</span>
            <span className="text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wide">Client</span>
            <span className="text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wide text-right">Montant</span>
            <span className="text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wide text-center">Expiration</span>
            <span className="text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wide text-center">Actions</span>
          </div>

          {/* Rows */}
          {filtered.map(item => {
            const id = item.id
            const days = daysLeft(item._deletedAt)
            const isUrgent = days <= 2

            return (
              <div
                key={id}
                className={`grid grid-cols-[40px_1fr_140px_120px_150px_100px] items-center px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                  isUrgent ? "bg-red-50/30" : ""
                }`}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggleSelect(id)}
                    className="w-4 h-4 rounded border-gray-300 accent-[#e87a2a]"
                  />
                </div>

                {/* Label + type badge */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item._type === "devis" ? "bg-blue-50" : "bg-emerald-50"
                  }`}>
                    {item._type === "devis"
                      ? <FilePenLine size={15} className="text-blue-500" />
                      : <Banknote size={15} className="text-emerald-500" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-manrope font-semibold text-[#1a1a2e] truncate">{item._label}</p>
                    <p className="text-xs font-manrope text-gray-400">
                      {item._type === "devis" ? "Devis" : "Facture"} · Créé le {formatDate(item._createdAt)}
                    </p>
                  </div>
                </div>

                {/* Client */}
                <p className="text-sm font-manrope text-gray-600 truncate">{item._client}</p>

                {/* Montant */}
                <p className="text-sm font-manrope font-semibold text-[#1a1a2e] text-right">
                  {item._montant ? `${item._montant.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}
                </p>

                {/* Expiration */}
                <div className="flex items-center justify-center gap-1.5">
                  <Clock size={13} className={isUrgent ? "text-red-400" : "text-amber-400"} />
                  <span className={`text-xs font-manrope font-semibold ${
                    isUrgent ? "text-red-500" : "text-amber-600"
                  }`}>
                    {daysLeftLabel(item._deletedAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleRestore(item._type, id)}
                    disabled={restoring === id}
                    title="Restaurer"
                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item._type, id)}
                    disabled={deleting === id}
                    title="Supprimer définitivement"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
