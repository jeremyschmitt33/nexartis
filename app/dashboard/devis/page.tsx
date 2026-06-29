"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search,
  FileText,
  Send,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  SendHorizonal,
  Trash2,
  Plus,
  AlertTriangle,
  Layers,
  ShieldCheck,
  FileEdit,
  Download,
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
import { PremiumInput, PremiumSelect, PremiumButton, InfoBanner } from "@/components/ui/v4"
// Chargement à la demande (next/dynamic, ssr:false) : la modale d'export n'est
// montée qu'à l'ouverture, on évite de charger son JS au premier render.
const ExportComptableModal = dynamic(() => import("@/components/dashboard/ExportComptableModal"), { ssr: false })
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

type DevisStatus = "brouillon" | "envoye" | "signe" | "refuse" | "expire" | "facture"

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Accepté",
  contreproposition: "Contre-proposition",
  refuse: "Refusé",
  expire: "Expiré",
  facture: "Facturé",
  finalise: "Envoyé",
}

const STATUS_STYLES: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-600",
  envoye: "bg-blue-50 text-blue-700",
  signe: "bg-green-50 text-green-700",
  contreproposition: "bg-amber-100 text-amber-800",
  refuse: "bg-red-50 text-red-700",
  expire: "bg-orange-50 text-orange-700",
  facture: "bg-purple-50 text-purple-700",
  finalise: "bg-blue-50 text-blue-700",
}

