"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search,
  FileText,
  CheckCircle2,
  Send,
  Clock,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  SendHorizonal,
  Trash2,
  Plus,
  AlertTriangle,
} from "lucide-react"
import {
  useDevis,
  useClients,
  useChantiers,
  useEntreprise,
  softDeleteRow,
  insertRow,
  updateRow,
  LoadingSkeleton,
  ErrorBanner,
} from "@/lib/hooks"
import { champsLegauxManquants } from "@/lib/helpers"

type DevisStatus = "brouillon" | "envoye" | "signe" | "refuse" | "expire" | "facture"

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  facture: "Facturé",
  finalise: "Envoyé",
}

const STATUS_STYLES: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-600",
  envoye: "bg-blue-50 text-blue-700",
  signe: "bg-green-50 text-green-700",
  refuse: "bg-red-50 text-red-700",
  expire: "bg-orange-50 text-orange-700",
  facture: "bg-purple-50 text-purple-700",
  finalise: "bg-blue-50 text-blue-700",
}

const FILTER_OPTIONS = ["Tous", "Brouillon", "Envoyé", "Accepté", "Refusé", "Expiré", "Facturé"]
const FILTER_TO_STATUS: Record<string, DevisStatus> = {
  Brouillon: "brouillon",
  "Envoyé": "envoye",
  "Accepté": "signe",
  "Refusé": "refuse",
  "Expiré": "expire",
  "Facturé": "facture",
}

const SORT_OPTIONS = ["Date", "Montant", "Client"]

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "0,00 \u20ac"
  return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \u20ac"
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-"
  const date = new Date(d)
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
}

