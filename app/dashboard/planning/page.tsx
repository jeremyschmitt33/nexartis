'use client'

import { useState, useMemo, useCallback, useRef, useEffect, Suspense } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, X, FileText,
  Search, AlertTriangle, Users, Briefcase, Clock, HardHat,
  MapPin, Eye, Maximize2, Minimize2, Check, Trash2, Pencil
} from 'lucide-react'
import {
  usePlanning, useIntervenants, useClients, useChantiers, useDevis,
  insertRow, updateRow, deleteRow, LoadingSkeleton, useEntreprise,
} from '@/lib/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import NotesIntervention from '@/components/NotesIntervention'

// ===================================================================
// Types & Constants
// ===================================================================

type R = Record<string, unknown>
type ViewPreset = 'complete' | 'planning' | 'annual'
type Creneau = 'matin' | 'apres_midi' | 'journee' | 'creneau'
type FilterType = 'all' | 'client' | 'chantier' | 'conflict'

const CRENEAUX: { value: Creneau; label: string; heures: string }[] = [
  { value: 'journee', label: 'Journée entière', heures: '8h-17h' },
  { value: 'matin', label: 'Demi-journée matin', heures: '8h-12h' },
  { value: 'apres_midi', label: 'Demi-journée après-midi', heures: '13h-17h' },
  { value: 'creneau', label: 'Créneau personnalisé', heures: 'Custom' },
]

const PALETTE = [
  { key: 'sky', bg: 'bg-[#eef7fc]', border: 'border-l-[#5ab4e0]', text: 'text-[#1a6fb5]', badge: 'bg-[#5ab4e0]', hex: '#5ab4e0' },
  { key: 'orange', bg: 'bg-[#fef5ee]', border: 'border-l-[#e87a2a]', text: 'text-[#b85c1a]', badge: 'bg-[#e87a2a]', hex: '#e87a2a' },
  { key: 'green', bg: 'bg-[#effbf2]', border: 'border-l-[#22c55e]', text: 'text-[#166534]', badge: 'bg-[#22c55e]', hex: '#22c55e' },
  { key: 'violet', bg: 'bg-[#f3effe]', border: 'border-l-[#7c3aed]', text: 'text-[#5b21b6]', badge: 'bg-[#7c3aed]', hex: '#7c3aed' },
  { key: 'gold', bg: 'bg-[#fefce8]', border: 'border-l-[#f5c842]', text: 'text-[#854d0e]', badge: 'bg-[#f5c842]', hex: '#f5c842' },
  { key: 'red', bg: 'bg-[#fef2f2]', border: 'border-l-[#ef4444]', text: 'text-[#991b1b]', badge: 'bg-[#ef4444]', hex: '#ef4444' },
]

const STATUTS = [
  { value: 'planifie', label: 'Planifié', color: 'bg-amber-100 text-amber-700' },
  { value: 'en_cours', label: 'En cours', color: 'bg-sky-100 text-sky-700' },
  { value: 'termine', label: 'Terminé', color: 'bg-green-100 text-green-700' },
  { value: 'annule', label: 'Annulé', color: 'bg-red-100 text-red-700' },
]

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

// ===================================================================
// Helpers
// ===================================================================

