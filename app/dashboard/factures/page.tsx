'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  FileText,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  SendHorizonal,
  Trash2,
  Plus,
  Layers,
  BadgeCheck,
  Hourglass,
  Download,
  RotateCcw,
} from 'lucide-react'
import { useFactures, useClients, softDeleteRow, insertRow, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
// Chargement à la demande (next/dynamic, ssr:false) : ces modales ne sont
// rendues qu'à l'ouverture. On évite ainsi de charger leur JS au premier render
// de la liste — gain perceptible sur ordinateurs anciens.
const EnvoyerFactureModal = dynamic(() => import('@/components/dashboard/EnvoyerFactureModal'), { ssr: false })
const ExportComptableModal = dynamic(() => import('@/components/dashboard/ExportComptableModal'), { ssr: false })
const CreerAvoirModal = dynamic(() => import('@/components/factures/CreerAvoirModal'), { ssr: false })
// V4 light premium : on remplace l'Input legacy par PremiumInput pour le champ recherche
// et on utilise PremiumButton pour les actions principales.
import { PremiumInput, PremiumButton } from '@/components/ui/v4'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

type FactureFilter = 'Toutes' | 'Encaissées' | 'Partielles' | 'En attente' | 'En retard' | 'Archivées'

// V3.1 — Filtre par type de document (P4)
// Backward-compat : type === null ou type === 'standard' → 'Standards'
type FactureTypeFilter = 'Toutes' | 'Standards' | 'Acomptes' | 'Situations' | 'Avoirs'

// V3.0d.2 : FILTER_OPTIONS retire (dropdown HTML remplace par StatCards cliquables).
// Le type FactureFilter reste pour la logique getFactureCategory.

function getFactureCategory(f: Record<string, unknown>): FactureFilter {
  const statut = (f.statut as string) ?? ''
  // Avoir = categorie neutre : jamais "En attente"/"En retard"/"Encaissées"
  // (un avoir n'est pas une creance ni un encaissement). On le sort de tous
  // les compteurs en lui donnant une categorie qui ne correspond a aucune StatCard.
  if ((f.type as string | null) === 'avoir') return 'Avoirs' as FactureFilter
  if (statut === 'payee' || statut === 'Encaissée') return 'Encaissées'
  if (statut === 'partielle' || statut === 'partiellement_payee') return 'Partielles'
  if (statut === 'en_retard') return 'En retard'
  if (statut === 'archivee') return 'Archivées'
  return 'En attente'
}

// V3.1 — Normalise le `type` d'une facture pour le filtrage P4.
// Backward-compat : un `type` null ou absent vaut 'standard'.
function getFactureTypeFilter(f: Record<string, unknown>): FactureTypeFilter {
  const raw = (f.type as string | null | undefined) ?? null
  if (raw === 'acompte') return 'Acomptes'
  if (raw === 'situation') return 'Situations'
  if (raw === 'avoir') return 'Avoirs'
  return 'Standards' // null OR 'standard' OR autre → considéré standard
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
  const askConfirm = useConfirm()
  const router = useRouter()
  const { data: factures, loading: loadingF, error: errorF, refetch: refetchF } = useFactures()
  const { data: clients, loading: loadingC } = useClients()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Toutes')
  // V3.1 — P4 : filtre par type de document (Toutes/Standards/Acomptes/Situations/Avoirs)
  const [typeFilter, setTypeFilter] = useState<FactureTypeFilter>('Toutes')
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  // V-AVOIR : cible de la modale "Creer un avoir" (facture d'origine).
  const [avoirTarget, setAvoirTarget] = useState<{ id: string; numero: string; clientNom: string; montantTtc: number; originePayee: boolean } | null>(null)
  const [sendTarget, setSendTarget] = useState<{ id: string; numero: string; email: string; clientNom: string; montantTtcLabel: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  // Pagination "Voir plus" : on n'affiche que les `visibleCount` premières
  // factures (la recherche/le filtre portent toujours sur TOUTE la liste).
  const [visibleCount, setVisibleCount] = useState(30)

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

  // clientMap m\u00e9mo\u00efs\u00e9 : ne se recalcule que si la liste clients change.
  const clientMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of clients) {
      const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || (c.raison_sociale as string) || ''
      map.set(c.id as string, nom)
    }
    return map
  }, [clients])

  // V-AVOIR : index des avoirs par facture d'origine, pour afficher un badge
  // "Avoir AV-..." (ou "Soldee par avoir") sur la facture d'origine, ET pour
  // calculer le NET (TTC - paye - avoirs imputes) qui pilote la categorisation.
  const avoirsByOrigine = useMemo(() => {
    const m = new Map<string, { numeros: string[]; totalAvoir: number }>()
    for (const f of factures) {
      if ((f.type as string | null) !== 'avoir') continue
      const oid = f.facture_origine_id as string | null
      if (!oid) continue
      const cur = m.get(oid) ?? { numeros: [], totalAvoir: 0 }
      if (f.numero) cur.numeros.push(f.numero as string)
      cur.totalAvoir += Number(f.montant_ttc ?? 0)
      m.set(oid, cur)
    }
    return m
  }, [factures])

  type EnrichedFacture = Record<string, unknown> & { paidPercent: number; overdue: number; category: FactureFilter; typeFilter: FactureTypeFilter; clientName: string; montantTtc: number; montantPaye: number }
  // enriched m\u00e9mo\u00efs\u00e9 : map co\u00fbteuse sur toutes les factures, recalcul\u00e9e
  // uniquement quand `factures`, `clientMap` ou `avoirsByOrigine` changent.
  const enriched: EnrichedFacture[] = useMemo(() => factures.map((f) => {
    const montantTtc = (f.montant_ttc as number) ?? 0
    const montantPaye = (f.montant_paye as number) ?? 0
    const paidPercent = montantTtc > 0 ? Math.round((montantPaye / montantTtc) * 100) : 0
    const overdue = daysOverdue(f.date_echeance as string | null)
    let category = getFactureCategory(f)
    // V-AVOIR : une facture d'origine dont le NET (TTC - paye - avoirs imputes)
    // est <= 0 est entierement soldee par avoir. On la sort des compteurs/montants
    // "En attente"/"En retard" en lui donnant la categorie neutre 'Avoirs'.
    if ((f.type as string | null) !== 'avoir') {
      const av = avoirsByOrigine.get(f.id as string)
      if (av && av.totalAvoir > 0) {
        const net = montantTtc - montantPaye - av.totalAvoir
        if (montantTtc > 0 && net <= 0.01) category = 'Avoirs' as FactureFilter
      }
    }
    const typeF = getFactureTypeFilter(f)
    const clientName = clientMap.get(f.client_id as string) || (f.client_nom as string) || (f.notes_client as string)?.split(' | ')[0]?.trim() || '\u2014'
    return { ...f, paidPercent, overdue, category, typeFilter: typeF, clientName, montantTtc, montantPaye } as EnrichedFacture
  }), [factures, clientMap, avoirsByOrigine])

  // filtered m\u00e9mo\u00efs\u00e9 : ne refiltre que si enriched/recherche/filtres changent.
  const filtered = useMemo(() => enriched.filter((f) => {
    if (filter !== 'Toutes' && f.category !== filter) return false
    if (typeFilter !== 'Toutes' && f.typeFilter !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        ((f.numero as string) ?? '').toLowerCase().includes(q) ||
        f.clientName.toLowerCase().includes(q) ||
        ((f.objet as string) ?? '').toLowerCase().includes(q)
      )
    }
    return true
  }), [enriched, filter, typeFilter, search])

  // Sous-liste r\u00e9ellement affich\u00e9e (pagination "Voir plus").
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  // \u00c0 chaque changement de recherche/filtre, on revient au haut des r\u00e9sultats.
  useEffect(() => { setVisibleCount(30) }, [search, filter, typeFilter])

  // V-AVOIR : on separe les avoirs (type='avoir') des vraies factures. Les
  // avoirs ne comptent PAS comme une creance/un encaissement ; ils viennent en
  // DEDUCTION du CA facture (CA = Somme factures - Somme avoirs).
  const isAvoir = (f: EnrichedFacture) => (f.type as string | null) === 'avoir'
  const facturesReelles = enriched.filter((f) => !isAvoir(f))
  const avoirsList = enriched.filter((f) => isAvoir(f))
  const avoirsHT = avoirsList.reduce((s, f) => s + ((f.montant_ht as number) ?? 0), 0)
  const totalCount = facturesReelles.length
  // CA HT net = HT des factures reelles - HT des avoirs.
  const totalHT = facturesReelles.reduce((s, f) => s + ((f.montant_ht as number) ?? 0), 0) - avoirsHT
  const encaissees = facturesReelles.filter((f) => f.category === 'Encaissées' || f.category === 'Archivées')
  const encaisseesHT = encaissees.reduce((s, f) => s + (f.montantTtc), 0)
  const resteList = facturesReelles.filter((f) => f.category === 'Partielles' || f.category === 'En attente')
  const resteHT = resteList.reduce((s, f) => s + (f.montantTtc - f.montantPaye), 0)
  const retardList = facturesReelles.filter((f) => f.category === 'En retard')
  const retardHT = retardList.reduce((s, f) => s + (f.montantTtc - f.montantPaye), 0)

  const handleDelete = async (id: string) => {
    if (!(await askConfirm({ title: 'Envoyer cette facture a la corbeille ?', variant: 'danger', confirmLabel: 'Envoyer' }))) return
    setDeleting(id)
    try {
      await softDeleteRow('factures', id)
      refetchF()
    } catch (err) {
      toast.error('Erreur lors de la suppression : ' + (err as Error).message)
    } finally {
      setDeleting(null)
      closeMenu()
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
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(f => f.id as string)))
    }
  }

  async function handleBulkDelete() {
    if (!(await askConfirm({ title: `Envoyer ${selected.size} facture${selected.size > 1 ? 's' : ''} a la corbeille ?`, variant: 'danger', confirmLabel: 'Envoyer' }))) return
    setBulkDeleting(true)
    try {
      for (const id of Array.from(selected)) {
        await softDeleteRow('factures', id)
      }
      setSelected(new Set())
      refetchF()
    } catch (err: unknown) {
      toast.error('Erreur : ' + (err instanceof Error ? err.message : 'Echec'))
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
        // V-AVOIR : ne jamais dupliquer les marqueurs d'avoir. Une copie
        // doit redevenir une facture standard propre (jamais un avoir AV- malforme).
        'type', 'facture_origine_id', 'facture_origine_numero',
        'facture_origine_date', 'remboursement_statut', 'rembourse_at',
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
      toast.error('Erreur lors de la duplication : ' + (err as Error).message)
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

  // V-AVOIR : ouvre la modale "Creer un avoir" pour la facture donnee.
  function openAvoirModal(facture: EnrichedFacture) {
    closeMenu()
    const statut = (facture.statut as string) ?? ''
    setAvoirTarget({
      id: facture.id as string,
      numero: (facture.numero as string) ?? '',
      clientNom: facture.clientName,
      montantTtc: facture.montantTtc,
      originePayee: statut === 'payee' || statut === 'Encaissée',
    })
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
      {/* V4 light premium : StatCards cliquables = filtres. Refonte visuelle (fond
          blanc, accent orange à l'état actif, halo orange discret, typo Hanken). */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={<Layers size={22} />}
          label="Toutes"
          value={String(totalCount)}
          sub={`${formatCurrency(totalHT)} HT`}
          color="#0f1a3a"
          active={filter === 'Toutes'}
          onClick={() => setFilter('Toutes')}
        />
        <StatCard
          icon={<BadgeCheck size={22} />}
          label="Encaissées"
          value={String(encaissees.length)}
          sub={`${formatCurrency(encaisseesHT)} HT`}
          color="#15803d"
          active={filter === 'Encaissées'}
          onClick={() => setFilter(filter === 'Encaissées' ? 'Toutes' : 'Encaissées')}
        />
        <StatCard
          icon={<Hourglass size={22} />}
          label="En attente"
          value={String(resteList.length)}
          sub={`${formatCurrency(resteHT)} HT`}
          color="#ff7a1a"
          active={filter === 'En attente'}
          onClick={() => setFilter(filter === 'En attente' ? 'Toutes' : 'En attente')}
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          label="En retard"
          value={String(retardList.length)}
          sub={`${formatCurrency(retardHT)} HT`}
          color="#dc2626"
          active={filter === 'En retard'}
          onClick={() => setFilter(filter === 'En retard' ? 'Toutes' : 'En retard')}
        />
      </div>

      {/* V4 light : barre de recherche + CTA "Nouvelle facture" — input premium + bouton gradient orange. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
          <PremiumInput
            type="text"
            placeholder="Rechercher une facture..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="[&_input]:pl-10"
          />
        </div>
        <PremiumButton
          variant="secondary"
          icon={<Download size={16} />}
          onClick={() => setExportOpen(true)}
          className="shrink-0"
        >
          Exporter en CSV
        </PremiumButton>
        <Link href="/dashboard/factures/nouveau" className="shrink-0">
          <PremiumButton variant="primary" icon={<Plus size={16} />}>
            Nouvelle facture
          </PremiumButton>
        </Link>
      </div>

      {/* V3.1 — Filtre par type (P4) : pills horizontales sous la recherche.
          Compact, scrollable mobile. Active = pill blanche orange. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500 mr-1">Type :</span>
        {(['Toutes', 'Standards', 'Acomptes', 'Situations', 'Avoirs'] as FactureTypeFilter[]).map((opt) => {
          const isActive = typeFilter === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setTypeFilter(opt)}
              className={`px-3 py-1.5 rounded-full font-hanken text-[12px] font-semibold transition-all border-[1.5px] ${
                isActive
                  ? 'bg-[#0f1a3a] text-white border-[#0f1a3a] shadow-[0_4px_12px_rgba(15,26,58,0.15)]'
                  : 'bg-white text-[#0f1a3a] border-gray-200 hover:border-[#ff7a1a] hover:text-[#ff7a1a]'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-blue-50/80 border border-blue-200/70 rounded-xl">
          <span className="font-hanken text-sm font-semibold text-blue-800">
            {selected.size} facture{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-hanken font-semibold transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(220,38,38,0.25)]"
          >
            <Trash2 size={13} /> {bulkDeleting ? 'Suppression...' : 'Supprimer la sélection'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 rounded-lg bg-white border-[1.5px] border-gray-200 text-xs font-hanken font-semibold text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* V4 light : cartes mobile (cards empilées sous md) — fond blanc, bord arrondi 2xl,
          ombre douce, tap zone confortable, montants en Spline Sans Mono. */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-hanken text-sm text-gray-500">Aucune facture trouvée</p>
          </div>
        ) : (
          visible.map((facture) => {
            const id = facture.id as string
            const restant = facture.montantTtc - facture.montantPaye
            const retardLabel = facture.category === 'En retard' && facture.overdue > 0 ? `En retard ${facture.overdue}j` : undefined
            // V-AVOIR (net du) : facture d'origine avec avoirs -> net = TTC - regle - avoirs.
            const avInfoM = avoirsByOrigine.get(id)
            const totalAvoirM = avInfoM?.totalAvoir ?? 0
            const aDesAvoirsM = (facture.type as string | null) !== 'avoir' && totalAvoirM > 0.01
            const netDuM = Math.max(0, facture.montantTtc - facture.montantPaye - totalAvoirM)
            // Couleur de la barre de paiement (sémantique) : vert payé, rouge en retard, orange partiel.
            const paidColor = facture.paidPercent === 100 ? '#15803d' : facture.category === 'En retard' ? '#dc2626' : '#ff7a1a'
            return (
              <div
                key={id}
                onClick={() => router.push(`/dashboard/factures/${id}`)}
                className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3.5 cursor-pointer hover:border-[#ff7a1a]/40 active:bg-[#fafbfc] transition-all shadow-[0_2px_6px_rgba(15,26,58,0.04)]"
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-hanken font-bold text-[14.5px] text-[#0f1a3a] truncate">{facture.clientName || (facture.numero as string)}</p>
                    <p className="font-hanken text-xs text-gray-500 mt-0.5 truncate">{(facture.objet as string) || (facture.numero as string)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {aDesAvoirsM ? (
                      <>
                        <p className="font-spline-mono text-[11px] text-gray-400 line-through tracking-[0.5px]">{formatCurrency(facture.montantTtc)}</p>
                        <p className="font-spline-mono font-medium text-[15px] text-[#0f1a3a] tracking-[0.5px]">{formatCurrency(netDuM)}</p>
                      </>
                    ) : (
                      <p className="font-spline-mono font-medium text-[15px] text-[#0f1a3a] tracking-[0.5px]">{formatCurrency(facture.montantTtc)}</p>
                    )}
                    {retardLabel && <p className="font-hanken text-xs text-red-600 font-semibold mt-0.5">{retardLabel}</p>}
                    {!retardLabel && facture.paidPercent < 100 && facture.paidPercent > 0 && (
                      <p className="font-spline-mono text-[11px] text-[#ff7a1a] mt-0.5">{formatCurrency(restant)} restants</p>
                    )}
                  </div>
                </div>
                {/* Barre de paiement (couleur sémantique) — masquee pour un avoir */}
                <div className="flex items-center gap-2 mb-1.5">
                  {(facture.type as string | null) === 'avoir' ? (
                    <span className="flex-1 font-spline-mono text-[11px] text-gray-400">Avoir (NET A CREDITER)</span>
                  ) : (
                    <>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${facture.paidPercent}%`, background: paidColor }} />
                      </div>
                      <span className="font-spline-mono text-[11px] text-gray-500">{facture.paidPercent}%</span>
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openMenu(e, id) }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 ml-1 transition-colors"
                    aria-label="Actions"
                  >
                    <MoreHorizontal size={15} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-spline-mono text-[11px] text-[#0f1a3a] bg-[#fafbfc] border border-gray-200 px-2 py-0.5 rounded-md">
                    {String(facture.numero || '')}
                  </span>
                  <FactureTypeBadge facture={facture} />
                  <OrigineAvoirBadge facture={facture} avoirInfo={avoirsByOrigine.get(facture.id as string)} />
                  <span className="font-spline-mono text-[11px] text-gray-400">
                    {formatDate((facture.date_emission || facture.created_at) as string | null)}
                  </span>
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

      {/* V4 light : tableau desktop — fond blanc, ombre douce, en-tête uppercase Hanken,
          chiffres Spline Sans Mono, hover ligne avec fond #fafbfc. */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-x-auto shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
              <th className="px-3 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a] cursor-pointer"
                />
              </th>
              {['Numéro', 'Règlements', 'Client / Chantier', 'Modifié', 'Date', 'Net à payer', 'Actions'].map((col) => (
                <th key={col} className="px-4 py-3.5 text-left font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-700">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((facture) => {
              const id = facture.id as string
              const restant = facture.montantTtc - facture.montantPaye
              const restantLabel = facture.paidPercent > 0 && facture.paidPercent < 100 ? `${formatCurrency(restant)} restants` : undefined
              const retardLabel = facture.category === 'En retard' && facture.overdue > 0 ? `En retard ${facture.overdue}j` : undefined
              // V-AVOIR (net du) : pour une facture d'ORIGINE qui a des avoirs, le
              // "Net a payer" reel = TTC - regle - avoirs emis (jamais negatif).
              const avInfoD = avoirsByOrigine.get(id)
              const totalAvoirD = avInfoD?.totalAvoir ?? 0
              const aDesAvoirsD = (facture.type as string | null) !== 'avoir' && totalAvoirD > 0.01
              const netDuD = Math.max(0, facture.montantTtc - facture.montantPaye - totalAvoirD)
              return (
                <tr
                  key={id}
                  onClick={() => router.push(`/dashboard/factures/${id}`)}
                  className="border-b border-[#0f1a3a]/[0.04] last:border-b-0 hover:bg-[#fafbfc] cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => toggleSelect(id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a] cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-spline-mono font-medium text-[13px] tracking-[0.5px] text-[#0f1a3a]">{(facture.numero as string) ?? '\u2014'}</span>
                      <FactureTypeBadge facture={facture} />
                      <OrigineAvoirBadge facture={facture} avoirInfo={avoirsByOrigine.get(facture.id as string)} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{(facture.type as string | null) === 'avoir' ? (<span className="font-spline-mono text-[12px] text-gray-400">{'\u2014'}</span>) : (<PaymentBar percent={facture.paidPercent} restant={restantLabel} retard={retardLabel} />)}</td>
                  <td className="px-4 py-3">
                    <div className="font-hanken text-[14px] font-semibold text-[#0f1a3a]">{facture.clientName}</div>
                    <div className="font-hanken text-xs text-gray-500">{(facture.objet as string) ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{formatDate(facture.updated_at as string | null)}</td>
                  <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{formatDate((facture.date_emission || facture.created_at) as string | null)}</td>
                  <td className="px-4 py-3 font-spline-mono font-medium text-[14px] text-[#0f1a3a]">
                    {aDesAvoirsD ? (
                      <span className="flex flex-col leading-tight">
                        <span className="text-[11px] text-gray-400 line-through">{formatCurrency(facture.montantTtc)}</span>
                        <span className="text-[#0f1a3a]">{formatCurrency(netDuD)}</span>
                      </span>
                    ) : (
                      formatCurrency(facture.montantTtc)
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => openMenu(e, id)} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all" aria-label="Actions">
                      <MoreHorizontal size={16} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-hanken text-sm text-gray-500">Aucune facture trouvée</p>
          </div>
        )}
        {/* Bouton "Voir plus" (desktop) — total basé sur filtered.length. */}
        {filtered.length > visibleCount && (
          <div className="flex justify-center py-4 border-t border-[#0f1a3a]/[0.04]">
            <button
              onClick={() => setVisibleCount((c) => c + 30)}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-hanken font-medium text-[#0f1a3a] hover:bg-gray-50 transition-colors"
            >
              Voir plus ({filtered.length - visibleCount} restants)
            </button>
          </div>
        )}
      </div>

      {/* Menu flottant V4 light — fond blanc, ombre 2xl, séparateurs gris ultra-fins. */}
      {openActions && menuPos && activeFacture && (
        <div
          className="fixed z-[9999] w-48 bg-white rounded-xl shadow-2xl border border-[#0f1a3a]/[0.08] py-1.5"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { closeMenu(); router.push(`/dashboard/factures/${activeFacture.id}`) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"
          >
            <Eye size={14} /> Voir
          </button>
          {(activeFacture.statut as string) === 'brouillon' ? (
            <button
              onClick={() => { closeMenu(); router.push(`/dashboard/factures/${activeFacture.id}/modifier`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"
            >
              <Pencil size={14} /> Modifier
            </button>
          ) : (
            <button
              disabled
              title="Facture émise : modification interdite (art. L441-9 C. comm.)"
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium text-gray-400 cursor-not-allowed"
            >
              <Pencil size={14} /> Modifier (verrouillée)
            </button>
          )}
          <button
            onClick={() => { handleDuplicate(activeFacture.id as string) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"
          >
            <Copy size={14} /> Dupliquer
          </button>
          {(() => {
            // Avoir possible UNIQUEMENT sur une facture emise (pas brouillon,
            // pas annulee) et qui n'est pas elle-meme un avoir.
            const t = (activeFacture.type as string | null) ?? null
            const st = (activeFacture.statut as string) ?? ''
            const eligible = t !== 'avoir' && ['envoyee', 'partiellement_payee', 'payee', 'en_retard', 'En attente', 'Encaissée'].includes(st)
            if (!eligible) return null
            return (
              <button
                onClick={() => { openAvoirModal(activeFacture) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"
              >
                <RotateCcw size={14} /> Creer un avoir
              </button>
            )
          })()}
          <button
            onClick={() => { handleSend(activeFacture) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium hover:bg-[#fafbfc] transition-colors text-[#0f1a3a]"
          >
            <SendHorizonal size={14} /> Envoyer
          </button>
          <button
            onClick={() => { handleDelete(activeFacture.id as string) }}
            disabled={deleting === (activeFacture.id as string)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-hanken text-[13.5px] font-medium hover:bg-red-50 transition-colors text-red-600"
          >
            <Trash2 size={14} /> {deleting === (activeFacture.id as string) ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      )}

      {duplicating && (
        <div className="fixed bottom-6 right-6 bg-[#0f1a3a] text-white px-4 py-2.5 rounded-xl shadow-xl font-hanken text-sm z-50">
          Duplication en cours...
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#0f1a3a] text-white px-4 py-2.5 rounded-xl shadow-xl font-hanken text-sm z-50">
          {toastMsg}
        </div>
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

      {/* V-AVOIR : modale "Creer un avoir" (montee a l'ouverture seulement). */}
      {avoirTarget && (
        <CreerAvoirModal
          open={!!avoirTarget}
          onClose={() => setAvoirTarget(null)}
          factureId={avoirTarget.id}
          numero={avoirTarget.numero}
          clientNom={avoirTarget.clientNom}
          montantTtc={avoirTarget.montantTtc}
          originePayee={avoirTarget.originePayee}
          onCreated={(avoirId) => {
            setAvoirTarget(null)
            refetchF()
            router.push(`/dashboard/factures/${avoirId}`)
          }}
        />
      )}

      {/* Rendu conditionnel : le composant dynamique n'est monté qu'à l'ouverture
          (il retournait déjà null quand fermé, on évite ici jusqu'au chargement du JS). */}
      {exportOpen && (
        <ExportComptableModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          type="factures"
        />
      )}
    </div>
  )
}

// V3.1 — Badge de type de facture (P1) : situation / acompte / avoir.
// Backward-compat : type === null OU type === 'standard' → aucun badge affiché.
// Pour 'situation', on affiche aussi le numéro (#N) et le % d'avancement si renseignés.
function FactureTypeBadge({ facture }: { facture: Record<string, unknown> }) {
  const raw = (facture.type as string | null | undefined) ?? null
  if (!raw || raw === 'standard') return null
  if (raw === 'situation') {
    const n = (facture.numero_situation as number | null | undefined) ?? null
    const pct = (facture.pourcentage_situation as number | null | undefined) ?? null
    const parts: string[] = []
    if (n != null) parts.push(`#${n}`)
    if (pct != null && pct > 0) parts.push(`${pct}%`)
    const detail = parts.length > 0 ? ` ${parts.join(' · ')}` : ''
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-hanken text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap">
        Situation{detail}
      </span>
    )
  }
  if (raw === 'acompte') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200/60 font-hanken text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap">
        Acompte
      </span>
    )
  }
  if (raw === 'avoir') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200/60 font-hanken text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap">
        Avoir
      </span>
    )
  }
  return null
}

// V-AVOIR : badge affiche sur une facture d'ORIGINE qui possede un ou plusieurs
// avoirs. "Soldee par avoir" si la somme des avoirs couvre tout le TTC, sinon
// "Avoir AV-...".
function OrigineAvoirBadge({ facture, avoirInfo }: { facture: Record<string, unknown>; avoirInfo?: { numeros: string[]; totalAvoir: number } }) {
  if (!avoirInfo || avoirInfo.numeros.length === 0) return null
  if ((facture.type as string | null) === 'avoir') return null
  const ttc = Number(facture.montant_ttc ?? 0)
  const paye = Number(facture.montant_paye ?? 0)
  const net = ttc - paye - avoirInfo.totalAvoir
  const soldee = net <= 0.01
  const label = soldee ? 'Soldee par avoir' : `Avoir ${avoirInfo.numeros[0]}`
  return (
    <span
      title={avoirInfo.numeros.join(', ')}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 font-hanken text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap"
    >
      {label}
    </span>
  )
}

// PaymentBar V4 light — barre de progression de paiement avec couleur sémantique
// (vert payé, orange partiel, gris vide). Chiffres en Spline Sans Mono.
function PaymentBar({ percent, restant, retard }: { percent: number; restant?: string; retard?: string }) {
  let barColor = 'bg-gray-200'
  if (percent === 100) barColor = 'bg-emerald-500'
  else if (percent > 0) barColor = 'bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d]'
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
        </div>
        <span className="font-spline-mono text-[11px] text-gray-500 whitespace-nowrap">{percent}%</span>
      </div>
      {restant && <p className="font-spline-mono text-[11px] text-[#ff7a1a]">{restant}</p>}
      {retard && <p className="font-hanken text-[11px] text-red-600 font-semibold">{retard}</p>}
    </div>
  )
}

// StatCard V4 light premium — cliquable (filtre la liste). Bordure subtile,
// halo orange à l'état actif, icône colorée par couleur sémantique, chiffres
// en Hanken Grotesk extrabold, total/sous-total en Spline Sans Mono.
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
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
          ? 'border-[#ff7a1a] shadow-[0_0_0_4px_rgba(255,122,26,0.10),_0_12px_24px_-12px_rgba(255,122,26,0.30)] -translate-y-px'
          : 'border-[#0f1a3a]/[0.06] hover:border-[#ff7a1a]/40 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(15,26,58,0.20)]'
      }`}
    >
      {/* Indicateur barre haute à l'état actif (signature V4) */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-4 w-10 h-[3px] bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d] rounded-b"
        />
      )}
      <div
        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-[#fafbfc] border border-[#0f1a3a]/[0.06]"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-hanken text-[10.5px] font-semibold uppercase tracking-wider text-gray-700">{label}</span>
        <span className="font-hanken font-extrabold text-2xl text-[#0f1a3a] leading-none mt-0.5 tracking-[-0.025em]">{value}</span>
        {sub && <span className="font-spline-mono text-[11px] text-gray-500 mt-1">{sub}</span>}
      </div>
    </Wrapper>
  )
}