export default function DevisListPage() {
  const router = useRouter()
  const { data: devisList, loading: loadingDevis, error: errorDevis, refetch: refetchDevis } = useDevis()
  const { data: clients, loading: loadingClients } = useClients()
  const { data: chantiers } = useChantiers()
  const { entreprise } = useEntreprise()
  const champsManquants = champsLegauxManquants(entreprise as Record<string, unknown> | null | undefined)
  const profilIncomplet = champsManquants.length > 0
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("Tous")
  const [sort, setSort] = useState("Date")
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Fermer le menu au scroll ou clic extérieur
  const closeMenu = useCallback(() => { setOpenActions(null); setMenuPos(null) }, [])
  useEffect(() => {
    if (!openActions) return
    const handleClickOutside = () => closeMenu()
    const handleScroll = () => closeMenu()
    document.addEventListener("click", handleClickOutside)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("click", handleClickOutside)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [openActions, closeMenu])

  const clientMap = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {}
    clients.forEach((c: Record<string, unknown>) => { map[c.id as string] = c })
    return map
  }, [clients])

  const chantierMap = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {}
    chantiers.forEach((c: Record<string, unknown>) => { map[c.id as string] = c })
    return map
  }, [chantiers])

  function getClientName(clientId: string | null): string {
    if (!clientId) return "-"
    const c = clientMap[clientId]
    if (!c) return "-"
    const parts = [c.prenom, c.nom].filter(Boolean).join(" ")
    return (c.raison_sociale as string) || parts || "-"
  }

  function getChantierTitre(chantierId: string | null): string {
    if (!chantierId) return "-"
    const c = chantierMap[chantierId]
    return (c?.titre as string) || "-"
  }

  const stats = useMemo(() => {
    const all = devisList.length
    const envoyes = devisList.filter((d: Record<string, unknown>) => d.statut === "envoye")
    const signes = devisList.filter((d: Record<string, unknown>) => d.statut === "signe")
    const enAttente = devisList.filter((d: Record<string, unknown>) => d.statut === "brouillon")
    return {
      all,
      envoyesCount: envoyes.length,
      envoyesTTC: envoyes.reduce((s: number, d: Record<string, unknown>) => s + Number(d.montant_ttc || 0), 0),
      signesCount: signes.length,
      signesTTC: signes.reduce((s: number, d: Record<string, unknown>) => s + Number(d.montant_ttc || 0), 0),
      attenteCount: enAttente.length,
      attenteTTC: enAttente.reduce((s: number, d: Record<string, unknown>) => s + Number(d.montant_ttc || 0), 0),
    }
  }, [devisList])

  const filtered = useMemo(() => {
    let list = [...devisList] as Record<string, unknown>[]
    if (filter !== "Tous") {
      const targetStatus = FILTER_TO_STATUS[filter]
      if (targetStatus) list = list.filter((d) => d.statut === targetStatus)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((d) => {
        const numero = ((d.numero as string) || "").toLowerCase()
        const clientName = getClientName(d.client_id as string | null).toLowerCase()
        const chantierName = getChantierTitre(d.chantier_id as string | null).toLowerCase()
        const objet = ((d.objet as string) || "").toLowerCase()
        const notesClient = ((d.notes_client as string) || "").toLowerCase()
        return numero.includes(q) || clientName.includes(q) || chantierName.includes(q) || objet.includes(q) || notesClient.includes(q)
      })
    }
    if (sort === "Date") list.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
    else if (sort === "Montant") list.sort((a, b) => Number(b.montant_ttc || 0) - Number(a.montant_ttc || 0))
    else if (sort === "Client") list.sort((a, b) => getClientName(a.client_id as string | null).localeCompare(getClientName(b.client_id as string | null)))
    return list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisList, filter, search, sort, clientMap, chantierMap])

  async function handleDelete(id: string) {
    if (!confirm("Envoyer ce devis à la corbeille ?")) return
    try { await softDeleteRow("devis", id); refetchDevis() }
    catch (err: unknown) { alert("Erreur : " + (err instanceof Error ? err.message : "Échec")) }
  }

  async function handleDuplicate(devis: Record<string, unknown>) {
    try {
      const { id, created_at, updated_at, user_id, numero, ...rest } = devis
      await insertRow("devis", { ...rest, numero: (numero as string) + "-copie", statut: "brouillon" })
      refetchDevis()
    } catch (err: unknown) { alert("Erreur : " + (err instanceof Error ? err.message : "Échec")) }
  }

  function handleSend(devis: Record<string, unknown>) {
    router.push(`/dashboard/devis/${devis.id}?send=1`)
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(d => d.id as string)))
  }
  async function handleBulkDelete() {
    if (!confirm(`Envoyer ${selected.size} devis à la corbeille ?`)) return
    setBulkDeleting(true)
    try { for (const id of Array.from(selected)) { await softDeleteRow("devis", id) }; setSelected(new Set()); refetchDevis() }
    catch (err: unknown) { alert("Erreur : " + (err instanceof Error ? err.message : "Échec")) }
    setBulkDeleting(false)
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, devisId: string) {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (openActions === devisId) { closeMenu(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const menuHeight = 220
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4
    const left = rect.right - 192
    setMenuPos({ top, left: Math.max(8, left) })
    setOpenActions(devisId)
  }

  const loading = loadingDevis || loadingClients

  if (loading) {
    return (<div className="space-y-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div><LoadingSkeleton rows={6} /></div>)
  }
  if (errorDevis) { return <ErrorBanner message={errorDevis} onRetry={refetchDevis} /> }

  const activeDevis = openActions ? filtered.find(d => (d.id as string) === openActions) : null

  return (
    <div className="space-y-6">

      {/* ============================================================
          Filet de securite : tant que les mentions legales obligatoires
          du profil entreprise manquent, on previent l'artisan que ses
          devis ne sont pas pleinement conformes a la loi.
          ============================================================ */}
      {profilIncomplet && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-syne font-bold text-[14px] sm:text-[15px] text-amber-900 mb-1">
                Tes devis ne sont pas pleinement conformes a la loi
              </h3>
              <p className="font-manrope text-[13px] text-amber-800 mb-2">
                Il manque {champsManquants.length} mention{champsManquants.length > 1 ? 's' : ''} obligatoire{champsManquants.length > 1 ? 's' : ''} dans ton profil entreprise.
                Les PDFs generes affichent une banniere d&apos;avertissement tant que ce n&apos;est pas regle.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {champsManquants.map(label => (
                  <span key={label} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-manrope text-[11px] font-medium">
                    {label}
                  </span>
                ))}
              </div>
              <Link
                href="/dashboard/parametres"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-syne font-bold text-[13px] transition-colors"
              >
                Completer mon profil
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FileText size={20} />} label="Tous" value={String(stats.all)} accent="#5ab4e0" />
        <StatCard icon={<Send size={20} />} label="Envoyés" value={String(stats.envoyesCount)} sub={formatCurrency(stats.envoyesTTC)} accent="#5ab4e0" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Acceptés" value={String(stats.signesCount)} sub={formatCurrency(stats.signesTTC)} accent="#22c55e" />
        <StatCard icon={<Clock size={20} />} label="Brouillons" value={String(stats.attenteCount)} sub={formatCurrency(stats.attenteTTC)} accent="#e87a2a" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un devis..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 pl-9 pr-4 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none transition-colors" />
        </div>
        <div className="relative">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 pr-8 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none appearance-none bg-white cursor-pointer">
            {FILTER_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 pr-8 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none appearance-none bg-white cursor-pointer">
            {SORT_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <Link href="/dashboard/devis/nouveau" className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors">
          <Plus size={16} /> Nouveau devis
        </Link>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-manrope font-semibold text-blue-700">{selected.size} devis sélectionné{selected.size > 1 ? "s" : ""}</span>
          <button onClick={handleBulkDelete} disabled={bulkDeleting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-manrope font-semibold transition-colors disabled:opacity-50"><Trash2 size={13} /> {bulkDeleting ? "Suppression..." : "Supprimer la sélection"}</button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-manrope font-medium text-gray-600 hover:bg-gray-50 transition-colors">Tout désélectionner</button>
        </div>
      )}

      {/* Mobile cards (visible < md) */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun devis trouvé</p>
          </div>
        ) : (
          filtered.map((devis) => {
            const statut = (devis.statut as DevisStatus) || "brouillon"
            return (
              <div
                key={String(devis.id)}
                onClick={() => router.push(`/dashboard/devis/${devis.id}`)}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-manrope font-bold text-[#1a1a2e] truncate">
                      {(devis.notes_client as string)?.split(" | ")[0] || getClientName(devis.client_id as string | null) || String(devis.numero || '')}
                    </p>
                    <p className="text-xs font-manrope text-gray-500 truncate">
                      {(devis.objet as string) || String(devis.numero || '')}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-manrope font-medium ${STATUS_STYLES[statut] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[statut] || statut}
                    </span>
                    <p className="text-sm font-manrope font-bold text-[#1a1a2e]">{formatCurrency(devis.montant_ttc as number)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <p className="text-xs font-manrope text-gray-400 flex-shrink-0">{formatDate(devis.date_emission as string)}</p>
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSend(devis) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#5ab4e0]/10 text-[#5ab4e0] text-xs font-manrope font-semibold hover:bg-[#5ab4e0]/20 active:scale-95 transition-all"
                    >
                      <Send size={11} /> Envoyer
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/devis/${devis.id}?convert=1`) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-manrope font-semibold hover:bg-emerald-100 active:scale-95 transition-all"
                    >
                      <FileText size={11} /> Convertir
                    </button>
                    <button
                      onClick={(e) => openMenu(e, devis.id as string)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreHorizontal size={16} className="text-gray-500" />
                    </button>
                  </div>
                </div>
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
              {["Client / Chantier", "Statut", "Numéro", "Modifié", "Date", "Valable jusqu'au", "Total HT", "Total TTC", "Actions"].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((devis, idx) => {
              const statut = (devis.statut as DevisStatus) || "brouillon"
              return (
                <tr key={String(devis.id)} onClick={() => router.push(`/dashboard/devis/${devis.id}`)} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-[#f8f9fa]" : ""}`}>
                  <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(devis.id as string)} onChange={() => toggleSelect(devis.id as string)} className="w-4 h-4 rounded border-gray-300 text-[#5ab4e0] focus:ring-[#5ab4e0] cursor-pointer" /></td>
                  <td className="px-4 py-3"><div className="text-sm font-manrope font-bold text-[#1a1a2e]">{(devis.notes_client as string)?.split(" | ")[0] || getClientName(devis.client_id as string | null)}</div><div className="text-sm font-manrope font-semibold text-gray-700">{(devis.objet as string) || (devis.description as string) || getChantierTitre(devis.chantier_id as string | null)}</div></td>
                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium ${STATUS_STYLES[statut] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[statut] || statut}</span></td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-500">{String(devis.numero || '')}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate(devis.updated_at as string)}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate(devis.date_emission as string)}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate(devis.date_validite as string)}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-medium text-[#1a1a2e]">{formatCurrency(devis.montant_ht as number)}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-bold text-[#1a1a2e]">{formatCurrency(devis.montant_ttc as number)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => openMenu(e, devis.id as string)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><MoreHorizontal size={16} className="text-gray-500" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (<div className="py-12 text-center"><FileText size={40} className="mx-auto text-gray-300 mb-3" /><p className="text-sm font-manrope text-gray-500">Aucun devis trouvé</p></div>)}
      </div>

      {/* Menu flottant en position fixed — sort du conteneur */}
      {openActions && menuPos && activeDevis && (
        <div
          className="fixed z-[9999] w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { closeMenu(); router.push(`/dashboard/devis/${activeDevis.id}`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Eye size={14} /> Voir</button>
          <button onClick={() => { closeMenu(); router.push(`/dashboard/devis/${activeDevis.id}/modifier`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Pencil size={14} /> Modifier</button>
          <button onClick={() => { closeMenu(); router.push(`/dashboard/devis/${activeDevis.id}?convert=1`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><FileText size={14} /> Convertir en facture</button>
          <button onClick={() => { closeMenu(); handleSend(activeDevis) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><SendHorizonal size={14} /> Envoyer</button>
          <button onClick={() => { closeMenu(); handleDelete(activeDevis.id as string) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-red-600"><Trash2 size={14} /> Supprimer</button>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + "15", color: accent }}>{icon}</div>
      <div>
        <p className="text-xs font-manrope text-gray-500">{label}</p>
        <p className="text-xl font-syne font-bold text-[#1a1a2e]">{value}</p>
        {sub && <p className="text-xs font-manrope text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}
