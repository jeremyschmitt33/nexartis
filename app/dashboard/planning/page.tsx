'use client'

import { useState, useMemo, useCallback, useRef, useEffect, Suspense } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, X, FileText,
  Search, AlertTriangle, Users, Briefcase, Clock, HardHat,
  MapPin, Eye, Maximize2, Minimize2, Check, Trash2, Pencil,
  Coffee, Handshake, Ruler, ShieldCheck, Wrench, Settings,
  MoreHorizontal, Phone, Navigation, Rows3, Rows4,
  Crown, UserPlus, CheckCircle2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  usePlanning, useIntervenants, useClients, useChantiers, useDevis,
  useInterventionIntervenants,
  insertRow, updateRow, deleteRow, LoadingSkeleton, useEntreprise,
} from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import NotesIntervention from '@/components/NotesIntervention'
import Combobox, { ComboboxItem } from '@/components/Combobox'
import { Input } from '@/components/ui/Input'
import SoloAgendaView from '@/components/planning/SoloAgendaView'
import { useViewModeAuto } from '@/components/planning/hooks/useViewModeAuto'
import type { PlanningViewMode } from '@/components/planning/shared/types'

// ===================================================================
// Session 8 (28/05/2026) — Multi-intervenants par intervention
// ===================================================================
// Une intervention peut être liée à N intervenants via la table jonction
// `intervention_intervenants` (cf. migration-2026-05-28-session-8-...sql).
// Rôles : 'referent' (pilote, 1 et 1 seul) ou 'equipier' (0..N).
// La colonne legacy `planning_interventions.intervenant_id` reste remplie
// avec l'ID du Référent pour la rétrocompat.

type InterventionRole = 'referent' | 'equipier'

type InterventionIntervenant = {
  id: string
  role: InterventionRole
}

// Helpers pour manipuler les listes du multi-sélecteur (state modal)
function findReferent(list: InterventionIntervenant[]): InterventionIntervenant | undefined {
  return list.find(x => x.role === 'referent')
}
function promoteReferent(list: InterventionIntervenant[], targetId: string): InterventionIntervenant[] {
  return list.map(x => ({ id: x.id, role: (x.id === targetId ? 'referent' : 'equipier') as InterventionRole }))
}
function addIntervenant(list: InterventionIntervenant[], id: string): InterventionIntervenant[] {
  if (list.some(x => x.id === id)) return list
  // Le 1er ajouté devient Référent automatiquement, les suivants sont Équipier.
  const role: InterventionRole = list.length === 0 ? 'referent' : 'equipier'
  return [...list, { id, role }]
}
function removeIntervenant(list: InterventionIntervenant[], id: string): InterventionIntervenant[] {
  const target = list.find(x => x.id === id)
  if (!target) return list
  // On refuse le retrait du Référent : l'utilisateur doit d'abord en
  // désigner un autre. Garde-fou côté caller, ici on retire quand même
  // mais on retourne la liste telle quelle si plus aucun Référent reste.
  const next = list.filter(x => x.id !== id)
  // Si on a retiré le Référent et qu'il reste au moins un Équipier,
  // on promeut le 1er restant Référent (sécurité, ne devrait pas arriver
  // car le bouton "retirer" est désactivé pour le Référent dans l'UI).
  if (target.role === 'referent' && next.length > 0 && !next.some(x => x.role === 'referent')) {
    return next.map((x, i) => ({ id: x.id, role: (i === 0 ? 'referent' : 'equipier') as InterventionRole }))
  }
  return next
}

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

// ── Helpers Session 4 (refonte fiche detail + cases planning) ──

