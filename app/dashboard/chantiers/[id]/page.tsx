'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Pencil, User, Phone, Calendar, HardHat,
  FileText, Receipt, Clock, Plus, Download,
  ChevronLeft, ChevronRight, Check, X, Users, Zap, Trash2,
} from 'lucide-react'
import {
  useSupabaseRecord, useClients, useIntervenants, useDevis, useFactures,
  usePlanning, useAchats, useChantierNotes, useSousTraitantPaiements,
  insertRow, updateRow, deleteRow, LoadingSkeleton,
} from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { createFactureFromDevis } from '@/lib/services/devis-automatisms'
import { generatePacteTemplate } from '@/lib/pacte-chantier'
import { fetchAndDownloadPdf } from '@/lib/download-pdf'

// -------------------------------------------------------------------
// Types & helpers
// -------------------------------------------------------------------
type R = Record<string, unknown>
type TabKey = 'resume' | 'devis' | 'factures'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'resume', label: 'Vue générale', icon: HardHat },
  { key: 'devis', label: 'Devis', icon: FileText },
  { key: 'factures', label: 'Factures', icon: Receipt },
]

const NOTE_CATS = [
  { value: 'urgent', label: 'Urgent', cls: 'bg-[#ef4444] text-white', icon: '🔴' },
  { value: 'rappel', label: 'À faire', cls: 'bg-[#e87a2a] text-white', icon: '🟠' },
  { value: 'materiel', label: 'Matériel', cls: 'bg-[#8b5cf6] text-white', icon: '🔧' },
  { value: 'appel', label: 'Appel / Contact', cls: 'bg-[#e8f4fb] text-[#2d8bc9]', icon: '📞' },
  { value: 'info', label: 'Note', cls: 'bg-[#f6f8fb] text-[#7b8ba3]', icon: '📝' },
]

const NOTE_PLACEHOLDERS: Record<string, string> = {
  urgent: 'Ex : Régler le problème de fuite avant mardi',
  rappel: 'Ex : Faire le point avec le client vendredi',
  materiel: 'Ex : Louer une pelleteuse chez Loxam',
  appel: 'Ex : Appeler le plombier pour devis sous-traitance',
  info: 'Ex : Le client sera absent du 20 au 25',
}

const PALETTE_HEX = ['#5ab4e0', '#e87a2a', '#22c55e', '#7c3aed', '#f5c842', '#ef4444']
const PALETTE_BG = ['bg-[#eef7fc]', 'bg-[#fef5ee]', 'bg-[#effbf2]', 'bg-[#f3effe]', 'bg-[#fefce8]', 'bg-[#fef2f2]']