function getMonday(d: Date): Date {
  const date = new Date(d); const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff); date.setHours(0, 0, 0, 0); return date
}
function fmtISO(d: Date): string {
  // Format YYYY-MM-DD en LOCAL (pas UTC) pour eviter le bug de timezone
  // qui faisait apparaitre les dates avec un jour de decalage.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function initials(name: string) { return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) }
function isSameDay(d1: Date, d2: Date) { return fmtISO(d1) === fmtISO(d2) }
function creneauLabel(c: string) { return CRENEAUX.find(cr => cr.value === c)?.label ?? c }

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getFirstDayOffset(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

// ===================================================================
// Page
// ===================================================================

function PlanningPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: planningData, loading: l1, refetch } = usePlanning()
  const { data: intervenants, loading: l2 } = useIntervenants()
  const { data: clients, loading: l3 } = useClients()
  const { data: chantiers } = useChantiers()
  const { data: devisData } = useDevis()
  const { entreprise } = useEntreprise()

  // ── State ──
  const [viewPreset, setViewPreset] = useState<ViewPreset>('complete')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [annualCollapsed, setAnnualCollapsed] = useState(false)
  const [detailCollapsed, setDetailCollapsed] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [panelIntervention, setPanelIntervention] = useState<R | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [isSociete, setIsSociete] = useState(true)
  const [showWeekend, setShowWeekend] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const autoDetectedRef = useRef(false)

  // Modal state
  const [mDevis, setMDevis] = useState('')
  const [mClient, setMClient] = useState('')
  const [mIntervenant, setMIntervenant] = useState('')
  const [mChantier, setMChantier] = useState('')
  // Saisie libre — pour visites de courtoisie, premiers RDV, contrôles sur prospect non encore en base.
  // Si mClientLibre/mChantierLibre est rempli, on l'utilise à la place du select (qui doit rester vide).
  const [mClientLibre, setMClientLibre] = useState('')
  const [mChantierLibre, setMChantierLibre] = useState('')
  const [mTypeIntervention, setMTypeIntervention] = useState('')
  const [mDate, setMDate] = useState('')
  const [mDateFin, setMDateFin] = useState('')
  const [mCreneau, setMCreneau] = useState<Creneau>('journee')
  const [mObjet, setMObjet] = useState('')
  const [mNotes, setMNotes] = useState('')
  const [mStatut, setMStatut] = useState('planifie')
  const [submitting, setSubmitting] = useState(false)
  const [mHeureDebut, setMHeureDebut] = useState('08:00')
  const [mHeureFin, setMHeureFin] = useState('17:00')
  const [mConflitWarning, setMConflitWarning] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  // Conflict confirmation modal state
  const [showConflitConfirm, setShowConflitConfirm] = useState(false)
  const [conflitConfirmMessage, setConflitConfirmMessage] = useState('')
  // Solo mode: ID of the self-intervenant (artisan himself)
  const [selfIntervenantId, setSelfIntervenantId] = useState<string | null>(null)
  const selfCreatingRef = useRef(false)

  const loading = l1 || l2 || l3

  // ── Auto-detect Solo mode for sole proprietors (once on load) ──
  const profilRempli = Boolean(entreprise?.forme_juridique && (entreprise.forme_juridique as string).trim().length > 0)
  useEffect(() => {
    if (entreprise && !autoDetectedRef.current) {
      const formeJuridique = (entreprise.forme_juridique as string ?? '').toLowerCase()
      if (formeJuridique.includes('micro') || formeJuridique === 'ei' || formeJuridique.includes('entreprise individuelle')) {
        setIsSociete(false)
      }
      autoDetectedRef.current = true
    }
  }, [entreprise])

  // ── Solo mode: resolve or auto-create the self-intervenant ──
  // Runs when intervenants are loaded and we are in Solo mode.
  // Identifies the self-intervenant as the first non-subcontractor in the list.
  // If none exists, creates one from the entreprise data (or user email).
  useEffect(() => {
    if (isSociete) return
    if (l2) return // wait for intervenants to load
    if (selfCreatingRef.current) return

    const existing = intervenants.find(
      iv => (iv as R).type_contrat !== 'sous-traitant'
    ) as R | undefined

    if (existing) {
      setSelfIntervenantId(existing.id as string)
      return
    }

    // No self-intervenant yet — create one from entreprise info
    selfCreatingRef.current = true
    const nomSelf = (entreprise?.nom as string) || 'Artisan'
    const metierSelf = (entreprise?.metier as string) || ''
    insertRow('intervenants', {
      prenom: '',
      nom: nomSelf,
      metier: metierSelf,
      type_contrat: 'cdi',
      actif: true,
    }).then(created => {
      if (created) {
        setSelfIntervenantId((created as R).id as string)
      }
      selfCreatingRef.current = false
    }).catch(() => { selfCreatingRef.current = false })
  }, [isSociete, l2, intervenants, entreprise])

  // ── Sync mIntervenant en mode Solo : force la pre-selection de "soi"
  // quand le modal est ouvert, quel que soit l'ordre de chargement.
  useEffect(() => {
    if (!showModal) return
    if (isSociete) return
    if (mIntervenant) return
    if (selfIntervenantId) {
      setMIntervenant(selfIntervenantId)
    } else if (intervenants.length > 0) {
      setMIntervenant((intervenants[0] as R).id as string)
    }
  }, [showModal, isSociete, mIntervenant, selfIntervenantId, intervenants])

  // ── Weekend toggle: read from localStorage on mount ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nexartis_planning_show_weekend')
      if (stored === '1') setShowWeekend(true)
    }
  }, [])

  // ── Weekend toggle: persist to localStorage on change ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexartis_planning_show_weekend', showWeekend ? '1' : '0')
    }
  }, [showWeekend])

  // ── Auto-activate conflict filter from URL query param ──
  useEffect(() => {
    if (searchParams && searchParams.get('filter') === 'conflict') {
      setActiveFilter('conflict')
    }
  }, [searchParams])

  // ── View preset effects ──
  useEffect(() => {
    if (viewPreset === 'planning') { setAnnualCollapsed(true); setDetailCollapsed(false) }
    else if (viewPreset === 'annual') { setAnnualCollapsed(false); setDetailCollapsed(true) }
    else { setAnnualCollapsed(false); setDetailCollapsed(false) }
  }, [viewPreset])

  // ── Toast ──
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }, [])

  // ── Click outside search ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Maps ──
  const clientMap = useMemo(() => {
    const map = new Map<string, R>()
    clients.forEach(c => { const r = c as R; map.set(r.id as string, r) })
    return map
  }, [clients])

  const intervenantMap = useMemo(() => {
    const map = new Map<string, R>()
    intervenants.forEach(iv => { const r = iv as R; map.set(r.id as string, r) })
    return map
  }, [intervenants])

  const chantierMap = useMemo(() => {
    const map = new Map<string, R>()
    chantiers.forEach(ch => { const r = ch as R; map.set(r.id as string, r) })
    return map
  }, [chantiers])

  const devisMap = useMemo(() => {
    const map = new Map<string, R>()
    devisData.forEach(d => { const r = d as R; map.set(r.id as string, r) })
    return map
  }, [devisData])

  // ── Devis acceptés (signés) ──
  const acceptedDevis = useMemo(() => {
    return devisData.filter(d => (d as R).statut === 'signe') as R[]
  }, [devisData])

  // ── Devis non planifiés (acceptés sans intervention liée) ──
  const unplannedDevis = useMemo(() => {
    const plannedDevisIds = new Set(
      planningData.map(p => (p as R).devis_id as string).filter(Boolean)
    )
    return acceptedDevis.filter(d => !plannedDevisIds.has(d.id as string))
  }, [acceptedDevis, planningData])

  const colorMap = useMemo(() => {
    const map = new Map<string, typeof PALETTE[0]>()
    intervenants.forEach((iv, i) => { map.set((iv as R).id as string, PALETTE[i % PALETTE.length]) })
    return map
  }, [intervenants])

  // ── Planning indexed by date string ──
  // BUG MULTI-JOURS FIX : si une intervention couvre plusieurs jours,
  // on l'ajoute à chaque jour entre date_debut et date_fin (heatmap annuelle correcte)
  const planningByDate = useMemo(() => {
    const map = new Map<string, R[]>()
    for (const item of planningData) {
      const rec = item as R
      const dateDebut = rec.date_debut as string
      if (!dateDebut) continue
      const startDay = dateDebut.split('T')[0]
      const endDateRaw = (rec.date_fin as string) || dateDebut
      const endDay = endDateRaw.split('T')[0]
      const startD = new Date(startDay + 'T00:00:00')
      const endD = new Date(endDay + 'T00:00:00')
      const last = endD < startD ? startD : endD
      let safety = 0
      const cur = new Date(startD)
      while (cur <= last && safety < 60) {
        const dayKey = fmtISO(cur)
        if (!map.has(dayKey)) map.set(dayKey, [])
        map.get(dayKey)!.push(rec)
        cur.setDate(cur.getDate() + 1)
        safety++
      }
    }
    return map
  }, [planningData])

  // ── Planning map: key = intervenantId__dateStr ──
  // BUG D FIX : en mode Solo, on rapatrie aussi les interventions sans intervenant_id
  // (sinon elles seraient invisibles) sous le seul intervenant affiché.
  // BUG MULTI-JOURS FIX : si une intervention dure plusieurs jours (date_debut < date_fin),
  // on la duplique sur CHAQUE jour entre les deux pour qu'elle apparaisse partout sur le calendrier.
  const planningMap = useMemo(() => {
    const map = new Map<string, R[]>()
    const fallbackIvId = !isSociete && intervenants.length > 0 ? (intervenants[0] as R).id as string : null
    for (const item of planningData) {
      const rec = item as R
      let ivId = rec.intervenant_id as string
      const dateDebut = rec.date_debut as string
      if (!dateDebut) continue
      // En Solo, fallback vers l'unique intervenant affiché si pas d'intervenant_id
      if (!ivId && fallbackIvId) ivId = fallbackIvId
      if (!ivId) continue

      // Déterminer la plage de jours couverte par l'intervention
      const startDay = dateDebut.split('T')[0]
      const endDateRaw = (rec.date_fin as string) || dateDebut
      const endDay = endDateRaw.split('T')[0]
      // Itérer du jour de début jusqu'au jour de fin (inclus)
      const startD = new Date(startDay + 'T00:00:00')
      const endD = new Date(endDay + 'T00:00:00')
      // Sécurité : si pour une raison X end < start, on prend juste le jour de début
      const last = endD < startD ? startD : endD
      // Limite à 60 jours pour éviter une boucle énorme en cas de mauvaise data
      let safety = 0
      const cur = new Date(startD)
      while (cur <= last && safety < 60) {
        const dayKey = fmtISO(cur)
        const key = `${ivId}__${dayKey}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(rec)
        cur.setDate(cur.getDate() + 1)
        safety++
      }
    }
    return map
  }, [planningData, isSociete, intervenants])

  // ── Conflicts detection (hour-based overlap: A.start < B.end && B.start < A.end) ──
  const conflicts = useMemo(() => {
    const set = new Set<string>()
    // Helper: convert HH:MM string to total minutes
    const t2m = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
    // Helper: get [startMin, endMin] for a record
    const recRange = (rec: R): [number, number] => {
      const c = rec.creneau as string
      if (c === 'journee') return [t2m('08:00'), t2m('17:00')]
      if (c === 'matin') return [t2m('08:00'), t2m('12:00')]
      if (c === 'apres_midi') return [t2m('13:00'), t2m('17:00')]
      return [t2m((rec.heure_debut as string) || '08:00'), t2m((rec.heure_fin as string) || '17:00')]
    }
    // Group by intervenant + date
    const byIntervenantDate = new Map<string, R[]>()
    for (const item of planningData) {
      const rec = item as R
      if (!rec.intervenant_id) continue
      const key = `${rec.intervenant_id}__${(rec.date_debut as string)?.split('T')[0]}`
      if (!byIntervenantDate.has(key)) byIntervenantDate.set(key, [])
      byIntervenantDate.get(key)!.push(rec)
    }
    byIntervenantDate.forEach((items) => {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const [aStart, aEnd] = recRange(items[i])
          const [bStart, bEnd] = recRange(items[j])
          if (aStart < bEnd && bStart < aEnd) {
            set.add(items[i].id as string)
            set.add(items[j].id as string)
          }
        }
      }
    })
    return set
  }, [planningData])

  // ── Stats ──
  const weekDaysForStats = useMemo(() => {
    const numDays = showWeekend ? 7 : 5
    const days: string[] = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      days.push(fmtISO(d))
    }
    return days
  }, [weekStart, showWeekend])

  const stats = useMemo(() => {
    const weekInterventions = planningData.filter(p => {
      const d = (p as R).date_debut as string
      if (!d) return false
      return weekDaysForStats.includes(d.split('T')[0])
    })
    const activeChantiers = new Set(weekInterventions.map(p => (p as R).chantier_id).filter(Boolean))
    const numDays = showWeekend ? 7 : 5
    const totalSlots = (isSociete ? intervenants.length : 1) * numDays
    const occupation = totalSlots > 0 ? Math.round((weekInterventions.length / totalSlots) * 100) : 0
    return {
      interventions: weekInterventions.length,
      chantiers: activeChantiers.size,
      occupation: Math.min(occupation, 100),
      conflicts: conflicts.size,
    }
  }, [planningData, weekDaysForStats, intervenants, isSociete, conflicts, showWeekend])

  // ── Search ──
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return []
    const q = searchQuery.toLowerCase()
    const results: { type: string; label: string; id: string; sub?: string }[] = []
    clients.forEach(c => {
      const r = c as R
      const name = `${r.prenom ?? ''} ${r.nom ?? ''}`.trim().toLowerCase()
      if (name.includes(q)) results.push({ type: 'Client', label: `${r.prenom ?? ''} ${r.nom ?? ''}`.trim(), id: r.id as string })
    })
    chantiers.forEach(ch => {
      const r = ch as R
      if ((r.titre as string)?.toLowerCase().includes(q)) results.push({ type: 'Chantier', label: r.titre as string, id: r.id as string })
    })
    intervenants.forEach(iv => {
      const r = iv as R
      const name = `${r.prenom ?? ''} ${r.nom ?? ''}`.trim().toLowerCase()
      if (name.includes(q)) results.push({ type: 'Intervenant', label: `${r.prenom ?? ''} ${r.nom ?? ''}`.trim(), id: r.id as string, sub: r.metier as string })
    })
    return results.slice(0, 8)
  }, [searchQuery, clients, chantiers, intervenants])

  // ── Filter ──
  const isFiltered = (intervention: R): boolean => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'conflict') return conflicts.has(intervention.id as string)
    return true
  }

  // ── Week nav ──
  const goToWeek = (date: Date) => setWeekStart(getMonday(date))
  const prevWeeks = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(getMonday(d)) }
  const nextWeeks = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(getMonday(d)) }
  const goToday = () => setWeekStart(getMonday(new Date()))

  // ── Panel ──
  const openPanel = (intervention: R) => { setPanelIntervention(intervention); setShowPanel(true) }
  const closePanel = () => { setShowPanel(false); setPanelIntervention(null) }

  // ── Conflict detection for custom slots ──
  const checkCreneauConflits = (ivId: string, dateStr: string, heureDebut: string, heureFin: string): string | null => {
    const existingOnDay = planningData.filter(p => {
      const rec = p as R
      return rec.intervenant_id === ivId && (rec.date_debut as string)?.split('T')[0] === dateStr
    })

    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    }

    const startMin = timeToMinutes(heureDebut)
    const endMin = timeToMinutes(heureFin)

    for (const item of existingOnDay) {
      const rec = item as R
      const creneauType = rec.creneau as string
      let existingStart = 0, existingEnd = 0

      if (creneauType === 'journee') {
        existingStart = timeToMinutes('08:00')
        existingEnd = timeToMinutes('17:00')
      } else if (creneauType === 'matin') {
        existingStart = timeToMinutes('08:00')
        existingEnd = timeToMinutes('12:00')
      } else if (creneauType === 'apres_midi') {
        existingStart = timeToMinutes('13:00')
        existingEnd = timeToMinutes('17:00')
      } else if (creneauType === 'creneau') {
        existingStart = timeToMinutes((rec.heure_debut as string) || '08:00')
        existingEnd = timeToMinutes((rec.heure_fin as string) || '17:00')
      }

      // Overlap check: not (endMin <= existingStart OR startMin >= existingEnd)
      if (!(endMin <= existingStart || startMin >= existingEnd)) {
        const chantier = chantierMap.get(rec.chantier_id as string) as R | undefined
        const chantierName = chantier ? `${chantier.titre}` : 'Chantier inconnu'
        return `Conflit détecté: ${existingStart}h-${existingEnd}h sur ${chantierName} (avertissement)`
      }
    }
    return null
  }

  // ── Modal ──
  const openModal = (dateStr?: string, intervenantId?: string, devisId?: string) => {
    // Solo mode: default to self-intervenant (pre-select silently, sélecteur caché)
    // Société mode: default to the intervenantId passed (from grid click) or empty
    const defaultIvId = intervenantId ?? (!isSociete ? (selfIntervenantId ?? (intervenants.length > 0 ? (intervenants[0] as R).id as string : '')) : '')
    setMDevis(''); setMClient(''); setMIntervenant(defaultIvId); setMChantier('')
    setMClientLibre(''); setMChantierLibre(''); setMTypeIntervention('')
    setMDate(dateStr ?? fmtISO(new Date())); setMDateFin(dateStr ?? fmtISO(new Date()))
    setMCreneau('journee'); setMObjet(''); setMNotes(''); setMStatut('planifie')
    setMHeureDebut('08:00'); setMHeureFin('17:00'); setMConflitWarning(null)
    setShowConflitConfirm(false); setConflitConfirmMessage('')
    setEditMode(false); setEditId(null)
    // Auto-fill from devis if provided
    if (devisId) {
      setMDevis(devisId)
      const devis = devisMap.get(devisId) as R | undefined
      if (devis) {
        if (devis.client_id) setMClient(devis.client_id as string)
        if (devis.chantier_id) setMChantier(devis.chantier_id as string)
        if (devis.objet) setMObjet(String(devis.objet))
      }
    }
    setShowModal(true)
  }

  // ── Open modal in EDIT mode ──
  const openEditModal = (intervention: R) => {
    const dateDebut = ((intervention.date_debut as string) ?? '').split('T')[0]
    const dateFin = ((intervention.date_fin as string) ?? dateDebut).split('T')[0]
    setEditMode(true)
    setEditId(intervention.id as string)
    setMDevis((intervention.devis_id as string) ?? '')
    setMClient((intervention.client_id as string) ?? '')
    setMIntervenant((intervention.intervenant_id as string) ?? '')
    setMChantier((intervention.chantier_id as string) ?? '')
    setMClientLibre((intervention.client_libre as string) ?? '')
    setMChantierLibre((intervention.chantier_libre as string) ?? '')
    setMTypeIntervention((intervention.type_intervention as string) ?? '')
    setMDate(dateDebut)
    setMDateFin(dateFin)
    setMCreneau((intervention.creneau as Creneau) ?? 'journee')
    setMObjet(String(intervention.titre ?? intervention.description_travaux ?? ''))
    setMNotes(String(intervention.notes ?? ''))
    setMStatut((intervention.statut as string) ?? 'planifie')
    setMHeureDebut(String(intervention.heure_debut ?? '08:00'))
    setMHeureFin(String(intervention.heure_fin ?? '17:00'))
    setMConflitWarning(null)
    setShowConflitConfirm(false); setConflitConfirmMessage('')
    setShowModal(true)
  }

  // ── Handle devis selection in modal ──
  const handleDevisChange = (devisId: string) => {
    setMDevis(devisId)
    if (devisId) {
      const devis = devisMap.get(devisId) as R | undefined
      if (devis) {
        if (devis.client_id) setMClient(devis.client_id as string)
        if (devis.chantier_id) setMChantier(devis.chantier_id as string)
        if (devis.objet) setMObjet(String(devis.objet))
      }
    } else {
      // Reset when deselecting devis
      setMClient(''); setMChantier(''); setMObjet('')
    }
  }

  // ── Helper: convert HH:MM to minutes ──
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  // ── Helper: get start/end minutes for a creneau type ──
  const creneauToRange = (creneauType: string, heureDebut?: string, heureFin?: string): [number, number] => {
    if (creneauType === 'journee') return [timeToMinutes('08:00'), timeToMinutes('17:00')]
    if (creneauType === 'matin') return [timeToMinutes('08:00'), timeToMinutes('12:00')]
    if (creneauType === 'apres_midi') return [timeToMinutes('13:00'), timeToMinutes('17:00')]
    // creneau personnalise
    return [timeToMinutes(heureDebut || '08:00'), timeToMinutes(heureFin || '17:00')]
  }

  // ── Detect conflicts for the new intervention before saving ──
  const detectConflitAvantSave = (
    ivId: string,
    dateStr: string,
    newStart: number,
    newEnd: number,
    excludeId?: string | null
  ): { titre: string; heureDebut: string; heureFin: string } | null => {
    const existingOnDay = planningData.filter(p => {
      const rec = p as R
      if (rec.intervenant_id !== ivId) return false
      if ((rec.date_debut as string)?.split('T')[0] !== dateStr) return false
      if (excludeId && rec.id === excludeId) return false
      return true
    })
    for (const item of existingOnDay) {
      const rec = item as R
      const [exStart, exEnd] = creneauToRange(
        rec.creneau as string,
        rec.heure_debut as string,
        rec.heure_fin as string
      )
      // Overlap: A.start < B.end AND B.start < A.end
      if (newStart < exEnd && exStart < newEnd) {
        const hd = String(rec.heure_debut || (rec.creneau === 'apres_midi' ? '13:00' : '08:00'))
        const hf = String(rec.heure_fin || (rec.creneau === 'matin' ? '12:00' : '17:00'))
        return {
          titre: String(rec.titre || rec.description_travaux || 'Intervention'),
          heureDebut: hd,
          heureFin: hf,
        }
      }
    }
    return null
  }

  const submitIntervention = async () => {
    if (!mIntervenant || !mDate) return

    // Garde-fou : verifier que l'annee n'est pas absurde (faute de frappe).
    // Limite a 4 chiffres et avertir si > annee courante + 2 ans.
    const yearStart = parseInt((mDate || '').split('-')[0] || '0', 10)
    const yearEnd = parseInt((mDateFin || mDate || '').split('-')[0] || '0', 10)
    const currentYear = new Date().getFullYear()
    if (yearStart > 9999 || yearEnd > 9999) {
      showToast('Annee invalide : 4 chiffres maximum')
      return
    }
    if ((yearStart > currentYear + 2 || yearEnd > currentYear + 2) && !showConflitConfirm) {
      const ok = confirm(`Cette intervention est planifiee en ${yearStart} (anormalement loin dans le futur). Etes-vous sur de la date ?`)
      if (!ok) return
    }

    // Si pas de description saisie, fallback automatique sur le titre du devis
    // ou sur "Intervention" pour ne pas bloquer la planification (utile pour
    // les depannages urgents ou demandes par telephone).
    let titreFinal = (mObjet || '').trim()
    if (!titreFinal) {
      const devisLie = mDevis ? (devisMap.get(mDevis) as R | undefined) : null
      titreFinal = String(devisLie?.objet ?? devisLie?.numero ?? 'Intervention')
    }

    // Validation du créneau personnalisé
    if (mCreneau === 'creneau') {
      if (!mHeureDebut || !mHeureFin) {
        showToast('Veuillez définir les heures de début et fin')
        return
      }
      if (mHeureFin <= mHeureDebut) {
        showToast('L\'heure de fin doit être après l\'heure de début')
        return
      }
    }

    // Calculer le creneau de la nouvelle intervention
    let startTime: string, endTime: string
    if (mCreneau === 'creneau') {
      startTime = mHeureDebut
      endTime = mHeureFin
    } else {
      startTime = mCreneau === 'apres_midi' ? '13:00' : '08:00'
      endTime = mCreneau === 'matin' ? '12:00' : '17:00'
    }

    // ── Verifier les conflits horaires AVANT d'enregistrer ──
    const ivRec = intervenantMap.get(mIntervenant) as R | undefined
    const ivNom = ivRec
      ? `${ivRec.prenom ?? ''} ${ivRec.nom ?? ''}`.trim()
      : 'L\'intervenant'

    const newStart = timeToMinutes(startTime)
    const newEnd = timeToMinutes(endTime)
    const conflitTrouve = detectConflitAvantSave(
      mIntervenant,
      mDate,
      newStart,
      newEnd,
      editMode ? editId : null
    )

    if (conflitTrouve && !showConflitConfirm) {
      // Show inline conflict warning — do not submit yet
      const conflitH = `${conflitTrouve.heureDebut.replace(':', 'h')} a ${conflitTrouve.heureFin.replace(':', 'h')}`
      setConflitConfirmMessage(
        `${ivNom} est deja sur "${conflitTrouve.titre}" de ${conflitH}. Voulez-vous quand meme ${editMode ? 'modifier' : 'creer'} cette intervention ?`
      )
      setShowConflitConfirm(true)
      return
    }
    // Reset confirm state before submitting (whether forced or no conflict)
    setShowConflitConfirm(false)
    setConflitConfirmMessage('')

    setSubmitting(true)
    try {
      // Effacer l'avertissement de conflit visuel si on force quand meme
      setMConflitWarning(null)

      const payload = {
        intervenant_id: mIntervenant,
        client_id: mClient || null,
        chantier_id: mChantier || null,
        // Saisie libre : utilisée uniquement si pas de client/chantier en base sélectionné.
        // On nettoie pour éviter de stocker à la fois un ID et un texte libre.
        client_libre: mClient ? null : (mClientLibre.trim() || null),
        chantier_libre: mChantier ? null : (mChantierLibre.trim() || null),
        type_intervention: mTypeIntervention || null,
        devis_id: mDevis || null,
        titre: titreFinal,
        description_travaux: titreFinal,
        date_debut: `${mDate}T${startTime}:00`,
        date_fin: `${mDateFin || mDate}T${endTime}:00`,
        heure_debut: startTime,
        heure_fin: endTime,
        creneau: mCreneau,
        statut: mStatut,
        notes: mNotes || null,
      }
      if (editMode && editId) {
        await updateRow('planning_interventions', editId, payload)
        setShowModal(false)
        setEditMode(false); setEditId(null)
        refetch()
        showToast('Intervention modifiee ✓')
      } else {
        await insertRow('planning_interventions', payload)
        setShowModal(false)
        refetch()
        showToast('Intervention creee ✓')
      }
    } catch {
      showToast('Erreur lors de la creation')
    } finally { setSubmitting(false) }
  }

  // ── Drag & Drop ──
  const handleDragStart = (id: string) => setDraggedId(id)
  const handleDragEnd = () => { setDraggedId(null); setDragOverCell(null) }
  const handleDrop = async (intervenantId: string, dateStr: string) => {
    if (!draggedId) return
    setDragOverCell(null)
    const intervention = planningData.find(p => (p as R).id === draggedId) as R
    if (!intervention) {
      setDraggedId(null)
      return
    }
    // Securite : refuser le drop sur samedi/dimanche si mode 5 jours
    // Parse manuel pour eviter les bugs timezone (new Date('2026-05-04') interprete comme UTC)
    const [yy, mm, dd] = dateStr.split('-').map(Number)
    const targetDate = new Date(yy, mm - 1, dd)
    const targetDay = targetDate.getDay() // 0 = dimanche, 6 = samedi
    if (!showWeekend && (targetDay === 0 || targetDay === 6)) {
      showToast('Activez le mode 7 jours pour planifier sur samedi/dimanche')
      setDraggedId(null)
      return
    }
    const startTime = (intervention.creneau as string) === 'apres_midi' ? '13:00' : '08:00'
    const endTime = (intervention.creneau as string) === 'matin' ? '12:00' : '17:00'
    try {
      await updateRow('planning_interventions', draggedId, {
        intervenant_id: intervenantId,
        date_debut: `${dateStr}T${startTime}:00`,
        date_fin: `${dateStr}T${endTime}:00`,
      })
      refetch()
      showToast('Intervention deplacee')
    } catch {
      showToast('Erreur lors du deplacement')
    }
    setDraggedId(null)
  }

  // ── Intervenants list ──
  // Solo mode: show self + any subcontractors (type_contrat = 'sous-traitant')
  // Société mode: show all active intervenants
  const displayedIntervenants = useMemo(() => {
    if (isSociete) {
      return intervenants.filter(iv => (iv as R).actif !== false)
    }
    // Solo mode: self + subcontractors
    const self = intervenants.slice(0, 1)
    const subcontractors = intervenants.filter(iv => (iv as R).type_contrat === 'sous-traitant' && (iv as R).actif !== false)
    return [...self, ...subcontractors]
  }, [intervenants, isSociete])

  // In Solo mode, check if there are any subcontractors (i.e., more than just self)
  const soloHasSubcontractors = !isSociete && displayedIntervenants.length > 1

  // ── Name helpers ──
  const ivName = (id: string) => {
    const iv = intervenantMap.get(id) as R | undefined
    return iv ? `${iv.prenom ?? ''} ${String(iv.nom ?? '').charAt(0)}.` : '—'
  }
  const ivFullName = (id: string) => {
    const iv = intervenantMap.get(id) as R | undefined
    return iv ? `${iv.prenom ?? ''} ${iv.nom ?? ''}`.trim() : '—'
  }
  const clName = (id: string) => {
    const cl = clientMap.get(id) as R | undefined
    return cl ? `${cl.prenom ?? ''} ${cl.nom ?? ''}`.trim() : ''
  }
  // BUG C FIX : récupère le nom du client soit directement,
  // soit via le chantier lié, soit retourne ''.
  // 28/05/2026 : fallback final sur client_libre (saisie libre pour visites/prospects).
  const clNameFromIntervention = (rec: R) => {
    if (rec.client_id) {
      const direct = clName(rec.client_id as string)
      if (direct) return direct
    }
    if (rec.chantier_id) {
      const ch = chantiers.find(c => (c as R).id === rec.chantier_id) as R | undefined
      if (ch && ch.client_id) {
        const fromChantier = clName(ch.client_id as string)
        if (fromChantier) return fromChantier
      }
    }
    if (rec.client_libre) return String(rec.client_libre)
    if (rec.chantier_libre) return String(rec.chantier_libre)
    return ''
  }

  // ── 12 months for annual view ──
  const annualMonths = useMemo(() => {
    const today = new Date()
    const months: { year: number; month: number; label: string; shortLabel: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        shortLabel: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() !== today.getFullYear() ? d.getFullYear() : ''}`.trim(),
      })
    }
    return months
  }, [])

  // ── 5 weeks for detail view (7 days if weekend shown) ──
  const DAY_LABELS_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const detailWeeks = useMemo(() => {
    const numDays = showWeekend ? 7 : 5
    const weeks: { start: Date; days: { label: string; date: Date; dateStr: string; isToday: boolean; isWeekend: boolean }[] }[] = []
    for (let w = 0; w < 5; w++) {
      const start = new Date(weekStart)
      start.setDate(start.getDate() + w * 7)
      const days: typeof weeks[0]['days'] = []
      for (let d = 0; d < numDays; d++) {
        const date = new Date(start)
        date.setDate(date.getDate() + d)
        days.push({ label: DAY_LABELS_WEEK[d], date, dateStr: fmtISO(date), isToday: isSameDay(date, new Date()), isWeekend: d >= 5 })
      }
      weeks.push({ start, days })
    }
    return weeks
  }, [weekStart, showWeekend])

  // ── Loading ──
  if (loading) return <div className="p-8"><LoadingSkeleton /></div>

  const today = new Date()
  const todayStr = fmtISO(today)

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-[#e6ecf2] px-3 sm:px-6 py-3 sm:py-3.5 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-[#0f1a3a] tracking-tight font-jakarta shrink-0">
              {isSociete ? 'Planning' : 'Planning'}
            </h1>
            {/* Profile toggle — hidden when profile is filled, auto-detected */}
            {profilRempli ? (
              <div className="hidden sm:flex items-center gap-1.5 bg-[#f6f8fb] rounded-full px-3 py-1.5 text-xs font-semibold text-[#64748b]">
                <span className="text-[#0f1a3a]">{isSociete ? 'Société' : 'Solo'}</span>
              </div>
            ) : (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-[#f6f8fb] rounded-full px-3 py-1.5 text-xs font-semibold text-[#64748b]">
                  <span className={!isSociete ? 'text-[#0f1a3a]' : ''}>Solo</span>
                  <button onClick={() => setIsSociete(!isSociete)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${isSociete ? 'bg-[#e87a2a]' : 'bg-[#5ab4e0]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isSociete ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <span className={isSociete ? 'text-[#0f1a3a]' : ''}>Société</span>
                </div>
                {/* Mobile solo/société compact toggle */}
                <button onClick={() => setIsSociete(!isSociete)}
                  className={`sm:hidden w-8 h-4 rounded-full relative transition-colors ${isSociete ? 'bg-[#e87a2a]' : 'bg-[#5ab4e0]'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isSociete ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View preset — hidden on mobile */}
            <div className="hidden sm:flex bg-[#f6f8fb] rounded-xl p-1 gap-0.5">
              {([
                { key: 'complete' as ViewPreset, label: 'Complète' },
                { key: 'planning' as ViewPreset, label: '5 semaines' },
                { key: 'annual' as ViewPreset, label: 'Annuel' },
              ]).map(v => (
                <button key={v.key} onClick={() => setViewPreset(v.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewPreset === v.key ? 'bg-white text-[#0f1a3a] shadow-sm' : 'text-[#64748b] hover:text-[#0f1a3a]'}`}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* Historique button */}
            <button
              onClick={() => router.push('/dashboard/planning/historique')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-[#e6ecf2] text-[#64748b] bg-white hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all"
            >
              Historique
            </button>

            {/* Search — hidden on mobile */}
            <div ref={searchRef} className="relative hidden sm:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7b8ba3] pointer-events-none" />
              <input type="text" placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (e.target.value.length >= 2) setSearchOpen(true); else setSearchOpen(false) }}
                onFocus={() => { if (searchQuery.length >= 2) setSearchOpen(true) }}
                className="w-full pl-10 pr-4 py-2 border border-[#e6ecf2] rounded-xl text-sm font-medium text-[#1e293b] bg-[#f6f8fb] focus:border-[#5ab4e0] focus:bg-white focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3]" />
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-[#e6ecf2] rounded-xl shadow-lg max-h-72 overflow-y-auto z-50">
                  {searchResults.map((r, i) => (
                    <button key={i} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#f6f8fb] transition-colors text-left border-b border-[#e6ecf2] last:border-b-0"
                      onClick={() => setSearchOpen(false)}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.type === 'Client' ? 'bg-[#e8f4fb] text-[#2d8bc9]' : r.type === 'Chantier' ? 'bg-[#fef3e8] text-[#e87a2a]' : 'bg-[#ede9fe] text-[#7c3aed]'}`}>{r.type}</span>
                      <div>
                        <div className="text-sm font-semibold text-[#1e293b]">{r.label}</div>
                        {r.sub && <div className="text-xs text-[#7b8ba3]">{r.sub}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New intervention */}
            <button onClick={() => openModal()}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-[#e87a2a] to-[#f09050] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-[0_4px_15px_rgba(232,122,42,.3)] hover:shadow-[0_6px_20px_rgba(232,122,42,.4)] hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouvelle intervention</span><span className="sm:hidden">Ajouter</span>
            </button>
          </div>
        </div>

        {/* Stats + Filters row */}
        <div className="flex items-center justify-between mt-2 sm:mt-3 overflow-x-auto">
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <MiniStat icon={<CalendarDays className="w-4 h-4" />} label="Interventions" value={stats.interventions} color="text-[#5ab4e0]" />
            <MiniStat icon={<Briefcase className="w-4 h-4" />} label="Chantiers" value={stats.chantiers} color="text-[#e87a2a]" />
            {isSociete && <MiniStat icon={<Clock className="w-4 h-4" />} label="Occupation" value={`${stats.occupation}%`} color="text-[#22c55e]" />}
            {unplannedDevis.length > 0 && <MiniStat icon={<FileText className="w-4 h-4" />} label="À planifier" value={unplannedDevis.length} color="text-[#7c3aed]" />}
            {isSociete && stats.conflicts > 0 && (
              <button onClick={() => setActiveFilter(activeFilter === 'conflict' ? 'all' : 'conflict')} className="cursor-pointer">
                <MiniStat icon={<AlertTriangle className="w-4 h-4" />} label="Conflits" value={stats.conflicts} color="text-[#ef4444]" />
              </button>
            )}
          </div>
          {isSociete && (
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all' as FilterType, label: 'Tous' },
                { key: 'conflict' as FilterType, label: 'Conflits' },
              ]).map(f => (
                <button key={f.key} onClick={() => setActiveFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${activeFilter === f.key ? 'bg-[#5ab4e0] text-white border-[#5ab4e0]' : 'bg-white text-[#64748b] border-[#e6ecf2] hover:border-[#5ab4e0]'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="px-3 sm:px-6 py-3 sm:py-4 space-y-4">

        {/* ════════════════════════════════════════════════════════════
            BANNIERE "INTERVENTIONS CACHEES SUR WEEKEND" (mode 5 jours)
        ════════════════════════════════════════════════════════════ */}
        {!showWeekend && (() => {
          const weekendCount = planningData.filter(p => {
            const d = new Date((p as R).date_debut as string).getDay()
            return d === 0 || d === 6
          }).length
          if (weekendCount === 0) return null
          return (
            <div className="bg-[#fff7ed] border-2 border-[#fdba74] rounded-2xl px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#e87a2a] shrink-0" />
                <p className="text-sm font-bold text-[#9a3412]">
                  {weekendCount} intervention{weekendCount > 1 ? 's' : ''} planifiee{weekendCount > 1 ? 's' : ''} le weekend, masquee{weekendCount > 1 ? 's' : ''} en mode 5 jours
                </p>
              </div>
              <button
                onClick={() => setShowWeekend(true)}
                className="px-4 py-1.5 bg-[#e87a2a] text-white text-xs font-bold rounded-full shadow-sm hover:bg-[#f09050] transition-all"
              >
                Afficher 7 jours
              </button>
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════════════════
            BANNIÈRE "À PLANIFIER" — Devis acceptés non planifiés
        ══════════════════════════════════════════════════════════════ */}
        {unplannedDevis.length > 0 && (
          <div id="a-planifier" className="bg-gradient-to-r from-[#7c3aed]/[.06] to-[#5ab4e0]/[.06] border border-[#7c3aed]/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#7c3aed]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#7c3aed]" />
                <h2 className="text-[14px] font-extrabold text-[#0f1a3a]">Devis acceptés — À planifier</h2>
                <span className="text-[11px] font-bold bg-[#7c3aed] text-white px-2 py-0.5 rounded-full">{unplannedDevis.length}</span>
              </div>
            </div>
            <div className="p-4 flex gap-3 overflow-x-auto">
              {unplannedDevis.map(devis => {
                const cl = clientMap.get(devis.client_id as string) as R | undefined
                const clientName = cl
                  ? `${cl.prenom ?? ''} ${cl.nom ?? ''}`.trim()
                  : (devis.notes_client as string)?.split(' | ')[0]?.trim() || (devis.objet as string)?.split(' ').slice(0, 4).join(' ') || 'Sans client'
                const ch = chantierMap.get(devis.chantier_id as string) as R | undefined
                return (
                  <div key={devis.id as string}
                    className="min-w-[260px] bg-white rounded-xl border border-[#e6ecf2] p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:border-[#7c3aed]/40 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#7c3aed] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full">
                        {String(devis.numero ?? '')}
                      </span>
                      <span className="text-[11px] font-bold text-[#22c55e]">
                        {Number(devis.montant_ttc ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                    <div className="text-[13px] font-bold text-[#0f1a3a]">{clientName}</div>
                    <div className="text-[11px] text-[#64748b] leading-snug line-clamp-2">{String(devis.objet ?? '')}</div>
                    {ch && <div className="flex items-center gap-1 text-[10px] text-[#7b8ba3]">
                      <MapPin className="w-3 h-3" />{String(ch.adresse_chantier ?? ch.ville_chantier ?? ch.titre ?? '')}
                    </div>}
                    <button onClick={() => openModal(undefined, undefined, devis.id as string)}
                      className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-[11px] font-bold transition-all shadow-sm">
                      <CalendarDays className="w-3.5 h-3.5" />Planifier
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PANNEAU DÉTAIL — 5 SEMAINES
        ══════════════════════════════════════════════════════════════ */}
        {!detailCollapsed && (
          <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e6ecf2] flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#e87a2a]" />
                  <h2 className="text-[15px] font-extrabold text-[#0f1a3a]">Planning détaillé</h2>
                </div>
                <span className="text-xs text-[#7b8ba3] font-medium">
                  Semaine {getWeekNumber(weekStart)} → {getWeekNumber(detailWeeks[4]?.start ?? weekStart)}
                </span>
                <button
                  onClick={() => setShowWeekend(!showWeekend)}
                  className={`flex items-center gap-2 bg-[#f6f8fb] rounded-full px-3 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#eef2f7] transition-colors`}
                  title="Afficher samedi et dimanche"
                >
                  <span className={!showWeekend ? 'text-[#0f1a3a]' : ''}>5 jours</span>
                  <span className={`w-9 h-5 rounded-full relative transition-colors ${showWeekend ? 'bg-[#e87a2a]' : 'bg-[#5ab4e0]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showWeekend ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                  <span className={showWeekend ? 'text-[#0f1a3a]' : ''}>7 jours</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={goToday} className="px-3 py-1 text-[11px] font-semibold text-[#5ab4e0] bg-[#e8f4fb] rounded-lg hover:bg-[#5ab4e0] hover:text-white transition-all">
                  Aujourd&apos;hui
                </button>
                <button onClick={prevWeeks} className="w-7 h-7 flex items-center justify-center border border-[#e6ecf2] rounded-lg text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={nextWeeks} className="w-7 h-7 flex items-center justify-center border border-[#e6ecf2] rounded-lg text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {viewPreset === 'complete' && (
                  <button onClick={() => setDetailCollapsed(true)} className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#5ab4e0] transition-all font-semibold ml-2">
                    <Minimize2 className="w-3.5 h-3.5" />Réduire
                  </button>
                )}
              </div>
            </div>

            {/* 5 weeks grid */}
            <div className="divide-y divide-[#e6ecf2] overflow-x-auto">
              {detailWeeks.map((week, wi) => {
                const weekNum = getWeekNumber(week.start)
                const weekEnd = new Date(week.start)
                weekEnd.setDate(weekEnd.getDate() + (showWeekend ? 6 : 4))
                const isCurrentWeek = week.days.some(d => d.isToday)

                return (
                  <div key={wi}>
                    {/* Week header — split into Artisan label + week info over days (Société only) */}
                    {isSociete || soloHasSubcontractors ? (
                      <div className={`grid ${isSociete ? 'grid-cols-[220px_1fr]' : 'grid-cols-[180px_1fr]'}`}>
                        {/* Left: Artisan column header */}
                        <div className={`px-4 py-2 flex items-center gap-1.5 border-r border-[#e6ecf2] ${isCurrentWeek ? 'bg-[#5ab4e0]/[.06]' : 'bg-[#f0f2f7]'}`}>
                          <Users className="w-3.5 h-3.5 text-[#7b8ba3]" />
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7b8ba3]">Intervenants</span>
                        </div>
                        {/* Right: Week info above the day columns */}
                        <div className={`px-4 py-2 flex items-center gap-2 text-xs font-bold ${isCurrentWeek ? 'bg-[#5ab4e0]/[.06] text-[#5ab4e0]' : 'bg-[#f6f8fb] text-[#7b8ba3]'}`}>
                          <span>S{weekNum}</span>
                          <span className="font-medium">{week.start.getDate()} — {weekEnd.getDate()} {MONTHS[weekEnd.getMonth()]}</span>
                          {isCurrentWeek && <span className="text-[10px] bg-[#5ab4e0] text-white px-2 py-0.5 rounded-full font-bold">Cette semaine</span>}
                        </div>
                      </div>
                    ) : (
                      <div className={`px-4 py-2 flex items-center gap-2 text-xs font-bold ${isCurrentWeek ? 'bg-[#5ab4e0]/[.06] text-[#5ab4e0]' : 'bg-[#f6f8fb] text-[#7b8ba3]'}`}>
                        <span>S{weekNum}</span>
                        <span className="font-medium">{week.start.getDate()} — {weekEnd.getDate()} {MONTHS[weekEnd.getMonth()]}</span>
                        {isCurrentWeek && <span className="text-[10px] bg-[#5ab4e0] text-white px-2 py-0.5 rounded-full font-bold">Cette semaine</span>}
                      </div>
                    )}

                    {/* Grid: intervenants × days (5 or 7 depending on showWeekend) */}
                    {/* Solo mode: hide artisan column if no subcontractors (full width days); show column if subcontractors exist (reduced width) */}
                    <div className={`grid min-w-max ${
                      isSociete
                        ? showWeekend ? 'grid-cols-[220px_repeat(7,1fr)]' : 'grid-cols-[220px_repeat(5,1fr)]'
                        : soloHasSubcontractors
                          ? showWeekend ? 'grid-cols-[180px_repeat(7,minmax(200px,1fr))]' : 'grid-cols-[180px_repeat(5,minmax(200px,1fr))]'
                          : showWeekend ? 'grid-cols-[repeat(7,minmax(200px,1fr))]' : 'grid-cols-[repeat(5,minmax(200px,1fr))]'
                    }`}>
                      {/* Day headers — with strong bottom border as separator */}
                      {(isSociete || soloHasSubcontractors) && <div className="bg-[#f0f2f7]/60 border-r border-[#e6ecf2] border-b-2 border-b-[#d0d7e2]" />}
                      {week.days.map(day => (
                        <div key={day.dateStr} className={`px-2 py-2 text-center border-r border-[#e6ecf2] last:border-r-0 border-b-2 border-b-[#d0d7e2] ${day.isToday ? 'bg-[#5ab4e0]/[.04]' : day.isWeekend ? 'bg-[#fafbfd]' : ''}`}>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${day.isToday ? 'text-[#5ab4e0]' : day.isWeekend ? 'text-[#94a3b8]' : 'text-[#7b8ba3]'}`}>
                            {day.label} {day.date.getDate()}
                          </div>
                          {day.isWeekend && <div className="text-[8px] text-[#c0cad8] font-medium mt-0.5">Weekend</div>}
                        </div>
                      ))}

                      {/* Intervenant rows */}
                      {displayedIntervenants.map(iv => {
                        const r = iv as R
                        const ivId = r.id as string
                        const color = colorMap.get(ivId) ?? PALETTE[0]

                        return (
                          <div key={`${wi}-${ivId}`} className="contents">
                            {/* Label — hidden in Solo mode without subcontractors */}
                            {(isSociete || soloHasSubcontractors) && (
                              <div className="px-3 py-2.5 border-r border-b border-[#e6ecf2] bg-[#f0f2f7]/50 flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: color.hex }}>
                                  {initials(`${r.prenom ?? ''} ${r.nom ?? ''}`)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-syne font-bold text-[#0f1a3a] truncate">
                                    {isSociete ? `${String(r.prenom ?? '')} ${String(r.nom ?? '').charAt(0)}.` : String(r.prenom ?? '')}
                                  </div>
                                  <div className="text-[11px] text-[#5ab4e0] font-semibold truncate bg-[#e8f4fb] px-2 py-0.5 rounded-md inline-block mt-0.5">
                                    {String(r.metier ?? '')}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Day cells */}
                            {week.days.map(day => {
                              const cellKey = `${ivId}__${day.dateStr}`
                              const interventions = planningMap.get(cellKey) ?? []
                              const isDragOver = dragOverCell === cellKey

                              return (
                                <div key={cellKey}
                                  className={`min-h-[90px] px-1.5 py-1 border-r border-b border-[#e6ecf2] last:border-r-0 relative group transition-all ${day.isToday ? 'bg-[#5ab4e0]/[.03]' : day.isWeekend ? 'bg-[#fafbfd]' : ''} ${isDragOver ? 'bg-[#5ab4e0]/10 outline-2 outline-dashed outline-[#5ab4e0] outline-offset-[-2px]' : ''}`}
                                  onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey) }}
                                  onDragLeave={() => setDragOverCell(null)}
                                  onDrop={e => { e.preventDefault(); handleDrop(ivId, day.dateStr) }}>

                                  <div className="flex flex-col gap-0.5">
                                    {interventions.filter(isFiltered).map(item => {
                                      const rec = item as R
                                      const isConflict = conflicts.has(rec.id as string)
                                      const isDragged = draggedId === rec.id as string
                                      const statut = STATUTS.find(s => s.value === rec.statut)
                                      const isCreneau = (rec.creneau as string) === 'creneau'
                                      const heureDebut = rec.heure_debut as string || '08:00'
                                      const heureFin = rec.heure_fin as string || '17:00'

                                      // Hauteur proportionnelle pour créneaux (base 60px pour 480min journée)
                                      let heightPx = 0
                                      let timeDisplay = ''
                                      if (isCreneau) {
                                        const startMin = parseInt(heureDebut.split(':')[0]) * 60 + parseInt(heureDebut.split(':')[1])
                                        const endMin = parseInt(heureFin.split(':')[0]) * 60 + parseInt(heureFin.split(':')[1])
                                        const durationMin = endMin - startMin
                                        heightPx = Math.max(40, Math.round((durationMin / 480) * 60))
                                        timeDisplay = `${heureDebut}–${heureFin}`
                                      }

                                      return (
                                        <div key={rec.id as string}
                                          draggable
                                          onDragStart={() => handleDragStart(rec.id as string)}
                                          onDragEnd={handleDragEnd}
                                          onClick={() => openPanel(rec)}
                                          className={`relative p-2 rounded-lg mb-1 cursor-grab active:cursor-grabbing transition-all border-l-[3px] leading-normal ${color.bg} ${color.border} ${color.text}
                                            ${isDragged ? 'opacity-30' : ''} ${isConflict ? 'ring-2 ring-[#ef4444] shadow-[0_0_0_2px_rgba(239,68,68,0.15)]' : ''} hover:shadow-md hover:scale-[1.01]`}
                                          style={isCreneau ? { minHeight: `${heightPx}px` } : {}}
                                          title={isConflict ? 'Conflit : cet intervenant a une autre intervention sur le meme creneau' : undefined}>
                                          {isConflict && (
                                            <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-[#ef4444] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                                              <AlertTriangle className="w-3 h-3" />
                                              <span>Conflit</span>
                                            </div>
                                          )}
                                          {isCreneau && (
                                            <div className="text-[10px] font-extrabold text-[#0f1a3a] leading-tight">
                                              {timeDisplay}
                                            </div>
                                          )}
                                          {statut && (
                                            <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded ${statut.color} float-right ml-1`}>
                                              {statut.label}
                                            </span>
                                          )}
                                          {!isCreneau && (
                                            <div className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                                              {creneauLabel(rec.creneau as string)}
                                            </div>
                                          )}
                                          {clNameFromIntervention(rec) && <div className="font-extrabold text-[10px] mt-0.5">{clNameFromIntervention(rec)}</div>}
                                          <div className="text-xs font-medium opacity-80 mt-1 pr-2 line-clamp-3 leading-snug">{String(rec.titre ?? rec.description_travaux ?? '—')}</div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Add button */}
                                  <button onClick={() => openModal(day.dateStr, ivId)}
                                    className="w-full h-6 border border-dashed border-[#5ab4e0]/20 rounded text-[#5ab4e0] text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[#5ab4e0]/[.06] hover:border-[#5ab4e0] transition-all pointer-events-none group-hover:pointer-events-auto">
                                    +
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Collapsed detail bar */}
        {detailCollapsed && viewPreset === 'complete' && (
          <button onClick={() => setDetailCollapsed(false)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-[#e6ecf2] rounded-xl text-xs font-semibold text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">
            <Maximize2 className="w-3.5 h-3.5" />Afficher le planning détaillé
          </button>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PANNEAU ANNUEL — 12 MOIS
        ══════════════════════════════════════════════════════════════ */}
        {!annualCollapsed && (
          <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e6ecf2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#5ab4e0]" />
                <h2 className="text-[15px] font-extrabold text-[#0f1a3a]">Vue annuelle — 12 prochains mois</h2>
              </div>
              <button onClick={() => setAnnualCollapsed(true)} className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#5ab4e0] transition-all font-semibold">
                <Minimize2 className="w-3.5 h-3.5" />Réduire
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {annualMonths.map(m => {
                const days = getDaysInMonth(m.year, m.month)
                const offset = getFirstDayOffset(m.year, m.month)
                const isCurrentMonth = m.year === today.getFullYear() && m.month === today.getMonth()

                return (
                  <div key={`${m.year}-${m.month}`} className={`rounded-xl border p-3 transition-all ${isCurrentMonth ? 'border-[#5ab4e0] bg-[#5ab4e0]/[.03]' : 'border-[#e6ecf2] hover:border-[#5ab4e0]/40'}`}>
                    <div className="text-[12px] font-bold text-[#0f1a3a] mb-2">{m.label}</div>
                    {/* Day labels */}
                    <div className="grid grid-cols-7 gap-px mb-1">
                      {DAYS_SHORT.map((d, i) => (
                        <div key={i} className="text-[9px] font-bold text-[#7b8ba3] text-center">{d}</div>
                      ))}
                    </div>
                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-px">
                      {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} className="h-[18px]" />)}
                      {days.map(day => {
                        const dateStr = fmtISO(day)
                        const dayInterventions = planningByDate.get(dateStr) ?? []
                        const count = dayInterventions.length
                        const isToday = dateStr === todayStr
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6
                        const hasConflict = dayInterventions.some(iv => conflicts.has((iv as R).id as string))

                        // Heat color
                        let bgCls = ''
                        if (count === 0) bgCls = isWeekend ? 'bg-[#f1f5f9]' : 'bg-white'
                        else if (count === 1) bgCls = 'bg-[#dcf0fa]'
                        else if (count === 2) bgCls = 'bg-[#93d1f0]'
                        else if (count <= 4) bgCls = 'bg-[#e87a2a]/30'
                        else bgCls = 'bg-[#ef4444]/30'

                        return (
                          <button key={dateStr}
                            onClick={() => { goToWeek(day); if (viewPreset === 'annual') setViewPreset('complete') }}
                            className={`h-[18px] rounded-[3px] flex items-center justify-center text-[8px] font-bold transition-all hover:ring-1 hover:ring-[#5ab4e0] ${bgCls} ${isToday ? 'ring-2 ring-[#5ab4e0] text-[#5ab4e0]' : 'text-[#64748b]'} ${hasConflict ? 'ring-2 ring-[#ef4444]' : ''}`}
                            title={hasConflict ? `⚠ Conflit — ${count} interventions` : count > 0 ? `${count} intervention${count > 1 ? 's' : ''}` : undefined}>
                            {hasConflict ? '⚠' : day.getDate()}
                          </button>
                        )
                      })}
                    </div>
                    {/* Monthly summary */}
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-[#7b8ba3] font-medium">
                        {(() => {
                          const monthDays = days.map(d => fmtISO(d))
                          const total = monthDays.reduce((sum, ds) => sum + (planningByDate.get(ds)?.length ?? 0), 0)
                          return `${total} intervention${total !== 1 ? 's' : ''}`
                        })()}
                      </span>
                      <button onClick={() => openModal(fmtISO(new Date(m.year, m.month, 15)))}
                        className="flex items-center gap-0.5 text-[#5ab4e0] hover:text-[#2d8bc9] font-semibold transition-all">
                        <Plus className="w-3 h-3" />Ajouter
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="px-5 pb-3 flex items-center gap-4 text-[10px] text-[#7b8ba3] font-medium">
              <span>Charge :</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-white border border-[#e6ecf2]" />Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#dcf0fa]" />1</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#93d1f0]" />2</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#e87a2a]/30" />3-4</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#ef4444]/30" />5+</span>
            </div>
          </div>
        )}

        {/* Collapsed annual bar */}
        {annualCollapsed && viewPreset === 'complete' && (
          <button onClick={() => setAnnualCollapsed(false)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-[#e6ecf2] rounded-xl text-xs font-semibold text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">
            <Maximize2 className="w-3.5 h-3.5" />Afficher la vue annuelle
          </button>
        )}
      </div>

      {/* ── SIDE PANEL ── */}
      {showPanel && panelIntervention && (
        <>
          <div className="fixed inset-0 bg-[#0f1a3a]/20 z-40" onClick={closePanel} />
          <aside className="fixed top-0 right-0 w-full sm:w-[420px] h-full bg-white shadow-[-8px_0_40px_rgba(15,26,58,.12)] z-50 flex flex-col animate-[slideIn_.3s_ease]">
            <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-extrabold text-[#0f1a3a]">Détail intervention</h2>
              <button onClick={closePanel} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f6f8fb] text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Chantier */}
              {Boolean(panelIntervention.chantier_id) && (() => {
                const ch = chantierMap.get(panelIntervention.chantier_id as string) as R | undefined
                if (!ch) return null
                return (
                  <div className="px-5 py-4 border-b border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Chantier</div>
                    <div className="text-[17px] font-extrabold text-[#0f1a3a]">{String(ch.titre ?? '')}</div>
                    {Boolean(ch.adresse_chantier) && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[13px] text-[#64748b]">
                        <MapPin className="w-3.5 h-3.5 text-[#7b8ba3]" />
                        {String(ch.adresse_chantier ?? '')}, {String(ch.ville_chantier ?? '')}
                      </div>
                    )}
                    <button onClick={() => { closePanel(); router.push(`/dashboard/chantiers/${ch.id}`) }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5ab4e0] text-white rounded-xl text-sm font-semibold hover:bg-[#2d8bc9] transition-all">
                      <Eye className="w-4 h-4" />Voir le chantier
                    </button>
                  </div>
                )
              })()}
              {/* Client */}
              {Boolean(panelIntervention.client_id) && (() => {
                const cl = clientMap.get(panelIntervention.client_id as string) as R | undefined
                if (!cl) return null
                return (
                  <div className="px-5 py-4 border-b border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Client</div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0f1a3a] text-white flex items-center justify-center text-sm font-bold">
                        {initials(`${cl.prenom ?? ''} ${cl.nom ?? ''}`)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0f1a3a]">{String(cl.prenom ?? '')} {String(cl.nom ?? '')}</div>
                        {Boolean(cl.telephone) && (
                          <a href={`tel:${String(cl.telephone)}`} className="text-[13px] text-[#5ab4e0] font-medium hover:underline">{String(cl.telephone)}</a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
              {/* Intervention details */}
              <div className="px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Intervention</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-[#7b8ba3] mb-1">Intervenant</div>
                    <span className="text-[13px] font-semibold">{ivFullName(panelIntervention.intervenant_id as string)}</span>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7b8ba3] mb-1">Créneau</div>
                    <div className="text-[13px] font-semibold">
                      {creneauLabel(panelIntervention.creneau as string)}
                      {(panelIntervention.creneau as string) === 'creneau' && (
                        <span className="text-[12px] text-[#5ab4e0] ml-2">
                          {String(panelIntervention.heure_debut ?? '—')} – {String(panelIntervention.heure_fin ?? '—')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[11px] text-[#7b8ba3] mb-1">Travaux</div>
                    <div className="text-[13px] leading-relaxed">{String(panelIntervention.titre ?? panelIntervention.description_travaux ?? '—')}</div>
                  </div>
                  {Boolean(panelIntervention.notes) && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-[#7b8ba3] mb-1">Notes</div>
                      <div className="text-[13px] leading-relaxed text-[#64748b]">{String(panelIntervention.notes)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* === Notes datées (V2) : présence client, préparation, rappels privés === */}
              <div className="px-5 py-4 border-t border-[#e6ecf2]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#5ab4e0]">
                    Rappels & notes pour ce jour
                  </h3>
                </div>
                <NotesIntervention interventionId={panelIntervention.id as string} />
              </div>
            </div>

            {/* Actions en bas du panel */}
            <div className="px-5 py-4 border-t border-[#e6ecf2] flex-shrink-0 space-y-2">
              {/* Modifier */}
              <button
                onClick={() => { closePanel(); openEditModal(panelIntervention) }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5ab4e0]/10 border border-[#5ab4e0]/30 text-[#1a6fb5] text-sm font-manrope font-semibold hover:bg-[#5ab4e0]/20 transition"
              >
                <Pencil className="w-4 h-4" /> Modifier
              </button>
              {/* Statut */}
              <div className="flex gap-2">
                {panelIntervention.statut !== 'termine' && (
                  <button
                    onClick={async () => {
                      await updateRow('planning_interventions', panelIntervention.id as string, { statut: 'termine' })
                      showToast('Intervention terminée ✓')
                      closePanel()
                      refetch()
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-100 transition-all"
                  >
                    <Check className="w-4 h-4" />Terminée
                  </button>
                )}
                {panelIntervention.statut === 'termine' && (
                  <button
                    onClick={async () => {
                      await updateRow('planning_interventions', panelIntervention.id as string, { statut: 'planifie' })
                      showToast('Intervention replanifiée ✓')
                      closePanel()
                      refetch()
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-all"
                  >
                    <Clock className="w-4 h-4" />Replanifier
                  </button>
                )}
              </div>
              {/* Supprimer */}
              <button
                onClick={async () => {
                  if (!confirm('Supprimer cette intervention ?')) return
                  try {
                    await deleteRow('planning_interventions', panelIntervention.id as string)
                    showToast('Intervention supprimée ✓')
                    closePanel()
                    refetch()
                  } catch (err) {
                    showToast('Erreur lors de la suppression')
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />Supprimer l&apos;intervention
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── MODAL: New Intervention ── */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0f1a3a]/35 z-50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditMode(false); setEditId(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-[540px] mx-4 max-h-[85vh] overflow-y-auto shadow-lg animate-[modalIn_.3s_ease]">
            <div className="px-6 py-5 border-b border-[#e6ecf2] flex items-center justify-between">
              <h3 className="text-[17px] font-extrabold text-[#0f1a3a]">{editMode ? "Modifier l'intervention" : 'Nouvelle intervention'}</h3>
              <button onClick={() => { setShowModal(false); setEditMode(false); setEditId(null) }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f6f8fb] text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Devis lié — sélection auto-remplit client, chantier, description */}
              <div>
                <label className="text-xs font-bold text-[#7c3aed] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />Lier à un devis accepté
                </label>
                <select value={mDevis} onChange={e => handleDevisChange(e.target.value)} className="w-full px-3.5 py-2.5 border border-[#7c3aed]/30 rounded-xl text-sm bg-[#7c3aed]/[.03] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10 outline-none transition-all">
                  <option value="">— Intervention libre (visite, contrôle, RDV…)</option>
                  {acceptedDevis.map(d => {
                    const cl = clientMap.get(d.client_id as string) as R | undefined
                    const clientLabel = cl ? `${cl.prenom ?? ''} ${cl.nom ?? ''}`.trim() : ''
                    return <option key={d.id as string} value={d.id as string}>{String(d.numero ?? '')} — {clientLabel} — {String(d.objet ?? '')}</option>
                  })}
                </select>
                {mDevis && (() => {
                  const devis = devisMap.get(mDevis) as R | undefined
                  if (!devis) return null
                  const cl = clientMap.get(devis.client_id as string) as R | undefined
                  const ch = chantierMap.get(devis.chantier_id as string) as R | undefined
                  return (
                    <div className="mt-2 bg-[#7c3aed]/[.04] border border-[#7c3aed]/15 rounded-lg px-3.5 py-2.5 space-y-1">
                      {cl && <div className="flex items-center gap-1.5 text-[12px]">
                        <Users className="w-3 h-3 text-[#7c3aed]" />
                        <span className="font-bold text-[#0f1a3a]">{String(cl.prenom ?? '')} {String(cl.nom ?? '')}</span>
                        {Boolean(cl.telephone) && <span className="text-[#64748b] ml-1">— {String(cl.telephone)}</span>}
                      </div>}
                      {ch && <div className="flex items-center gap-1.5 text-[12px]">
                        <MapPin className="w-3 h-3 text-[#7c3aed]" />
                        <span className="text-[#64748b]">{String(ch.adresse_chantier ?? '')} {String(ch.ville_chantier ?? '')}</span>
                      </div>}
                      <div className="flex items-center gap-1.5 text-[12px]">
                        <Briefcase className="w-3 h-3 text-[#7c3aed]" />
                        <span className="text-[#64748b]">{String(devis.objet ?? '')}</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#22c55e]">
                        {Number(devis.montant_ttc ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Intervenant + Créneau */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* Mode Société : sélecteur complet */}
                  {isSociete && (
                    <>
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Intervenant *</label>
                      <select value={mIntervenant} onChange={e => { setMIntervenant(e.target.value); setShowConflitConfirm(false); setConflitConfirmMessage('') }} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" required>
                        <option value="">— Choisir</option>
                        {intervenants.map(iv => { const r = iv as R; return <option key={r.id as string} value={r.id as string}>{String(r.prenom ?? '')} {String(r.nom ?? '')} — {String(r.metier ?? '')}</option> })}
                      </select>
                    </>
                  )}

                  {/* Mode Solo sans sous-traitants : badge read-only "Vous" */}
                  {!isSociete && !soloHasSubcontractors && (
                    <>
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Intervenant</label>
                      <div className="w-full px-3.5 py-2.5 border border-[#5ab4e0]/30 rounded-xl text-sm bg-[#5ab4e0]/[.04] text-[#1a6fb5] font-semibold flex items-center gap-2">
                        <HardHat className="w-3.5 h-3.5 text-[#5ab4e0]" />
                        Vous (artisan)
                      </div>
                    </>
                  )}

                  {/* Mode Solo avec sous-traitants : toggle Moi / sous-traitant */}
                  {!isSociete && soloHasSubcontractors && (
                    <>
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Intervenant *</label>
                      <select value={mIntervenant} onChange={e => { setMIntervenant(e.target.value); setShowConflitConfirm(false); setConflitConfirmMessage('') }} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" required>
                        {displayedIntervenants.map((iv) => {
                          const r = iv as R
                          const isMe = r.id === selfIntervenantId
                          const label = isMe ? 'Moi (artisan)' : `${String(r.prenom ?? '')} ${String(r.nom ?? '')}`.trim()
                          return <option key={r.id as string} value={r.id as string}>{label}{!isMe ? ` — ${String(r.metier ?? '')}` : ''}</option>
                        })}
                      </select>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Créneau</label>
                  <select value={mCreneau} onChange={e => { setMCreneau(e.target.value as Creneau); setMConflitWarning(null); setShowConflitConfirm(false); setConflitConfirmMessage('') }} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all">
                    {CRENEAUX.map(c => <option key={c.value} value={c.value}>{c.label} ({c.heures})</option>)}
                  </select>
                </div>
              </div>

              {/* Créneau personnalisé: heure début et fin */}
              {mCreneau === 'creneau' && (
                <div className="bg-[#e8f4fb]/30 border border-[#5ab4e0]/20 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#5ab4e0]" />
                    <span className="text-xs font-bold text-[#0f1a3a]">Définir les horaires précis</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Heure début *</label>
                      <input type="time" value={mHeureDebut} onChange={e => { setMHeureDebut(e.target.value); setMConflitWarning(null); setShowConflitConfirm(false); setConflitConfirmMessage('') }} className="w-full px-3.5 py-2.5 border border-[#5ab4e0]/30 rounded-lg text-sm bg-[#5ab4e0]/[.03] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Heure fin *</label>
                      <input type="time" value={mHeureFin} onChange={e => { setMHeureFin(e.target.value); setMConflitWarning(null); setShowConflitConfirm(false); setConflitConfirmMessage('') }} className="w-full px-3.5 py-2.5 border border-[#5ab4e0]/30 rounded-lg text-sm bg-[#5ab4e0]/[.03] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" required />
                    </div>
                  </div>
                  {mHeureFin <= mHeureDebut && (
                    <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      L'heure de fin doit être après l'heure de début
                    </div>
                  )}
                  {mConflitWarning && (
                    <div className="text-xs text-amber-600 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{mConflitWarning}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Date début *</label>
                  <input type="date" value={mDate} onChange={e => { setMDate(e.target.value); if (!mDateFin || mDateFin < e.target.value) setMDateFin(e.target.value); setShowConflitConfirm(false); setConflitConfirmMessage('') }} max={`${new Date().getFullYear() + 4}-12-31`} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Date fin</label>
                  <input type="date" value={mDateFin} onChange={e => setMDateFin(e.target.value)} min={mDate} max={`${new Date().getFullYear() + 4}-12-31`} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" />
                </div>
              </div>

              {/* Type d'intervention — visible uniquement en saisie libre (pas de devis) */}
              {!mDevis && (
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Type d&apos;intervention</label>
                  <select value={mTypeIntervention} onChange={e => setMTypeIntervention(e.target.value)} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all">
                    <option value="">— Non précisé</option>
                    <option value="visite_courtoisie">Visite de courtoisie</option>
                    <option value="premier_rdv">Premier rendez-vous (prospect)</option>
                    <option value="metre">Métré sur site</option>
                    <option value="devis_sur_site">Devis sur site</option>
                    <option value="controle_qualite">Contrôle qualité / SAV</option>
                    <option value="depannage">Dépannage</option>
                    <option value="entretien">Entretien / maintenance</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              )}

              {/* Client — auto-rempli si devis sélectionné, sinon saisie manuelle ou libre */}
              {(!mDevis || editMode) && (
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Client</label>
                  <select value={mClient} onChange={e => {
                    setMClient(e.target.value)
                    if (e.target.value) setMClientLibre('') // on vide la saisie libre si on choisit un client existant
                    // Reset chantier si le chantier actuel n'appartient pas au nouveau client
                    if (mChantier) {
                      const ch = chantierMap.get(mChantier) as R | undefined
                      if (ch && e.target.value && ch.client_id !== e.target.value) setMChantier('')
                    }
                  }} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all">
                    <option value="">— Sélectionner un client existant</option>
                    {clients.map(cl => { const r = cl as R; return <option key={r.id as string} value={r.id as string}>{String(r.prenom ?? '')} {String(r.nom ?? '')}</option> })}
                  </select>
                  {/* Saisie libre — affichée seulement si aucun client choisi */}
                  {!mClient && (
                    <input
                      type="text"
                      value={mClientLibre}
                      onChange={e => setMClientLibre(e.target.value)}
                      placeholder="ou tapez un nom libre (ex : M. Dupont, prospect à rappeler)"
                      className="mt-2 w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3] placeholder:italic"
                    />
                  )}
                </div>
              )}

              {/* Chantier — visible en saisie libre, filtré par client si sélectionné */}
              {(!mDevis || editMode) && (
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5" />Chantier / Lieu
                  </label>
                  <select value={mChantier} onChange={e => {
                    setMChantier(e.target.value)
                    if (e.target.value) setMChantierLibre('') // on vide la saisie libre si on choisit un chantier existant
                    // Auto-remplir le client du chantier sélectionné
                    if (e.target.value) {
                      const ch = chantierMap.get(e.target.value) as R | undefined
                      if (ch?.client_id && !mClient) setMClient(ch.client_id as string)
                    }
                  }} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all">
                    <option value="">— Sélectionner un chantier existant</option>
                    {chantiers
                      .filter(ch => !mClient || (ch as R).client_id === mClient)
                      .map(ch => {
                        const r = ch as R
                        const cl = clientMap.get(r.client_id as string) as R | undefined
                        const clientLabel = cl ? ` — ${String(cl.prenom ?? '')} ${String(cl.nom ?? '')}`.trim() : ''
                        return <option key={r.id as string} value={r.id as string}>{String(r.titre ?? 'Sans titre')}{clientLabel}</option>
                      })}
                  </select>
                  {/* Saisie libre — affichée seulement si aucun chantier choisi */}
                  {!mChantier && (
                    <input
                      type="text"
                      value={mChantierLibre}
                      onChange={e => setMChantierLibre(e.target.value)}
                      placeholder="ou tapez une adresse / un lieu libre (ex : 15 rue des Lilas)"
                      className="mt-2 w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3] placeholder:italic"
                    />
                  )}
                </div>
              )}

              {/* Description — toujours visible et editable, optionnelle */}
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Description des travaux <span className="text-[#7b8ba3] font-normal normal-case">(optionnel)</span></label>
                <input type="text" value={mObjet} onChange={e => setMObjet(e.target.value)} placeholder="Ex: Pose tableau electrique, depannage, intervention urgente..." className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3]" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Statut</label>
                <select value={mStatut} onChange={e => setMStatut(e.target.value)} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all">
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Notes</label>
                <input type="text" value={mNotes} onChange={e => setMNotes(e.target.value)} placeholder="Notes optionnelles..." className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3]" />
              </div>
            </div>
            {/* ── Conflict confirmation banner ── */}
            {showConflitConfirm && (
              <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700">Conflit detecte</p>
                    <p className="text-xs text-red-600 mt-0.5 leading-snug">{conflitConfirmMessage}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowConflitConfirm(false); setConflitConfirmMessage('') }}
                    className="flex-1 px-4 py-2 border border-red-200 rounded-lg text-sm font-semibold text-red-600 bg-white hover:bg-red-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={submitIntervention}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    Confirmer quand meme
                  </button>
                </div>
              </div>
            )}
            <div className="px-6 py-4 border-t border-[#e6ecf2] flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); setEditMode(false); setEditId(null) }} className="px-5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#1e293b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">Annuler</button>
              <button onClick={submitIntervention} disabled={submitting || !mIntervenant || !mDate}
                className="px-5 py-2.5 bg-gradient-to-r from-[#e87a2a] to-[#f09050] text-white rounded-xl text-sm font-semibold shadow-[0_4px_15px_rgba(232,122,42,.3)] hover:shadow-[0_6px_20px_rgba(232,122,42,.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? (editMode ? 'Modification...' : 'Creation...') : (editMode ? "Enregistrer les modifications" : "Creer l'intervention")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0f1a3a] text-white px-7 py-3.5 rounded-xl text-sm font-semibold shadow-lg z-[999] flex items-center gap-2.5 animate-[slideUp_.4s_ease]">
          <Check className="w-5 h-5 text-[#22c55e]" />
          {toast}
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes modalIn { from { opacity: 0; transform: scale(.95) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes slideUp { from { transform: translateX(-50%) translateY(100px) } to { transform: translateX(-50%) translateY(0) } }
      `}</style>
    </div>
  )
}

// ===================================================================
// Sub-components
// ========================================================
function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-[#e6ecf2] rounded-lg px-3 py-1.5">
      <span className={color}>{icon}</span>
      <span className="text-[11px] text-[#7b8ba3] font-medium">{label}</span>
      <span className={`text-sm font-extrabold ${color}`}>{value}</span>
    </div>
  )
}

export default function PlanningPage() {
  return (
    <Suspense fallback={null}>
      <PlanningPageInner />
    </Suspense>
  )
}
