'use client'
// Modifier devis — refonte parité Nouveau (patch 3)

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, X, Send } from 'lucide-react'
import { useClients, useEntreprise, useChantiers, usePointsCollecte, useSupabaseRecord, useDevisLignes, usePrestations, updateRow, LoadingSkeleton } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
import { isAutoEntrepreneur } from '@/lib/helpers'
import { buildSuggestions, memorizePrestations } from '@/lib/prestations-memo'
import { mergeCatalogueSuggestions } from '@/lib/catalogue'
import LineCard from '@/components/mobile/LineCard'
import LineSheet, { type SheetLine } from '@/components/mobile/LineSheet'
import LineStatutSelect, { type InclusionStatut, inclusionToDb, dbToInclusion } from '@/components/devis/LineStatut'
import DesignationAutocomplete from '@/components/DesignationAutocomplete'
import EnvoyerDevisModal from '@/components/dashboard/EnvoyerDevisModal'

interface LineItem {
  id: number
  designation: string
  qty: number
  unit: string
  priceHT: number
  // V2.5 — TVA par ligne (parite Obat). Defaut 10% (sauf franchise AE → 0).
  tva: number
  type: 'line' | 'section' | 'subsection' | 'text'
  // Statut d'inclusion : ferme / facultatif / option
  inclusion: InclusionStatut
}

interface ClientRecord { id: string; nom: string; prenom?: string; civilite?: string; adresse?: string; telephone?: string; email?: string; code_postal?: string; ville?: string }
interface ChantierRecord { id: string; nom?: string; titre?: string; objet?: string; description?: string }

interface DevisRecord {
  id: string
  numero: string
  statut: string
  date_emission?: string
  date_validite?: string
  date_debut_travaux?: string
  duree_estimee?: string
  objet?: string
  description?: string
  chantier_id?: string | null
  client_id?: string | null
  client_nom?: string
  conditions_paiement?: string
  notes_personnalisees?: string
  notes_internes?: string
  notes_client?: string
  acompte_pourcent?: number
  montant_ht?: number
  montant_tva?: number
  montant_ttc?: number
  dechets_nature?: string
  dechets_quantite?: string
  dechets_responsable?: string
  dechets_tri?: string
  dechets_collecte_nom?: string
  dechets_collecte_adresse?: string
  dechets_collecte_type?: string
  dechets_cout?: number
  dechets_inclure_cout?: boolean
}

interface LigneRecord {
  id: string
  designation: string
  quantite: number
  unite: string
  prix_unitaire_ht: number
  taux_tva?: number
  ordre: number
  type?: string
  niveau?: number
  optionnel?: boolean
  inclus_par_defaut?: boolean
}

const UNIT_SUGGESTIONS = ['U', 'm²', 'm', 'ml', 'cm', 'kg', 't', 'h', 'jour', 'demi-journée', 'forfait', 'ensemble', 'lot', 'm³']
const TVA_RATES = [0, 5.5, 10, 20]

const PRESTATIONS_INTEGREES = [
  'Installation tableau électrique', 'Remplacement tableau électrique', 'Mise aux normes électriques',
  'Installation prises de courant', 'Installation interrupteurs', 'Câblage / tirage de câbles',
  'Installation éclairage intérieur', 'Installation éclairage extérieur', 'Pose spots encastrés',
  'Installation VMC (ventilation)', 'Installation chauffe-eau électrique', 'Installation radiateurs électriques',
  'Domotique / automatisation', 'Borne de recharge véhicule électrique', 'Mise à la terre',
  'Diagnostic électrique', 'Installation alarme / sécurité', 'Sonette / interphone / visiophone',
  'Installation sanitaires (WC, lavabo, douche)', 'Remplacement robinetterie', 'Débouchage canalisations',
  'Réparation fuite d\'eau', 'Installation chauffe-eau', 'Remplacement chaudière',
  'Construction mur / cloison', 'Démolition mur / cloison', 'Ouverture de mur porteur',
  'Coulage dalle béton', 'Ragréage sol', 'Enduit / crépi extérieur', 'Isolation thermique',
  'Pose fenêtres double vitrage', 'Pose porte d\'entrée', 'Pose porte intérieure',
  'Installation volets roulants', 'Pose parquet', 'Construction terrasse bois', 'Pose pergola',
  'Peinture intérieure', 'Peinture extérieure', 'Pose papier peint', 'Pose carrelage / faïence',
  'Ravalement de façade', 'Travaux de plomberie générale', 'Travaux de charpente',
  'Fourniture et pose de matériel', 'Main d\'œuvre', 'Déplacement et frais de chantier',
  'Nettoyage fin de chantier', 'Dépose / évacuation gravats', 'Visite et diagnostic',
  'Salle de bain', 'Cuisine', 'Rénovation complète', 'Mise en conformité',
]

const PAYMENT_OPTIONS = [
  { id: 'p30', label: '30% à la commande, solde à la réception' },
  { id: 'p50', label: '50% à la commande, solde à la réception' },
  { id: 'comptant', label: 'Paiement comptant à la réception' },
  { id: 'j30', label: 'Paiement à 30 jours' },
  { id: 'reception', label: 'Paiement à réception de facture' },
  { id: 'virement', label: 'Virement bancaire uniquement' },
  { id: 'cheque', label: 'Chèque accepté' },
  { id: 'penalites', label: 'Pénalités de retard : 3 fois le taux légal' },
]

let nextId = 1000

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// SIREN = 9 chiffres (minimum legal), SIRET = 14 chiffres (SIREN + etablissement).
// On accepte les DEUX. Champ vide autorise (tant qu'on n'enregistre pas).
// Retourne un message d'erreur si invalide, sinon null.
function validateClientSiret(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 0 || digits.length === 9 || digits.length === 14) return null
  return `Numéro invalide : un SIREN fait 9 chiffres, un SIRET 14 (vous avez saisi ${digits.length}).`
}

// V4 : style input partagé sur cette page — bordure 1.5px, bg #fafbfc, focus halo orange
const inputCls = 'w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4] placeholder:text-gray-400 focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all duration-200'