function formatEur(n: number) { return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + '€' }
function formatDate(d: string | undefined) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR') }
function initials(name: string) { return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) }

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function getMonday(d: Date): Date {
  const date = new Date(d); const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff); date.setHours(0, 0, 0, 0); return date
}
// fmtISO en LOCAL (jamais toISOString() qui décale en UTC et fait perdre 1 jour
// selon le fuseau horaire). Bug récurrent documenté dans la mémoire projet.
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isSameDay(d1: Date, d2: Date) { return fmtISO(d1) === fmtISO(d2) }

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function ChantierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  // Data
  const { data: chantier, loading: l1 } = useSupabaseRecord<R>('chantiers', id)
  const { data: clients } = useClients()
  const { data: intervenants } = useIntervenants()
  const { data: allDevis } = useDevis()
  const { data: allFactures } = useFactures()
  const { data: allPlanning, refetch: refetchPlanning } = usePlanning()
  const { data: allAchats } = useAchats()
  const { data: chantierNotes, refetch: refetchNotes } = useChantierNotes(id)
  const { data: stPaiements, refetch: refetchST } = useSousTraitantPaiements(id)

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('resume')
  // Fenetre Gantt = J-2 a J+7 (10 jours), centree sur aujourd'hui avec
  // 2 jours de contexte passe pour voir les interventions des jours d'avant.
  const [ganttStart, setGanttStart] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - 2)
    return d
  })
  const [newNote, setNewNote] = useState('')
  const [newNoteCat, setNewNoteCat] = useState('info')
  const [toast, setToast] = useState<string | null>(null)

  // Equipe du chantier
  const [equipe, setEquipe] = useState<R[]>([])
  const [showAddEquipe, setShowAddEquipe] = useState(false)
  const [addEquipeIv, setAddEquipeIv] = useState('')
  const [addEquipeDate, setAddEquipeDate] = useState('')
  const [equipeAdding, setEquipeAdding] = useState(false)
  const [factureCreating, setFactureCreating] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editTitre, setEditTitre] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDateDebut, setEditDateDebut] = useState('')
  const [editDateFin, setEditDateFin] = useState('')
  const [editAdresse, setEditAdresse] = useState('')
  const [editVille, setEditVille] = useState('')
  // Champs PDF V2 — pour la fiche client envoyée
  const [editPreparationClient, setEditPreparationClient] = useState('')
  const [editNonInclus, setEditNonInclus] = useState('')
  const [editModalitesPerso, setEditModalitesPerso] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingRecap, setExportingRecap] = useState(false)
  // Modal d'export PDF (V2 — option Pacte de chantier)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportWithPacte, setExportWithPacte] = useState(false)
  const [exportPacteTexte, setExportPacteTexte] = useState('')

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }, [])

  // Fetch equipe assignee au chantier
  const fetchEquipe = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('chantier_intervenants')
        .select('*')
        .eq('chantier_id', id)
        .order('date_assignation', { ascending: true })
      setEquipe(data ?? [])
    } catch (_) { /* table optionnelle */ }
  }, [id])

  useEffect(() => { fetchEquipe() }, [fetchEquipe])

  // ── Derived data ──
  const client = useMemo(() => {
    if (!chantier?.client_id) return null
    return (clients.find(c => (c as R).id === chantier.client_id) as R) ?? null
  }, [clients, chantier])

  const chantierDevis = useMemo(() =>
    allDevis.filter(d => (d as R).chantier_id === id) as R[],
  [allDevis, id])

  const chantierFactures = useMemo(() =>
    allFactures.filter(f => (f as R).chantier_id === id) as R[],
  [allFactures, id])

  const chantierInterventions = useMemo(() =>
    allPlanning.filter(p => (p as R).chantier_id === id) as R[],
  [allPlanning, id])

  // SYNC ÉQUIPE ↔ PLANNING : tout intervenant planifié sur ce chantier
  // doit apparaître dans l'équipe (sinon doublon de saisie).
  // ATTENTION : doit être déclaré APRÈS chantierInterventions (block-scoped const).
  const equipeAffichage = useMemo(() => {
    const result = [...(equipe as R[])]
    const knownIds = new Set(result.map(e => e.intervenant_id as string))

    // Dédupliquer strictement sur intervenant_id UNIQUEMENT
    const seenPlanning = new Set<string>()
    const toAdd: string[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(chantierInterventions as any[]).forEach((p) => {
      const ivId = p?.intervenant_id as string | undefined
      // Ajouter SEULEMENT si:
      // 1. ivId est non-vide
      // 2. Pas dans les manuels (knownIds)
      // 3. Pas déjà vu dans le planning (seenPlanning)
      if (ivId && !knownIds.has(ivId) && !seenPlanning.has(ivId)) {
        seenPlanning.add(ivId)
        toAdd.push(ivId)
      }
    })

    toAdd.forEach(ivId => {
      result.push({
        id: `auto-${ivId}`,
        chantier_id: id,
        intervenant_id: ivId,
        date_assignation: new Date().toISOString(),
        _autoFromPlanning: true,
      })
    })

    return result
  }, [equipe, chantierInterventions, id])

  const chantierAchats = useMemo(() =>
    allAchats.filter(a => (a as R).chantier_id === id) as R[],
  [allAchats, id])

  // Maps
  const intervenantMap = useMemo(() => {
    const map = new Map<string, R>()
    intervenants.forEach(iv => { const r = iv as R; map.set(r.id as string, r) })
    return map
  }, [intervenants])

  const colorMap = useMemo(() => {
    const map = new Map<string, number>()
    intervenants.forEach((iv, i) => map.set((iv as R).id as string, i % PALETTE_HEX.length))
    return map
  }, [intervenants])

  // ── Finances (calculées dynamiquement depuis les factures) ──
  const finances = useMemo(() => {
    // ── DEVISÉ TTC ──
    // TOUJOURS calculer depuis les devis liés au chantier (somme des montants).
    // On n'utilise PLUS chantier.montant_devis_total qui est une valeur obsolète
    // figée à la création du chantier (cf. bug "42 403€" alors que somme = 27 120€).
    const deviseTotal = chantierDevis.reduce((sum, d) => sum + Number(d.montant_ttc ?? 0), 0)

    // ── FACTURÉ TTC ──
    // Déduplication par devis_id : si plusieurs factures existent pour le MÊME
    // devis (cas des doublons accidentels), on garde uniquement la facture la
    // plus récente par devis. Évite l'absurdité "Facturé > Devisé" (cf. bug 121%).
    // Les factures sans devis_id sont toutes comptées (factures manuelles).
    const facturesParDevis = new Map<string, R>()
    const facturesSansDevis: R[] = []
    chantierFactures.forEach(f => {
      const devisId = f.devis_id as string | null | undefined
      if (!devisId) {
        facturesSansDevis.push(f)
        return
      }
      const existing = facturesParDevis.get(devisId)
      const fDate = String(f.date_emission ?? f.created_at ?? '')
      const eDate = existing ? String(existing.date_emission ?? existing.created_at ?? '') : ''
      if (!existing || fDate > eDate) facturesParDevis.set(devisId, f)
    })
    const facturesUtiles = [...Array.from(facturesParDevis.values()), ...facturesSansDevis]
    const factureTotal = facturesUtiles.reduce((sum, f) => sum + Number(f.montant_ttc ?? 0), 0)

    // ── ENCAISSÉ ──
    // Somme des factures dont statut === 'payee' (parmi les facturesUtiles dédupliquées)
    const encaisse = facturesUtiles
      .filter(f => f.statut === 'payee')
      .reduce((sum, f) => sum + Number(f.montant_ttc ?? 0), 0)

    // ── RESTE À FACTURER ──
    // Cap à 0 : si Facturé > Devisé (cas anormal), on n'affiche pas un négatif
    const reste = Math.max(0, deviseTotal - factureTotal)

    // ── AVANCEMENT PAR DEVIS ──
    // Un devis est "facturé" SEULEMENT s'il a au moins une facture LIÉE EXISTANTE
    // (pas juste un statut "facture" ou "signe" qui peut être obsolète).
    const devisCount = chantierDevis.length
    const devisIdsAvecFacture = new Set<string>()
    chantierFactures.forEach(f => {
      const dId = f.devis_id as string | null | undefined
      if (dId) devisIdsAvecFacture.add(dId)
    })
    const devisFactures = chantierDevis.filter(d => devisIdsAvecFacture.has(d.id as string)).length
    const pctDevis = devisCount > 0 ? Math.min(100, Math.round((devisFactures / devisCount) * 100)) : 0

    // ── AVANCEMENT VALEUR / ENCAISSEMENT ──
    // Cap à 100% pour éviter les valeurs absurdes (>100%) en cas d'incohérence
    const pctValeur = deviseTotal > 0 ? Math.min(100, Math.round((factureTotal / deviseTotal) * 100)) : 0
    const pctEncaissement = deviseTotal > 0 ? Math.min(100, Math.round((encaisse / deviseTotal) * 100)) : 0

    // ── RENTABILITÉ ──
    const totalST = (stPaiements as R[]).reduce((sum, p) => sum + Number(p.montant_prevu ?? 0), 0)
    const totalAchats = chantierAchats.reduce((sum, a) => sum + Number(a.montant_ttc ?? a.montant_ht ?? 0), 0)
    const depenses = totalST + totalAchats
    const marge = factureTotal - depenses
    const margePct = factureTotal > 0 ? Math.round((marge / factureTotal) * 100) : 0

    return { deviseTotal, factureTotal, encaisse, reste, devisCount, devisFactures, pctDevis, pctValeur, pctEncaissement, totalST, totalAchats, depenses, marge, margePct }
  }, [chantierDevis, chantierFactures, stPaiements, chantierAchats])

  // ── Gantt data ── (affiche 10 jours pour des cases plus larges et lisibles)
  const ganttDays = useMemo(() => {
    const days: { label: string; date: Date; dateStr: string; isToday: boolean }[] = []
    for (let i = 0; i < 10; i++) {
      const d = new Date(ganttStart); d.setDate(d.getDate() + i)
      // DAYS commence a Lundi = index 0. getDay() retourne 0 pour Dimanche, 1 pour Lundi, etc.
      // On normalise : Lundi=0, Mardi=1, ..., Dimanche=6
      const dow = d.getDay()
      const dayIdx = dow === 0 ? 6 : dow - 1
      days.push({ label: DAYS[dayIdx], date: d, dateStr: fmtISO(d), isToday: isSameDay(d, new Date()) })
    }
    return days
  }, [ganttStart])

  // Group interventions by intervenant for Gantt
  // FIX bug LUN 4 disparu : on ne skip PLUS les interventions sans intervenant_id.
  // Les orphelines sont regroupées dans une phase virtuelle "__orphan__" qui
  // s'affiche avec un libellé "Non assigné" — au lieu de disparaître complètement
  // du Gantt et de laisser l'artisan se demander pourquoi son chantier semble vide.
  const ganttPhases = useMemo(() => {
    const ORPHAN_KEY = '__orphan__'
    const map = new Map<string, R[]>()
    chantierInterventions.forEach(pi => {
      const ivId = (pi.intervenant_id as string) || ORPHAN_KEY
      if (!map.has(ivId)) map.set(ivId, [])
      map.get(ivId)!.push(pi)
    })
    return Array.from(map.entries()).map(([ivId, interventions]) => {
      if (ivId === ORPHAN_KEY) {
        // Phase orpheline (intervention sans intervenant assigné)
        return {
          ivId,
          iv: { prenom: 'Non', nom: 'assigné', metier: '—' } as R,
          interventions,
          colorIdx: 0,
        }
      }
      const iv = intervenantMap.get(ivId) as R | undefined
      const colorIdx = colorMap.get(ivId) ?? 0
      return { ivId, iv, interventions, colorIdx }
    })
  }, [chantierInterventions, intervenantMap, colorMap])

  // ── Notes CRUD ──
  const addNote = async () => {
    if (!newNote.trim()) return
    await insertRow('chantier_notes', { chantier_id: id, texte: newNote, categorie: newNoteCat })
    setNewNote(''); refetchNotes(); showToast('Note ajoutée ✓')
  }
  const toggleNote = async (noteId: string, fait: boolean) => {
    await updateRow('chantier_notes', noteId, { fait: !fait, fait_le: !fait ? new Date().toISOString() : null })
    refetchNotes()
  }
  const removeNote = async (noteId: string) => {
    await deleteRow('chantier_notes', noteId)
    refetchNotes(); showToast('Note supprimée')
  }

  // ── Equipe handlers ──
  const handleAddEquipe = async () => {
    if (!addEquipeIv || !addEquipeDate || equipeAdding || !chantier) return
    setEquipeAdding(true)
    try {
      const supabase = createClient()
      await supabase.from('chantier_intervenants').insert({
        chantier_id: id,
        intervenant_id: addEquipeIv,
        date_assignation: new Date().toISOString(),
      })
      const iv = intervenantMap.get(addEquipeIv) as R | undefined
      await supabase.from('planning_interventions').insert({
        user_id: chantier.user_id,
        chantier_id: id,
        client_id: chantier.client_id,
        titre: `Intervention — ${iv ? `${iv.prenom ?? ''} ${iv.nom ?? ''}`.trim() : 'Intervenant'}`,
        date_debut: addEquipeDate,
        heure_debut: '08:00',
        heure_fin: '17:00',
        intervenant_id: addEquipeIv,
        statut: 'planifie',
      })
      await fetchEquipe()
      await refetchPlanning()
      setShowAddEquipe(false)
      setAddEquipeIv('')
      setAddEquipeDate('')
      showToast('Intervenant assigné + planning créé ✓')
    } catch (_err) {
      showToast("Erreur lors de l'assignation")
    } finally {
      setEquipeAdding(false)
    }
  }

  // ── Suppression intervenant ──
  const handleRemoveEquipe = async (equipeRowId: string, intervenantId: string) => {
    if (!confirm('Retirer cet intervenant du chantier ?')) return
    try {
      const supabase = createClient()
      // Supprimer l'assignation
      await supabase.from('chantier_intervenants').delete().eq('id', equipeRowId)
      // Supprimer aussi l'intervention planning associée
      await supabase.from('planning_interventions').delete()
        .eq('chantier_id', id)
        .eq('intervenant_id', intervenantId)
      await fetchEquipe()
      await refetchPlanning()
      showToast('Intervenant retiré ✓')
    } catch (_err) {
      showToast("Erreur lors de la suppression")
    }
  }

  // ── Facturation handler ──
  // Vérifie d'abord si une facture existe déjà pour ce devis (évite les doublons).
  // Si oui, on redirige simplement vers la facture existante au lieu d'en créer une nouvelle.
  const handleCreateFacture = async (devisId: string) => {
    setFactureCreating(devisId)
    try {
      // 1. Check côté CLIENT (rapide, sur les factures déjà chargées) :
      // existe-t-il déjà une facture pour ce devis dans le state local ?
      const existingLocal = chantierFactures.find(f => f.devis_id === devisId)
      if (existingLocal) {
        showToast('Facture déjà existante — redirection')
        router.push(`/dashboard/factures/${existingLocal.id}`)
        return
      }

      // 2. Check côté SERVEUR (requête fraîche) : permet d'éviter les doublons
      // en cas de double-click ou de cache obsolète. Indispensable car on a vu
      // des doublons (2 factures pour le même devis sur le même chantier).
      const supabase = createClient()
      const { data: factureExistante } = await supabase
        .from('factures')
        .select('id')
        .eq('devis_id', devisId)
        .is('deleted_at', null)
        .maybeSingle()
      if (factureExistante) {
        showToast('Facture déjà existante — redirection')
        router.push(`/dashboard/factures/${factureExistante.id}`)
        return
      }

      // 3. Sinon, on crée la facture
      const facture = await createFactureFromDevis(devisId)
      showToast('Facture créée ✓')
      // Rafraîchir les données du chantier en tâche de fond (stats finance + barres)
      // pour que si l'utilisateur revient sur la fiche chantier, les chiffres
      // soient déjà à jour. La navigation vers la facture se fait juste après.
      try {
        refetchPlanning()
      } catch { /* non bloquant */ }
      const factureId = String((facture as R).id ?? '')
      router.push(`/dashboard/factures/${factureId}`)
    } catch (err) {
      console.error('Erreur création facture:', err)
      const msg = err instanceof Error ? err.message : 'Erreur création facture'
      showToast(msg.length > 60 ? 'Erreur création facture — voir console' : msg)
    } finally {
      setFactureCreating(null)
    }
  }

  // ── Edit chantier ──
  const openEditMode = () => {
    setEditTitre(String(chantier?.titre ?? ''))
    setEditDesc(String(chantier?.description ?? ''))
    setEditDateDebut(chantier?.date_debut ? String(chantier.date_debut).split('T')[0] : '')
    setEditDateFin(chantier?.date_fin_prevue ? String(chantier.date_fin_prevue).split('T')[0] : '')
    setEditAdresse(String(chantier?.adresse_chantier ?? ''))
    setEditVille(String(chantier?.ville_chantier ?? ''))
    setEditPreparationClient(String(chantier?.preparation_client ?? ''))
    setEditNonInclus(String(chantier?.non_inclus ?? ''))
    setEditModalitesPerso(String(chantier?.modalites_personnalisees ?? ''))
    setEditMode(true)
  }

  const saveEdit = async () => {
    if (!chantier) return
    setEditSaving(true)
    try {
      await updateRow('chantiers', id, {
        titre: editTitre.trim() || undefined,
        description: editDesc.trim() || undefined,
        date_debut: editDateDebut || undefined,
        date_fin_prevue: editDateFin || undefined,
        adresse_chantier: editAdresse.trim() || undefined,
        ville_chantier: editVille.trim() || undefined,
        // Champs PDF V2 — note : on envoie '' si vide pour pouvoir effacer un texte
        preparation_client: editPreparationClient.trim() || null,
        non_inclus: editNonInclus.trim() || null,
        modalites_personnalisees: editModalitesPerso.trim() || null,
      })
      setEditMode(false)
      showToast('Chantier mis à jour ✓')
      window.location.reload()
    } catch (_err) {
      showToast('Erreur lors de la mise à jour')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Export PDF ──
  // Ouvre la modal d'options (checkbox Pacte de chantier) au lieu d'exporter direct.
  const openExportModal = async () => {
    if (!chantier) return
    // Charger le profil entreprise (pour engagements/modalités utilisés dans le template)
    let ent: Record<string, unknown> | null = null
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('entreprises')
          .select('nom, engagements_default')
          .eq('user_id', user.id)
          .single()
        ent = data
      }
    } catch { /* ignore — on génère sans profil si erreur */ }

    // Si l'artisan a déjà sauvegardé un pacte personnalisé, on le pré-charge.
    // Sinon on génère un template à partir du profil + chantier.
    const existing = (chantier.pacte_chantier_texte as string | null)?.trim()
    const clientName = client
      ? `${client.civilite ?? ''} ${client.prenom ?? ''} ${client.nom ?? ''}`.replace(/\s+/g, ' ').trim()
      : ''
    const tpl = existing || generatePacteTemplate({
      artisanNom: ent?.nom as string | null | undefined,
      clientNom: clientName,
      chantierTitre: chantier.titre as string | null,
      dateDebut: chantier.date_debut as string | null,
      dateFin: chantier.date_fin_prevue as string | null,
      engagements: ent?.engagements_default as string | null | undefined,
      preparationClient: chantier.preparation_client as string | null,
    })
    // Par défaut, la case est DÉCOCHÉE (Jerem voulait que ce soit un choix conscient).
    // Mais si un pacte personnalisé existe déjà, on coche par défaut (l'artisan a déjà
    // signalé qu'il l'utilise).
    setExportWithPacte(Boolean(existing))
    setExportPacteTexte(tpl)
    setShowExportModal(true)
  }

  // V3.0d : telechargement PDF "Recap pour client" cross-platform via helper.
  //   - iOS Safari : ouvre dans nouvel onglet + toast d'aide.
  //   - Android / desktop : <a download> + toast confirmation.
  const handleExportRecap = async () => {
    if (!chantier) return
    setExportingRecap(true)
    try {
      const result = await fetchAndDownloadPdf(
        `/api/export-recap-chantier-pdf?id=${id}`,
        { method: 'GET' },
        `recap-${String(chantier?.titre ?? 'chantier').replace(/\s+/g, '-').toLowerCase()}.pdf`,
      )
      showToast(result.openedInNewTab ? result.helpMessage : 'Récap pour client téléchargé ✓')
    } catch (_err) {
      showToast('Erreur lors de la génération du récap')
    } finally {
      setExportingRecap(false)
    }
  }

  // V3.0d : export PDF chantier cross-platform via helper (idem).
  const handleExportPDF = async () => {
    if (!chantier) return
    setExportingPdf(true)
    try {
      const result = await fetchAndDownloadPdf(
        '/api/export-chantier-pdf',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            withPacte: exportWithPacte,
            pacteTexte: exportWithPacte ? exportPacteTexte : '',
          }),
        },
        `chantier-${String(chantier?.titre ?? 'export').replace(/\s+/g, '-').toLowerCase()}.pdf`,
      )
      setShowExportModal(false)
      if (result.openedInNewTab) {
        showToast(result.helpMessage)
      } else {
        showToast(exportWithPacte ? 'PDF avec Pacte téléchargé ✓' : 'PDF téléchargé ✓')
      }
    } catch (_err) {
      showToast('Erreur lors de l\'export PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  // ── Loading ──
  if (l1) return <div className="p-8"><LoadingSkeleton /></div>
  if (!chantier) return (
    <div className="p-8">
      <Link href="/dashboard/chantiers" className="flex items-center gap-2 text-sm text-[#64748b] hover:text-[#0f1a3a] mb-4"><ArrowLeft className="w-4 h-4" />Retour</Link>
      <p className="text-sm text-[#7b8ba3]">Chantier introuvable.</p>
    </div>
  )

  const statutLabel = (chantier.statut as string) === 'en_cours' ? 'En cours' : (chantier.statut as string) === 'signe' ? 'Signé' : (chantier.statut as string) ?? '—'
  const statutCls = (chantier.statut as string) === 'en_cours' ? 'bg-[#e8f4fb] text-[#2d8bc9]' : (chantier.statut as string) === 'livre' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef9e7] text-[#b45309]'

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-[#e6ecf2] px-6 py-4 sticky top-0 z-30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/chantiers')} className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#0f1a3a] transition-colors font-medium mr-1">
            <ArrowLeft className="w-4 h-4" />Retour
          </button>
          <h1 className="text-xl font-extrabold text-[#0f1a3a] tracking-tight font-jakarta">
            {String(chantier.titre ?? '')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/planning" className="flex items-center gap-2 px-4 py-2 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#1e293b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">
            <Clock className="w-4 h-4" />Planning
          </Link>
          <button onClick={openExportModal} disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#1e293b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all disabled:opacity-50">
            <Download className="w-4 h-4" />{exportingPdf ? 'Export...' : 'Exporter PDF'}
          </button>
          <button onClick={handleExportRecap} disabled={exportingRecap}
            title="Document de récap 2 pages destiné au client : travaux, financier, timeline, garanties, SAV"
            className="flex items-center gap-2 px-4 py-2 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#1e293b] hover:border-[#059669] hover:text-[#059669] transition-all disabled:opacity-50">
            <FileText className="w-4 h-4" />{exportingRecap ? 'Génération...' : 'Récap client'}
          </button>
          <button onClick={openEditMode}
            className="flex items-center gap-2 px-4 py-2 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#1e293b] hover:border-[#e87a2a] hover:text-[#e87a2a] transition-all">
            <Pencil className="w-4 h-4" />Modifier
          </button>
        </div>
      </header>

      <div className="px-6 py-5">
        {/* ── HERO ── */}
        <div className="bg-white border border-[#e6ecf2] rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${statutCls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />{statutLabel}
            </span>
            <div className="flex bg-[#f6f8fb] rounded-xl p-1 gap-0.5">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === t.key ? 'bg-white text-[#0f1a3a] shadow-sm' : 'text-[#64748b] hover:text-[#0f1a3a]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <h2 className="text-[22px] font-extrabold text-[#0f1a3a] tracking-tight mt-2">
            {String(chantier.titre ?? '')} — {client ? String(`${client.prenom ?? ''} ${client.nom ?? ''}`).trim() : 'Client'}
          </h2>
          <div className="text-sm text-[#7b8ba3] font-medium mb-4">
            {String(chantier.description ?? '')} • {String(chantier.adresse_chantier ?? '')}, {String(chantier.ville_chantier ?? '')}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
              <Calendar className="w-4 h-4 text-[#7b8ba3] flex-shrink-0" />
              Début : <strong className="text-[#0f1a3a]">{formatDate(chantier.date_debut as string)}</strong>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
              <Clock className="w-4 h-4 text-[#7b8ba3] flex-shrink-0" />
              Fin prévue : <strong className="text-[#0f1a3a]">{formatDate(chantier.date_fin_prevue as string)}</strong>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
              <User className="w-4 h-4 text-[#7b8ba3] flex-shrink-0" />
              Client : <strong className="text-[#0f1a3a]">{client ? String(`${client.prenom ?? ''} ${client.nom ?? ''}`).trim() : '—'}</strong>
            </div>
            {(() => { const tel = client?.telephone as string | undefined; return tel ? (
              <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
                <Phone className="w-4 h-4 text-[#7b8ba3] flex-shrink-0" />
                Tél : <a href={`tel:${tel}`} className="text-[#5ab4e0] font-semibold hover:underline">{tel}</a>
              </div>
            ) : null })()}
          </div>
        </div>

        {/* ── FINANCE ROW ── */}
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          {[
            { label: 'Devisé TTC', value: formatEur(finances.deviseTotal) },
            { label: 'Facturé TTC', value: formatEur(finances.factureTotal) },
            { label: 'Encaissé', value: formatEur(finances.encaisse), cls: 'text-[#22c55e]' },
            { label: 'Reste à facturer', value: formatEur(finances.reste), cls: 'text-[#e87a2a]' },
          ].map((f, i) => (
            <div key={i} className="text-center py-4 px-4 bg-[#f6f8fb] rounded-xl">
              <div className={`text-xl font-extrabold tracking-tight ${f.cls ?? 'text-[#0f1a3a]'}`}>{f.value}</div>
              <div className="text-[11px] text-[#7b8ba3] font-medium mt-1">{f.label}</div>
            </div>
          ))}
        </div>

        {/* ── PROGRESS BARS ── */}
        <div className="bg-white border border-[#e6ecf2] rounded-2xl p-5 mb-5 space-y-4">
          <ProgressBar label="Avancement par devis" value={`${finances.devisFactures} / ${finances.devisCount} devis • ${finances.pctDevis}%`} pct={finances.pctDevis} color="bg-[#5ab4e0]" sub={`${finances.devisFactures} devis facturés / ${finances.devisCount} total`} />
          <ProgressBar label="Avancement en valeur" value={`${formatEur(finances.factureTotal)} / ${formatEur(finances.deviseTotal)} • ${finances.pctValeur}%`} pct={finances.pctValeur} color="bg-[#e87a2a]" sub={`${formatEur(finances.factureTotal)} facturés / ${formatEur(finances.deviseTotal)} TTC`} />
          <ProgressBar label="Encaissement" value={`${formatEur(finances.encaisse)} / ${formatEur(finances.deviseTotal)} • ${finances.pctEncaissement}%`} pct={finances.pctEncaissement} color="bg-[#22c55e]" sub={`${formatEur(finances.encaisse)} encaissés / ${formatEur(finances.deviseTotal)} TTC`} />
        </div>

        {/* ── GANTT CHART ── */}
        {(activeTab === 'resume') && (
        <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-[#0f1a3a] tracking-tight">Planning des phases</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const d = new Date(ganttStart); d.setDate(d.getDate() - 5); setGanttStart(d) }}
                title="Reculer de 5 jours"
                className="w-8 h-8 flex items-center justify-center border border-[#e6ecf2] rounded-lg text-[#64748b] hover:text-[#5ab4e0] hover:border-[#5ab4e0] transition-all">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const d = new Date()
                  d.setHours(0, 0, 0, 0)
                  d.setDate(d.getDate() - 2)
                  setGanttStart(d)
                }}
                title="Recentrer sur aujourd'hui"
                className="px-2 h-8 flex items-center justify-center border border-[#e6ecf2] rounded-lg text-[10px] font-bold text-[#64748b] hover:text-[#5ab4e0] hover:border-[#5ab4e0] transition-all uppercase tracking-wider">
                Aujourd&apos;hui
              </button>
              <span className="text-xs font-semibold text-[#0f1a3a] min-w-[100px] text-center">
                {ganttStart.getDate()} {MONTHS[ganttStart.getMonth()].substring(0, 3)} — {new Date(ganttStart.getTime() + 9 * 86400000).getDate()} {MONTHS[new Date(ganttStart.getTime() + 9 * 86400000).getMonth()].substring(0, 3)}
              </span>
              <button
                onClick={() => { const d = new Date(ganttStart); d.setDate(d.getDate() + 5); setGanttStart(d) }}
                title="Avancer de 5 jours"
                className="w-8 h-8 flex items-center justify-center border border-[#e6ecf2] rounded-lg text-[#64748b] hover:text-[#5ab4e0] hover:border-[#5ab4e0] transition-all">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            {/* Header */}
            <div className="grid grid-cols-[220px_repeat(10,1fr)] mb-2 pb-2 border-b border-[#e6ecf2]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] self-end pb-1">Phase / Intervenant</span>
              {ganttDays.map(d => {
                const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6
                return (
                  <div key={d.dateStr} className="flex flex-col items-center justify-end gap-0.5 px-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${d.isToday ? 'text-[#5ab4e0]' : isWeekend ? 'text-[#cbd5e1]' : 'text-[#7b8ba3]'}`}>
                      {d.label}
                    </span>
                    <span className={`text-[15px] font-extrabold leading-none ${d.isToday ? 'text-[#5ab4e0]' : isWeekend ? 'text-[#cbd5e1]' : 'text-[#1e293b]'}`}>
                      {d.date.getDate()}
                    </span>
                    {d.isToday && (
                      <span className="text-[8px] font-bold text-[#5ab4e0] uppercase tracking-wider mt-0.5">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Phases */}
            {ganttPhases.length === 0 && (
              <div className="py-8 text-center text-sm text-[#7b8ba3]">Aucune intervention planifiée pour ce chantier</div>
            )}
            {ganttPhases.map(phase => {
              const ivName = phase.iv ? `${phase.iv.prenom ?? ''} ${(phase.iv.nom as string)?.charAt(0) ?? ''}.` : '—'
              const metier = phase.iv?.metier as string ?? ''
              const hex = PALETTE_HEX[phase.colorIdx]
              // Which days have interventions
              // BUG MULTI-JOURS FIX : on remplit dayMap pour CHAQUE jour entre
              // date_debut et date_fin (inclus), pas uniquement date_debut.
              const dayMap = new Map<string, R>()
              phase.interventions.forEach(pi => {
                const startRaw = (pi.date_debut as string)?.split('T')[0]
                const endRaw = (pi.date_fin as string)?.split('T')[0] || startRaw
                if (!startRaw) return
                const startD = new Date(startRaw + 'T00:00:00')
                const endD = new Date((endRaw || startRaw) + 'T00:00:00')
                const last = endD < startD ? startD : endD
                const cur = new Date(startD)
                let safety = 0
                while (cur <= last && safety < 60) {
                  // ⚠️ utiliser fmtISO local (PAS toISOString) sinon decalage timezone
                  // qui peut faire disparaitre une journee complete (bug recurrent).
                  const k = fmtISO(cur)
                  if (!dayMap.has(k)) dayMap.set(k, pi)
                  cur.setDate(cur.getDate() + 1)
                  safety++
                }
              })
              // Status
              const allDone = phase.interventions.every(pi => pi.statut === 'termine')
              const anyInProgress = phase.interventions.some(pi => pi.statut === 'en_cours')
              const statusLabel = allDone ? 'Terminé' : anyInProgress ? 'En cours' : 'À venir'
              const statusCls = allDone ? 'bg-[#dcfce7] text-[#166534]' : anyInProgress ? 'bg-[#e8f4fb] text-[#2d8bc9]' : 'bg-[#f6f8fb] text-[#7b8ba3]'

              // Devis linked
              const linkedDevis = chantierDevis.find(d => phase.interventions.some(pi => (pi.description_travaux as string)?.includes(d.objet as string ?? '__')))
              const devisRef = linkedDevis ? `D-${String(linkedDevis.numero ?? '').slice(-4)}` : ''
              const devisAmt = linkedDevis ? formatEur(Number(linkedDevis.montant_ttc ?? 0)) : ''

              return (
                <div key={phase.ivId} className="grid grid-cols-[220px_repeat(10,1fr)] mb-2 min-h-[72px] items-stretch">
                  {/* Label */}
                  <div className="py-3 pr-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#1e293b]">
                      <span className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: hex }} />
                      {metier || ivName}
                    </div>
                    <div className="text-[11px] text-[#7b8ba3] pl-[18px]">{ivName} {devisRef && `• ${devisRef} : ${devisAmt}`}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md w-fit ml-[18px] ${statusCls}`}>{statusLabel}</span>
                  </div>

                  {/* Day cells */}
                  {ganttDays.map((day, di) => {
                    const intervention = dayMap.get(day.dateStr)
                    if (!intervention) {
                      return <div key={day.dateStr} className={`border-r border-[#e6ecf2]/30 min-h-[72px] relative ${day.isToday ? 'bg-[#5ab4e0]/[.03]' : ''}`}>
                        {day.isToday && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#ef4444] z-10"><span className="absolute -top-1 -left-[3px] w-2 h-2 bg-[#ef4444] rounded-full" /></div>}
                      </div>
                    }

                    // Check continuity (is prev/next day also filled?)
                    const prevDay = di > 0 ? ganttDays[di - 1] : null
                    const nextDay = di < ganttDays.length - 1 ? ganttDays[di + 1] : null
                    const hasPrev = prevDay && dayMap.has(prevDay.dateStr)
                    const hasNext = nextDay && dayMap.has(nextDay.dateStr)
                    const radius = hasPrev && hasNext ? 'rounded-none' : hasPrev ? 'rounded-r-lg rounded-l-none' : hasNext ? 'rounded-l-lg rounded-r-none' : 'rounded-lg'
                    const margin = hasPrev ? 'ml-0' : 'ml-1'
                    const marginR = hasNext ? 'mr-0' : 'mr-1'

                    return (
                      <div key={day.dateStr} className={`border-r border-[#e6ecf2]/30 min-h-[72px] relative ${day.isToday ? 'bg-[#5ab4e0]/[.03]' : ''}`}>
                        <div className={`absolute top-1.5 bottom-1.5 ${margin} ${marginR} ${radius} flex flex-col justify-center px-3 py-2 text-white cursor-pointer hover:brightness-105 transition-all`}
                          style={{ background: hex, left: hasPrev ? '-1px' : '4px', right: hasNext ? '-1px' : '4px', outline: '2px solid rgba(255,255,255,.15)', outlineOffset: '-2px' }}>
                          <div className="text-xs font-bold line-clamp-2">{ivName}</div>
                          <div className="text-[10px] font-medium opacity-85 line-clamp-2">{String(intervention.titre ?? '')}</div>
                        </div>
                        {day.isToday && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#ef4444] z-10"><span className="absolute -top-1 -left-[3px] w-2 h-2 bg-[#ef4444] rounded-full" /></div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* ── EQUIPE DU CHANTIER ── */}
        {(activeTab === 'resume') && (
        <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5ab4e0]" />
              <h3 className="text-[15px] font-extrabold text-[#0f1a3a]">Équipe du chantier</h3>
              {equipeAffichage.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#e8f4fb] text-[#2d8bc9] text-[11px] font-bold">{equipeAffichage.length}</span>
              )}
            </div>
            <button onClick={() => setShowAddEquipe(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e6ecf2] text-xs font-semibold text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all">
              <Plus className="w-3 h-3" />Ajouter intervenant
            </button>
          </div>

          {/* Formulaire d'ajout */}
          {showAddEquipe && (
            <div className="px-5 py-4 border-b border-[#e6ecf2] bg-[#f6f8fb] flex gap-3 items-end flex-wrap">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3]">Intervenant</label>
                <select value={addEquipeIv} onChange={e => setAddEquipeIv(e.target.value)}
                  className="px-3 py-2 border border-[#e6ecf2] rounded-lg text-[13px] font-medium text-[#1e293b] bg-white outline-none focus:border-[#5ab4e0] transition-all">
                  <option value="">-- Sélectionner --</option>
                  {intervenants.map(iv => {
                    const r = iv as R
                    return (
                      <option key={r.id as string} value={r.id as string}>
                        {String(r.prenom ?? '')} {String(r.nom ?? '')} — {String(r.metier ?? '')}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3]">Date de début</label>
                <input type="date" value={addEquipeDate} onChange={e => setAddEquipeDate(e.target.value)}
                  className="px-3 py-2 border border-[#e6ecf2] rounded-lg text-[13px] font-medium text-[#1e293b] bg-white outline-none focus:border-[#5ab4e0] transition-all" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddEquipe(false); setAddEquipeIv(''); setAddEquipeDate('') }}
                  className="px-3 py-2 border border-[#e6ecf2] rounded-lg text-[13px] font-semibold text-[#64748b] hover:border-[#ef4444] hover:text-[#ef4444] transition-all">
                  Annuler
                </button>
                <button onClick={handleAddEquipe} disabled={equipeAdding || !addEquipeIv || !addEquipeDate}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5ab4e0] to-[#2d8bc9] text-white rounded-lg text-[13px] font-bold hover:shadow-md transition-all disabled:opacity-50">
                  <Zap className="w-3.5 h-3.5" />
                  {equipeAdding ? 'Assignation...' : 'Assigner + créer planning'}
                </button>
              </div>
            </div>
          )}

          {/* Liste équipe */}
          <div className="divide-y divide-[#e6ecf2]">
            {equipeAffichage.length === 0 && (
              <div className="px-5 py-8 text-center">
                <div className="w-10 h-10 bg-[#f6f8fb] rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-[#7b8ba3]" />
                </div>
                <div className="text-sm text-[#7b8ba3] font-medium">Aucun intervenant assigné</div>
                <div className="text-xs text-[#7b8ba3] mt-1">Cliquez sur &quot;Ajouter intervenant&quot; pour assigner l&apos;équipe et générer le planning automatiquement</div>
              </div>
            )}
            {equipeAffichage.map((e: R) => {
              const iv = intervenantMap.get(e.intervenant_id as string) as R | undefined
              const colorIdx = colorMap.get(e.intervenant_id as string) ?? (equipeAffichage.indexOf(e) % PALETTE_HEX.length)
              return (
                <div key={e.id as string} className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f6f8fb]/50 transition-all">
                  <div className="w-10 h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: PALETTE_HEX[colorIdx] }}>
                    {iv ? initials(`${iv.prenom ?? ''} ${iv.nom ?? ''}`) : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#1e293b] flex items-center gap-2">
                      {iv ? `${iv.prenom ?? ''} ${iv.nom ?? ''}`.trim() : '—'}
                      {e._autoFromPlanning ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-bold uppercase tracking-wider">
                          Via planning
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-[#7b8ba3] mt-0.5">
                      {String(iv?.metier ?? '')}{e._autoFromPlanning ? '' : ` • Assigné le ${formatDate(e.date_assignation as string)}`}
                    </div>
                  </div>
                  <Link href="/dashboard/planning" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#e8f4fb] text-[#2d8bc9] hover:bg-[#d0e8f7] transition-colors cursor-pointer">
                    <Zap className="w-2.5 h-2.5" />Planning
                  </Link>
                  {!e._autoFromPlanning && (
                    <button
                      onClick={() => handleRemoveEquipe(e.id as string, e.intervenant_id as string)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Retirer cet intervenant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* ── NOTES + SOUS-TRAITANTS ── */}
        {activeTab === 'resume' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Notes */}
          <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between">
              <h3 className="text-[15px] font-extrabold text-[#0f1a3a]">Notes & rappels</h3>
              <span className="text-[11px] text-[#7b8ba3] font-semibold">{(chantierNotes as R[]).filter(n => !n.fait).length} tâches</span>
            </div>
            <div className="px-5 py-3">
              {(chantierNotes as R[]).map(note => {
                const cat = NOTE_CATS.find(c => c.value === note.categorie) ?? NOTE_CATS[2]
                return (
                  <div key={note.id as string} className="flex gap-2.5 py-2.5 border-b border-[#e6ecf2] last:border-b-0 items-start group">
                    <button onClick={() => toggleNote(note.id as string, note.fait as boolean)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${Boolean(note.fait) ? 'bg-[#22c55e] border-[#22c55e] text-white' : 'border-[#e6ecf2] hover:border-[#5ab4e0]'}`}>
                      {Boolean(note.fait) && <Check className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium leading-snug ${Boolean(note.fait) ? 'line-through text-[#7b8ba3]' : 'text-[#1e293b]'}`}>{String(note.texte ?? '')}</div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#7b8ba3]">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cat.cls}`}>{cat.label}</span>
                        {Boolean(note.fait_le) && <span>Fait le {formatDate(note.fait_le as string)}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeNote(note.id as string)}
                      className="w-5 h-5 rounded flex items-center justify-center text-[#7b8ba3] opacity-0 group-hover:opacity-100 hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
              {/* Add note */}
              <div className="flex gap-2 pt-2.5 items-center">
                <select value={newNoteCat} onChange={e => setNewNoteCat(e.target.value)}
                  className="px-2.5 py-2 border border-[#e6ecf2] rounded-lg text-xs font-semibold text-[#64748b] bg-white outline-none">
                  {NOTE_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNote() }}
                  placeholder={NOTE_PLACEHOLDERS[newNoteCat] || 'Ajouter une note ou un rappel...'}
                  className="flex-1 px-3 py-2 border-2 border-dashed border-[#e6ecf2] rounded-lg text-[13px] focus:border-[#5ab4e0] focus:bg-[#5ab4e0]/[.03] outline-none transition-all placeholder:text-[#7b8ba3]" />
                <button onClick={addNote} className="px-3 py-2 bg-gradient-to-r from-[#e87a2a] to-[#f09050] text-white rounded-lg text-xs font-bold hover:shadow-md transition-all">+</button>
              </div>
            </div>
          </div>

          {/* Sous-traitants */}
          <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between">
              <h3 className="text-[15px] font-extrabold text-[#0f1a3a]">Sous-traitants</h3>
              <button className="flex items-center gap-1 text-xs text-[#64748b] font-semibold hover:text-[#5ab4e0] transition-all">
                <Plus className="w-3 h-3" />Ajouter
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-[#f6f8fb]">
                <tr>
                  <th className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] text-left border-b border-[#e6ecf2]">Intervenant</th>
                  <th className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] text-left border-b border-[#e6ecf2]">Prévu</th>
                  <th className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] text-left border-b border-[#e6ecf2]">Payé</th>
                  <th className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] text-left border-b border-[#e6ecf2]">Statut</th>
                  <th className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] text-left border-b border-[#e6ecf2]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(stPaiements as R[]).length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-[#7b8ba3]">Aucun sous-traitant enregistré</td></tr>
                )}
                {(stPaiements as R[]).map(st => {
                  const iv = intervenantMap.get(st.intervenant_id as string) as R | undefined
                  const colorIdx = colorMap.get(st.intervenant_id as string) ?? 0
                  const statut = st.statut as string
                  const statutCls = statut === 'paye' ? 'bg-[#dcfce7] text-[#166534]' : statut === 'partiel' ? 'bg-[#fef9e7] text-[#b45309]' : 'bg-[#fee2e2] text-[#991b1b]'
                  const statutLbl = statut === 'paye' ? 'Payé' : statut === 'partiel' ? 'Partiel' : 'À payer'
                  return (
                    <tr key={st.id as string} className="hover:bg-[#f6f8fb]/60">
                      <td className="px-5 py-3 border-b border-[#e6ecf2]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg text-white text-[10px] font-bold flex items-center justify-center" style={{ background: PALETTE_HEX[colorIdx] }}>
                            {iv ? initials(`${iv.prenom ?? ''} ${iv.nom ?? ''}`) : '?'}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold">{iv ? `${iv.prenom ?? ''} ${iv.nom ?? ''}`.trim() : '—'}</div>
                            <div className="text-[11px] text-[#7b8ba3]">{String(iv?.metier ?? '')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 border-b border-[#e6ecf2] text-[13px] font-bold text-[#0f1a3a]">{formatEur(Number(st.montant_prevu ?? 0))}</td>
                      <td className="px-5 py-3 border-b border-[#e6ecf2] text-[13px] font-bold text-[#0f1a3a]">{formatEur(Number(st.montant_paye ?? 0))}</td>
                      <td className="px-5 py-3 border-b border-[#e6ecf2]">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statutCls}`}>{statutLbl}</span>
                      </td>
                      <td className="px-5 py-3 border-b border-[#e6ecf2]">
                        <div className="flex gap-1">
                          {statut !== 'paye' && (
                            <button onClick={async () => {
                              await updateRow('sous_traitant_paiements', st.id as string, { montant_paye: st.montant_prevu, statut: 'paye' })
                              refetchST(); showToast('Paiement enregistré ✓')
                            }} className="px-2.5 py-1 text-[11px] font-semibold border border-[#22c55e] text-[#22c55e] bg-[#dcfce7] rounded-md hover:bg-[#22c55e] hover:text-white transition-all">
                              Payer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* ── DEVIS LIES + FACTURATION ── */}
        {(activeTab === 'resume' || activeTab === 'devis' || activeTab === 'factures') && chantierDevis.length > 0 && (
          <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#e87a2a]" />
                <h3 className="text-[15px] font-extrabold text-[#0f1a3a]">Devis & Facturation</h3>
              </div>
              <span className="text-[11px] text-[#7b8ba3] font-semibold">
                {chantierDevis.filter(d => d.statut === 'facture').length} / {chantierDevis.length} devis facturés
              </span>
            </div>
            <div className="divide-y divide-[#e6ecf2]">
              {chantierDevis.map(d => {
                const isFacture = d.statut === 'facture'
                const linkedFactures = chantierFactures.filter(f => (f as R).devis_id === d.id)
                return (
                  <div key={d.id as string} className="flex items-center gap-4 px-5 py-4 hover:bg-[#f6f8fb]/50 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[#fff7f0] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-[#e87a2a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link href={`/dashboard/devis/${d.id}`} className="text-[11px] font-bold text-[#7b8ba3] bg-[#f6f8fb] px-2 py-0.5 rounded hover:bg-[#e8f4fb] hover:text-[#2d8bc9] transition-all">
                          D-{String(d.numero ?? '').slice(-4)}
                        </Link>
                        <Link href={`/dashboard/devis/${d.id}`} className="text-[13px] font-bold text-[#1e293b] truncate hover:text-[#5ab4e0] transition-colors">
                          {String(d.objet ?? '—')}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#7b8ba3]">
                        <span className="font-bold text-[#0f1a3a]">{formatEur(Number(d.montant_ttc ?? 0))} TTC</span>
                        {linkedFactures.map(f => (
                          <Link key={f.id as string} href={`/dashboard/factures/${f.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#dcfce7] text-[#166534] text-[10px] font-bold hover:bg-[#22c55e] hover:text-white transition-all">
                            <Receipt className="w-2.5 h-2.5" />F-{String(f.numero ?? '').slice(-4)}
                          </Link>
                        ))}
                      </div>
                    </div>
                    {linkedFactures.length > 0 ? (
                      // Facture déjà créée → on redirige vers elle (plus de doublons)
                      <Link
                        href={`/dashboard/factures/${(linkedFactures[0] as R).id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#dcfce7] text-[#166534] rounded-xl text-[12px] font-bold hover:bg-[#bbf7d0] transition-all flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        {isFacture ? 'Facturé' : 'Voir la facture'}
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleCreateFacture(d.id as string)}
                        disabled={factureCreating === (d.id as string)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white rounded-xl text-[12px] font-bold hover:shadow-md transition-all disabled:opacity-50 flex-shrink-0">
                        {factureCreating === (d.id as string) ? (
                          <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Création...</>
                        ) : (
                          <><Plus className="w-3.5 h-3.5" />Créer facture</>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── FACTURES DÉTAILLÉES (onglet factures) ── */}
        {activeTab === 'factures' && chantierFactures.length > 0 && (
          <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-[#e6ecf2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#22c55e]" />
                <h3 className="text-[15px] font-extrabold text-[#0f1a3a]">Factures du chantier</h3>
              </div>
              <span className="text-[11px] text-[#7b8ba3] font-semibold">{chantierFactures.length} facture{chantierFactures.length > 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-[#e6ecf2]">
              {chantierFactures.map(f => {
                const isPaid = (f as R).statut === 'payee'
                return (
                  <Link key={f.id as string} href={`/dashboard/factures/${f.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[#f6f8fb]/50 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-5 h-5 text-[#22c55e]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#1e293b]">Facture {String((f as R).numero ?? '')}</div>
                      <div className="text-[11px] text-[#7b8ba3]">{formatDate((f as R).date_emission as string)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-[#0f1a3a]">{formatEur(Number((f as R).montant_ttc ?? 0))}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef9e7] text-[#b45309]'}`}>
                        {isPaid ? 'Payée' : 'En attente'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── MARGE NETTE ── */}
        {(activeTab === 'resume' || activeTab === 'factures') && (
        <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-[#e6ecf2]">
            <h3 className="text-[15px] font-extrabold text-[#0f1a3a]">Rentabilité du chantier</h3>
          </div>
          <div className="grid grid-cols-3 border-b border-[#e6ecf2]">
            <div className="text-center py-5 px-4 border-r border-[#e6ecf2]">
              <div className="text-[22px] font-extrabold text-[#22c55e] tracking-tight">{formatEur(finances.factureTotal)}</div>
              <div className="text-[11px] text-[#7b8ba3] font-medium mt-1">Facturé client (TTC)</div>
            </div>
            <div className="text-center py-5 px-4 border-r border-[#e6ecf2]">
              <div className="text-[22px] font-extrabold text-[#ef4444] tracking-tight">- {formatEur(finances.depenses)}</div>
              <div className="text-[11px] text-[#7b8ba3] font-medium mt-1">Dépenses (ST + achats)</div>
            </div>
            <div className="text-center py-5 px-4">
              <div className="text-[22px] font-extrabold text-[#0f1a3a] tracking-tight">{formatEur(finances.marge)} <span className="text-sm font-bold text-[#7b8ba3]">({finances.margePct}%)</span></div>
              <div className="text-[11px] text-[#7b8ba3] font-medium mt-1">Marge nette</div>
            </div>
          </div>

          {/* Achats fournisseurs */}
          <div className="px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-2">Achats fournisseurs</div>
            {chantierAchats.length === 0 && <div className="text-sm text-[#7b8ba3] py-3">Aucun achat enregistré</div>}
            {chantierAchats.map(achat => (
              <div key={achat.id as string} className="flex items-center justify-between py-2.5 border-b border-[#e6ecf2] last:border-b-0 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1e293b]">{String(achat.description ?? '—')}</span>
                  <span className="text-[11px] text-[#7b8ba3]">{formatDate(achat.date_achat as string)}</span>
                </div>
                <span className="font-bold text-[#ef4444]">- {formatEur(Number(achat.montant_ttc ?? achat.montant_ht ?? 0))}</span>
              </div>
            ))}
            <div className="pt-2.5 text-center">
              <Link
                href={`/dashboard/achats?chantier_id=${id}&new=1`}
                className="text-xs text-[#5ab4e0] font-semibold inline-flex items-center gap-1 mx-auto hover:underline"
              >
                <Plus className="w-3 h-3" />Ajouter un achat
              </Link>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ── MODAL EXPORT PDF (V2 — option Pacte de chantier) ── */}
      {showExportModal && (
        <div
          className="fixed inset-0 bg-[#0f1a3a]/35 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !exportingPdf) setShowExportModal(false) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-[640px] shadow-lg animate-[modalIn_.3s_ease] flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 border-b border-[#e6ecf2] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#0f1a3a]">Exporter le PDF de planification</h3>
                <p className="text-[12px] text-[#7b8ba3] mt-0.5">Choisissez les options avant la génération</p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exportingPdf}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f6f8fb] text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className={`rounded-xl border-2 transition-all ${exportWithPacte ? 'border-[#5ab4e0] bg-[#5ab4e0]/[.04]' : 'border-[#e6ecf2]'}`}>
                <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportWithPacte}
                    onChange={(e) => setExportWithPacte(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#5ab4e0] cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-bold text-[#0f1a3a]">Inclure le Pacte de chantier</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e87a2a]/15 text-[#e87a2a]">Recommandé gros chantier</span>
                    </div>
                    <p className="text-[12px] text-[#64748b] leading-snug">
                      Ajoute une page de garde signée par les deux parties (engagement mutuel artisan + client). Idéal pour rassurer le client sur les chantiers de rénovation lourde. Décoché par défaut.
                    </p>
                  </div>
                </label>

                {exportWithPacte && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#e6ecf2]/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3]">
                        Texte du pacte (modifiable)
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          // Régénère le template propre depuis le profil + chantier (sans
                          // les éventuels caractères parasites des anciennes versions sauvegardées).
                          if (exportPacteTexte.trim() && !confirm('Réinitialiser le texte du pacte au modèle par défaut ? Vos modifications seront perdues.')) return
                          let ent: Record<string, unknown> | null = null
                          try {
                            const supabase = createClient()
                            const { data: { user } } = await supabase.auth.getUser()
                            if (user) {
                              const { data } = await supabase
                                .from('entreprises')
                                .select('nom, engagements_default')
                                .eq('user_id', user.id)
                                .single()
                              ent = data
                            }
                          } catch { /* ignore */ }
                          const cName = client
                            ? `${client.civilite ?? ''} ${client.prenom ?? ''} ${client.nom ?? ''}`.replace(/\s+/g, ' ').trim()
                            : ''
                          const fresh = generatePacteTemplate({
                            artisanNom: ent?.nom as string | null | undefined,
                            clientNom: cName,
                            chantierTitre: chantier?.titre as string | null,
                            dateDebut: chantier?.date_debut as string | null,
                            dateFin: chantier?.date_fin_prevue as string | null,
                            engagements: ent?.engagements_default as string | null | undefined,
                            preparationClient: chantier?.preparation_client as string | null,
                          })
                          setExportPacteTexte(fresh)
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-[#5ab4e0] hover:text-[#3a94c0] transition-colors"
                        title="Régénère le texte à partir de votre profil + données chantier"
                      >
                        ↻ Réinitialiser
                      </button>
                    </div>
                    <textarea
                      value={exportPacteTexte}
                      onChange={(e) => setExportPacteTexte(e.target.value)}
                      rows={14}
                      className="w-full rounded-lg border border-[#e6ecf2] bg-white px-3 py-2.5 text-[12px] leading-snug font-mono focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0]/20 outline-none transition-all resize-y"
                    />
                    <p className="mt-1.5 text-[10px] text-[#94a3b8] italic leading-snug">
                      Pré-rempli automatiquement à partir de votre profil et du chantier. Le texte est sauvegardé pour vos prochains exports — utilisez «&nbsp;Réinitialiser&nbsp;» pour repartir du modèle.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-[#f6f8fb] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5">Le PDF contiendra</p>
                <ul className="text-[12px] text-[#1e293b] space-y-1">
                  {exportWithPacte && (
                    <li className="flex items-center gap-1.5"><span className="text-[#5ab4e0] font-bold">+</span> Page de garde — Pacte de chantier signé</li>
                  )}
                  <li className="flex items-center gap-1.5"><span className="text-[#22c55e] font-bold">✓</span> Identité artisan &amp; client + lieu du chantier</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#22c55e] font-bold">✓</span> Périmètre Inclus / Non inclus + Préparation</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#22c55e] font-bold">✓</span> Calendrier visuel + tableau des phases</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#22c55e] font-bold">✓</span> Notes du chantier + Modalités + Engagements</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#22c55e] font-bold">✓</span> Échéancier de paiement + Garanties</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e6ecf2] flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exportingPdf}
                className="px-4 py-2.5 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#64748b] hover:border-[#ef4444] hover:text-[#ef4444] transition-all disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf || (exportWithPacte && !exportPacteTexte.trim())}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e87a2a] to-[#f09050] text-white rounded-xl text-sm font-bold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                {exportingPdf ? 'Génération en cours...' : 'Générer le PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MODIFIER ── */}
      {editMode && (
        <div className="fixed inset-0 bg-[#0f1a3a]/35 z-50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setEditMode(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-[540px] mx-4 shadow-lg animate-[modalIn_.3s_ease]">
            <div className="px-6 py-5 border-b border-[#e6ecf2] flex items-center justify-between">
              <h3 className="text-[17px] font-extrabold text-[#0f1a3a]">Modifier le chantier</h3>
              <button onClick={() => setEditMode(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f6f8fb] text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">Titre du chantier</label>
                <input type="text" value={editTitre} onChange={e => setEditTitre(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                  className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">Date début</label>
                  <input type="date" value={editDateDebut} onChange={e => setEditDateDebut(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">Date fin prévue</label>
                  <input type="date" value={editDateFin} onChange={e => setEditDateFin(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">Adresse chantier</label>
                  <input type="text" value={editAdresse} onChange={e => setEditAdresse(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">Ville</label>
                  <input type="text" value={editVille} onChange={e => setEditVille(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] outline-none transition-all" />
                </div>
              </div>

              <div className="pt-3 mt-1 border-t border-[#e6ecf2]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5ab4e0] mb-3">
                  Informations pour le PDF client
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">
                      Préparation à la charge du client
                    </label>
                    <textarea
                      value={editPreparationClient}
                      onChange={e => setEditPreparationClient(e.target.value)}
                      rows={3}
                      placeholder={'Ex :\n• Vider la pièce des meubles\n• Couper le compteur d\'eau\n• Prévoir un stationnement pour le camion'}
                      className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all resize-none"
                    />
                    <p className="mt-1 text-[10px] text-[#94a3b8]">
                      S&apos;affiche dans la section &laquo;&nbsp;Préparation à votre charge&nbsp;&raquo; du PDF.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">
                      Non inclus dans le forfait <span className="text-[#f97316]">(anti-litige)</span>
                    </label>
                    <textarea
                      value={editNonInclus}
                      onChange={e => setEditNonInclus(e.target.value)}
                      rows={3}
                      placeholder={'Ex :\n• Peinture du portail\n• Évacuation des gravats hors démolition\n• Modification du système d\'arrosage'}
                      className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all resize-none"
                    />
                    <p className="mt-1 text-[10px] text-[#94a3b8]">
                      Ce que le client pourrait imaginer comme inclus mais qui ne l&apos;est PAS. Source n°1 des litiges.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ba3] mb-1.5 block">
                      Modalités d&apos;intervention spécifiques à ce chantier
                    </label>
                    <textarea
                      value={editModalitesPerso}
                      onChange={e => setEditModalitesPerso(e.target.value)}
                      rows={2}
                      placeholder="Laisser vide pour utiliser les modalités par défaut de votre profil."
                      className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all resize-none"
                    />
                    <p className="mt-1 text-[10px] text-[#94a3b8]">
                      Si rempli, écrase les modalités par défaut de votre profil pour ce chantier uniquement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e6ecf2] flex justify-end gap-3">
              <button onClick={() => setEditMode(false)}
                className="px-4 py-2.5 border border-[#e6ecf2] rounded-xl text-sm font-semibold text-[#64748b] hover:border-[#ef4444] hover:text-[#ef4444] transition-all">
                Annuler
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e87a2a] to-[#f09050] text-white rounded-xl text-sm font-bold hover:shadow-md transition-all disabled:opacity-50">
                {editSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0f1a3a] text-white px-7 py-3.5 rounded-xl text-sm font-semibold shadow-lg z-[999] flex items-center gap-2.5 animate-[slideUp_.4s_ease]">
          <Check className="w-5 h-5 text-[#22c55e]" />
          {toast}
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp { from { transform: translateX(-50%) translateY(100px) } to { transform: translateX(-50%) translateY(0) } }
      `}</style>
    </div>
  )
}

// -------------------------------------------------------------------
// Sub-component: ProgressBar
// -------------------------------------------------------------------

function ProgressBar({ label, value, pct, color, sub }: {
  label: string; value: string; pct: number; color: string; sub: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5 text-xs">
        <span className="font-semibold text-[#1e293b]">{label}</span>
        <span className="font-bold text-[#0f1a3a]">{value}</span>
      </div>
      <div className="h-[7px] bg-[#e6ecf2] rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full transition-all duration-700 relative ${color}`} style={{ width: `${Math.min(pct, 100)}%` }}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-[#7b8ba3]">
        <span>{sub.split('/')[0]}</span>
        <span>/ {sub.split('/')[1]}</span>
      </div>
    </div>
  )
}