// V3.0d.2 : FILTER_OPTIONS supprime (le dropdown HTML a ete remplace par les
// StatCards cliquables). Seuls les 4 statuts principaux sont filtrables en un
// clic (Brouillon/Envoyé/Accepté) — les autres (Refusé/Expiré/Facturé) restent
// accessibles via setFilter en interne au besoin (ex: liens depuis email).
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
  const askConfirm = useConfirm()
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
  const [exportOpen, setExportOpen] = useState(false)
  // Pagination "Voir plus" (recherche/filtre/tri portent sur toute la liste).
  const [visibleCount, setVisibleCount] = useState(30)

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
      // Montant réellement accepté par le client (signé) si modifié, sinon proposé.
      signesTTC: signes.reduce((s: number, d: Record<string, unknown>) => s + Number((d.montant_ttc_signe ?? d.montant_ttc) || 0), 0),
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
    else if (sort === "Montant") list.sort((a, b) => Number((b.montant_ttc_signe ?? b.montant_ttc) || 0) - Number((a.montant_ttc_signe ?? a.montant_ttc) || 0))
    else if (sort === "Client") list.sort((a, b) => getClientName(a.client_id as string | null).localeCompare(getClientName(b.client_id as string | null)))
    return list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisList, filter, search, sort, clientMap, chantierMap])

  // Sous-liste réellement affichée (pagination "Voir plus").
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  // À chaque changement de recherche/filtre/tri, on revient au haut des résultats.
  useEffect(() => { setVisibleCount(30) }, [search, filter, sort])

  async function handleDelete(id: string) {
    if (!(await askConfirm({ title: "Envoyer ce devis a la corbeille ?", variant: "danger", confirmLabel: "Envoyer" }))) return
    try { await softDeleteRow("devis", id); refetchDevis() }
    catch (err: unknown) { toast.error("Erreur : " + (err instanceof Error ? err.message : "Echec")) }
  }

  async function handleDuplicate(devis: Record<string, unknown>) {
    try {
      const { id, created_at, updated_at, user_id, numero, ...rest } = devis
      await insertRow("devis", { ...rest, numero: (numero as string) + "-copie", statut: "brouillon" })
      refetchDevis()
    } catch (err: unknown) { toast.error("Erreur : " + (err instanceof Error ? err.message : "Echec")) }
  }

  async function handleSend(devis: Record<string, unknown>) {
    router.push(`/dashboard/devis/${devis.id}?send=1`)
  }

  async function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  async function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(d => d.id as string)))
  }
  async function handleBulkDelete() {
    if (!(await askConfirm({ title: `Envoyer ${selected.size} devis a la corbeille ?`, variant: "danger", confirmLabel: "Envoyer" }))) return
    setBulkDeleting(true)
    try { for (const id of Array.from(selected)) { await softDeleteRow("devis", id) }; setSelected(new Set()); refetchDevis() }
    catch (err: unknown) { toast.error("Erreur : " + (err instanceof Error ? err.message : "Echec")) }
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
      {/* V4 : InfoBanner warn pour signaler le profil entreprise incomplet.
          Affiche la liste des mentions légales manquantes et un CTA vers /parametres. */}
      {profilIncomplet && (
        <InfoBanner
          variant="warn"
          icon={<AlertTriangle size={18} className="text-amber-700" />}
        >
          <p className="font-hanken font-bold text-[15px] text-amber-900 mb-1">
            Tes devis ne sont pas pleinement conformes à la loi
          </p>
          <p className="font-hanken text-sm text-amber-800 mb-2">
            Il manque {champsManquants.length} mention{champsManquants.length > 1 ? 's' : ''} obligatoire{champsManquants.length > 1 ? 's' : ''} dans ton profil entreprise.
            Les PDFs générés affichent une bannière d&apos;avertissement tant que ce n&apos;est pas réglé.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {champsManquants.map(label => (
              <span key={label} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-hanken text-[11px] font-semibold">
                {label}
              </span>
            ))}
          </div>
          <Link
            href="/dashboard/parametres"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] hover:brightness-105 text-white font-hanken font-bold text-[13px] shadow-[0_4px_12px_rgba(255,122,26,0.25)] transition-all"
          >
            Compléter mon profil
          </Link>
        </InfoBanner>
      )}

      {/* V3.0d.2 : StatCards cliquables = filtres. Le dropdown filter HTML est
          supprime (devenu redondant). Cliquer sur la card active la deselectionne
          (retour a "Tous"). Police Hanken Grotesk sur les chiffres pour parite PDF. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={<Layers size={22} />}
          label="Tous"
          value={String(stats.all)}
          gradient="from-sky/20 to-sky/10"
          color="#2d8bc9"
          active={filter === "Tous"}
          onClick={() => setFilter("Tous")}
        />
        <StatCard
          icon={<Send size={22} />}
          label="Envoyés"
          value={String(stats.envoyesCount)}
          sub={formatCurrency(stats.envoyesTTC)}
          gradient="from-blue-200 to-blue-100"
          color="#2563eb"
          active={filter === "Envoyé"}
          onClick={() => setFilter(filter === "Envoyé" ? "Tous" : "Envoyé")}
        />
        <StatCard
          icon={<ShieldCheck size={22} />}
          label="Acceptés"
          value={String(stats.signesCount)}
          sub={formatCurrency(stats.signesTTC)}
          gradient="from-green-200 to-green-100"
          color="#15803d"
          active={filter === "Accepté"}
          onClick={() => setFilter(filter === "Accepté" ? "Tous" : "Accepté")}
        />
        <StatCard
          icon={<FileEdit size={22} />}
          label="Brouillons"
          value={String(stats.attenteCount)}
          sub={formatCurrency(stats.attenteTTC)}
          gradient="from-orange/30 to-orange/10"
          color="#ff7a1a"
          active={filter === "Brouillon"}
          onClick={() => setFilter(filter === "Brouillon" ? "Tous" : "Brouillon")}
        />
      </div>

      {/* V4 : barre recherche + tri + CTA "Nouveau devis".
          Utilise PremiumInput/PremiumSelect partagés + gradient orange sur le bouton. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
          <PremiumInput
            type="text"
            placeholder="Rechercher un devis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="[&_input]:pl-9"
          />
        </div>
        <PremiumSelect
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="sm:w-44"
        >
          {SORT_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
        </PremiumSelect>
        <PremiumButton
          variant="secondary"
          icon={<Download size={16} />}
          onClick={() => setExportOpen(true)}
          className="shrink-0"
        >
          Exporter en CSV
        </PremiumButton>
        <Link
          href="/dashboard/devis/nouveau"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     text-white text-sm font-hanken font-bold
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)]
                     hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0
                     transition-all duration-200 shrink-0"
        >
          <Plus size={16} /> Nouveau devis
        </Link>
      </div>

      {/* V4 : barre d'actions groupées (visible quand >=1 devis sélectionné) */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-blue-50/80 border border-blue-200/70 rounded-xl">
          <span className="text-sm font-hanken font-bold text-blue-800">
            {selected.size} devis sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-hanken font-bold transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} /> {bulkDeleting ? "Suppression..." : "Supprimer la sélection"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 rounded-lg bg-white border-[1.5px] border-gray-200 text-xs font-hanken font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* V4 : Mobile cards (visible < md). rounded-2xl, ombre douce, accent au hover. */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06)]">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-hanken text-gray-500">Aucun devis trouvé</p>
          </div>
        ) : (
          visible.map((devis) => {
            const statut = (devis.statut as DevisStatus) || "brouillon"
            return (
              <div
                key={String(devis.id)}
                onClick={() => router.push(`/dashboard/devis/${devis.id}`)}
                className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3.5 cursor-pointer
                           shadow-[0_4px_12px_rgba(15,26,58,0.04)]
                           hover:border-[#ff7a1a]/40 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,26,58,0.08)]
                           active:translate-y-0 transition-all duration-200"
              >
                {/* Police Hanken sur titres + Spline Sans Mono sur montants/numéro pour parité PDF */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-hanken font-bold text-[#0f1a3a] truncate">
                      {(devis.notes_client as string)?.split(" | ")[0] || getClientName(devis.client_id as string | null) || String(devis.numero || '')}
                    </p>
                    <p className="text-xs font-hanken text-gray-500 truncate mt-0.5">
                      {(devis.objet as string) || String(devis.numero || '')}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-hanken font-bold uppercase tracking-wider ${STATUS_STYLES[statut] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[statut] || statut}
                    </span>
                    <p className="font-spline-mono font-bold text-[15px] text-[#0f1a3a] tabular-nums">{formatCurrency((devis.montant_ttc_signe ?? devis.montant_ttc) as number)}</p>
                    {Boolean(devis.modifie_par_client) && <span className="text-[9.5px] font-hanken font-bold uppercase tracking-wide text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">modifié</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-spline-mono text-[11px] text-[#0f1a3a] bg-[#fafbfc] border border-gray-100 px-2 py-0.5 rounded">{String(devis.numero || '')}</span>
                    <span className="text-xs font-spline-mono text-gray-400">{formatDate(devis.date_emission as string)}</span>
                  </div>
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSend(devis) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-hanken font-semibold hover:bg-blue-100 active:scale-95 transition-all"
                    >
                      <Send size={11} /> Envoyer
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/devis/${devis.id}?convert=1`) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-hanken font-semibold hover:bg-emerald-100 active:scale-95 transition-all"
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
        {/* Bouton "Voir plus" (mobile) — total basé sur filtered.length. */}
        {filtered.length > visibleCount && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setVisibleCount((c) => c + 30)}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-hanken font-medium text-[#0f1a3a] hover:bg-gray-50 transition-colors"
            >
              Voir plus ({filtered.length - visibleCount} restants)
            </button>
          </div>
        )}
      </div>

      {/* V4 : Desktop table dans une carte secondaire (rounded-2xl, ombre subtile).
          Polices Hanken partout, montants en Spline Sans Mono pour la parité PDF. */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)] overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[#fafbfc] border-b border-gray-100">
              <th className="px-3 py-3.5 w-10"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a] cursor-pointer" /></th>
              {["Client / Chantier", "Statut", "Numéro", "Modifié", "Date", "Valable jusqu'au", "Total HT", "Total TTC", "Actions"].map((col) => (
                <th key={col} className="px-4 py-3.5 text-left text-[11.5px] font-hanken font-bold uppercase tracking-[0.08em] text-gray-700">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((devis, idx) => {
              const statut = (devis.statut as DevisStatus) || "brouillon"
              return (
                <tr key={String(devis.id)} onClick={() => router.push(`/dashboard/devis/${devis.id}`)} className={`border-b border-gray-100 hover:bg-[#fafbfc] cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-[#fbfcfd]" : ""}`}>
                  <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(devis.id as string)} onChange={() => toggleSelect(devis.id as string)} className="w-4 h-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a] cursor-pointer" /></td>
                  <td className="px-4 py-3"><div className="text-sm font-hanken font-bold text-[#0f1a3a]">{(devis.notes_client as string)?.split(" | ")[0] || getClientName(devis.client_id as string | null)}</div><div className="text-xs font-hanken font-medium text-gray-500 mt-0.5">{(devis.objet as string) || (devis.description as string) || getChantierTitre(devis.chantier_id as string | null)}</div></td>
                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${STATUS_STYLES[statut] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[statut] || statut}</span></td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono text-gray-700">{String(devis.numero || '')}</td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono text-gray-600">{formatDate(devis.updated_at as string)}</td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono text-gray-600">{formatDate(devis.date_emission as string)}</td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono text-gray-600">{formatDate(devis.date_validite as string)}</td>
                  <td className="px-4 py-3 text-sm font-spline-mono font-medium text-[#0f1a3a] tabular-nums">{formatCurrency((devis.montant_ht_signe ?? devis.montant_ht) as number)}</td>
                  <td className="px-4 py-3 text-sm font-spline-mono font-bold text-[#0f1a3a] tabular-nums">
                    {formatCurrency((devis.montant_ttc_signe ?? devis.montant_ttc) as number)}
                    {Boolean(devis.modifie_par_client) && <span className="ml-1.5 text-[9.5px] font-hanken font-bold uppercase tracking-wide text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded align-middle">modifié</span>}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => openMenu(e, devis.id as string)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><MoreHorizontal size={16} className="text-gray-500" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-hanken text-gray-500">Aucun devis trouvé</p>
          </div>
        )}
        {/* Bouton "Voir plus" (desktop) — total basé sur filtered.length. */}
        {filtered.length > visibleCount && (
          <div className="flex justify-center py-4 border-t border-gray-100">
            <button
              onClick={() => setVisibleCount((c) => c + 30)}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-hanken font-medium text-[#0f1a3a] hover:bg-gray-50 transition-colors"
            >
              Voir plus ({filtered.length - visibleCount} restants)
            </button>
          </div>
        )}
      </div>

      {/* V4 : Menu flottant d'actions (rounded-xl, ombre douce bleutée) */}
      {openActions && menuPos && activeDevis && (
        <div
          className="fixed z-[9999] w-52 bg-white rounded-xl shadow-[0_12px_32px_rgba(15,26,58,0.18),_0_4px_12px_rgba(15,26,58,0.08)] border border-[#0f1a3a]/[0.06] py-1.5"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { closeMenu(); router.push(`/dashboard/devis/${activeDevis.id}`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-hanken font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"><Eye size={14} /> Voir</button>
          <button onClick={() => { closeMenu(); router.push(`/dashboard/devis/${activeDevis.id}/modifier`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-hanken font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"><Pencil size={14} /> Modifier</button>
          <button onClick={() => { closeMenu(); router.push(`/dashboard/devis/${activeDevis.id}?convert=1`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-hanken font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"><FileText size={14} /> Convertir en facture</button>
          <button onClick={() => { closeMenu(); handleSend(activeDevis) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-hanken font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"><SendHorizonal size={14} /> Envoyer</button>
          <div className="h-px bg-gray-100 my-1 mx-2" />
          <button onClick={() => { closeMenu(); handleDelete(activeDevis.id as string) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-hanken font-semibold hover:bg-red-50 transition-colors text-red-600"><Trash2 size={14} /> Supprimer</button>
        </div>
      )}

      {/* Rendu conditionnel : composant dynamique monté uniquement à l'ouverture. */}
      {exportOpen && (
        <ExportComptableModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          type="devis"
        />
      )}
    </div>
  )
}

// V3.0d.2 — StatCard premium : cliquable (filtre la liste), icone 44x44 avec
// gradient subtil + ombre interne, chiffres en Hanken Grotesk extrabold tabular-nums
// pour parite avec le PDF devis/facture. Etat actif = bordure orange + fond cream
// gradient + indicateur barre top + scale leger.
function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
  color,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  gradient: string
  color: string
  active?: boolean
  onClick?: () => void
}) {
  const isClickable = typeof onClick === 'function'
  const Wrapper = isClickable ? 'button' : 'div'
  return (
    <Wrapper
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={`relative w-full text-left bg-white rounded-2xl border-[1.5px] p-3 md:p-4 flex items-start gap-3 transition-all duration-200 overflow-hidden ${
        active
          ? 'border-orange bg-gradient-to-br from-orange/5 to-orange/10 shadow-[0_14px_30px_-14px_rgba(232,122,42,0.35)] -translate-y-px'
          : 'border-gray-200 hover:border-orange/40 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(15,26,58,0.25)]'
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-4 w-9 h-[3px] bg-orange rounded-b"
        />
      )}
      <div
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-[inset_0_-2px_0_rgba(15,26,58,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]`}
        style={{ color }}
      >
        {icon}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[10.5px] font-hanken font-bold uppercase tracking-wider text-gray-500">{label}</span>
        <span className="font-hanken font-extrabold text-2xl text-navy leading-none mt-0.5 tabular-nums">{value}</span>
        {sub && <span className="text-[11px] font-spline-mono text-gray-500 mt-1 tabular-nums">{sub}</span>}
      </div>
    </Wrapper>
  )
}