export default function ModifierDevisPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: devis, loading: loadingDevis } = useSupabaseRecord<DevisRecord>('devis', id)
  const { data: lignesRaw, loading: loadingLignes } = useDevisLignes(id)
  const { data: clientsRaw } = useClients()
  const { data: chantiersRaw } = useChantiers()
  const { data: pointsCollecteRaw } = usePointsCollecte()
  const { entreprise } = useEntreprise()
  const { data: prestationsRows } = usePrestations()
  const prestationSuggestions = useMemo(
    () => mergeCatalogueSuggestions(buildSuggestions(prestationsRows), (entreprise as { metier?: string } | null | undefined)?.metier),
    [prestationsRows, entreprise],
  )
  const clients = clientsRaw as unknown as ClientRecord[]
  const chantiers = (chantiersRaw as unknown as ChantierRecord[]) || []
  const pointsCollecte = pointsCollecteRaw as unknown as { id: string; nom: string; adresse?: string; type_installation?: string }[]

  const [dateDevis, setDateDevis] = useState('')
  const [dateValidite, setDateValidite] = useState('')
  const [dateTravaux, setDateTravaux] = useState('')
  const [duree, setDuree] = useState('')

  const [clientCivilite, setClientCivilite] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [clientPrenom, setClientPrenom] = useState('')
  const [clientSiret, setClientSiret] = useState('')
  // SIREN (9 chiffres) OU SIRET (14 chiffres) : tout autre nombre = invalide.
  const [clientSiretError, setClientSiretError] = useState<string | null>(null)
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientCodePostal, setClientCodePostal] = useState('')
  const [clientVille, setClientVille] = useState('')
  const [clientTelephone, setClientTelephone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientSuggestions, setClientSuggestions] = useState<ClientRecord[]>([])
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)

  const [chantierDesc, setChantierDesc] = useState('')
  const [chantierId, setChantierId] = useState<string | null>(null)
  const [chantierSuggestions, setChantierSuggestions] = useState<string[]>([])
  const [chantierDropdownOpen, setChantierDropdownOpen] = useState(false)

  const [lines, setLines] = useState<LineItem[]>([])
  const [autoEntrepreneur, setAutoEntrepreneur] = useState(false)
  const [globalTvaRate, setGlobalTvaRate] = useState(10)
  const [tvaUserOverride, setTvaUserOverride] = useState(false)

  const [useForfait, setUseForfait] = useState(false)
  const [forfaitHT, setForfaitHT] = useState(0)

  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [conditionsLibres, setConditionsLibres] = useState('')

  const [acompteActive, setAcompteActive] = useState(false)
  const [acomptePercent, setAcomptePercent] = useState<string>('')
  const [acompteLabel, setAcompteLabel] = useState('')

  const [notes, setNotes] = useState('')

  const [dechetsNature, setDechetsNature] = useState('Déchets non dangereux (câbles, emballages)')
  const [dechetsQuantite, setDechetsQuantite] = useState('')
  const [dechetsResponsable, setDechetsResponsable] = useState('L\'entreprise')
  const [dechetsTri, setDechetsTri] = useState('Tri sur le chantier')
  const [dechetsCollecteNom, setDechetsCollecteNom] = useState('')
  const [dechetsCollecteAdresse, setDechetsCollecteAdresse] = useState('')
  const [dechetsCollecteType, setDechetsCollecteType] = useState('Déchetterie')
  const [dechetsCout, setDechetsCout] = useState('')
  const [dechetsInclureCout, setDechetsInclureCout] = useState(false)
  const [dechetteriesProches, setDechetteriesProches] = useState<{nom:string;adresse:string;code_postal:string;commune:string;distance_km:number;accepte_pro:string;accepte_construction:boolean;accepte_deee:boolean}[]>([])
  const [loadingDechetteries, setLoadingDechetteries] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [envoyerOpen, setEnvoyerOpen] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLine, setSheetLine] = useState<LineItem | null>(null)
  const [sheetDefaultType, setSheetDefaultType] = useState<'line' | 'section' | 'subsection' | 'text'>('line')

  const openCreateSheet = (type: 'line' | 'section' | 'subsection' | 'text' = 'line') => {
    setSheetLine(null); setSheetDefaultType(type); setSheetOpen(true)
  }
  const openEditSheet = (line: LineItem) => {
    setSheetLine(line); setSheetDefaultType(line.type); setSheetOpen(true)
  }
  const handleSheetSave = (payload: SheetLine) => {
    if (sheetLine) {
      setLines(prev => prev.map(l => l.id === sheetLine.id ? { ...l, designation: payload.designation, qty: payload.qty, unit: payload.unit || l.unit, priceHT: payload.priceHT, type: payload.type, inclusion: payload.inclusion ?? l.inclusion } : l))
    } else {
      // V2.5 : nouvelle ligne herite du taux global (raccourci) ou 10% par defaut.
      setLines(prev => [...prev, { id: nextId++, designation: payload.designation, qty: payload.qty, unit: payload.unit || 'U', priceHT: payload.priceHT, tva: autoEntrepreneur ? 0 : (globalTvaRate || 10), type: payload.type, inclusion: payload.inclusion ?? 'ferme' }])
    }
  }
  const handleSheetSaveAndNew = (payload: SheetLine) => {
    handleSheetSave(payload); setSheetLine(null); setSheetDefaultType('line'); setSheetOpen(false)
    setTimeout(() => setSheetOpen(true), 50)
  }

  useEffect(() => {
    if (!devis || loaded) return
    setDateDevis(devis.date_emission || '')
    setDateValidite(devis.date_validite || '')
    setDateTravaux(devis.date_debut_travaux || '')
    setDuree(devis.duree_estimee || '')
    setChantierDesc(devis.objet || devis.description || '')
    setChantierId(devis.chantier_id || null)
    setConditionsLibres(devis.conditions_paiement || '')
    setNotes(devis.notes_personnalisees || devis.notes_internes || '')
    if (devis.acompte_pourcent && devis.acompte_pourcent > 0) {
      setAcompteActive(true); setAcomptePercent(String(devis.acompte_pourcent))
    }
    if (devis.dechets_nature) setDechetsNature(devis.dechets_nature)
    if (devis.dechets_quantite) setDechetsQuantite(devis.dechets_quantite)
    if (devis.dechets_responsable) setDechetsResponsable(devis.dechets_responsable)
    if (devis.dechets_tri) setDechetsTri(devis.dechets_tri)
    if (devis.dechets_collecte_nom) setDechetsCollecteNom(devis.dechets_collecte_nom)
    if (devis.dechets_collecte_adresse) setDechetsCollecteAdresse(devis.dechets_collecte_adresse)
    if (devis.dechets_collecte_type) setDechetsCollecteType(devis.dechets_collecte_type)
    if (devis.dechets_cout != null) setDechetsCout(String(devis.dechets_cout))
    if (devis.dechets_inclure_cout) setDechetsInclureCout(devis.dechets_inclure_cout)
    setLoaded(true)
  }, [devis, loaded])

  useEffect(() => {
    if (!devis || !loaded) return
    if (clientNom) return
    const supabase = createClient()
    if (devis.client_id) {
      supabase.from('clients').select('*').eq('id', devis.client_id).maybeSingle().then(({ data }) => {
        if (data) {
          const c = data as unknown as ClientRecord & { civilite?: string }
          const rawC = data as unknown as Record<string, string>
          if (rawC.type === 'professionnel') {
            setClientCivilite('Société')
            setClientSiret(rawC.siret || '')
          } else {
            setClientCivilite(c.civilite || '')
          }
          setClientNom(c.nom || ''); setClientPrenom(c.prenom || '')
          setClientAdresse(c.adresse || ''); setClientCodePostal(c.code_postal || '')
          setClientVille(c.ville || ''); setClientTelephone(c.telephone || '')
          setClientEmail(c.email || '')
        } else if (devis.notes_client) {
          const parts = devis.notes_client.split(/\s*\|\s*/).map(s => s.trim())
          if (parts[0]) setClientNom(parts[0])
          if (parts[1]) setClientAdresse(parts[1])
        }
      })
    } else if (devis.notes_client) {
      const parts = devis.notes_client.split(/\s*\|\s*/).map(s => s.trim())
      if (parts[0]) setClientNom(parts[0])
      if (parts[1]) setClientAdresse(parts[1])
    }
  }, [devis, loaded, clientNom])

  useEffect(() => {
    if (!lignesRaw || lignesRaw.length === 0 || lines.length > 0) return
    const raw = lignesRaw as unknown as LigneRecord[]
    setLines(raw.map((l, i) => {
      const reactType: LineItem['type'] = l.type === 'section' ? 'section' : l.type === 'sous_section' ? 'subsection' : l.type === 'commentaire' ? 'text' : 'line'
      // V2.5 : on lit le taux_tva DB par ligne (chaque ligne peut avoir son propre taux).
      return { id: nextId + i, designation: l.designation || '', qty: l.quantite || (reactType === 'line' ? 1 : 0), unit: l.unite || 'U', priceHT: l.prix_unitaire_ht || 0, tva: l.taux_tva ?? 10, type: reactType, inclusion: dbToInclusion(l.optionnel, l.inclus_par_defaut) }
    }))
    nextId += raw.length
    const firstLine = raw.find(l => !l.type || l.type === 'prestation')
    if (firstLine && firstLine.taux_tva != null) {
      const tva = firstLine.taux_tva
      setGlobalTvaRate(tva); setTvaUserOverride(true)
      if (tva === 0) setAutoEntrepreneur(true)
    }
  }, [lignesRaw, lines.length])

  useEffect(() => {
    if (tvaUserOverride) return
    if (isAutoEntrepreneur(entreprise)) {
      setAutoEntrepreneur(true); setGlobalTvaRate(0)
    }
  }, [entreprise, tvaUserOverride])

  useEffect(() => {
    if (!entreprise) return
    const cp = (entreprise as Record<string, unknown>).code_postal as string
    if (!cp) return
    setLoadingDechetteries(true)
    fetch(`/api/dechetteries?cp=${encodeURIComponent(cp)}`)
      .then(r => r.json())
      .then(data => { if (data.dechetteries) setDechetteriesProches(data.dechetteries) })
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingDechetteries(false))
  }, [entreprise])

  useEffect(() => {
    if (autoEntrepreneur) setGlobalTvaRate(0)
  }, [autoEntrepreneur])

  const handleClientNomChange = (value: string) => {
    setClientNom(value)
    if (value.length >= 1 && clients && clients.length > 0) {
      const q = value.toLowerCase().trim()
      const filtered = clients.filter(c => {
        const nom = String(c.nom || '').toLowerCase()
        const prenom = String(c.prenom || '').toLowerCase()
        const civilite = String((c as unknown as Record<string, string>).civilite || '').toLowerCase()
        return nom.includes(q) || prenom.includes(q) || (prenom + ' ' + nom).includes(q) || civilite.includes(q)
      })
      setClientSuggestions(filtered.slice(0, 8)); setClientDropdownOpen(filtered.length > 0)
    } else { setClientSuggestions([]); setClientDropdownOpen(false) }
  }
  const selectClientSuggestion = (c: ClientRecord) => {
    const raw = c as unknown as Record<string, string>
    setClientSiretError(null)
    if (raw.type === 'professionnel') {
      setClientCivilite('Société')
      setClientSiret(raw.siret || '')
    } else {
      setClientCivilite(raw.civilite || '')
    }
    setClientNom(c.nom); setClientPrenom(c.prenom || '')
    setClientAdresse(c.adresse || ''); setClientCodePostal(c.code_postal || '')
    setClientVille(c.ville || ''); setClientTelephone(c.telephone || '')
    setClientEmail(c.email || ''); setClientSuggestions([]); setClientDropdownOpen(false)
  }

  const handleChantierDescChange = (value: string) => {
    setChantierDesc(value)
    if (value.length >= 1) {
      const q = value.toLowerCase()
      const fromDB = chantiers
        .map(c => (c.titre as string) || (c.nom as string) || (c.objet as string) || '')
        .filter(t => t.length > 0 && t.toLowerCase().includes(q))
      const fromDBset = new Set(fromDB.map(n => n.toLowerCase()))
      const fromBuiltin = PRESTATIONS_INTEGREES.filter(p => p.toLowerCase().includes(q) && !fromDBset.has(p.toLowerCase()))
      const merged = [...fromDB, ...fromBuiltin].slice(0, 10)
      setChantierSuggestions(merged); setChantierDropdownOpen(merged.length > 0)
    } else { setChantierSuggestions([]); setChantierDropdownOpen(false) }
  }
  const selectChantierSuggestion = (nom: string) => {
    setChantierDesc(nom)
    const match = chantiers.find(c => {
      const label = (c.titre as string) || (c.nom as string) || (c.objet as string) || ''
      return label.toLowerCase() === nom.toLowerCase()
    })
    setChantierId(match ? match.id : null)
    setChantierSuggestions([]); setChantierDropdownOpen(false)
  }

  function updateLine(lid: number, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => l.id === lid ? { ...l, [field]: value } : l))
  }
  function removeLine(lid: number) { setLines(prev => prev.filter(l => l.id !== lid)) }
  function addLine(type: 'line' | 'section' | 'subsection' | 'text' = 'line') {
    // V2.5 : nouvelle ligne herite du taux global (raccourci) ou 10% par defaut.
    setLines(prev => [...prev, { id: nextId++, designation: '', qty: type === 'line' ? 1 : 0, unit: 'U', priceHT: 0, tva: autoEntrepreneur ? 0 : (globalTvaRate || 10), type, inclusion: 'ferme' }])
  }
  function subtotalAt(idx: number): number {
    const current = lines[idx]
    if (!current || (current.type !== 'section' && current.type !== 'subsection')) return 0
    let subtotal = 0
    for (let j = idx + 1; j < lines.length; j++) {
      const l = lines[j]
      if (current.type === 'section' && l.type === 'section') break
      if (current.type === 'subsection' && (l.type === 'section' || l.type === 'subsection')) break
      if (l.type === 'line') subtotal += l.qty * l.priceHT
    }
    return subtotal
  }

  const togglePayment = (pid: string) => {
    setSelectedPayments(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid); else next.add(pid)
      return next
    })
  }

  const effectiveTva = autoEntrepreneur ? 0 : globalTvaRate
  let totalHT = 0
  // V2.5 — TVA par ligne (parite Obat) : agregation par taux saisi sur chaque ligne.
  const tvaGroups: Record<number, { ht: number; tva: number }> = {}
  if (useForfait) {
    totalHT = forfaitHT
    if (effectiveTva > 0) {
      tvaGroups[effectiveTva] = { ht: totalHT, tva: totalHT * (effectiveTva / 100) }
    }
  } else {
    lines.forEach(l => {
      if (l.type !== 'line') return
      // Les lignes "Option +" ne sont pas comptees dans le total principal.
      if (l.inclusion === 'option') return
      const lineTotal = l.qty * l.priceHT
      totalHT += lineTotal
      const taux = autoEntrepreneur ? 0 : (l.tva ?? 0)
      if (taux > 0) {
        if (!tvaGroups[taux]) tvaGroups[taux] = { ht: 0, tva: 0 }
        tvaGroups[taux].ht += lineTotal
        tvaGroups[taux].tva += lineTotal * (taux / 100)
      }
    })
  }
  const totalTVA = Object.values(tvaGroups).reduce((s, g) => s + g.tva, 0)
  const dechetsCoutNum = dechetsCout ? parseFloat(dechetsCout) : 0
  const totalTTC = totalHT + totalTVA + (dechetsInclureCout ? dechetsCoutNum : 0)
  const acomptePct = acompteActive && acomptePercent ? parseFloat(acomptePercent) : 0
  const acompteMontant = acomptePct > 0 ? (autoEntrepreneur ? totalHT : totalTTC) * (acomptePct / 100) : 0
  const resteAPayer = (autoEntrepreneur ? totalHT : totalTTC) - acompteMontant

  const buildConditionsStr = (): string => {
    const fromChips = Array.from(selectedPayments).map(pid => {
      const opt = PAYMENT_OPTIONS.find(p => p.id === pid)
      return opt ? opt.label : ''
    }).filter(Boolean)
    const out = [...fromChips]
    if (conditionsLibres && conditionsLibres.trim()) out.push(conditionsLibres.trim())
    return out.join('\n')
  }

  const handleSave = useCallback(async (action: 'brouillon' | 'enregistrer' | 'envoyer') => {
    if (!devis) return
    // Blocage : client Societe + SIREN/SIRET non vide mais invalide (ni 9 ni 14 chiffres).
    // On ne bloque PAS si le champ est vide (enregistrement possible sans identifiant).
    if (clientCivilite === 'Société') {
      const siretMsg = validateClientSiret(clientSiret)
      if (siretMsg) {
        setClientSiretError(siretMsg)
        setError(siretMsg)
        return
      }
    }
    setSaving(true); setError(null)
    const wasSharedWithClient = devis.statut === 'envoye' || devis.statut === 'signe'
    let nouveauStatut: string
    if (action === 'brouillon') nouveauStatut = 'brouillon'
    else if (action === 'enregistrer') nouveauStatut = wasSharedWithClient ? 'brouillon' : 'finalise'
    else nouveauStatut = 'finalise'

    try {
      const clientDisplay = `${clientCivilite ? clientCivilite + ' ' : ''}${clientPrenom ? clientPrenom + ' ' : ''}${clientNom || ''}`.trim()
      const conditionsStr = buildConditionsStr()
      const devisData: Record<string, unknown> = {
        statut: nouveauStatut,
        date_emission: dateDevis || null,
        date_validite: dateValidite || null,
        date_debut_travaux: dateTravaux || null,
        duree_estimee: duree || null,
        objet: chantierDesc || null,
        description: chantierDesc || null,
        chantier_id: chantierId,
        conditions_paiement: conditionsStr || null,
        notes_personnalisees: notes || null,
        notes_internes: null,
        notes_client: clientDisplay
          ? `${clientDisplay}${clientAdresse ? ` | ${clientAdresse}` : ''}${clientCodePostal || clientVille ? ` | ${clientCodePostal} ${clientVille}`.trim() : ''}${clientTelephone ? ` | ${clientTelephone}` : ''}${clientEmail ? ` | ${clientEmail}` : ''}`
          : null,
        acompte_pourcent: acomptePct > 0 ? acomptePct : null,
        montant_ht: totalHT,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        dechets_nature: dechetsNature || null,
        dechets_quantite: dechetsQuantite || null,
        dechets_responsable: dechetsResponsable || null,
        dechets_tri: dechetsTri || null,
        dechets_collecte_nom: dechetsCollecteNom || null,
        dechets_collecte_adresse: dechetsCollecteAdresse || null,
        dechets_collecte_type: dechetsCollecteType || null,
        dechets_cout: dechetsCout ? parseFloat(dechetsCout) : null,
        dechets_inclure_cout: dechetsInclureCout,
      }

      if (clientNom.trim()) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: existingClient } = await supabase
              .from('clients').select('id').eq('user_id', user.id).ilike('nom', clientNom.trim()).maybeSingle()
            const clientData: Record<string, unknown> = {
              nom: clientNom.trim(),
              prenom: clientPrenom.trim() || null,
              adresse: clientAdresse || null,
              code_postal: clientCodePostal || null,
              ville: clientVille || null,
              telephone: clientTelephone || null,
              email: clientEmail || null,
              user_id: user.id,
            }
            if (clientCivilite) clientData.civilite = clientCivilite
            // Client professionnel (Societe) : on persiste type + SIRET pour la
            // facturation electronique B2B. Sinon on retombe sur 'particulier'.
            const isPro = clientCivilite === 'Société'
            clientData.type = isPro ? 'professionnel' : 'particulier'
            if (isPro) clientData.siret = clientSiret.trim() || null
            if (existingClient) {
              devisData.client_id = existingClient.id
              await supabase.from('clients').update(clientData).eq('id', existingClient.id)
            } else {
              const { data: newClient } = await supabase.from('clients').insert({ ...clientData, actif: true }).select('id').single()
              if (newClient) devisData.client_id = newClient.id
            }
          }
        } catch (err) { console.error('Erreur sauvegarde client:', err) }
      }

      if (dechetsCollecteNom.trim()) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: existingPoint } = await supabase.from('points_collecte').select('id').eq('user_id', user.id).ilike('nom', dechetsCollecteNom.trim()).maybeSingle()
            if (!existingPoint) {
              await supabase.from('points_collecte').insert({
                nom: dechetsCollecteNom.trim(),
                adresse: dechetsCollecteAdresse || null,
                type_installation: dechetsCollecteType || null,
                user_id: user.id,
              })
            }
          }
        } catch (err) { console.error('Erreur sauvegarde point de collecte:', err) }
      }

      await updateRow('devis', devis.id, devisData)

      const supabase = createClient()
      const lignesFiltrees = lines.filter(l => l.type === 'line' || !!l.designation)
      const lignesPourNumero = lignesFiltrees.map(l => ({
        type: (l.type === 'section' ? 'section' : l.type === 'subsection' ? 'sous_section' : l.type === 'text' ? 'commentaire' : 'prestation') as 'section' | 'sous_section' | 'prestation' | 'commentaire',
        _orig: l,
      }))
      const lignesAvecNumero = computeHierarchicalNumbers(lignesPourNumero)
      const lignesPayload = lignesAvecNumero.map((item, i) => {
        const l = item._orig as typeof lines[0]
        const dbType = item.type
        const dbNiveau = dbType === 'section' ? 1 : dbType === 'sous_section' ? 2 : 3
        return {
          designation: l.designation,
          quantite: l.type === 'line' ? l.qty : 0,
          unite: l.type === 'line' ? l.unit : '',
          prix_unitaire_ht: l.type === 'line' ? l.priceHT : 0,
          // V2.5 — TVA par ligne : on persiste le taux saisi sur chaque ligne.
          // En mode AE, on force 0. En mode forfait, on retombe sur effectiveTva.
          taux_tva: autoEntrepreneur ? 0 : (useForfait ? effectiveTva : (l.tva ?? effectiveTva)),
          ordre: i + 1,
          type: dbType,
          niveau: dbNiveau,
          numero: item.numero || null,
          // Statut d'inclusion : seules les prestations peuvent etre facultatives/options.
          ...(dbType === 'prestation' ? inclusionToDb(l.inclusion) : { optionnel: false, inclus_par_defaut: true }),
        }
      })

      const { error: rpcError } = await supabase.rpc('replace_devis_lignes', {
        p_devis_id: devis.id,
        p_lignes: lignesPayload,
      })
      if (rpcError) throw rpcError

      // Mémorisation auto des prestations (best-effort, ne bloque jamais le succès)
      await memorizePrestations(lines.map(l => ({ designation: l.designation, unit: l.unit, priceHT: l.priceHT, tva: (l as { tva?: number }).tva, type: l.type })))

      if (action === 'brouillon') {
        setToastMsg('Modifications sauvegardées')
        setTimeout(() => setToastMsg(null), 3000)
        setSaving(false)
      } else if (action === 'envoyer') {
        setSaving(false); setEnvoyerOpen(true)
      } else {
        router.push(`/dashboard/devis/${devis.id}`)
      }
    } catch (err) {
      setError((err as Error).message); setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devis, clientCivilite, clientSiret, clientNom, clientPrenom, clientAdresse, clientCodePostal, clientVille, clientTelephone, clientEmail, dateDevis, dateValidite, dateTravaux, duree, chantierDesc, chantierId, selectedPayments, conditionsLibres, notes, totalHT, totalTVA, totalTTC, effectiveTva, lines, router, acomptePct, acompteActive, acompteLabel, dechetsNature, dechetsQuantite, dechetsResponsable, dechetsTri, dechetsCollecteNom, dechetsCollecteAdresse, dechetsCollecteType, dechetsCout, dechetsInclureCout, useForfait, forfaitHT])

  if (loadingDevis || loadingLignes) return <div className="p-6"><LoadingSkeleton rows={8} /></div>
  if (!devis) return <div className="p-6"><p className="text-sm text-gray-500">Devis introuvable.</p></div>

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 py-3 px-4 sm:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/dashboard/devis/${id}`} className="p-1.5 rounded-md hover:bg-gray-100 shrink-0">
            <ArrowLeft size={18} className="text-[#6b7280]" />
          </Link>
          <h2 className="hidden sm:block font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] truncate">
            Modifier devis <span className="font-spline-mono font-bold">{devis.numero}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => handleSave('brouillon')} disabled={saving} className="h-9 px-3 sm:px-4 rounded-xl border-2 border-gray-300 text-sm font-hanken font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50">Brouillon</button>
          <button onClick={() => handleSave('enregistrer')} disabled={saving} className="h-9 px-3 sm:px-5 rounded-xl bg-emerald-600 text-white font-hanken font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50">{saving ? '...' : 'Enregistrer'}</button>
          <button onClick={() => handleSave('envoyer')} disabled={saving} className="h-9 px-3 sm:px-4 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken font-bold text-sm shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100 flex items-center gap-1.5"><Send size={14} /><span className="hidden sm:inline">Envoyer</span></button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600 font-hanken">{error}</p></div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Date d&apos;émission</label><input type="date" value={dateDevis} onChange={e => setDateDevis(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Valable jusqu&apos;au</label><input type="date" value={dateValidite} onChange={e => setDateValidite(e.target.value)} className={inputCls} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Date des travaux</label><input type="date" value={dateTravaux} onChange={e => setDateTravaux(e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Durée estimée</label><input type="text" value={duree} onChange={e => setDuree(e.target.value)} placeholder="Ex. : 3 jours" className={inputCls} /></div>
            </div>
            <div className="relative">
              <label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Chantier / Prestation{chantierId && <span className="ml-2 text-[10px] font-hanken font-bold text-[#0f1a3a] bg-[#fff5ec] px-2 py-0.5 rounded uppercase tracking-wider">Lié au chantier</span>}</label>
              <input type="text" value={chantierDesc} onChange={e => handleChantierDescChange(e.target.value)} onBlur={() => setTimeout(() => setChantierDropdownOpen(false), 150)} placeholder="Description de la prestation / chantier..." className={inputCls} autoComplete="off" />
              {chantierDropdownOpen && chantierSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border-2 border-[#ff7a1a]/30 shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                  {chantierSuggestions.map((nom, i) => (
                    <button key={i} type="button" onMouseDown={e => { e.preventDefault(); selectChantierSuggestion(nom) }} className="w-full text-left px-4 py-3 text-sm font-hanken hover:bg-[#fff5ec] border-b border-gray-100 last:border-0 transition-colors text-[#0f1a3a] font-medium">{nom}</button>
                  ))}
                </div>
              )}
              <p className="text-[11px] font-hanken text-gray-400 mt-1">Tapez pour rechercher un chantier existant, ou saisissez librement.</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-hanken font-semibold text-[#0f1a3a] mb-3">Client</label>
            <div className="space-y-3">
              <div className="relative">
                <div className="flex gap-2">
                  <select value={clientCivilite} onChange={e => { setClientCivilite(e.target.value); if (e.target.value !== 'Société') setClientSiretError(null) }} className="w-24 h-11 shrink-0 rounded-xl border-2 border-gray-200 px-2 text-sm font-hanken outline-none focus:border-[#ff7a1a] bg-white">
                    <option value="">—</option><option value="M.">M.</option><option value="Mme">Mme</option><option value="Société">Société</option>
                  </select>
                  <input type="text" value={clientNom} onChange={e => handleClientNomChange(e.target.value)} onBlur={() => setTimeout(() => { setClientDropdownOpen(false); setClientSuggestions([]) }, 200)} placeholder="Nom (tapez pour rechercher)" className={inputCls} autoComplete="off" />
                </div>
                {clientDropdownOpen && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border-2 border-[#ff7a1a]/30 shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                    {clientSuggestions.map(c => (
                      <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); selectClientSuggestion(c) }} className="w-full text-left px-4 py-3 font-hanken hover:bg-[#fff5ec] border-b border-gray-100 last:border-0 transition-colors">
                        <span className="font-semibold text-[#0f1a3a] text-sm">{c.prenom ? `${c.prenom} ${c.nom}` : c.nom}</span>
                        {c.adresse && <span className="text-[#6b7280] text-xs block mt-0.5">{c.adresse}{c.code_postal || c.ville ? ` · ${c.code_postal ?? ''} ${c.ville ?? ''}`.trim() : ''}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {clientCivilite === 'Société' ? (
                <div>
                  <input type="text" inputMode="numeric" value={clientSiret} onChange={e => setClientSiret(e.target.value)} onBlur={() => setClientSiretError(validateClientSiret(clientSiret))} placeholder="SIREN (9) ou SIRET (14)" className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]' + (clientSiretError ? ' border-red-500 focus:border-red-500' : '')} />
                  {clientSiretError && <p className="mt-1 text-[12px] text-red-600 font-hanken">{clientSiretError}</p>}
                </div>
              ) : (
                <input type="text" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} placeholder="Prénom" className={inputCls} />
              )}
              <input type="text" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} placeholder="Adresse" className={inputCls} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" value={clientCodePostal} onChange={e => setClientCodePostal(e.target.value)} placeholder="Code postal" className={inputCls} />
                <input type="text" value={clientVille} onChange={e => setClientVille(e.target.value)} placeholder="Ville" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="tel" value={clientTelephone} onChange={e => setClientTelephone(e.target.value)} placeholder="Téléphone" className={inputCls} />
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email" className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="sm:hidden p-3 space-y-2">
            {lines.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-[#fafbfc] px-4 py-6 text-center">
                <p className="text-sm font-hanken text-[#5f6c80]">Aucune ligne pour l&apos;instant.</p>
                <p className="text-[12px] font-hanken text-gray-400 mt-1">Touchez <strong>+ Ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
              </div>
            )}
            {lines.map((line, idx) => (
              <LineCard key={line.id} line={line} subtotal={subtotalAt(idx)} onTap={() => openEditSheet(line)} onDelete={() => removeLine(line.id)} formatCurrency={formatCurrency} />
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => openCreateSheet('line')} className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:border-[#ff7a1a] hover:bg-[#fff5ec] rounded-full px-4 py-2.5 text-sm font-hanken font-semibold text-[#0f1a3a] active:scale-95 transition-all"><Plus size={16} /> Ligne</button>
              <button type="button" onClick={() => openCreateSheet('section')} className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-hanken font-semibold text-[#0f1a3a] active:scale-95 transition-all"><Plus size={16} /> Section</button>
              <button type="button" onClick={() => openCreateSheet('subsection')} className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-hanken font-semibold text-[#0f1a3a] active:scale-95 transition-all"><Plus size={16} /> Sous-section</button>
            </div>
          </div>

          <div className="hidden sm:block overflow-x-auto">
            {/* V2.5 — Colonne TVA par ligne (parite Obat) */}
            <div className="bg-[#0f1a3a] text-white grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-3 text-xs font-hanken font-semibold uppercase">
              <span>Désignation</span><span className="text-center">Qté</span><span className="text-center">Unité</span><span className="text-right">Prix U. HT</span><span className="text-center">TVA</span><span className="text-right">Total HT</span><span />
            </div>
            {lines.length === 0 && (
              <div className="px-4 py-8 text-center border-b border-gray-100">
                <p className="text-sm font-hanken text-[#5f6c80]">Aucune ligne pour l&apos;instant.</p>
                <p className="text-[12px] font-hanken text-gray-400 mt-1">Cliquez sur <strong>+ Ajouter une ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
              </div>
            )}
            {lines.map((line, idx) => {
              if (line.type === 'section') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-2 bg-[#fafbfc] border-l-4 border-[#ff7a1a] border-b border-gray-100">
                    <input type="text" value={line.designation} onChange={e => updateLine(line.id, 'designation', e.target.value)} className="text-sm font-bold text-[#0f1a3a] uppercase border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white/60 focus:border-[#ff7a1a] px-2 h-9 placeholder-gray-400 [grid-column:span_5]" placeholder="Nom de la section (ex : Démolition, Maçonnerie...)" />
                    <span className="text-sm font-bold text-[#0f1a3a] text-right pr-1 whitespace-nowrap">{formatCurrency(subtotalAt(idx))}</span>
                    <button onClick={() => removeLine(line.id)} className="p-1 text-gray-400 hover:text-red-500 justify-self-end"><Trash2 size={14} /></button>
                  </div>
                )
              }
              if (line.type === 'subsection') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-2 bg-white border-l-4 border-[#ff7a1a]/60 border-b border-gray-100">
                    <input type="text" value={line.designation} onChange={e => updateLine(line.id, 'designation', e.target.value)} className="text-sm font-semibold text-[#0f1a3a] border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white/60 focus:border-[#ff7a1a] px-2 h-9 placeholder-gray-400 [grid-column:span_5]" placeholder="Nom de la sous-section (ex : Cuisine, Plomberie...)" />
                    <span className="text-sm font-semibold text-[#0f1a3a] text-right pr-1 whitespace-nowrap">{formatCurrency(subtotalAt(idx))}</span>
                    <button onClick={() => removeLine(line.id)} className="p-1 text-gray-400 hover:text-red-500 justify-self-end"><Trash2 size={14} /></button>
                  </div>
                )
              }
              if (line.type === 'text') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_36px] min-w-[500px] items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <input type="text" value={line.designation} onChange={e => updateLine(line.id, 'designation', e.target.value)} className="text-sm italic text-gray-600 border border-gray-200 rounded-md outline-none bg-white focus:border-[#ff7a1a] px-2 h-9" placeholder="Texte libre (note, remarque...)" />
                    <button onClick={() => removeLine(line.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                )
              }
              return (
                <div key={line.id} className="grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-2 border-b border-gray-100">
                  <div className="mr-2">
                    <DesignationAutocomplete
                      value={line.designation}
                      onChange={v => updateLine(line.id, 'designation', v)}
                      onPick={s => {
                        updateLine(line.id, 'designation', s.designation)
                        updateLine(line.id, 'unit', s.unite)
                        updateLine(line.id, 'priceHT', s.prix_unitaire_ht)
                        updateLine(line.id, 'tva', autoEntrepreneur ? 0 : s.taux_tva)
                      }}
                      suggestions={prestationSuggestions}
                      placeholder="Désignation..."
                      rows={1}
                      className="w-full text-sm font-hanken border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] px-2 py-1.5 resize-none overflow-hidden min-h-[36px]"
                    />
                    <div className="mt-1.5">
                      <LineStatutSelect value={line.inclusion} onChange={s => updateLine(line.id, 'inclusion', s)} />
                    </div>
                  </div>
                  <input type="number" value={line.qty} onChange={e => updateLine(line.id, 'qty', Number(e.target.value))} className="text-sm text-center border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 mx-1" min={0} />
                  <select value={line.unit} onChange={e => updateLine(line.id, 'unit', e.target.value)} className="text-sm text-center border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 mx-1 w-full">
                    {UNIT_SUGGESTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" value={line.priceHT} onChange={e => updateLine(line.id, 'priceHT', Number(e.target.value))} className="text-sm text-right border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 px-2 mx-1" min={0} step={0.01} />
                  {/* V2.5 — Selecteur TVA par ligne (parite Obat) */}
                  <select value={line.tva} onChange={e => updateLine(line.id, 'tva', Number(e.target.value))} disabled={autoEntrepreneur} className="text-sm text-center border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 mx-1 w-full disabled:bg-gray-50 disabled:text-gray-400">
                    {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? '0%' : r === 5.5 ? '5,5%' : `${r}%`}</option>)}
                  </select>
                  <span className="text-sm font-semibold text-right">{line.priceHT > 0 ? formatCurrency(line.qty * line.priceHT) : '—'}</span>
                  <button onClick={() => removeLine(line.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>

          <div className="hidden sm:flex flex-wrap gap-2 p-4 border-t border-gray-100">
            <button onClick={() => addLine('line')} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-hanken hover:bg-gray-100"><Plus size={14} /> Ajouter une ligne</button>
            <button onClick={() => addLine('section')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-hanken text-[#0f1a3a] bg-white border border-gray-300 hover:border-[#ff7a1a] hover:bg-[#fff5ec] rounded-lg"><Plus size={14} /> Section</button>
            <button onClick={() => addLine('subsection')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-hanken text-[#0f1a3a] bg-white border border-gray-300 hover:border-[#ff7a1a] hover:bg-[#fff5ec] rounded-lg"><Plus size={14} /> Sous-section</button>
            <button onClick={() => addLine('text')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-hanken text-[#6b7280] hover:text-[#0f1a3a]"><Plus size={14} /> Texte libre</button>
          </div>
        </div>

        {/* V2.5 — Selecteur global = raccourci "Appliquer a toutes les lignes". */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-hanken font-medium text-[#0f1a3a]">Appliquer à toutes les lignes :</label>
            <select
              value={globalTvaRate}
              onChange={e => {
                const v = Number(e.target.value)
                setTvaUserOverride(true)
                setGlobalTvaRate(v)
                setAutoEntrepreneur(v === 0)
                // V2.5 : pousse le taux sur TOUTES les lignes existantes
                setLines(prev => prev.map(l => l.type === 'line' ? { ...l, tva: v } : l))
              }}
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-hanken outline-none focus:border-[#ff7a1a] bg-white cursor-pointer"
            >
              {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'Sans TVA' : `${r}%`}</option>)}
            </select>
          </div>
          <span className="text-xs font-hanken text-[#6b7280] italic">Astuce : modifiable aussi ligne par ligne dans le tableau.</span>
          {autoEntrepreneur && <span className="text-xs font-hanken text-[#6b7280] italic">TVA non applicable, art. 293 B du CGI</span>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-hanken cursor-pointer">
            <input type="checkbox" checked={useForfait} onChange={e => setUseForfait(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#ff7a1a] focus:ring-[#ff7a1a]" />
            Appliquer un prix forfaitaire global
          </label>
          {useForfait && (
            <div className="flex items-center gap-2">
              <input type="number" value={forfaitHT} onChange={e => setForfaitHT(Number(e.target.value))} className="w-32 h-9 rounded-lg border border-gray-200 px-3 text-sm font-hanken outline-none focus:border-[#ff7a1a] text-right" min={0} step={0.01} />
              <span className="text-sm font-hanken text-[#6b7280]">€ HT</span>
              <span className="text-[11px] font-hanken text-gray-400">(remplace le calcul ligne par ligne)</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={acompteActive} onChange={e => setAcompteActive(e.target.checked)} className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-[#0f1a3a] focus:ring-2 focus:ring-[#ff7a1a]/30 cursor-pointer accent-[#ff7a1a]" />
            <div>
              <span className="block text-sm font-hanken font-semibold text-[#0f1a3a]">Demander un acompte</span>
              <span className="block text-[11px] font-hanken text-gray-400 mt-0.5">Cochez si vous souhaitez demander un acompte à la signature du devis. Il sera affiché dans le récapitulatif.</span>
            </div>
          </label>
          {acompteActive && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-hanken font-medium text-gray-500 uppercase tracking-wider mb-1">Pourcentage (%)</label>
                <input type="number" value={acomptePercent} min={0} max={100} step={1} onChange={e => setAcomptePercent(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-hanken font-medium text-gray-500 uppercase tracking-wider mb-1">Libellé (optionnel)</label>
                <input type="text" value={acompteLabel} onChange={e => setAcompteLabel(e.target.value)} placeholder="Ex. : à la commande" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <label className="block text-sm font-hanken font-medium text-[#0f1a3a]">Conditions de paiement</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_OPTIONS.map(opt => (
              <button key={opt.id} type="button" onClick={() => togglePayment(opt.id)} className={`px-3 py-1.5 rounded-full text-sm font-hanken border transition-colors ${selectedPayments.has(opt.id) ? 'bg-[#fff5ec] border-[#ff7a1a] text-[#0f1a3a] font-medium' : 'border-gray-200 text-[#6b7280] hover:border-gray-400'}`}>
                {selectedPayments.has(opt.id) ? '✓ ' : '☐ '}{opt.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Conditions libres<span className="ml-2 text-[10px] font-hanken text-gray-400 font-normal">(éditable, contient les conditions existantes du devis)</span></label>
            <textarea value={conditionsLibres} onChange={e => setConditionsLibres(e.target.value)} rows={3} placeholder="Ex : Acompte 30% à la commande, solde à réception..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a] resize-none" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm font-hanken font-medium text-[#0f1a3a]">Gestion des déchets</label>
            <span className="text-[9px] font-hanken text-[#ff7a1a] border border-[#ff7a1a]/40 px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold">Loi AGEC</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Nature des déchets</label>
              <select value={dechetsNature} onChange={e => setDechetsNature(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                <option value="Déchets non dangereux (câbles, emballages)">Déchets non dangereux (câbles, emballages)</option>
                <option value="Déchets d'équipements électriques (DEEE)">DEEE (équipements électriques)</option>
                <option value="Déchets inertes (gravats, plâtre, béton)">Déchets inertes (gravats, plâtre)</option>
                <option value="Mélange non dangereux">Mélange non dangereux</option>
                <option value="Déchets dangereux (amiante, peintures)">Déchets dangereux (amiante, peintures)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Quantité estimée</label>
              <input type="text" value={dechetsQuantite} onChange={e => setDechetsQuantite(e.target.value)} placeholder="Ex : 0.5 tonne, 2 m³" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Enlèvement par</label>
              <select value={dechetsResponsable} onChange={e => setDechetsResponsable(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                <option value="L'entreprise">L&apos;entreprise</option>
                <option value="Le client (maître d'ouvrage)">Le client</option>
                <option value="Prestataire externe">Prestataire externe</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Tri</label>
              <select value={dechetsTri} onChange={e => setDechetsTri(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                <option value="Tri sur le chantier">Tri sur le chantier</option>
                <option value="Collecte séparée">Collecte séparée</option>
                <option value="Évacuation en mélange">Évacuation en mélange</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Coût estimé TTC (€)</label>
              <input type="number" value={dechetsCout} onChange={e => setDechetsCout(e.target.value)} placeholder="0.00" min={0} step={0.01} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={dechetsInclureCout} onChange={e => setDechetsInclureCout(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#ff7a1a] focus:ring-[#ff7a1a]" />
                <span className="text-sm font-hanken text-[#0f1a3a]">Inclure dans le prix total</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Point de collecte</label>
            {!dechetsCollecteNom && ((pointsCollecte && pointsCollecte.length > 0) || dechetteriesProches.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pointsCollecte?.map(p => (
                  <button key={p.id} type="button" onClick={() => { setDechetsCollecteNom(p.nom); setDechetsCollecteAdresse(p.adresse || ''); setDechetsCollecteType(p.type_installation || 'Déchetterie') }} className="px-2.5 py-1 rounded-full text-[11px] font-hanken bg-[#fff5ec] border border-[#ff7a1a]/30 text-[#0f1a3a] hover:bg-[#ffeadb] transition-colors font-medium">★ {p.nom}</button>
                ))}
                {dechetteriesProches.slice(0, 3).map((d, i) => {
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.nom} ${d.adresse} ${d.code_postal} ${d.commune}`)}`
                  const acceptePro = d.accepte_pro && d.accepte_pro !== 'Non renseigné' && d.accepte_pro.toLowerCase() !== 'non'
                  return (
                    <div key={`api-${i}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 hover:border-gray-400 transition-colors overflow-hidden">
                      <button type="button" onClick={() => { setDechetsCollecteNom(d.nom); setDechetsCollecteAdresse(`${d.adresse}, ${d.code_postal} ${d.commune}`); setDechetsCollecteType('Déchetterie') }} className="px-2.5 py-1 text-[11px] font-hanken text-[#6b7280] hover:bg-gray-50 transition-colors">
                        {d.nom} <span className="text-[#ff7a1a] font-semibold">({d.distance_km} km)</span>
                        {acceptePro && <span title="Accepte les professionnels" className="ml-1 px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">PRO</span>}
                        {d.accepte_construction && <span title="Accepte les déchets de construction (gravats)" className="ml-1 px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">GRAVATS</span>}
                        {d.accepte_deee && <span title="Accepte les équipements électriques et électroniques" className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">DEEE</span>}
                      </button>
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Voir sur Google Maps" className="px-2 py-1 text-[#ff7a1a] hover:bg-[#fff5ec] transition-colors border-l border-gray-200">↗</a>
                    </div>
                  )
                })}
              </div>
            )}
            {loadingDechetteries && !dechetsCollecteNom && <p className="text-[11px] font-hanken text-[#9ca3af] mb-2 animate-pulse">Recherche des déchetteries proches...</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <input type="text" value={dechetsCollecteNom} onChange={e => setDechetsCollecteNom(e.target.value)} placeholder="Nom / raison sociale" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
                {dechetsCollecteNom && <button type="button" onClick={() => { setDechetsCollecteNom(''); setDechetsCollecteAdresse(''); setDechetsCollecteType('Déchetterie') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
              </div>
              <input type="text" value={dechetsCollecteAdresse} onChange={e => setDechetsCollecteAdresse(e.target.value)} placeholder="Adresse" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
              <select value={dechetsCollecteType} onChange={e => setDechetsCollecteType(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                <option value="Déchetterie">Déchetterie</option>
                <option value="Centre de tri">Centre de tri</option>
                <option value="Plateforme de recyclage">Plateforme de recyclage</option>
                <option value="Collecteur agréé">Collecteur agréé</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Notes personnalisées<span className="ml-2 text-[10px] text-gray-400 font-normal">(visibles par le client)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Écrire ici…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a] resize-none" />
        </div>

        <div className="flex justify-end">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full sm:w-80">
            <div className="flex justify-between py-1.5 text-sm font-hanken"><span className="text-[#5f6c80]">Sous-total HT</span><span className="font-medium">{formatCurrency(totalHT)}</span></div>
            {/* V2.5 — Ventilation TVA par taux (multi-taux Obat) */}
            {!autoEntrepreneur && Object.entries(tvaGroups).filter(([r, g]) => Number(r) > 0 && g.tva > 0.005).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, group]) => (
              <div key={rate} className="flex justify-between py-1.5 text-sm font-hanken"><span className="text-[#5f6c80]">TVA {rate}%</span><span className="font-medium">{formatCurrency(group.tva)}</span></div>
            ))}
            {dechetsInclureCout && dechetsCoutNum > 0 && <div className="flex justify-between py-1.5 text-sm font-hanken"><span className="text-[#ff7a1a]">Gestion déchets TTC</span><span className="font-medium text-[#ff7a1a]">{formatCurrency(dechetsCoutNum)}</span></div>}
            <div className="border-t mt-2 pt-2 flex justify-between py-1.5 text-sm font-hanken"><span className="text-[#0f1a3a] font-bold">{autoEntrepreneur ? 'Total' : 'Total TTC'}</span><span className="font-bold">{formatCurrency(autoEntrepreneur ? totalHT : totalTTC)}</span></div>
            {autoEntrepreneur && <p className="text-xs text-[#6b7280] italic mt-1">TVA non applicable, art. 293 B du CGI</p>}
            {acompteMontant > 0 && (
              <>
                <div className="flex justify-between py-1.5 text-sm font-hanken border-t mt-1 pt-2"><span className="text-[#0f1a3a] font-medium">Acompte à verser ({acomptePct}%)</span><span className="text-[#0f1a3a] font-semibold">{formatCurrency(acompteMontant)}</span></div>
                <div className="flex justify-between py-1.5 text-sm font-hanken"><span className="text-[#6b7280]">Reste à facturer</span><span className="font-semibold text-[#0f1a3a]">{formatCurrency(resteAPayer)}</span></div>
              </>
            )}
            <div className="bg-[#0f1a3a] text-white rounded-lg p-3 mt-3 flex justify-between items-center">
              <span className="font-hanken font-bold text-sm">NET À PAYER</span>
              <span className="font-hanken font-bold text-lg">{formatCurrency(autoEntrepreneur ? totalHT : totalTTC)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end pb-8">
          <button onClick={() => handleSave('brouillon')} disabled={saving} className="h-12 px-6 rounded-xl border-2 border-gray-300 text-sm font-hanken font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50">Brouillon</button>
          <button onClick={() => handleSave('enregistrer')} disabled={saving} className="h-12 px-8 rounded-xl bg-emerald-600 text-white font-hanken font-bold text-sm hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            Enregistrer
          </button>
          <div className="w-px h-8 bg-gray-200 mx-1" />
          <button onClick={() => handleSave('envoyer')} disabled={saving} className="h-12 px-8 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken font-bold text-sm shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100">
            <Send size={16} /> Envoyer
          </button>
        </div>
      </div>

      {toastMsg && <div className="fixed bottom-6 right-6 bg-[#0f1a3a] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-hanken z-50">{toastMsg}</div>}

      <LineSheet open={sheetOpen} onClose={() => setSheetOpen(false)} line={sheetLine as SheetLine | null} onSave={handleSheetSave} onSaveAndNew={handleSheetSaveAndNew} defaultType={sheetDefaultType} unitOptions={UNIT_SUGGESTIONS} prestations={prestationSuggestions} autoEntrepreneur={autoEntrepreneur} showStatut />

      <EnvoyerDevisModal open={envoyerOpen} onClose={() => setEnvoyerOpen(false)} devisId={devis.id} numeroDevis={devis.numero} clientEmail={clientEmail} chantier={chantierDesc} onSuccess={() => { setEnvoyerOpen(false); router.push(`/dashboard/devis/${devis.id}`) }} />
    </div>
  )
}