// "2026-05-28" -> "Jeu 28 mai 2026"
function formatDateFR(iso: string): string {
  if (!iso) return ''
  const datePart = iso.split('T')[0]
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${jours[date.getDay()]} ${d} ${mois[m - 1]} ${y}`
}

// "08:00" + "12:00" -> "4h00" ; "08:00" + "12:30" -> "4h30"
function formatCreneauDuree(start: string, end: string): string {
  if (!start || !end) return ''
  const [hs, ms] = start.split(':').map(Number)
  const [he, me] = end.split(':').map(Number)
  if (Number.isNaN(hs) || Number.isNaN(he)) return ''
  let total = (he * 60 + (me || 0)) - (hs * 60 + (ms || 0))
  if (total <= 0) return ''
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

// "08:00" -> "8h" ; "14:30" -> "14h30"
function shortTime(t: string): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  if (Number.isNaN(h)) return t
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

// Catalogue centralisé des types d'intervention (icone + label + couleur)
const TYPE_INTERVENTION_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  visite_courtoisie: { icon: Coffee,           label: 'Visite de courtoisie', color: 'bg-amber-100 text-amber-700' },
  premier_rdv:       { icon: Handshake,        label: 'Premier RDV',          color: 'bg-sky-100 text-sky-700' },
  metre:             { icon: Ruler,            label: 'Métré',                color: 'bg-violet-100 text-violet-700' },
  devis_sur_site:    { icon: FileText,         label: 'Devis sur site',       color: 'bg-blue-100 text-blue-700' },
  controle_qualite:  { icon: ShieldCheck,      label: 'Contrôle qualité',     color: 'bg-emerald-100 text-emerald-700' },
  depannage:         { icon: Wrench,           label: 'Dépannage',            color: 'bg-orange-100 text-orange-700' },
  entretien:         { icon: Settings,         label: 'Entretien',            color: 'bg-teal-100 text-teal-700' },
  autre:             { icon: MoreHorizontal,   label: 'Autre',                color: 'bg-gray-100 text-gray-700' },
}

function getTypeInterventionMeta(type: string | null | undefined) {
  if (!type) return null
  return TYPE_INTERVENTION_META[type] ?? null
}

function getTypeInterventionLabel(type: string): string {
  return TYPE_INTERVENTION_META[type]?.label ?? type
}

function getTypeInterventionColor(type: string): string {
  return TYPE_INTERVENTION_META[type]?.color ?? 'bg-gray-100 text-gray-700'
}

// Pastille couleur statut (6px) - couleur pleine pour pastille discrete
function getStatutPastilleColor(statut: string): string {
  switch (statut) {
    case 'termine':  return 'bg-green-500'
    case 'en_cours': return 'bg-sky-500 animate-pulse'
    case 'annule':   return 'bg-red-500'
    case 'planifie': return 'bg-amber-400'
    default:         return 'bg-gray-300'
  }
}

// URL Google Maps directions (ouvre Maps natif sur mobile, web sinon)
function buildGmapsLink(adresse: string, cp: string, ville: string): string {
  const parts = [adresse, cp, ville].filter(p => p && String(p).trim().length > 0)
  const dest = encodeURIComponent(parts.join(', '))
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

// ===================================================================
// Page
// ===================================================================

function PlanningPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: planningData, loading: l1, refetch } = usePlanning()
  const { data: intervenants, loading: l2, refetch: refetchIntervenants } = useIntervenants()
  const { data: clients, loading: l3, refetch: refetchClients } = useClients()
  const { data: chantiers } = useChantiers()
  const { data: devisData } = useDevis()
  // Session 13 V2 : on n'a plus besoin de `update` (le flag
  // `user_is_intervenant` n'est plus écrit côté UI — il reste en DB dormant
  // mais aucun code ne le lit/écrit).
  const { entreprise } = useEntreprise()
  // Session 8 : table jonction multi-intervenants. On reflète aussi son
  // refetch dans le refetch global du planning (cf. saveLiaisons).
  const { data: interventionIntervenantsData, refetch: refetchLiaisons } = useInterventionIntervenants()

  // ── Horaires de travail par défaut (depuis Paramètres > Entreprise) ──
  // Si non renseigné en BDD, fallback aux valeurs historiques 08:00-12:00 / 13:00-17:00.
  // Utilisé pour les créneaux Matin / Après-midi / Journée entière du planning.
  const horaires = useMemo(() => ({
    debutMatin: ((entreprise as R)?.heure_debut_matin as string) || '08:00',
    finMatin: ((entreprise as R)?.heure_fin_matin as string) || '12:00',
    debutAm: ((entreprise as R)?.heure_debut_apres_midi as string) || '13:00',
    finAm: ((entreprise as R)?.heure_fin_apres_midi as string) || '17:00',
  }), [entreprise])

  // CRENEAUX dynamique (shadow du top-level) avec les vrais horaires de l'entreprise.
  // Le top-level CRENEAUX reste utilisé par creneauLabel() défini hors composant.
  const CRENEAUX = useMemo<{ value: Creneau; label: string; heures: string }[]>(() => [
    { value: 'journee', label: 'Journée entière', heures: `${horaires.debutMatin}-${horaires.finAm}` },
    { value: 'matin', label: 'Demi-journée matin', heures: `${horaires.debutMatin}-${horaires.finMatin}` },
    { value: 'apres_midi', label: 'Demi-journée après-midi', heures: `${horaires.debutAm}-${horaires.finAm}` },
    { value: 'creneau', label: 'Créneau personnalisé', heures: 'Custom' },
  ], [horaires])

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
  // Fix #4 (Vague 2) : ID de l'intervenant en cours de drag depuis la barre de chips.
  // Utilisé uniquement pour le visuel (highlight pendant le drag) — le payload
  // est porté par dataTransfer ('text/intervenant') pour ne pas casser le drag
  // existant des interventions entre cases.
  const [draggedChipIvId, setDraggedChipIvId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const autoDetectedRef = useRef(false)

  // Modal state
  // Mode du modal : 'devis' = planifier depuis un devis signé, 'libre' = visite/RDV/SAV.
  // Initialisé au moment de l'ouverture (cf. openModal) selon présence de devis signés.
  const [mMode, setMMode] = useState<'devis' | 'libre'>('libre')
  const [mDevis, setMDevis] = useState('')
  const [mClient, setMClient] = useState('')
  // Session 8 : multi-intervenants. La liste contient le Référent (rôle
  // 'referent', un et un seul) + 0..N Équipiers. L'ancien champ
  // `mIntervenant` (string) reste utilisé en interne pour les vérifs
  // (alimenté depuis findReferent(mIntervenants)) et pour le payload
  // legacy `intervenant_id` envoyé à `planning_interventions`.
  const [mIntervenants, setMIntervenants] = useState<InterventionIntervenant[]>([])
  // Buffer du Combobox d'ajout (controlled : null = combobox vide)
  const [mAddIvBuffer, setMAddIvBuffer] = useState<string | null>(null)
  // Dérivé : ID du Référent courant (ou '' si aucun).
  const mIntervenant = findReferent(mIntervenants)?.id ?? ''
  const setMIntervenant = useCallback((id: string) => {
    // Setter rétrocompat : pré-sélection mono. Si la liste est vide, on
    // ajoute le Référent. Sinon on promeut un autre Référent.
    setMIntervenants(prev => {
      if (!id) return prev
      if (prev.some(x => x.id === id)) return promoteReferent(prev, id)
      // Pas dans la liste : on remplace tout (cas mode Solo où il n'y a
      // qu'un intervenant possible).
      if (prev.length === 0) return [{ id, role: 'referent' }]
      return promoteReferent([...prev.filter(x => x.id !== id), { id, role: 'equipier' }], id)
    })
  }, [])
  const [mChantier, setMChantier] = useState('')
  // Saisie libre — pour visites de courtoisie, premiers RDV, contrôles sur prospect non encore en base.
  // Si mClientLibre/mChantierLibre est rempli, on l'utilise à la place du select (qui doit rester vide).
  const [mClientLibre, setMClientLibre] = useState('')
  const [mChantierLibre, setMChantierLibre] = useState('')
  const [mTypeIntervention, setMTypeIntervention] = useState('')

  // ── Saisie libre étendue client (Session 12 V4 — 29/05/2026) ──
  // Avant : pour stocker un téléphone client, il fallait créer une fiche complète
  // via un mini-form prospect (7 champs lourds). Trop pénible pour un dépannage one-shot.
  // Maintenant : le nom libre (`mClientLibre`) déclenche l'affichage de 4 champs
  // optionnels (tél, adresse, CP, ville) stockés directement sur l'intervention
  // dans les colonnes `client_libre_telephone`, `client_libre_adresse`,
  // `client_libre_code_postal`, `client_libre_ville` (migration prod appliquée).
  // Bouton discret "+ Enregistrer comme client" pour formaliser si besoin.
  const [mClientLibreTel, setMClientLibreTel] = useState('')
  const [mClientLibreAdresse, setMClientLibreAdresse] = useState('')
  const [mClientLibreCP, setMClientLibreCP] = useState('')
  const [mClientLibreVille, setMClientLibreVille] = useState('')
  const [enregistrerClientSaving, setEnregistrerClientSaving] = useState(false)
  // Session 12 V4.1 : feedback visuel après "+ Enregistrer comme client".
  // Affiche un mini-message vert sous le combobox tant que le client créé
  // reste sélectionné. Reset à l'ouverture/fermeture du modal, au switchMode
  // ou si l'utilisateur retire le client du combobox.
  const [lastEnregistreClientNom, setLastEnregistreClientNom] = useState('')
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
  // Solo mode: ID of the self-intervenant (artisan himself) — rétrocompat.
  // Session 13 V2.1 : plus de création auto, juste un lookup sur les comptes
  // legacy qui ont déjà un intervenant is_self ou un membre Solo existant.
  const [selfIntervenantId, setSelfIntervenantId] = useState<string | null>(null)

  // ─────────────────────────────────────────────────────────────────
  // Session 13 V2 (29/05/2026) — Mini-modal "+ Ajouter intervenant"
  // depuis le modal Nouvelle intervention.
  //
  // Note Session 13 V2 : le bandeau orange "Êtes-vous intervenant ?" et le
  // sous-modal "Lier votre compte" ont été SUPPRIMÉS. Toute la gestion
  // "Vous" passe désormais par Mon équipe (refonte radicale validée après
  // tests prod et benchmark concurrence — voir commentaire useEffect plus haut).
  // ─────────────────────────────────────────────────────────────────

  // Mini-modal "Créer un intervenant" (utilisé depuis le combobox du modal
  // Nouvelle intervention via "+ Ajouter un intervenant").
  // Le callback `onCreated` permet au caller de réagir après création
  // (ex. ajouter le nouvel intervenant à la liste mIntervenants).
  type MiniCreateState = {
    open: boolean
    onCreated: ((newIntervenantId: string) => void) | null
  }
  const [miniCreate, setMiniCreate] = useState<MiniCreateState>({ open: false, onCreated: null })

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

  // ── Vague 3 (29/05/2026) : mode de vue Agenda vs Matrice ──
  // Détection auto via forme juridique au 1er mount (AE→agenda, sinon matrice),
  // override manuel via toggle dans la toolbar + persistance localStorage.
  // `tempMatrixOverride` permet de basculer TEMPORAIREMENT vers la matrice
  // depuis SoloAgendaView (bouton "Voir par intervenant") sans persister.
  const { viewMode, setViewMode } = useViewModeAuto(entreprise?.forme_juridique as string | undefined)
  const [tempMatrixOverride, setTempMatrixOverride] = useState(false)
  // Vue effective utilisée pour le rendu (override temporaire prend le pas).
  const effectiveViewMode: PlanningViewMode = tempMatrixOverride ? 'matrix' : viewMode
  const handleSetViewMode = useCallback((mode: PlanningViewMode) => {
    setTempMatrixOverride(false) // tout choix manuel annule l'override temporaire
    setViewMode(mode)
  }, [setViewMode])

  // ── Résolution de l'intervenant "self" ──
  //
  // Session 13 V2.1 (29/05/2026 soir) — Refonte radicale TOTALE :
  //   AUCUN "Vous" auto-créé, ni en Solo ni en Société. Tous les intervenants
  //   doivent être créés manuellement dans Mon équipe. Cohérence : "tout
  //   passe par Mon équipe" pour tous les statuts juridiques (AE compris).
  //   Décision Jerem 29/05/2026 (validée par recherche concurrence Obat /
  //   Tolteck / Praxedo / Vertuoza / Batappli / Sage / Codial / Mediabat).
  //
  // Rétrocompat : les comptes qui ont déjà un membre `is_self = true` ou
  // un intervenant non sous-traitant existant gardent ce membre comme
  // référent pour le tri "Vous en haut" et le libellé. On ne supprime
  // rien — l'utilisateur peut effacer manuellement s'il le souhaite.
  useEffect(() => {
    if (l2) return // wait for intervenants to load
    if (!entreprise) return // wait for entreprise to load

    // 1. Lookup par is_self (légacy : comptes Session 9 ou plus anciens)
    const selfMarked = intervenants.find(iv => (iv as R).is_self === true) as R | undefined
    if (selfMarked) {
      setSelfIntervenantId(selfMarked.id as string)
      return
    }

    // 2. Rétrocompat Solo : fallback sur 1er non-sous-traitant (anciens
    //    comptes Solo où le self n'a pas le flag is_self).
    if (!isSociete) {
      const existing = intervenants.find(
        iv => (iv as R).type_contrat !== 'sous-traitant'
      ) as R | undefined
      if (existing) {
        setSelfIntervenantId(existing.id as string)
        return
      }
    }

    // 3. Aucun intervenant : selfIntervenantId reste à null. L'état vide
    //    explicite s'affichera dans le planning (cf. JSX `availableIntervenants.length === 0`).
    //    Plus de création silencieuse — l'utilisateur va créer ses fiches
    //    lui-même dans Mon équipe.
    setSelfIntervenantId(null)
  }, [isSociete, l2, intervenants, entreprise])

  // ─── Mini-modal "+ Ajouter un intervenant" — state + handlers ───
  // Form local (réinitialisé à chaque ouverture). On garde un schéma simple
  // aligné sur la page Mon équipe (5 champs : prenom, nom, metier, type_contrat,
  // role). Au submit on insère via insertRow + on appelle onCreated avec l'ID.
  const [mcPrenom, setMcPrenom] = useState('')
  const [mcNom, setMcNom] = useState('')
  const [mcMetier, setMcMetier] = useState('')
  const [mcTypeContrat, setMcTypeContrat] = useState<'cdi' | 'cdd' | 'apprenti' | 'interimaire' | 'sous-traitant'>('cdi')
  const [mcRole, setMcRole] = useState('')
  const [mcSaving, setMcSaving] = useState(false)
  // Auto-lock Apprenti si Type=Apprentissage (parité avec Mon équipe).
  useEffect(() => {
    if (mcTypeContrat === 'apprenti' && mcRole !== 'Apprenti') setMcRole('Apprenti')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcTypeContrat])

  const resetMiniCreateForm = useCallback(() => {
    setMcPrenom(''); setMcNom(''); setMcMetier('')
    setMcTypeContrat('cdi'); setMcRole('')
  }, [])

  const openMiniCreate = useCallback((opts: { onCreated: ((id: string) => void) | null }) => {
    resetMiniCreateForm()
    setMiniCreate({ open: true, onCreated: opts.onCreated })
  }, [resetMiniCreateForm])

  const closeMiniCreate = useCallback(() => {
    setMiniCreate({ open: false, onCreated: null })
    resetMiniCreateForm()
  }, [resetMiniCreateForm])

  const handleMiniCreateSubmit = useCallback(async () => {
    if (!mcNom.trim()) return
    setMcSaving(true)
    try {
      const PALETTE_COULEURS = ['bg-[#5ab4e0]', 'bg-emerald-500', 'bg-[#e87a2a]', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500']
      const couleur = PALETTE_COULEURS[Math.floor(Math.random() * PALETTE_COULEURS.length)]
      const created = await insertRow('intervenants', {
        prenom: mcPrenom.trim(),
        nom: mcNom.trim(),
        metier: mcMetier.trim(),
        type_contrat: mcTypeContrat,
        niveau_acces: 'compagnon',
        role: mcRole || null,
        taux_horaire: null,
        actif: true,
        couleur,
        is_self: null,
      })
      // Notifier le caller : on lui passe l'ID (utile pour ajouter le membre
      // dans la liste mIntervenants du modal Nouvelle intervention).
      if (created && miniCreate.onCreated) {
        miniCreate.onCreated((created as R).id as string)
      }
      closeMiniCreate()
    } catch {
      // silencieux : RLS error ou autre
    } finally {
      setMcSaving(false)
    }
  }, [mcPrenom, mcNom, mcMetier, mcTypeContrat, mcRole, miniCreate, closeMiniCreate])

  // ── Pre-selection de l'intervenant "self" à l'ouverture du modal ──
  // Session 8 : pre-fill du Référent uniquement quand la liste est vide
  // (sinon on garde l'état multi-intervenants du modal).
  // Session 9 (28/05/2026) : étendu au mode Société. Si le dirigeant n'a pas
  // encore créé d'équipe, le self est pré-sélectionné comme Référent par
  // défaut (sinon le dropdown serait vide et la planification impossible).
  // V1 Fix #6 (28/05/2026) : on RETIRE le pre-fill en mode Société.
  //   - Mode AE (!isSociete) : pre-fill `[self, referent]` (comportement S9 conservé).
  //   - Mode Société : aucun pre-fill, mIntervenants reste vide et le dirigeant
  //     ajoute manuellement les intervenants (le self "Vous" reste dispo dans
  //     le Combobox d'ajout d'intervenant, donc rien n'est perdu).
  useEffect(() => {
    if (!showModal) return
    if (mIntervenants.length > 0) return
    if (isSociete) return
    if (selfIntervenantId) {
      setMIntervenant(selfIntervenantId)
    } else if (intervenants.length > 0) {
      // Fallback Solo legacy : 1er intervenant si pas de self résolu.
      setMIntervenant((intervenants[0] as R).id as string)
    }
  }, [showModal, isSociete, mIntervenants.length, selfIntervenantId, intervenants, setMIntervenant])

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

  // ══════════════════════════════════════════════════════════════
  // S2 — Scalabilité planning : filtres + groupement + densité
  // ══════════════════════════════════════════════════════════════
  // 3 leviers UX pour gérer un planning avec beaucoup d'intervenants :
  //   1. Chips intervenants (masquer/afficher individuellement)
  //   2. Groupement par métier (collapsible inline dans la grille)
  //   3. Toggle densité Compact / Confort (taille des cellules)
  // États persistés en localStorage pour respecter le choix utilisateur.

  // Levier 1 : intervenants masqués (Set d'IDs)
  const [hiddenIntervenants, setHiddenIntervenants] = useState<Set<string>>(new Set())
  // Init depuis localStorage au mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('planning_filter_intervenants')
      if (raw) {
        const arr = JSON.parse(raw) as unknown
        if (Array.isArray(arr)) {
          setHiddenIntervenants(new Set(arr.filter((x): x is string => typeof x === 'string')))
        }
      }
    } catch { /* ignore parse errors */ }
  }, [])
  // Persist
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('planning_filter_intervenants', JSON.stringify(Array.from(hiddenIntervenants)))
  }, [hiddenIntervenants])

  // Levier 3 : densité ('compact' | 'confort')
  const [density, setDensity] = useState<'compact' | 'confort'>('confort')
  // Init depuis localStorage au mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('planning_density')
    if (raw === 'compact' || raw === 'confort') setDensity(raw)
  }, [])
  // Persist
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('planning_density', density)
  }, [density])

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

  // ── Session 8 — Liaisons multi-intervenants par intervention ──
  // Indexe la table jonction `intervention_intervenants` par intervention_id.
  // Pour chaque intervention, on récupère la liste { intervenant_id, role }.
  // Utilisé par :
  //   - `planningMap` (rendu grille — 1 intervention apparait dans N cellules)
  //   - `openEditModal` (hydrater le multi-sélecteur)
  //   - `conflicts` (détection sur chaque intervenant lié)
  //   - panneau détail (afficher Référent + Équipiers)
  const interventionIntervenantsMap = useMemo(() => {
    const map = new Map<string, InterventionIntervenant[]>()
    for (const row of interventionIntervenantsData) {
      const r = row as R
      const ivId = r.intervention_id as string
      const intervenantId = r.intervenant_id as string
      const role = (r.role as InterventionRole) ?? 'equipier'
      if (!ivId || !intervenantId) continue
      if (!map.has(ivId)) map.set(ivId, [])
      map.get(ivId)!.push({ id: intervenantId, role })
    }
    // Tri systématique : Référent en tête, puis Équipiers (stabilité du
    // rendu détail et de l'ordre dans le modal édition).
    map.forEach(list => list.sort((a, b) => (a.role === 'referent' ? -1 : 1) - (b.role === 'referent' ? -1 : 1)))
    return map
  }, [interventionIntervenantsData])

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
    // Session 9 (28/05/2026) : on garantit que l'intervenant `self` (Vous) prend
    // toujours la couleur SKY (PALETTE[0]) en l'épinglant en tête. Les autres
    // gardent l'ordre BDD et cyclent sur PALETTE[1..] pour ne pas reprendre sky.
    const selfIv = intervenants.find(iv => (iv as R).is_self === true)
    const others = intervenants.filter(iv => (iv as R).is_self !== true)
    if (selfIv) map.set((selfIv as R).id as string, PALETTE[0])
    others.forEach((iv, i) => {
      const palette = selfIv ? PALETTE[1 + (i % (PALETTE.length - 1))] : PALETTE[i % PALETTE.length]
      map.set((iv as R).id as string, palette)
    })
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
    // 28/05/2026 (fix Jerem) : tri par heure de début croissante dans chaque jour.
    // matin/journée → debutMatin, après-midi → debutAm, custom → heure réelle.
    const startMin = (rec: R): number => {
      const t = (s: string): number => {
        const [h, m] = s.split(':').map(Number)
        return (h || 0) * 60 + (m || 0)
      }
      const creneau = rec.creneau as string
      if (creneau === 'creneau' && rec.heure_debut) return t(rec.heure_debut as string)
      if (creneau === 'apres_midi') return t(horaires.debutAm)
      return t(horaires.debutMatin)
    }
    map.forEach((list) => {
      list.sort((a, b) => startMin(a) - startMin(b))
    })
    return map
  }, [planningData, horaires])

  // ── Planning map: key = intervenantId__dateStr ──
  // Session 8 (28/05/2026) — Multi-intervenants :
  //   1 intervention peut être liée à N intervenants via la table jonction
  //   `intervention_intervenants`. Elle apparaît donc dans la cellule de
  //   CHAQUE intervenant lié (style Obat).
  //
  // Algorithme :
  //   - Pour chaque intervention, on cherche ses liaisons dans
  //     `interventionIntervenantsMap`. S'il y en a, on push dans chaque cellule
  //     `${intervenantLié}__${jour}`.
  //   - Fallback (intervention orpheline, ex. ancienne donnée non backfillée
  //     ou cas Solo sans liaison) : on retombe sur `intervention.intervenant_id`
  //     direct, comme avant.
  //
  // Reste valide :
  //   - BUG D FIX : en mode Solo sans intervenant_id, on rapatrie sous le seul
  //     intervenant affiché.
  //   - BUG MULTI-JOURS : on duplique l'intervention sur chaque jour entre
  //     date_debut et date_fin.
  const planningMap = useMemo(() => {
    const map = new Map<string, R[]>()
    const fallbackIvId = !isSociete && intervenants.length > 0 ? (intervenants[0] as R).id as string : null
    for (const item of planningData) {
      const rec = item as R
      const interventionId = rec.id as string
      const dateDebut = rec.date_debut as string
      if (!dateDebut) continue

      // Récupérer la liste des intervenants liés à cette intervention.
      // Si aucune liaison (intervention orpheline / pas encore backfillée),
      // on retombe sur l'ancien champ `intervenant_id` + fallback Solo.
      const liaisons = interventionIntervenantsMap.get(interventionId)
      let targetIvIds: string[]
      if (liaisons && liaisons.length > 0) {
        targetIvIds = liaisons.map(l => l.id)
      } else {
        let ivId = rec.intervenant_id as string
        if (!ivId && fallbackIvId) ivId = fallbackIvId
        if (!ivId) continue
        targetIvIds = [ivId]
      }

      // Déterminer la plage de jours couverte par l'intervention
      const startDay = dateDebut.split('T')[0]
      const endDateRaw = (rec.date_fin as string) || dateDebut
      const endDay = endDateRaw.split('T')[0]
      const startD = new Date(startDay + 'T00:00:00')
      const endD = new Date(endDay + 'T00:00:00')
      const last = endD < startD ? startD : endD

      // Push dans chaque (intervenantLié × jour). On itère les jours UNE FOIS
      // pour ne pas re-parser les dates par intervenant.
      const dayKeys: string[] = []
      let safety = 0
      const cur = new Date(startD)
      while (cur <= last && safety < 60) {
        dayKeys.push(fmtISO(cur))
        cur.setDate(cur.getDate() + 1)
        safety++
      }
      for (const ivId of targetIvIds) {
        for (const dayKey of dayKeys) {
          const key = `${ivId}__${dayKey}`
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(rec)
        }
      }
    }
    // 28/05/2026 (fix Jerem) : tri par heure de début croissante dans chaque cellule.
    // matin/journée → debutMatin, après-midi → debutAm, custom → heure réelle.
    const startMin = (rec: R): number => {
      const t = (s: string): number => {
        const [h, m] = s.split(':').map(Number)
        return (h || 0) * 60 + (m || 0)
      }
      const creneau = rec.creneau as string
      if (creneau === 'creneau' && rec.heure_debut) return t(rec.heure_debut as string)
      if (creneau === 'apres_midi') return t(horaires.debutAm)
      return t(horaires.debutMatin)
    }
    map.forEach((list) => {
      list.sort((a, b) => startMin(a) - startMin(b))
    })
    return map
  }, [planningData, isSociete, intervenants, horaires, interventionIntervenantsMap])

  // ── Conflicts detection (hour-based overlap: A.start < B.end && B.start < A.end) ──
  const conflicts = useMemo(() => {
    const set = new Set<string>()
    // Helper: convert HH:MM string to total minutes
    const t2m = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
    // Helper: get [startMin, endMin] for a record
    const recRange = (rec: R): [number, number] => {
      const c = rec.creneau as string
      if (c === 'journee') return [t2m(horaires.debutMatin), t2m(horaires.finAm)]
      if (c === 'matin') return [t2m(horaires.debutMatin), t2m(horaires.finMatin)]
      if (c === 'apres_midi') return [t2m(horaires.debutAm), t2m(horaires.finAm)]
      return [t2m((rec.heure_debut as string) || horaires.debutMatin), t2m((rec.heure_fin as string) || horaires.finAm)]
    }
    // Session 8 : on groupe par (intervenant_lié × date), pas seulement par
    // `intervenant_id` legacy. Une intervention avec 3 intervenants peut
    // créer un conflit sur n'importe lequel d'entre eux.
    const byIntervenantDate = new Map<string, R[]>()
    for (const item of planningData) {
      const rec = item as R
      const interventionId = rec.id as string
      const dayKey = (rec.date_debut as string)?.split('T')[0]
      if (!dayKey) continue
      const liaisons = interventionIntervenantsMap.get(interventionId)
      let ivIds: string[]
      if (liaisons && liaisons.length > 0) {
        ivIds = liaisons.map(l => l.id)
      } else if (rec.intervenant_id) {
        ivIds = [rec.intervenant_id as string]
      } else {
        continue
      }
      for (const ivId of ivIds) {
        const key = `${ivId}__${dayKey}`
        if (!byIntervenantDate.has(key)) byIntervenantDate.set(key, [])
        byIntervenantDate.get(key)!.push(rec)
      }
    }
    byIntervenantDate.forEach((items) => {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          // Sécurité : si les 2 lignes pointent en réalité sur la MÊME
          // intervention (ne devrait pas arriver mais on s'en assure),
          // on ignore — sinon on flag une intervention en conflit avec
          // elle-même quand 2 intervenants la partagent.
          if (items[i].id === items[j].id) continue
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
  }, [planningData, horaires, interventionIntervenantsMap])

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

  // ── Vague 3 : nb d'intervenants distincts sur les interventions du mois courant ──
  // Sert à SoloAgendaView pour décider d'afficher le bouton "Voir par intervenant".
  // Si ≥2 intervenants distincts sur le mois → toggle pertinent.
  const monthIntervenantsCount = useMemo(() => {
    const today = new Date()
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const set = new Set<string>()
    for (const item of planningData) {
      const rec = item as R
      const d = (rec.date_debut as string) ?? ''
      if (!d.startsWith(ym)) continue
      const liaisons = interventionIntervenantsMap.get(rec.id as string)
      if (liaisons && liaisons.length > 0) {
        liaisons.forEach(l => set.add(l.id))
      } else if (rec.intervenant_id) {
        set.add(rec.intervenant_id as string)
      }
    }
    return set.size
  }, [planningData, interventionIntervenantsMap])
  const hasMultipleIntervenantsOnMonth = monthIntervenantsCount >= 2

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
        existingStart = timeToMinutes(horaires.debutMatin)
        existingEnd = timeToMinutes(horaires.finAm)
      } else if (creneauType === 'matin') {
        existingStart = timeToMinutes(horaires.debutMatin)
        existingEnd = timeToMinutes(horaires.finMatin)
      } else if (creneauType === 'apres_midi') {
        existingStart = timeToMinutes(horaires.debutAm)
        existingEnd = timeToMinutes(horaires.finAm)
      } else if (creneauType === 'creneau') {
        existingStart = timeToMinutes((rec.heure_debut as string) || horaires.debutMatin)
        existingEnd = timeToMinutes((rec.heure_fin as string) || horaires.finAm)
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
    // Session 8 : initialiser la liste multi-intervenants. Le défaut devient
    // le Référent. En mode Société sans intervenant passé, on démarre vide
    // (l'utilisateur doit en choisir un via le Combobox).
    const initialList: InterventionIntervenant[] = defaultIvId
      ? [{ id: defaultIvId, role: 'referent' }]
      : []
    setMIntervenants(initialList)
    setMAddIvBuffer(null)
    setMDevis(''); setMClient(''); setMChantier('')
    setMClientLibre(''); setMChantierLibre(''); setMTypeIntervention('')
    // Session 12 V4 : reset des 4 champs libres client étendus
    setMClientLibreTel(''); setMClientLibreAdresse(''); setMClientLibreCP(''); setMClientLibreVille('')
    // Session 12 V4.1 : reset feedback "Coordonnées enregistrées" à chaque ouverture
    setLastEnregistreClientNom('')
    setMDate(dateStr ?? fmtISO(new Date())); setMDateFin(dateStr ?? fmtISO(new Date()))
    setMCreneau('journee'); setMObjet(''); setMNotes(''); setMStatut('planifie')
    setMHeureDebut(horaires.debutMatin); setMHeureFin(horaires.finAm); setMConflitWarning(null)
    setShowConflitConfirm(false); setConflitConfirmMessage('')
    setEditMode(false); setEditId(null)
    // Mode initial intelligent :
    //  - si on ouvre depuis un drag-from-devis : mode 'devis' forcé
    //  - sinon : 'devis' si on a au moins un devis signé, 'libre' sinon
    const initialMode: 'devis' | 'libre' = devisId
      ? 'devis'
      : (acceptedDevis.length > 0 ? 'devis' : 'libre')
    setMMode(initialMode)
    // Auto-fill from devis if provided (drag-from-devis)
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
    // Déduire le mode depuis les données de l'intervention :
    // si elle est liée à un devis, on est en mode 'devis', sinon 'libre'.
    setMMode(intervention.devis_id ? 'devis' : 'libre')
    setMDevis((intervention.devis_id as string) ?? '')
    setMClient((intervention.client_id as string) ?? '')
    // Session 8 : hydrater le multi-sélecteur depuis la table jonction.
    // Fallback si aucune liaison (intervention orpheline) : on reconstruit
    // une liste à partir de `intervention_id` legacy avec rôle 'referent'.
    const liaisonsExistantes = interventionIntervenantsMap.get(intervention.id as string)
    if (liaisonsExistantes && liaisonsExistantes.length > 0) {
      setMIntervenants(liaisonsExistantes.map(l => ({ id: l.id, role: l.role })))
    } else if (intervention.intervenant_id) {
      setMIntervenants([{ id: intervention.intervenant_id as string, role: 'referent' }])
    } else {
      setMIntervenants([])
    }
    setMAddIvBuffer(null)
    setMChantier((intervention.chantier_id as string) ?? '')
    setMClientLibre((intervention.client_libre as string) ?? '')
    setMChantierLibre((intervention.chantier_libre as string) ?? '')
    // Session 12 V4 : pré-remplir les 4 champs libres étendus (tél + adresse + CP + ville)
    setMClientLibreTel((intervention.client_libre_telephone as string) ?? '')
    setMClientLibreAdresse((intervention.client_libre_adresse as string) ?? '')
    setMClientLibreCP((intervention.client_libre_code_postal as string) ?? '')
    setMClientLibreVille((intervention.client_libre_ville as string) ?? '')
    setMTypeIntervention((intervention.type_intervention as string) ?? '')
    setMDate(dateDebut)
    setMDateFin(dateFin)
    setMCreneau((intervention.creneau as Creneau) ?? 'journee')
    setMObjet(String(intervention.titre ?? intervention.description_travaux ?? ''))
    setMNotes(String(intervention.notes ?? ''))
    setMStatut((intervention.statut as string) ?? 'planifie')
    setMHeureDebut(String(intervention.heure_debut ?? horaires.debutMatin))
    setMHeureFin(String(intervention.heure_fin ?? horaires.finAm))
    setMConflitWarning(null)
    setShowConflitConfirm(false); setConflitConfirmMessage('')
    // Session 12 V4.1 : reset feedback à l'ouverture en édition.
    setLastEnregistreClientNom('')
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

  // ── Switch mode (devis ↔ libre) avec reset propre ──
  // En passant de "devis" à "libre" : on vide ce qui est lié au devis (devis, client lié, chantier lié, objet)
  // mais on conserve date, créneau, intervenant, notes, type, etc.
  // En passant de "libre" à "devis" : on vide ce qui est saisie libre (clientLibre, chantierLibre).
  const switchMode = (target: 'devis' | 'libre') => {
    if (target === mMode) return
    if (target === 'libre') {
      setMDevis('')
      setMClient('')
      setMChantier('')
      setMObjet('')
    } else {
      setMClientLibre('')
      setMChantierLibre('')
      // Session 12 V4 : reset des 4 champs libres étendus
      setMClientLibreTel('')
      setMClientLibreAdresse('')
      setMClientLibreCP('')
      setMClientLibreVille('')
    }
    setMMode(target)
    setShowConflitConfirm(false); setConflitConfirmMessage('')
    // Session 12 V4.1 : reset feedback au changement de mode.
    setLastEnregistreClientNom('')
  }

  // ── Enregistrer comme client (Session 12 V4 — 29/05/2026) ──
  // Bouton discret en bas du bloc "saisie libre client" : transforme les
  // 5 champs libres (nom + tél + adresse + CP + ville) en une vraie fiche
  // client (table `clients`, RLS user_id = auth.uid()), puis pré-sélectionne
  // ce client dans le combobox et vide les champs libres.
  //
  // Heuristique nom/prénom : si 1 seul mot OU premier mot = civilité
  // (M., Mme, etc.), on met tout dans `nom`. Sinon : premier mot = prénom.
  const handleEnregistrerCommeClient = useCallback(async () => {
    const nomLibreTrim = mClientLibre.trim()
    if (!nomLibreTrim) {
      showToast('Renseignez au moins le nom')
      return
    }
    setEnregistrerClientSaving(true)
    try {
      // Split nom/prénom (même heuristique que l'ancien createClientInline)
      const parts = nomLibreTrim.split(/\s+/)
      const civilitePattern = /^(m\.|mme\.?|mlle\.?|monsieur|madame|mademoiselle)$/i
      let prenom = ''
      let nom = ''
      if (parts.length === 1 || civilitePattern.test(parts[0])) {
        nom = nomLibreTrim
      } else {
        prenom = parts[0]
        nom = parts.slice(1).join(' ')
      }

      const payload: Record<string, unknown> = { nom }
      if (prenom) payload.prenom = prenom
      const telTrim = mClientLibreTel.trim()
      const adrTrim = mClientLibreAdresse.trim()
      const cpTrim = mClientLibreCP.trim()
      const villeTrim = mClientLibreVille.trim()
      if (telTrim) payload.telephone = telTrim
      if (adrTrim) payload.adresse = adrTrim
      if (cpTrim) payload.code_postal = cpTrim
      if (villeTrim) payload.ville = villeTrim

      const created = await insertRow('clients', payload)
      if (created) {
        const newId = (created as R).id as string
        setMClient(newId)
        // Vider tous les libres : la fiche prend le relais.
        setMClientLibre('')
        setMClientLibreTel('')
        setMClientLibreAdresse('')
        setMClientLibreCP('')
        setMClientLibreVille('')
        showToast('Client enregistré ✓')
        // Session 12 V4.1 : mémoriser le nom pour le feedback visuel sous le combobox.
        setLastEnregistreClientNom(nomLibreTrim)
        // Refetch pour que le combobox affiche le nouveau client.
        // V4.1 fix critique : refetchClients() AVANT refetch() planning, sinon
        // le nouvel id n'apparaît pas dans clientItems et le combobox affiche
        // "Aucun client trouvé" même si la fiche existe en DB.
        refetchClients()
        refetch()
      }
    } catch (err) {
      console.error('[planning] handleEnregistrerCommeClient', err)
      showToast('Impossible d\'enregistrer le client')
    } finally {
      setEnregistrerClientSaving(false)
    }
  }, [mClientLibre, mClientLibreTel, mClientLibreAdresse, mClientLibreCP, mClientLibreVille, refetch, refetchClients, showToast])

  // ── Items pour les Combobox du modal ──
  // Liste des devis signés, formatée pour le composant Combobox.
  const devisItems: ComboboxItem[] = useMemo(() => {
    return acceptedDevis.map(d => {
      const cl = clientMap.get(d.client_id as string) as R | undefined
      const clientLabel = cl ? `${cl.prenom ?? ''} ${cl.nom ?? ''}`.trim() : ''
      const numero = String(d.numero ?? '')
      const objet = String(d.objet ?? '')
      const montant = Number(d.montant_ttc ?? 0)
      const dateAccept = d.date_signature ? String(d.date_signature).split('T')[0] : ''
      return {
        id: d.id as string,
        label: `${numero}${clientLabel ? ` — ${clientLabel}` : ''}`,
        sublabel: objet || undefined,
        searchText: `${numero} ${clientLabel} ${objet}`,
        meta: (
          <div className="text-right">
            <div className="font-bold text-[#22c55e]">
              {montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </div>
            {dateAccept && <div className="text-[10px] text-[#7b8ba3]">signé {dateAccept}</div>}
          </div>
        ),
      }
    })
  }, [acceptedDevis, clientMap])

  // Session 8 — Liste des intervenants pour le Combobox d'ajout du modal.
  // On exclut ceux déjà sélectionnés dans `mIntervenants` (pas de doublon).
  // En mode Solo : on n'expose que les sous-traitants pour ajouter en équipier
  // (le "self" est déjà le Référent par défaut).
  // Session 9 : le self (is_self = true) est affiché en première position avec
  // le libellé "Vous" + métier (et non le nom de l'entreprise).
  const availableIntervenantsForModal: ComboboxItem[] = useMemo(() => {
    const alreadySelected = new Set(mIntervenants.map(x => x.id))
    const source = isSociete
      ? intervenants.filter(iv => (iv as R).actif !== false)
      : intervenants.filter(iv => (iv as R).actif !== false && (iv as R).type_contrat === 'sous-traitant')
    const filtered = source.filter(iv => !alreadySelected.has((iv as R).id as string))
    // Tri : self en tête (forcé en mode Société).
    filtered.sort((a, b) => {
      const aSelf = (a as R).is_self === true ? 1 : 0
      const bSelf = (b as R).is_self === true ? 1 : 0
      return bSelf - aSelf
    })
    return filtered.map(iv => {
      const r = iv as R
      const isSelf = r.is_self === true
      const prenom = String(r.prenom ?? '')
      const nom = String(r.nom ?? '')
      const metier = String(r.metier ?? '')
      const full = isSelf ? 'Vous' : (`${prenom} ${nom}`.trim() || '(sans nom)')
      return {
        id: r.id as string,
        label: full,
        sublabel: metier || (isSelf ? 'Dirigeant' : undefined),
        searchText: `${full} ${metier} ${isSelf ? 'vous dirigeant moi' : ''}`,
      }
    })
  }, [intervenants, mIntervenants, isSociete])

  // Liste des clients (combobox client en mode libre)
  const clientItems: ComboboxItem[] = useMemo(() => {
    return clients.map(cl => {
      const r = cl as R
      const prenom = String(r.prenom ?? '')
      const nom = String(r.nom ?? '')
      const full = `${prenom} ${nom}`.trim() || '(sans nom)'
      const tel = r.telephone ? String(r.telephone) : ''
      const email = r.email ? String(r.email) : ''
      const sub = [tel, email].filter(Boolean).join(' · ')
      return {
        id: r.id as string,
        label: full,
        sublabel: sub || undefined,
        searchText: `${full} ${tel} ${email}`,
      }
    })
  }, [clients])

  // ── Helper: convert HH:MM to minutes ──
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  // ── Helper: get start/end minutes for a creneau type ──
  const creneauToRange = (creneauType: string, heureDebut?: string, heureFin?: string): [number, number] => {
    if (creneauType === 'journee') return [timeToMinutes(horaires.debutMatin), timeToMinutes(horaires.finAm)]
    if (creneauType === 'matin') return [timeToMinutes(horaires.debutMatin), timeToMinutes(horaires.finMatin)]
    if (creneauType === 'apres_midi') return [timeToMinutes(horaires.debutAm), timeToMinutes(horaires.finAm)]
    // creneau personnalise
    return [timeToMinutes(heureDebut || horaires.debutMatin), timeToMinutes(heureFin || horaires.finAm)]
  }

  // ── Detect conflicts for the new intervention before saving ──
  // Session 8 : prend en compte les liaisons multi-intervenants. Une
  // intervention existante "occupe" tous ses intervenants liés (Référent +
  // Équipiers). Si une seule liaison n'est pas trouvée, on retombe sur
  // `intervenant_id` legacy de la ligne planning_interventions.
  const detectConflitAvantSave = (
    ivId: string,
    dateStr: string,
    newStart: number,
    newEnd: number,
    excludeId?: string | null
  ): { titre: string; heureDebut: string; heureFin: string } | null => {
    const existingOnDay = planningData.filter(p => {
      const rec = p as R
      if ((rec.date_debut as string)?.split('T')[0] !== dateStr) return false
      if (excludeId && rec.id === excludeId) return false
      // Vérifier si ivId est lié à cette intervention (via jonction OU
      // legacy `intervenant_id`).
      const liaisons = interventionIntervenantsMap.get(rec.id as string)
      if (liaisons && liaisons.length > 0) {
        return liaisons.some(l => l.id === ivId)
      }
      return rec.intervenant_id === ivId
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
        const hd = String(rec.heure_debut || (rec.creneau === 'apres_midi' ? horaires.debutAm : horaires.debutMatin))
        const hf = String(rec.heure_fin || (rec.creneau === 'matin' ? horaires.finMatin : horaires.finAm))
        return {
          titre: String(rec.titre || rec.description_travaux || 'Intervention'),
          heureDebut: hd,
          heureFin: hf,
        }
      }
    }
    return null
  }

  // ── Session 8 : synchronisation des liaisons multi-intervenants ──
  // Diff propre : on supprime toutes les liaisons existantes pour cette
  // intervention puis on insère les nouvelles. Plus simple et plus sûr que
  // de calculer un diff fin (rare cas où l'utilisateur ajoute/retire 1 ligne).
  // En cas d'échec partiel (rare), on remonte l'erreur — le caller fait
  // un toast + refetch.
  const saveLiaisons = useCallback(async (interventionId: string, liaisons: InterventionIntervenant[]) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non connecté')
    // 1. Purge des anciennes liaisons (RLS filtre par user_id côté policy)
    const { error: delErr } = await supabase
      .from('intervention_intervenants')
      .delete()
      .eq('intervention_id', interventionId)
    if (delErr) throw new Error(delErr.message)
    if (liaisons.length === 0) return
    // 2. Insertion en bulk des nouvelles liaisons
    const rows = liaisons.map(l => ({
      user_id: user.id,
      intervention_id: interventionId,
      intervenant_id: l.id,
      role: l.role,
    }))
    const { error: insErr } = await supabase
      .from('intervention_intervenants')
      .insert(rows)
    if (insErr) throw new Error(insErr.message)
  }, [])

  const submitIntervention = async () => {
    if (!mIntervenant || !mDate) return
    if (mIntervenants.length === 0) {
      showToast('Sélectionnez au moins un intervenant')
      return
    }
    if (!findReferent(mIntervenants)) {
      showToast('Un Référent est obligatoire')
      return
    }

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
      startTime = mCreneau === 'apres_midi' ? horaires.debutAm : horaires.debutMatin
      endTime = mCreneau === 'matin' ? horaires.finMatin : horaires.finAm
    }

    // ── Verifier les conflits horaires AVANT d'enregistrer ──
    // Session 8 : on boucle sur TOUS les intervenants ajoutés (Référent +
    // Équipiers). Le premier conflit trouvé est remonté à l'utilisateur.
    // S'il confirme "Quand même", la création/mise à jour se poursuit même
    // si d'autres conflits existent sur les autres intervenants.
    const newStart = timeToMinutes(startTime)
    const newEnd = timeToMinutes(endTime)
    let conflitTrouve: { titre: string; heureDebut: string; heureFin: string } | null = null
    let ivNomEnConflit = 'L\'intervenant'
    for (const member of mIntervenants) {
      const found = detectConflitAvantSave(
        member.id,
        mDate,
        newStart,
        newEnd,
        editMode ? editId : null
      )
      if (found) {
        conflitTrouve = found
        const ivRec = intervenantMap.get(member.id) as R | undefined
        ivNomEnConflit = ivRec
          ? `${ivRec.prenom ?? ''} ${ivRec.nom ?? ''}`.trim()
          : 'L\'intervenant'
        break
      }
    }

    if (conflitTrouve && !showConflitConfirm) {
      // Show inline conflict warning — do not submit yet
      const conflitH = `${conflitTrouve.heureDebut.replace(':', 'h')} a ${conflitTrouve.heureFin.replace(':', 'h')}`
      setConflitConfirmMessage(
        `${ivNomEnConflit} est deja sur "${conflitTrouve.titre}" de ${conflitH}. Voulez-vous quand meme ${editMode ? 'modifier' : 'creer'} cette intervention ?`
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

      // Session 8 : `intervenant_id` legacy = ID du Référent. Garanti par la
      // validation en tête de fonction (un Référent existe forcément).
      const referentId = findReferent(mIntervenants)?.id ?? mIntervenant
      const payload = {
        intervenant_id: referentId,
        client_id: mClient || null,
        chantier_id: mChantier || null,
        // Saisie libre : utilisée uniquement si pas de client/chantier en base sélectionné.
        // On nettoie pour éviter de stocker à la fois un ID et un texte libre.
        client_libre: mClient ? null : (mClientLibre.trim() || null),
        // Session 12 V4 (29/05/2026) : 4 coordonnées libres stockées directement
        // sur l'intervention (pas de fiche client créée). Migration prod appliquée.
        client_libre_telephone:    mClient ? null : (mClientLibreTel.trim()     || null),
        client_libre_adresse:      mClient ? null : (mClientLibreAdresse.trim() || null),
        client_libre_code_postal:  mClient ? null : (mClientLibreCP.trim()      || null),
        client_libre_ville:        mClient ? null : (mClientLibreVille.trim()   || null),
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
        // Session 8 : on synchronise les liaisons (purge + insert)
        await saveLiaisons(editId, mIntervenants)
        setShowModal(false)
        setEditMode(false); setEditId(null)
        refetch()
        refetchLiaisons()
        showToast('Intervention modifiee ✓')
      } else {
        const created = await insertRow('planning_interventions', payload)
        // Session 8 : on insère les liaisons sur la nouvelle intervention.
        // Si saveLiaisons échoue, l'intervention reste créée mais sans
        // liaisons : `planningMap` retombera sur `intervenant_id` legacy
        // (Référent) — l'utilisateur ne verra qu'1 ligne au lieu de N.
        // L'erreur est remontée au catch global pour toast.
        const newId = (created as R | null)?.id as string | undefined
        if (newId) await saveLiaisons(newId, mIntervenants)
        setShowModal(false)
        refetch()
        refetchLiaisons()
        showToast('Intervention creee ✓')
      }
    } catch (err) {
      // 28/05/2026 : on remonte le message Supabase au lieu du texte générique.
      // Permet à l'utilisateur de comprendre les erreurs CHECK constraint, RLS, etc.
      const message = err instanceof Error ? err.message : 'Erreur lors de la création'
      showToast(message.length > 120 ? message.slice(0, 117) + '...' : message)
    } finally { setSubmitting(false) }
  }

  // ── Drag & Drop ──
  // Session 8 (28/05/2026) — Multi-intervenants :
  //   Une intervention peut apparaître dans la ligne de plusieurs intervenants.
  //   Quand on drag depuis la ligne de X vers la ligne de Y :
  //     - Si X === Y : on déplace simplement la date (cas drag entre jours).
  //     - Si X !== Y : on retire X des liaisons et on ajoute Y. Si X était
  //       Référent, Y devient Référent. Le `intervenant_id` legacy de la
  //       ligne planning_interventions est mis à jour si nécessaire.
  //     - Cas Y déjà lié : on ne crée pas de doublon. Si X était Référent
  //       et Y équipier, Y devient le Référent (on retire X).
  const draggedFromIvIdRef = useRef<string | null>(null)
  const handleDragStart = (id: string, fromIvId?: string) => {
    setDraggedId(id)
    draggedFromIvIdRef.current = fromIvId ?? null
  }
  const handleDragEnd = () => { setDraggedId(null); setDragOverCell(null); draggedFromIvIdRef.current = null }
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
    const startTime = (intervention.creneau as string) === 'apres_midi' ? horaires.debutAm : horaires.debutMatin
    const endTime = (intervention.creneau as string) === 'matin' ? horaires.finMatin : horaires.finAm

    // Liaisons actuelles
    const currentLiaisons = interventionIntervenantsMap.get(draggedId) ?? []
    const fromIvId = draggedFromIvIdRef.current
    const sameIvLine = fromIvId !== null && fromIvId === intervenantId

    try {
      // 1. Update toujours la date_debut / date_fin
      const updatePayload: Record<string, unknown> = {
        date_debut: `${dateStr}T${startTime}:00`,
        date_fin: `${dateStr}T${endTime}:00`,
      }

      // 2. Si on change d'intervenant : adapter la liste des liaisons
      if (!sameIvLine && fromIvId) {
        const wasReferent = currentLiaisons.find(l => l.id === fromIvId)?.role === 'referent'
        const targetAlreadyLinked = currentLiaisons.some(l => l.id === intervenantId)
        // Construire la nouvelle liste
        let nextList: InterventionIntervenant[]
        if (targetAlreadyLinked) {
          // Y est déjà dans la liste : on retire X. Si X était Référent, Y
          // devient Référent.
          nextList = currentLiaisons
            .filter(l => l.id !== fromIvId)
            .map(l => ({ id: l.id, role: (wasReferent && l.id === intervenantId ? 'referent' : l.role) as InterventionRole }))
          // S'il ne reste plus de Référent (cas X seul Référent et Y était
          // équipier), on en promeut le premier de la liste.
          if (!nextList.some(l => l.role === 'referent') && nextList.length > 0) {
            nextList = nextList.map((l, i) => ({ id: l.id, role: (i === 0 ? 'referent' : 'equipier') as InterventionRole }))
          }
        } else {
          // Y pas dans la liste : on remplace X par Y, en gardant le rôle de X.
          nextList = currentLiaisons.map(l =>
            l.id === fromIvId
              ? { id: intervenantId, role: l.role }
              : { id: l.id, role: l.role }
          )
        }
        // intervenant_id legacy : = ID du Référent dans la nouvelle liste.
        const newReferent = nextList.find(l => l.role === 'referent')
        if (newReferent) updatePayload.intervenant_id = newReferent.id
        // Persister la liste mise à jour
        await updateRow('planning_interventions', draggedId, updatePayload)
        await saveLiaisons(draggedId, nextList)
      } else if (currentLiaisons.length === 0 && intervention.intervenant_id !== intervenantId) {
        // Cas legacy (intervention orpheline sans liaison + on la déplace
        // sur une autre ligne intervenant) : on met à jour `intervenant_id`
        // ET on crée la liaison correspondante.
        updatePayload.intervenant_id = intervenantId
        await updateRow('planning_interventions', draggedId, updatePayload)
        await saveLiaisons(draggedId, [{ id: intervenantId, role: 'referent' }])
      } else {
        // Drag entre jours sur la même ligne intervenant : juste la date.
        await updateRow('planning_interventions', draggedId, updatePayload)
      }
      refetch()
      refetchLiaisons()
      showToast('Intervention deplacee')
    } catch {
      showToast('Erreur lors du deplacement')
    }
    setDraggedId(null)
    draggedFromIvIdRef.current = null
  }

  // ── Intervenants list ──
  // Solo mode: show self + any subcontractors (type_contrat = 'sous-traitant')
  // Société mode: show all active intervenants
  // S2 : "available" = liste complète (utilisée pour la barre de chips et stats)
  //      "displayedIntervenants" = liste filtrée (utilisée pour le rendu de la grille)
  const availableIntervenants = useMemo(() => {
    if (isSociete) {
      // Session 9 : self en tête de liste pour la grille (cellule en haut).
      const list = intervenants.filter(iv => (iv as R).actif !== false)
      list.sort((a, b) => {
        const aSelf = (a as R).is_self === true ? 1 : 0
        const bSelf = (b as R).is_self === true ? 1 : 0
        return bSelf - aSelf
      })
      return list
    }
    // Solo mode: self + subcontractors
    // Session 9 : on prend l'intervenant marqué is_self en priorité, sinon
    // le 1er non-sous-traitant (rétrocompat avec les comptes Solo pré-S9).
    const explicitSelf = intervenants.find(iv => (iv as R).is_self === true) as R | undefined
    const legacySelf = explicitSelf ?? (intervenants.find(iv => (iv as R).type_contrat !== 'sous-traitant') as R | undefined)
    const selfArr = legacySelf ? [legacySelf] : []
    const subcontractors = intervenants.filter(iv => (iv as R).type_contrat === 'sous-traitant' && (iv as R).actif !== false)
    return [...selfArr, ...subcontractors]
  }, [intervenants, isSociete])

  // S2 — filtrage par chips intervenants : on retire ceux masqués via la barre de chips
  const displayedIntervenants = useMemo(() => {
    if (hiddenIntervenants.size === 0) return availableIntervenants
    return availableIntervenants.filter(iv => !hiddenIntervenants.has((iv as R).id as string))
  }, [availableIntervenants, hiddenIntervenants])

  // In Solo mode, check if there are any subcontractors (i.e., more than just self)
  const soloHasSubcontractors = !isSociete && availableIntervenants.length > 1

  // Session 12 V3 (29/05/2026) — Suppression du groupement par métier dans la
  // matrice. La recherche concurrence (Obat, Praxedo, Vertuoza, Tolteck,
  // Batappli) confirme qu'aucun outil ne groupe par métier dans la grille
  // planning : ça ajoute du bruit visuel sans bénéfice.
  // Liste plate triée : `Vous` (is_self) toujours en premier, puis ordre
  // alphabétique sur `prenom nom`. Le métier reste visible en chip discret
  // à côté du nom dans la colonne de gauche.
  const orderedIntervenants = useMemo(() => {
    const list = [...displayedIntervenants] as R[]
    list.sort((a, b) => {
      const aSelf = a.is_self === true
      const bSelf = b.is_self === true
      if (aSelf && !bSelf) return -1
      if (!aSelf && bSelf) return 1
      const aName = `${String(a.prenom ?? '')} ${String(a.nom ?? '')}`.trim()
      const bName = `${String(b.prenom ?? '')} ${String(b.nom ?? '')}`.trim()
      return aName.localeCompare(bName, 'fr', { sensitivity: 'base' })
    })
    return list
  }, [displayedIntervenants])

  // S2 — Helpers densité : classes Tailwind dépendantes de density
  // Confort = cases actuelles (90px min, fonts normales)
  // Compact = cases plus serrées (~50px min, paddings réduits, line-3 masquée)
  const isCompact = density === 'compact'
  const cellMinHeightClass = isCompact ? 'min-h-[50px]' : 'min-h-[90px]'
  const cellPaddingClass = isCompact ? 'px-1 py-0.5' : 'px-1.5 py-1'
  const interventionPaddingClass = isCompact ? 'p-1 pr-5' : 'p-2 pr-6'
  const interventionGapClass = isCompact ? 'mb-0.5' : 'mb-1'
  // V1 Fix #8 (28/05/2026) : texte des cases bumpé d'un cran (Confort uniquement)
  // pour améliorer la lisibilité sans casser la densité. Compact reste petit.
  const titreLineClass = isCompact ? 'hidden' : 'hidden sm:block text-[12px] font-medium opacity-75 mt-0.5 line-clamp-2 leading-snug'
  const clientLineFontClass = isCompact ? 'text-[10px]' : 'text-[12px]'

  // S2 — Helpers pour la barre de chips et le groupement
  const toggleIntervenantVisibility = (id: string) => {
    setHiddenIntervenants(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const showAllIntervenants = () => setHiddenIntervenants(new Set())
  const hideAllIntervenants = () => setHiddenIntervenants(new Set(availableIntervenants.map(iv => (iv as R).id as string)))

  // S2 — La barre de chips ne s'affiche que si pertinente :
  // - Mode Solo + 0-1 intervenant : aucun intérêt (cf. brief)
  // - Mode Société ou Solo avec sous-traitants : on l'affiche
  const showChipsBar = (isSociete && availableIntervenants.length >= 2) || soloHasSubcontractors

  // ── Name helpers ──
  // Session 9 : si l'intervenant est marqué is_self, on affiche "Vous"
  // partout dans le planning (en mode Société) au lieu du nom de l'entreprise.
  const ivName = (id: string) => {
    const iv = intervenantMap.get(id) as R | undefined
    if (!iv) return '—'
    if (iv.is_self === true) return 'Vous'
    return `${iv.prenom ?? ''} ${String(iv.nom ?? '').charAt(0)}.`
  }
  const ivFullName = (id: string) => {
    const iv = intervenantMap.get(id) as R | undefined
    if (!iv) return '—'
    if (iv.is_self === true) return 'Vous'
    return `${iv.prenom ?? ''} ${iv.nom ?? ''}`.trim()
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
            Session 13 V2 (29/05/2026) — Le bandeau orange "Êtes-vous
            intervenant ?" a été SUPPRIMÉ. La gestion "Vous" passe
            désormais intégralement par la page Mon équipe (cf. décision
            Session 13 V2 et useEffect plus haut).
        ════════════════════════════════════════════════════════════ */}

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
                {/* Vague 3 — Toggle Vue Agenda / Matrice (segment control)
                    Détection auto via forme juridique au 1er mount + override
                    manuel persisté en localStorage (cf. useViewModeAuto). */}
                <div className="flex bg-[#f6f8fb] rounded-lg p-0.5 gap-0.5" role="group" aria-label="Type de vue planning">
                  <button
                    onClick={() => handleSetViewMode('agenda')}
                    aria-pressed={effectiveViewMode === 'agenda'}
                    title="Vue agenda (par jour, idéal mode Solo)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${effectiveViewMode === 'agenda' ? 'bg-white text-[#0f1a3a] shadow-sm' : 'text-[#64748b] hover:text-[#0f1a3a]'}`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Agenda</span>
                  </button>
                  <button
                    onClick={() => handleSetViewMode('matrix')}
                    aria-pressed={effectiveViewMode === 'matrix'}
                    title="Vue matrice (intervenants × jours)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${effectiveViewMode === 'matrix' ? 'bg-white text-[#0f1a3a] shadow-sm' : 'text-[#64748b] hover:text-[#0f1a3a]'}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Matrice</span>
                  </button>
                </div>
                {/* S2 — Toggle densité Compact / Confort (segment control) */}
                <div className="flex bg-[#f6f8fb] rounded-lg p-0.5 gap-0.5" role="group" aria-label="Densité d'affichage">
                  <button
                    onClick={() => setDensity('confort')}
                    aria-pressed={density === 'confort'}
                    title="Affichage confort (cases larges)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${density === 'confort' ? 'bg-white text-[#0f1a3a] shadow-sm' : 'text-[#64748b] hover:text-[#0f1a3a]'}`}
                  >
                    <Rows3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Confort</span>
                  </button>
                  <button
                    onClick={() => setDensity('compact')}
                    aria-pressed={density === 'compact'}
                    title="Affichage compact (cases serrées)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${density === 'compact' ? 'bg-white text-[#0f1a3a] shadow-sm' : 'text-[#64748b] hover:text-[#0f1a3a]'}`}
                  >
                    <Rows4 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Compact</span>
                  </button>
                </div>
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

            {/* ── S2 — Barre de chips intervenants (filtres rapides) ──
                Permet de masquer/afficher chaque intervenant d'un clic. État persisté.
                Masquée en mode Solo sans sous-traitants (0-1 intervenant = inutile). */}
            {showChipsBar && (
              <div className="px-5 py-3 border-b border-[#e6ecf2] bg-[#fafbfd]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3]">
                    Intervenants affichés ({availableIntervenants.length - hiddenIntervenants.size}/{availableIntervenants.length})
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <button onClick={showAllIntervenants} className="text-[#5ab4e0] hover:underline disabled:opacity-40 disabled:no-underline" disabled={hiddenIntervenants.size === 0}>
                      Tout afficher
                    </button>
                    <span className="text-[#cbd5e1]">·</span>
                    <button onClick={hideAllIntervenants} className="text-[#64748b] hover:text-[#0f1a3a] hover:underline disabled:opacity-40 disabled:no-underline" disabled={hiddenIntervenants.size === availableIntervenants.length}>
                      Tout masquer
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {availableIntervenants.map(iv => {
                    const r = iv as R
                    const ivId = r.id as string
                    const color = colorMap.get(ivId) ?? PALETTE[0]
                    const isHidden = hiddenIntervenants.has(ivId)
                    // Session 9 : "Vous" pour le self
                    const isSelfChip = r.is_self === true
                    // V1 Fix #2 (28/05/2026) : prenom + nom complet (au lieu d'initiale + nom).
                    // Wrap autorisé sur 2 lignes pour les noms longs (whitespace-normal + leading-tight).
                    // "Vous" reste seul. Min-width pour éviter chips minuscules, max-width pour borner.
                    const fullLabel = isSelfChip
                      ? 'Vous'
                      : (`${String(r.prenom ?? '').trim()} ${String(r.nom ?? '').trim()}`.trim() || 'Sans nom')
                    const isChipDragged = draggedChipIvId === ivId
                    return (
                      <button
                        key={ivId}
                        onClick={() => toggleIntervenantVisibility(ivId)}
                        // Fix #4 (Vague 2) : drag chip → case planning. Payload via
                        // dataTransfer 'text/intervenant' pour différencier du drag
                        // intervention entre cases (qui n'utilise pas dataTransfer).
                        draggable={!isHidden}
                        onDragStart={e => {
                          if (isHidden) { e.preventDefault(); return }
                          e.dataTransfer.setData('text/intervenant', ivId)
                          e.dataTransfer.effectAllowed = 'copy'
                          setDraggedChipIvId(ivId)
                        }}
                        onDragEnd={() => setDraggedChipIvId(null)}
                        aria-pressed={!isHidden}
                        title={isHidden ? `Afficher ${ivFullName(ivId)}` : `Glisser sur une case pour planifier ${ivFullName(ivId)} (clic = masquer/afficher)`}
                        className={`flex items-start gap-1.5 px-2.5 py-1 rounded-2xl text-[11px] font-semibold whitespace-normal leading-tight text-left transition-all border min-w-[110px] max-w-[180px] ${
                          isHidden
                            ? 'bg-white border-[#e6ecf2] text-[#94a3b8] hover:border-[#cbd5e1]'
                            : 'border-transparent text-white shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing'
                        } ${isChipDragged ? 'opacity-50 ring-2 ring-sky' : ''}`}
                        style={!isHidden ? { background: color.hex } : undefined}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-extrabold flex-shrink-0 mt-0.5 ${isHidden ? 'bg-[#f1f5f9] text-[#94a3b8]' : 'bg-white/25 text-white'}`}
                        >
                          {initials(`${r.prenom ?? ''} ${r.nom ?? ''}`)}
                        </span>
                        <span className="line-clamp-2 break-words">{fullLabel}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Session 13 V2.2 — État vide réservé au mode Société.
                En AE/Solo, l'artisan sait qui il est : on n'a pas besoin
                d'afficher de bandeau. Les interventions s'affichent
                directement dans l'agenda sans ligne intervenant. */}
            {isSociete && availableIntervenants.length === 0 && (
              <div className="m-4 bg-cream/50 border border-gray-200 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="font-syne text-lg text-[#0f1a3a] mb-2">Aucun membre d&apos;équipe configuré</h3>
                <p className="text-sm font-manrope text-gray-600 mb-4 max-w-md mx-auto">
                  Pour planifier en mode Société, ajoutez vos collaborateurs dans la page Mon équipe.
                </p>
                <Link
                  href="/dashboard/equipe"
                  className="inline-flex items-center gap-2 bg-orange hover:bg-orange-hover text-white font-syne font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Aller à Mon équipe
                </Link>
              </div>
            )}

            {/* Vague 3 — Vue Agenda (1 semaine, colonnes-jours) — mode AE/EI */}
            {!(isSociete && availableIntervenants.length === 0) && effectiveViewMode === 'agenda' && detailWeeks[0] && (
              <div className="p-3">
                <SoloAgendaView
                  days={detailWeeks[0].days}
                  interventionsByDay={planningByDate}
                  colorMap={colorMap}
                  intervenantMap={intervenantMap}
                  interventionIntervenantsMap={interventionIntervenantsMap}
                  conflicts={conflicts}
                  density={density}
                  draggedId={draggedId}
                  dragOverCell={dragOverCell}
                  setDragOverCell={setDragOverCell}
                  onOpenPanel={openPanel}
                  onOpenModal={openModal}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  showToast={showToast}
                  shortTime={shortTime}
                  creneauLabel={creneauLabel}
                  clNameFromIntervention={clNameFromIntervention}
                  getTypeInterventionMeta={getTypeInterventionMeta}
                  getStatutPastilleColor={getStatutPastilleColor}
                  statuts={STATUTS}
                  horaires={horaires}
                  initials={initials}
                  selfIntervenantId={selfIntervenantId}
                  showWeekend={showWeekend}
                  hasMultipleIntervenants={hasMultipleIntervenantsOnMonth}
                  onSwitchToMatrix={() => setTempMatrixOverride(true)}
                />
              </div>
            )}

            {/* Bandeau "Retour à l'agenda" — visible uniquement quand le tempMatrixOverride
                est actif (l'utilisateur a cliqué "Voir par intervenant" depuis SoloAgendaView). */}
            {!(isSociete && availableIntervenants.length === 0) && effectiveViewMode === 'matrix' && tempMatrixOverride && (
              <div className="px-4 py-2 border-b border-[#e6ecf2] flex items-center justify-between bg-[#fef5ee]">
                <span className="text-[11px] font-semibold text-[#b85c1a]">
                  Vue matrice temporaire (basculée depuis l&apos;agenda)
                </span>
                <button
                  type="button"
                  onClick={() => setTempMatrixOverride(false)}
                  className="text-[11px] font-semibold text-[#e87a2a] hover:underline"
                >
                  Retour à l&apos;agenda
                </button>
              </div>
            )}

            {/* 5 weeks grid (vue Matrice — comportement historique inchangé) */}
            {!(isSociete && availableIntervenants.length === 0) && effectiveViewMode === 'matrix' && (
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

                      {/* ── Session 12 V3 (29/05/2026) — Liste plate triée ──
                          Suppression du groupement par métier (entêtes ÉLECTRICIEN /
                          PAYSAGISTE...). Tous les concurrents (Obat, Praxedo,
                          Vertuoza, Tolteck, Batappli) affichent la matrice à plat.
                          Tri : `Vous` (is_self) toujours en premier, puis
                          alphabétique sur `prenom nom`. Le métier reste visible
                          comme petit chip discret à droite du nom. */}
                      {orderedIntervenants.map(iv => {
                        const r = iv as R
                        const ivId = r.id as string
                        const color = colorMap.get(ivId) ?? PALETTE[0]

                        return (
                          <div key={`${wi}-${ivId}`} className="contents">
                            {/* Label — hidden in Solo mode without subcontractors */}
                            {(isSociete || soloHasSubcontractors) && (() => {
                              // Session 9 : libellé "Vous" pour le self (au lieu du nom de l'entreprise).
                              const isSelfRow = r.is_self === true
                              const fullLabel = isSelfRow ? 'Vous' : `${String(r.prenom ?? '')} ${String(r.nom ?? '')}`.trim()
                              const compactLabel = isSelfRow
                                ? 'Vous'
                                : (isSociete ? `${String(r.prenom ?? '')} ${String(r.nom ?? '').charAt(0)}.` : String(r.prenom ?? ''))
                              // Session 12 V3 : chip métier discret à côté du nom.
                              // Caché si métier vide (en mode Solo `Vous` sans métier
                              // entreprise → rien d'affiché, on n'invente pas).
                              const metierChip = String(r.metier ?? '').trim()
                              return (
                                <div className={`${isCompact ? 'px-2 py-1.5' : 'px-3 py-2.5'} border-r border-b border-[#e6ecf2] bg-[#f0f2f7]/50 flex items-center ${isCompact ? 'gap-2' : 'gap-2.5'}`}>
                                  <div className={`${isCompact ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-[10px]'} rounded-md flex items-center justify-center text-white font-bold flex-shrink-0`} style={{ background: color.hex }}>
                                    {initials(fullLabel)}
                                  </div>
                                  <div className="min-w-0 flex-1 flex items-center gap-2">
                                    <div className={`${isCompact ? 'text-[12px]' : 'text-sm'} font-syne font-bold text-[#0f1a3a] truncate`}>
                                      {compactLabel}
                                    </div>
                                    {metierChip && (
                                      <span
                                        className="text-[10px] text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap flex-shrink-0"
                                        title={metierChip}
                                      >
                                        {metierChip}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}

                            {/* Day cells */}
                            {week.days.map(day => {
                              const cellKey = `${ivId}__${day.dateStr}`
                              const interventions = planningMap.get(cellKey) ?? []
                              const isDragOver = dragOverCell === cellKey

                              // V1 Fix #10 (28/05/2026) : cellules vides
                              // teintées en gris très léger pour effet "papier
                              // quadrillé". Les cellules avec intervention(s)
                              // gardent leur fond couleur intervenant.
                              const isEmpty = interventions.length === 0
                              return (
                                <div key={cellKey}
                                  className={`${cellMinHeightClass} ${cellPaddingClass} min-w-0 overflow-hidden border-r border-b border-[#e6ecf2] last:border-r-0 relative group transition-all ${day.isToday ? 'bg-[#5ab4e0]/[.03]' : day.isWeekend ? 'bg-[#fafbfd]' : isEmpty ? 'bg-gray-50' : ''} ${isDragOver ? 'bg-[#5ab4e0]/10 outline-2 outline-dashed outline-[#5ab4e0] outline-offset-[-2px]' : ''}`}
                                  onDragOver={e => {
                                    // Fix #4 (Vague 2) : preventDefault autorise aussi le drop chip → case.
                                    e.preventDefault()
                                    setDragOverCell(cellKey)
                                  }}
                                  onDragLeave={() => setDragOverCell(null)}
                                  onDrop={e => {
                                    e.preventDefault()
                                    setDragOverCell(null)
                                    // Fix #4 : si on drop un chip intervenant (depuis la barre du haut),
                                    // on ouvre le modal Nouvelle intervention pré-rempli avec cet
                                    // intervenant + la date de la case. Sinon on retombe sur le
                                    // comportement existant (drag intervention entre cases).
                                    const droppedIvId = e.dataTransfer.getData('text/intervenant')
                                    if (droppedIvId) {
                                      setDraggedChipIvId(null)
                                      openModal(day.dateStr, droppedIvId)
                                      return
                                    }
                                    handleDrop(ivId, day.dateStr)
                                  }}>

                                  <div className="flex flex-col gap-0.5">
                                    {interventions.filter(isFiltered).map(item => {
                                      const rec = item as R
                                      const isConflict = conflicts.has(rec.id as string)
                                      const isDragged = draggedId === rec.id as string
                                      const statut = STATUTS.find(s => s.value === rec.statut)
                                      const isCreneau = (rec.creneau as string) === 'creneau'
                                      const heureDebut = rec.heure_debut as string || horaires.debutMatin
                                      const heureFin = rec.heure_fin as string || horaires.finAm

                                      // Hauteur proportionnelle pour créneaux (base 60px pour 480min journée)
                                      let heightPx = 0
                                      let timeDisplay = ''
                                      if (isCreneau) {
                                        const startMin = parseInt(heureDebut.split(':')[0]) * 60 + parseInt(heureDebut.split(':')[1])
                                        const endMin = parseInt(heureFin.split(':')[0]) * 60 + parseInt(heureFin.split(':')[1])
                                        const durationMin = endMin - startMin
                                        heightPx = Math.max(isCompact ? 28 : 40, Math.round((durationMin / 480) * (isCompact ? 40 : 60)))
                                        timeDisplay = `${shortTime(heureDebut)}-${shortTime(heureFin)}`
                                      }

                                      // ── Données case Maquette A "Compact informatif" ──
                                      const typeMeta = getTypeInterventionMeta(rec.type_intervention as string)
                                      const TypeIcon = typeMeta?.icon ?? null
                                      const clientName = clNameFromIntervention(rec)
                                      // Session 8 : nb total d'intervenants sur cette intervention.
                                      // Affiche un badge "+N" quand > 1, pour signaler la présence
                                      // d'équipiers en plus du référent.
                                      const recLiaisons = interventionIntervenantsMap.get(rec.id as string) ?? []
                                      const nbExtraIntervenants = Math.max(0, recLiaisons.length - 1)
                                      // Fallback titre -> ville client si pas de titre
                                      const titreRaw = String(rec.titre ?? rec.description_travaux ?? '').trim()
                                      let titreOuVille = titreRaw
                                      if (!titreOuVille && rec.client_id) {
                                        const cl = clientMap.get(rec.client_id as string) as R | undefined
                                        if (cl?.ville) titreOuVille = String(cl.ville)
                                      }
                                      // Tooltip riche pour cases tronquées
                                      const tooltipParts: string[] = []
                                      if (isCreneau) tooltipParts.push(timeDisplay)
                                      else tooltipParts.push(creneauLabel(rec.creneau as string))
                                      if (clientName) tooltipParts.push(clientName)
                                      if (titreRaw) tooltipParts.push(titreRaw)
                                      if (typeMeta) tooltipParts.push(typeMeta.label)
                                      const tooltip = isConflict
                                        ? 'Conflit : cet intervenant a une autre intervention sur le meme creneau'
                                        : tooltipParts.join(' · ')

                                      // Session 8 : on capture l'intervenant de DÉPART du drag
                                      // (la ligne où apparaissait la case). Sert dans handleDrop
                                      // à savoir quel intervenant retirer si on drag sur une autre ligne.
                                      return (
                                        <div key={rec.id as string}
                                          draggable
                                          onDragStart={() => handleDragStart(rec.id as string, ivId)}
                                          onDragEnd={handleDragEnd}
                                          onClick={() => openPanel(rec)}
                                          className={`relative ${interventionPaddingClass} rounded-lg ${interventionGapClass} cursor-grab active:cursor-grabbing transition-all border-l-[3px] leading-normal ${color.bg} ${color.border} ${color.text}
                                            ${isDragged ? 'opacity-30' : ''} ${isConflict ? 'ring-2 ring-[#ef4444] shadow-[0_0_0_2px_rgba(239,68,68,0.15)]' : ''} hover:shadow-md hover:scale-[1.01]`}
                                          style={isCreneau ? { minHeight: `${heightPx}px` } : {}}
                                          title={tooltip}>
                                          {isConflict && (
                                            <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-[#ef4444] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                                              <AlertTriangle className="w-3 h-3" />
                                              <span>Conflit</span>
                                            </div>
                                          )}
                                          {/* Icone type d'intervention en haut a droite */}
                                          {TypeIcon && (
                                            <span className="absolute top-1.5 right-1.5 opacity-60" aria-label={typeMeta?.label}>
                                              <TypeIcon className="w-3 h-3" />
                                            </span>
                                          )}
                                          {/* Session 8 : badge "+N équipiers" si multi-intervenants */}
                                          {nbExtraIntervenants > 0 && (
                                            <span
                                              className={`absolute ${TypeIcon ? 'top-1.5 right-6' : 'top-1.5 right-1.5'} inline-flex items-center gap-0.5 bg-white/70 backdrop-blur-sm text-[#0f1a3a] text-[9px] font-extrabold px-1 py-0.5 rounded-full shadow-sm`}
                                              title={`${recLiaisons.length} intervenants sur cette intervention`}
                                              aria-label={`${nbExtraIntervenants} équipier${nbExtraIntervenants > 1 ? 's' : ''} en plus du référent`}
                                            >
                                              +{nbExtraIntervenants}
                                            </span>
                                          )}
                                          {/* Ligne 1 : creneau horaire compact
                                              V1 Fix #8 : +1 cran en Confort (10→11 et 9→10). Compact inchangé. */}
                                          {isCreneau ? (
                                            <div className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} font-extrabold text-[#0f1a3a] leading-tight`}>
                                              {timeDisplay}
                                            </div>
                                          ) : (
                                            <div className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} font-bold uppercase tracking-wide opacity-70`}>
                                              {creneauLabel(rec.creneau as string)}
                                            </div>
                                          )}
                                          {/* Ligne 2 : nom client + pastille statut */}
                                          {clientName && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                              {statut && (
                                                <span
                                                  className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatutPastilleColor(rec.statut as string)}`}
                                                  aria-label={`Statut : ${statut.label}`}
                                                />
                                              )}
                                              <span className={`font-bold ${clientLineFontClass} truncate`}>{clientName}</span>
                                            </div>
                                          )}
                                          {/* Ligne 3 : titre ou ville (masque sur mobile pour compacite, masque aussi en mode Compact)
                                              Fix #9 : title natif pour tooltip au hover si le titre est tronqué (line-clamp-2 déjà appliqué). */}
                                          {titreOuVille && (
                                            <div className={titreLineClass} title={titreOuVille}>
                                              {titreOuVille}
                                            </div>
                                          )}
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
            )}
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

      {/* ── SIDE PANEL — Maquette A "Action-first" ── */}
      {showPanel && panelIntervention && (() => {
        // ── Pré-calculs ──
        const pi = panelIntervention
        const ivColor = colorMap.get(pi.intervenant_id as string)
        const ivRec = intervenantMap.get(pi.intervenant_id as string) as R | undefined
        const ivMetier = ivRec ? String(ivRec.metier ?? '') : ''
        const ivFull = ivFullName(pi.intervenant_id as string)
        const cl = pi.client_id ? (clientMap.get(pi.client_id as string) as R | undefined) : undefined
        const ch = pi.chantier_id ? (chantierMap.get(pi.chantier_id as string) as R | undefined) : undefined
        const dv = pi.devis_id ? (devisMap.get(pi.devis_id as string) as R | undefined) : undefined
        const statut = STATUTS.find(s => s.value === pi.statut)
        const typeMeta = getTypeInterventionMeta(pi.type_intervention as string)
        const TypeIcon = typeMeta?.icon ?? null
        const creneauType = pi.creneau as string
        const isCreneau = creneauType === 'creneau'
        const heureD = isCreneau ? String(pi.heure_debut ?? horaires.debutMatin)
          : creneauType === 'apres_midi' ? horaires.debutAm : horaires.debutMatin
        const heureF = isCreneau ? String(pi.heure_fin ?? horaires.finAm)
          : creneauType === 'matin' ? horaires.finMatin : horaires.finAm
        const dureeStr = formatCreneauDuree(heureD, heureF)
        // Compteur d'interventions liees au chantier (calcule cote client)
        const chantierInterventionCount = ch
          ? planningData.filter(p => (p as R).chantier_id === ch.id).length
          : 0
        // Adresse : prioriser chantier, sinon client en base, sinon saisie libre intervention
        // (Session 12 V4 — 29/05/2026 : fallback sur les 4 colonnes libres
        //  `client_libre_adresse`, `client_libre_code_postal`, `client_libre_ville`,
        //  `client_libre_telephone` pour les interventions sans fiche client.)
        const addrLine = ch?.adresse_chantier || cl?.adresse || (pi.client_libre_adresse as string) || ''
        const addrCp = ch?.code_postal_chantier || cl?.code_postal || (pi.client_libre_code_postal as string) || ''
        const addrVille = ch?.ville_chantier || cl?.ville || (pi.client_libre_ville as string) || ''
        const addrFull = [addrLine, [addrCp, addrVille].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        const hasAddr = Boolean(addrLine || addrVille)
        // Titre / objet
        const titre = String(pi.titre ?? pi.description_travaux ?? '').trim()
        // Client libre fallback (Session 12 V4 : nom + téléphone éventuel)
        const clientLibre = !cl && pi.client_libre ? String(pi.client_libre) : ''
        const clientLibreTel = !cl ? String(pi.client_libre_telephone ?? '') : ''
        // Montant TTC du devis
        const montantTtc = dv ? Number(dv.montant_ttc ?? 0) : 0

        return (
          <>
            <div className="fixed inset-0 bg-[#0f1a3a]/20 z-40" onClick={closePanel} />
            <aside className="fixed top-0 right-0 w-full sm:w-[440px] h-full bg-white shadow-[-8px_0_40px_rgba(15,26,58,.12)] z-50 flex flex-col animate-[slideIn_.3s_ease]">
              {/* ── Header sticky avec close + modifier ── */}
              <div className="px-5 py-3 border-b border-[#e6ecf2] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button onClick={closePanel} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f6f8fb] text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all" aria-label="Fermer">
                    <X className="w-4 h-4" />
                  </button>
                  <h2 className="text-[13px] font-bold text-[#64748b] uppercase tracking-wider">Détail intervention</h2>
                </div>
                <button
                  onClick={() => { closePanel(); openEditModal(pi) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#5ab4e0]/10 text-[#1a6fb5] hover:bg-[#5ab4e0]/20 transition-all"
                  aria-label="Modifier les champs"
                  title="Modifier les champs"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* ── Barre de couleur intervenant ── */}
              {ivColor && (
                <div className="h-1 flex-shrink-0" style={{ backgroundColor: ivColor.hex }} />
              )}

              {/* ── Corps scrollable ── */}
              <div className="flex-1 overflow-y-auto">
                {/* ── Bloc Date / Heure / Durée + chips ── */}
                <div className="px-5 pt-4 pb-3">
                  <div className="text-[13px] font-semibold text-[#0f1a3a] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{formatDateFR(pi.date_debut as string)}</span>
                    <span className="text-[#7b8ba3]">·</span>
                    <span>
                      {isCreneau
                        ? `${shortTime(heureD)}-${shortTime(heureF)}`
                        : creneauLabel(creneauType)}
                    </span>
                    {dureeStr && (
                      <>
                        <span className="text-[#7b8ba3]">·</span>
                        <span className="text-[#5ab4e0] font-bold">{dureeStr}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {typeMeta && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${typeMeta.color}`}>
                        {TypeIcon && <TypeIcon className="w-3 h-3" />}
                        {typeMeta.label}
                      </span>
                    )}
                    {statut && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${statut.color}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${getStatutPastilleColor(pi.statut as string)}`} />
                        {statut.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Titre travaux ── */}
                {titre && (
                  <div className="px-5 pb-4">
                    <div className="text-[17px] font-extrabold text-[#0f1a3a] font-syne leading-snug">
                      {titre}
                    </div>
                  </div>
                )}

                {/* ── Bloc Client (avec actions Appeler / SMS / Email) ── */}
                {cl && (
                  <div className="px-5 py-4 border-t border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Client</div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0f1a3a] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {initials(`${cl.prenom ?? ''} ${cl.nom ?? ''}`)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0f1a3a] truncate">{String(cl.prenom ?? '')} {String(cl.nom ?? '')}</div>
                        {Boolean(cl.telephone) && (
                          <a href={`tel:${String(cl.telephone)}`} className="text-[13px] text-[#5ab4e0] font-medium hover:underline">{String(cl.telephone)}</a>
                        )}
                      </div>
                    </div>
                    {/* Bouton action terrain — uniquement Appeler (SMS/Email retirés le 28/05/2026
                        sur retour Jerem : l'artisan préfère gérer SMS/email manuellement). */}
                    {Boolean(cl.telephone) && (
                      <div className="flex mt-3">
                        <a href={`tel:${String(cl.telephone)}`}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#5ab4e0] text-white rounded-lg text-[12px] font-semibold hover:bg-[#2d8bc9] transition-all">
                          <Phone className="w-3.5 h-3.5" /> Appeler
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Client libre (si pas de fiche client en base)
                    Session 12 V4 : on affiche aussi téléphone + bouton Appeler
                    si le `client_libre_telephone` est renseigné sur l'intervention. */}
                {!cl && clientLibre && (
                  <div className="px-5 py-4 border-t border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Client</div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0f1a3a] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {initials(clientLibre)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0f1a3a] truncate">{clientLibre}</div>
                        {clientLibreTel && (
                          <a href={`tel:${clientLibreTel}`} className="text-[13px] text-[#5ab4e0] font-medium hover:underline">{clientLibreTel}</a>
                        )}
                      </div>
                    </div>
                    {clientLibreTel && (
                      <div className="flex mt-3">
                        <a href={`tel:${clientLibreTel}`}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#5ab4e0] text-white rounded-lg text-[12px] font-semibold hover:bg-[#2d8bc9] transition-all">
                          <Phone className="w-3.5 h-3.5" /> Appeler
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Bloc Adresse + Itinéraire GPS ── */}
                {hasAddr && (
                  <div className="px-5 py-4 border-t border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-2">Adresse</div>
                    <div className="flex items-start gap-1.5 text-[13px] text-[#0f1a3a]">
                      <MapPin className="w-4 h-4 text-[#7b8ba3] flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{addrFull}</span>
                    </div>
                    <a
                      href={buildGmapsLink(String(addrLine), String(addrCp), String(addrVille))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-all"
                    >
                      <Navigation className="w-4 h-4" /> Itinéraire GPS
                    </a>
                  </div>
                )}

                {/* ── Carte preview Chantier lié ── */}
                {ch && (
                  <div className="px-5 py-4 border-t border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Chantier lié</div>
                    <div className="rounded-xl border border-[#e6ecf2] p-3 hover:border-[#5ab4e0]/50 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[14px] font-bold text-[#0f1a3a] leading-snug">{String(ch.titre ?? '—')}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[#64748b]">
                        {Boolean(ch.statut) && (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5ab4e0]" />
                            <span className="font-semibold">{String(ch.statut)}</span>
                          </span>
                        )}
                        {chantierInterventionCount > 0 && (
                          <>
                            {Boolean(ch.statut) && <span className="text-[#7b8ba3]">·</span>}
                            <span>{chantierInterventionCount} intervention{chantierInterventionCount > 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                      <button onClick={() => { closePanel(); router.push(`/dashboard/chantiers/${ch.id}`) }}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#5ab4e0]/10 text-[#1a6fb5] rounded-lg text-[13px] font-semibold hover:bg-[#5ab4e0]/20 transition-all">
                        <Eye className="w-3.5 h-3.5" /> Voir le chantier
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Carte preview Devis lié ── */}
                {dv && (
                  <div className="px-5 py-4 border-t border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">Devis lié</div>
                    <div className="rounded-xl border border-[#e6ecf2] p-3 hover:border-[#5ab4e0]/50 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-bold text-[#0f1a3a]">{String(dv.numero ?? '—')}</div>
                          {Boolean(dv.objet) && (
                            <div className="text-[12px] text-[#64748b] line-clamp-1 mt-0.5">{String(dv.objet)}</div>
                          )}
                        </div>
                        <div className="text-[14px] font-extrabold text-[#22c55e] flex items-center gap-0.5 flex-shrink-0">
                          {montantTtc.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <button onClick={() => { closePanel(); router.push(`/dashboard/devis/${dv.id}`) }}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#5ab4e0]/10 text-[#1a6fb5] rounded-lg text-[13px] font-semibold hover:bg-[#5ab4e0]/20 transition-all">
                        <FileText className="w-3.5 h-3.5" /> Voir le devis
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Bloc Intervenants — Référent + Équipiers (Session 8) ── */}
                {/* Si liaisons existent → on affiche tous les membres avec leurs rôles.
                    Sinon (intervention orpheline / pas backfillée) → fallback sur le seul
                    intervenant_id legacy.
                    Le Référent est marqué d'une couronne. */}
                {(() => {
                  const liaisons = interventionIntervenantsMap.get(pi.id as string) ?? []
                  const members: { id: string; role: InterventionRole }[] = liaisons.length > 0
                    ? liaisons
                    : (pi.intervenant_id ? [{ id: pi.intervenant_id as string, role: 'referent' as InterventionRole }] : [])
                  if (members.length === 0) return null
                  return (
                    <div className="px-5 py-4 border-t border-[#e6ecf2]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-3">
                        {members.length > 1 ? 'Équipe sur l\'intervention' : 'Intervenant'}
                      </div>
                      <div className="space-y-2">
                        {members.map(m => {
                          const ivR = intervenantMap.get(m.id) as R | undefined
                          if (!ivR) return null
                          // Session 9 : libellé "Vous" pour le self.
                          const fullName = ivR.is_self === true
                            ? 'Vous'
                            : (`${ivR.prenom ?? ''} ${ivR.nom ?? ''}`.trim() || '—')
                          const metier = String(ivR.metier ?? '')
                          const col = colorMap.get(m.id)
                          return (
                            <div key={m.id} className="flex items-center gap-2">
                              {col && (
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.hex }} />
                              )}
                              <span className="text-[13px] font-semibold text-[#0f1a3a]">{fullName}</span>
                              {metier && (
                                <>
                                  <span className="text-[#7b8ba3]">·</span>
                                  <span className="text-[12px] text-[#64748b]">{metier}</span>
                                </>
                              )}
                              {m.role === 'referent' && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto"
                                  title="Référent — pilote de l'intervention"
                                >
                                  <Crown className="w-3 h-3" />
                                  Référent
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* ── Notes initiales (du formulaire) ── */}
                {Boolean(pi.notes) && (
                  <div className="px-5 py-4 border-t border-[#e6ecf2]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-2">Note initiale</div>
                    <div className="text-[13px] leading-relaxed text-[#64748b]">{String(pi.notes)}</div>
                  </div>
                )}

                {/* === Notes datées (V2) : présence client, préparation, rappels privés === */}
                <div className="px-5 py-4 border-t border-[#e6ecf2]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#5ab4e0]">
                      Rappels & notes pour ce jour
                    </h3>
                  </div>
                  <NotesIntervention interventionId={pi.id as string} />
                </div>
              </div>

              {/* ── Footer sticky : 3 actions principales ── */}
              <div className="px-5 py-3 border-t border-[#e6ecf2] flex-shrink-0 flex items-center gap-2 bg-white">
                {pi.statut !== 'termine' ? (
                  <button
                    onClick={async () => {
                      await updateRow('planning_interventions', pi.id as string, { statut: 'termine' })
                      showToast('Intervention terminée ✓')
                      closePanel()
                      refetch()
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500 text-white rounded-xl text-[13px] font-bold hover:bg-green-600 transition-all"
                  >
                    <Check className="w-4 h-4" />Terminée
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await updateRow('planning_interventions', pi.id as string, { statut: 'planifie' })
                      showToast('Intervention replanifiée ✓')
                      closePanel()
                      refetch()
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-100 text-amber-700 rounded-xl text-[13px] font-bold hover:bg-amber-200 transition-all"
                  >
                    <Clock className="w-4 h-4" />Replanifier
                  </button>
                )}
                <button
                  onClick={() => { closePanel(); openEditModal(pi) }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#f6f8fb] text-[#0f1a3a] rounded-xl text-[13px] font-semibold hover:bg-[#e6ecf2] transition-all"
                  aria-label="Replanifier (modifier date/heure)"
                  title="Replanifier"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Supprimer cette intervention ?')) return
                    try {
                      await deleteRow('planning_interventions', pi.id as string)
                      showToast('Intervention supprimée ✓')
                      closePanel()
                      refetch()
                    } catch {
                      showToast('Erreur lors de la suppression')
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-[13px] font-semibold hover:bg-red-100 transition-all"
                  aria-label="Supprimer l&apos;intervention"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </aside>
          </>
        )
      })()}

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
              {/* ── Fix #11 (Vague 2) : Infos client en lecture seule (mode édition uniquement) ──
                  Affiche adresse + boutons Itinéraire/Appeler en haut du modal pour que
                  l'utilisateur n'ait pas besoin de fermer Modifier pour aller consulter
                  ces infos dans le panneau Détail. */}
              {editMode && (() => {
                const editClientId = mClient || null
                const editChantierId = mChantier || null
                const editCl = editClientId ? (clientMap.get(editClientId) as R | undefined) : undefined
                const editCh = editChantierId ? (chantierMap.get(editChantierId) as R | undefined) : undefined
                // Priorité adresse chantier puis client puis saisie libre étendue (V4).
                // (cohérent avec le side panel ; permet de garder les infos visibles
                //  même quand l'intervention n'est pas liée à un client en base.)
                const addrLine = String(editCh?.adresse_chantier ?? editCl?.adresse ?? mClientLibreAdresse ?? '').trim()
                const addrCp = String(editCh?.code_postal_chantier ?? editCl?.code_postal ?? mClientLibreCP ?? '').trim()
                const addrVille = String(editCh?.ville_chantier ?? editCl?.ville ?? mClientLibreVille ?? '').trim()
                const addrFull = [addrLine, [addrCp, addrVille].filter(Boolean).join(' ')].filter(Boolean).join(', ')
                const hasAddr = Boolean(addrLine || addrVille)
                const telephone = editCl?.telephone ? String(editCl.telephone) : (mClientLibreTel.trim() || '')
                // Si rien à afficher (cas intervention libre sans client/chantier), on masque.
                if (!hasAddr && !telephone) return null
                return (
                  <div className="bg-sky/5 border border-sky/20 rounded-xl px-4 py-3 space-y-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#1a6fb5]">Infos client</div>
                    {hasAddr && (
                      <div className="flex items-start gap-1.5 text-[12px] text-[#0f1a3a]">
                        <MapPin className="w-3.5 h-3.5 text-[#5ab4e0] flex-shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{addrFull}</span>
                      </div>
                    )}
                    {telephone && (
                      <div className="flex items-center gap-1.5 text-[12px] text-[#0f1a3a]">
                        <Phone className="w-3.5 h-3.5 text-[#5ab4e0] flex-shrink-0" />
                        <span>{telephone}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      {hasAddr && (
                        <a
                          href={buildGmapsLink(addrLine, addrCp, addrVille)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-orange text-white rounded-lg text-[12px] font-semibold hover:bg-orange-hover transition-all"
                          aria-label="Ouvrir l'itinéraire dans Google Maps"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Itinéraire
                        </a>
                      )}
                      {telephone && (
                        <a
                          href={`tel:${telephone}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-sky text-white rounded-lg text-[12px] font-semibold hover:bg-sky-light transition-all"
                          aria-label={`Appeler ${telephone}`}
                        >
                          <Phone className="w-3.5 h-3.5" /> Appeler
                        </a>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* ── SWITCH MODE — 2 cards radio (Maquette A) ── */}
              {/* En mode édition, le mode est verrouillé sur celui déduit de l'intervention.
                  Le switch reste visible mais désactivé (visualisable, non modifiable). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={editMode}
                  onClick={() => switchMode('devis')}
                  className={`relative text-left p-3.5 rounded-xl border-2 transition-all ${
                    mMode === 'devis'
                      ? 'border-[#7c3aed] bg-[#7c3aed]/[.05] shadow-[0_2px_8px_rgba(124,58,237,.1)]'
                      : 'border-[#e6ecf2] bg-white hover:border-[#7c3aed]/40'
                  } ${editMode ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      mMode === 'devis' ? 'border-[#7c3aed]' : 'border-[#cbd5e1]'
                    }`}>
                      {mMode === 'devis' && <div className="w-2 h-2 rounded-full bg-[#7c3aed]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#7c3aed]" />
                        <span className="text-[13px] font-bold text-[#0f1a3a]">Depuis un devis signé</span>
                        {acceptedDevis.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold bg-[#7c3aed]/15 text-[#7c3aed] px-1.5 py-0.5 rounded-full">
                            {acceptedDevis.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748b] mt-1">Chantier facturable</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={editMode}
                  onClick={() => switchMode('libre')}
                  className={`relative text-left p-3.5 rounded-xl border-2 transition-all ${
                    mMode === 'libre'
                      ? 'border-[#5ab4e0] bg-[#5ab4e0]/[.05] shadow-[0_2px_8px_rgba(90,180,224,.1)]'
                      : 'border-[#e6ecf2] bg-white hover:border-[#5ab4e0]/40'
                  } ${editMode ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      mMode === 'libre' ? 'border-[#5ab4e0]' : 'border-[#cbd5e1]'
                    }`}>
                      {mMode === 'libre' && <div className="w-2 h-2 rounded-full bg-[#5ab4e0]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-[#5ab4e0]" />
                        <span className="text-[13px] font-bold text-[#0f1a3a]">Intervention libre</span>
                      </div>
                      <div className="text-[11px] text-[#64748b] mt-1">Visite, RDV, SAV…</div>
                    </div>
                  </div>
                </button>
              </div>

              {/* ─── Branche A : DEPUIS UN DEVIS ─── */}
              {mMode === 'devis' && (
                <div>
                  <Combobox
                    label="Devis à planifier"
                    required
                    placeholder="Tapez nom client, n° devis ou objet…"
                    items={devisItems}
                    value={mDevis || null}
                    onChange={(id) => handleDevisChange(id ?? '')}
                    icon={<FileText className="w-3.5 h-3.5" />}
                    emptyState={
                      acceptedDevis.length === 0
                        ? <div className="space-y-1.5">
                            <div className="font-semibold text-[#0f1a3a]">Aucun devis signé</div>
                            <div className="text-[11px]">Créez un devis et faites-le accepter pour pouvoir le planifier.</div>
                          </div>
                        : 'Aucun devis ne correspond'
                    }
                  />
                  {/* Preview du devis sélectionné */}
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
              )}

              {/* ─── Branche B : INTERVENTION LIBRE ─── */}
              {mMode === 'libre' && (
                <>
                  {/* Client (optionnel) :
                      - Combobox pour choisir un client existant
                      - OU saisie libre (nom) → déclenche un bloc de 4 champs
                        optionnels (tél, adresse, CP, ville) stockés DIRECTEMENT
                        sur l'intervention (pas de fiche client créée).
                      - Bouton discret "+ Enregistrer comme client" pour formaliser. */}
                  <div>
                    <Combobox
                      label="Client (optionnel)"
                      placeholder="Tapez un nom… ou laissez vide"
                      items={clientItems}
                      value={mClient || null}
                      onChange={(id) => {
                        setMClient(id ?? '')
                        if (id) {
                          // Sélection d'un client en base : on vide tous les libres
                          setMClientLibre('')
                          setMClientLibreTel('')
                          setMClientLibreAdresse('')
                          setMClientLibreCP('')
                          setMClientLibreVille('')
                        } else {
                          // V4.1 : l'utilisateur retire le client → le feedback n'a plus de sens
                          setLastEnregistreClientNom('')
                        }
                      }}
                      icon={<Users className="w-3.5 h-3.5" />}
                      emptyState="Aucun client trouvé. Tapez un nom dans le champ ci-dessous pour le stocker sur l'intervention."
                    />
                    {/* Saisie libre nom — affichée seulement si aucun client choisi */}
                    {!mClient && (
                      <input
                        type="text"
                        value={mClientLibre}
                        onChange={e => setMClientLibre(e.target.value)}
                        placeholder="ou tapez un nom libre (ex : M. Dupont, prospect à rappeler)"
                        className="mt-2 w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3] placeholder:italic"
                      />
                    )}
                    {/* Bloc coordonnées libres — affiché seulement si nom libre saisi (et aucun client choisi) */}
                    {!mClient && mClientLibre.trim().length > 0 && (
                      <div className="mt-2 bg-gray-100 border-2 border-gray-300 rounded-lg p-3 space-y-3">
                        <p className="text-[11px] italic text-gray-500 leading-snug">
                          Coordonnées (optionnelles) — stockées sur cette intervention uniquement.
                        </p>
                        <Input
                          label="Téléphone"
                          type="tel"
                          value={mClientLibreTel}
                          onChange={e => setMClientLibreTel(e.target.value)}
                          placeholder="06 12 34 56 78"
                        />
                        <Input
                          label="Adresse"
                          type="text"
                          value={mClientLibreAdresse}
                          onChange={e => setMClientLibreAdresse(e.target.value)}
                          placeholder="15 rue des Lilas"
                        />
                        <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
                          <Input
                            label="Code postal"
                            type="text"
                            value={mClientLibreCP}
                            onChange={e => setMClientLibreCP(e.target.value)}
                            maxLength={5}
                            placeholder="33000"
                          />
                          <Input
                            label="Ville"
                            type="text"
                            value={mClientLibreVille}
                            onChange={e => setMClientLibreVille(e.target.value)}
                            placeholder="Bordeaux"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleEnregistrerCommeClient}
                          disabled={enregistrerClientSaving}
                          className="text-xs text-sky hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enregistrerClientSaving ? 'Enregistrement…' : '+ Enregistrer comme client (créer la fiche)'}
                        </button>
                      </div>
                    )}
                    {/* V4.1 : feedback visuel post-enregistrement.
                        Tant que le client créé reste sélectionné, on rassure
                        l'utilisateur sur le fait que ses coordonnées ont bien
                        été persistées dans la fiche client. */}
                    {lastEnregistreClientNom && mClient && (
                      <div className="mt-2 text-[12px] text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Coordonnées enregistrées dans la fiche client <strong>{lastEnregistreClientNom}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Lieu / Chantier (saisie libre uniquement, plus pratique pour visites) */}
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />Lieu / Chantier (optionnel)
                    </label>
                    <input
                      type="text"
                      value={mChantierLibre}
                      onChange={e => setMChantierLibre(e.target.value)}
                      placeholder="Adresse, n° chantier ou repère (ex : 15 rue des Lilas)"
                      className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3]"
                    />
                  </div>
                </>
              )}

              {/* ─── Toujours visible (les 2 modes) : Type d'intervention en chips ─── */}
              {/* Bug latent corrigé : Type est désormais dispo aussi en mode 'devis'
                  (un artisan doit pouvoir taguer "métré sur site lié à D-2026-014"). */}
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Type d&apos;intervention</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { v: 'visite_courtoisie', l: 'Visite courtoisie' },
                    { v: 'premier_rdv', l: 'Premier RDV' },
                    { v: 'metre', l: 'Métré' },
                    { v: 'devis_sur_site', l: 'Devis sur site' },
                    { v: 'controle_qualite', l: 'Contrôle / SAV' },
                    { v: 'depannage', l: 'Dépannage' },
                    { v: 'entretien', l: 'Entretien' },
                    { v: 'autre', l: 'Autre' },
                  ].map(opt => {
                    const active = mTypeIntervention === opt.v
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setMTypeIntervention(active ? '' : opt.v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          active
                            ? 'bg-[#5ab4e0] border-[#5ab4e0] text-white shadow-[0_2px_6px_rgba(90,180,224,.3)]'
                            : 'bg-white border-[#e6ecf2] text-[#64748b] hover:border-[#5ab4e0]/40 hover:text-[#0f1a3a]'
                        }`}
                      >
                        {opt.l}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ─── Session 8 : Intervenants (multi-sélection avec rôles) ─── */}
              {/*
                Modes :
                  - Société : Combobox d'ajout + liste éditable (1er = Référent, autres = Équipiers)
                  - Solo sans sous-traitants : badge "Vous (artisan)" en read-only, comme avant
                  - Solo avec sous-traitants : Combobox d'ajout limité aux sous-traitants
                    (le Référent est déjà "Moi" par défaut)
                Le 1er ajouté devient Référent. Le bouton "Référent" sur chaque ligne permet
                de promouvoir un autre intervenant. La croix X retire (sauf si dernier).
              */}
              {(() => {
                const isSoloSelf = !isSociete && !soloHasSubcontractors
                return (
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
                      {isSoloSelf ? 'Intervenant' : `Intervenants ${mIntervenants.length > 0 ? `(${mIntervenants.length})` : '*'}`}
                    </label>
                    {/* Mode Solo sans sous-traitants : badge read-only */}
                    {isSoloSelf && (
                      <div className="w-full px-3.5 py-2.5 border border-[#5ab4e0]/30 rounded-xl text-sm bg-[#5ab4e0]/[.04] text-[#1a6fb5] font-semibold flex items-center gap-2">
                        <HardHat className="w-3.5 h-3.5 text-[#5ab4e0]" />
                        Vous (artisan)
                      </div>
                    )}
                    {/* Autres modes : Combobox d'ajout + liste éditable */}
                    {!isSoloSelf && (
                      <>
                        {/* Combobox d'ajout. Sélection = ajout immédiat à la liste. */}
                        <Combobox
                          items={availableIntervenantsForModal}
                          value={mAddIvBuffer}
                          onChange={(id) => {
                            if (!id) { setMAddIvBuffer(null); return }
                            setMIntervenants(prev => addIntervenant(prev, id))
                            setShowConflitConfirm(false); setConflitConfirmMessage('')
                            // Reset du buffer pour ne pas garder la dernière sélection
                            // affichée (l'item vient de quitter la liste filtrée de toute façon).
                            setMAddIvBuffer(null)
                          }}
                          placeholder={mIntervenants.length === 0
                            ? 'Choisir le Référent…'
                            : 'Ajouter un équipier…'}
                          icon={<Users className="w-3.5 h-3.5" />}
                          emptyState={
                            availableIntervenantsForModal.length === 0
                              ? 'Tous les intervenants sont déjà ajoutés.'
                              : 'Aucun intervenant trouvé'
                          }
                        />
                        {/* Session 13 V1 : bouton toujours visible "+ Ajouter un intervenant".
                            Ouvre une mini-modal de création légère (overlay au-dessus du modal
                            Nouvelle intervention). Après création, le nouvel intervenant est
                            ajouté immédiatement comme Équipier de l'intervention en cours. */}
                        <button
                          type="button"
                          onClick={() => openMiniCreate({
                            onCreated: (newId) => {
                              setMIntervenants(prev => addIntervenant(prev, newId))
                            },
                          })}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#e6ecf2] text-[#64748b] text-[11px] font-semibold hover:border-[#5ab4e0] hover:text-[#5ab4e0] hover:bg-[#5ab4e0]/5 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          Ajouter un intervenant
                        </button>
                        {/* Session 13 V2.2 — Mention rassurante : on confirme à
                            l'utilisateur que la création reste cohérente avec Mon équipe. */}
                        <p className="mt-1 text-[10px] text-[#7b8ba3] italic">
                          Le nouveau membre sera aussi enregistré dans Mon équipe.
                        </p>
                        {/* Liste des intervenants ajoutés */}
                        {mIntervenants.length > 0 && (
                          <ul className="mt-2 space-y-1.5">
                            {mIntervenants.map(member => {
                              const ivR = intervenantMap.get(member.id) as R | undefined
                              if (!ivR) return null
                              const fullName = `${ivR.prenom ?? ''} ${ivR.nom ?? ''}`.trim() || '(sans nom)'
                              const metier = String(ivR.metier ?? '')
                              // Session 9 : on détecte le self via le flag is_self (mode Société)
                              // OU le selfIntervenantId résolu (mode Solo legacy).
                              const isSelfMember = ivR.is_self === true
                              const isMe = isSelfMember || (!isSociete && member.id === selfIntervenantId)
                              const displayLabel = isSelfMember
                                ? 'Vous'
                                : (isMe ? 'Moi (artisan)' : fullName)
                              const col = colorMap.get(member.id) ?? PALETTE[0]
                              const isReferent = member.role === 'referent'
                              return (
                                <li
                                  key={member.id}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                    isReferent
                                      ? 'border-amber-300 bg-amber-50/60'
                                      : 'border-[#e6ecf2] bg-white'
                                  }`}
                                >
                                  <span
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                                    style={{ background: col.hex }}
                                  >
                                    {initials(displayLabel)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-semibold text-[#0f1a3a] truncate">{displayLabel}</div>
                                    {metier && !isMe && (
                                      <div className="text-[11px] text-[#7b8ba3] truncate">{metier}</div>
                                    )}
                                  </div>
                                  {/* Session 13 V2.2 — Référent discrétisé.
                                      Badge clair sur le Référent. Sur les autres :
                                      petite couronne discrète (icône seule, opacity réduite)
                                      qui devient visible au hover pour permettre la promotion. */}
                                  {isReferent ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-200 text-amber-800"
                                      title="Référent — pilote l'intervention"
                                    >
                                      <Crown className="w-3 h-3" />
                                      Référent
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setMIntervenants(prev => promoteReferent(prev, member.id))}
                                      className="w-6 h-6 flex items-center justify-center rounded-md text-[#7b8ba3] opacity-30 hover:opacity-100 hover:text-amber-600 transition-all"
                                      title="Définir comme Référent"
                                    >
                                      <Crown className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {/* Retirer (X) — désactivé pour le dernier intervenant restant */}
                                  <button
                                    type="button"
                                    onClick={() => setMIntervenants(prev => removeIntervenant(prev, member.id))}
                                    disabled={mIntervenants.length <= 1}
                                    className="w-6 h-6 flex items-center justify-center rounded-md text-[#7b8ba3] hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={mIntervenants.length <= 1 ? 'Au moins un intervenant requis' : 'Retirer'}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {/* Info bulle "Référent" si plusieurs */}
                        {mIntervenants.length > 1 && (
                          <p className="mt-1.5 text-[11px] text-[#7b8ba3] flex items-center gap-1">
                            <UserPlus className="w-3 h-3" />
                            Le Référent pilote l&apos;intervention. L&apos;intervention apparaît dans le planning de chacun.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Créneau */}
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Créneau</label>
                <select value={mCreneau} onChange={e => { setMCreneau(e.target.value as Creneau); setMConflitWarning(null); setShowConflitConfirm(false); setConflitConfirmMessage('') }} className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all">
                  {CRENEAUX.map(c => <option key={c.value} value={c.value}>{c.label} ({c.heures})</option>)}
                </select>
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

              {/* Détail de l'intervention — toujours visible et editable, optionnel.
                  Anciennement "Description des travaux" : renommé pour bien différencier du Type. */}
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Détail de l&apos;intervention <span className="text-[#7b8ba3] font-normal normal-case">(optionnel)</span></label>
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

      {/* Session 12 V4 (29/05/2026) : le mini-formulaire prospect a été supprimé.
          Remplacé par la saisie libre étendue (4 champs optionnels tél/adresse/CP/ville)
          dans le modal Nouvelle intervention, avec un bouton discret
          "+ Enregistrer comme client" pour formaliser la fiche si besoin. */}

      {/* ════════════════════════════════════════════════════════════
          Session 13 V2 (29/05/2026) — Le sous-modal "Lier votre compte"
          a été SUPPRIMÉ avec la refonte radicale. La gestion "Vous"
          passe désormais par Mon équipe.
      ════════════════════════════════════════════════════════════ */}

      {/* ════════════════════════════════════════════════════════════
          Session 13 V1 — Mini-modal "+ Ajouter un intervenant"
          Déclenché depuis le bouton "+ Ajouter un intervenant" du modal
          Nouvelle intervention. Comportement post-création : appel de
          miniCreate.onCreated(newId) — le caller ajoute le membre à
          mIntervenants comme Équipier.
      ════════════════════════════════════════════════════════════ */}
      {miniCreate.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">
                Ajouter un intervenant
              </h2>
              <button
                type="button"
                onClick={closeMiniCreate}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
                  Prénom
                </label>
                <Input
                  type="text"
                  value={mcPrenom}
                  onChange={(e) => setMcPrenom(e.target.value)}
                  placeholder="ex : Jérémy"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
                  Nom *
                </label>
                <Input
                  type="text"
                  value={mcNom}
                  onChange={(e) => setMcNom(e.target.value)}
                  placeholder="ex : Schmitt"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
                Métier
              </label>
              <Input
                type="text"
                value={mcMetier}
                onChange={(e) => setMcMetier(e.target.value)}
                placeholder="ex : Électricien"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
                Type de contrat
              </label>
              <select
                value={mcTypeContrat}
                onChange={(e) => setMcTypeContrat(e.target.value as typeof mcTypeContrat)}
                className="w-full px-3.5 py-2.5 border border-gray-400 bg-gray-100 hover:border-gray-500 rounded-xl text-sm focus:border-sky focus:ring-1 focus:ring-sky/20 outline-none transition-all"
              >
                <option value="cdi">Employé (CDI)</option>
                <option value="cdd">Employé (CDD)</option>
                <option value="apprenti">Apprenti</option>
                <option value="interimaire">Intérimaire</option>
                <option value="sous-traitant">Sous-traitant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
                Rôle
              </label>
              <select
                value={mcRole}
                onChange={(e) => setMcRole(e.target.value)}
                disabled={mcTypeContrat === 'apprenti'}
                className="w-full px-3.5 py-2.5 border border-gray-400 bg-gray-100 hover:border-gray-500 rounded-xl text-sm focus:border-sky focus:ring-1 focus:ring-sky/20 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— Non défini</option>
                <option value="Apprenti">Apprenti</option>
                <option value="Ouvrier">Ouvrier</option>
                <option value="Compagnon">Compagnon</option>
                <option value="Chef d'équipe">Chef d&apos;équipe</option>
                <option value="Dirigeant">Dirigeant</option>
              </select>
              {mcTypeContrat === 'apprenti' && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Verrouillé : un contrat d&apos;apprentissage impose le rôle Apprenti.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeMiniCreate}
                className="h-10 px-5 rounded-lg border border-gray-200 text-sm font-syne font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleMiniCreateSubmit}
                disabled={mcSaving || !mcNom.trim()}
                className="h-10 px-5 rounded-lg bg-orange hover:bg-orange-hover disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
              >
                {mcSaving ? 'Création…' : 'Créer'}
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
// ===================================================================
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
