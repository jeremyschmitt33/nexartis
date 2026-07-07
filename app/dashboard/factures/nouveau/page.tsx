'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useClients, useEntreprise, useChantiers, usePrestations, insertRow } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { creditDisponibleAvoir } from '@/lib/facture-net'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
import { isAutoEntrepreneur } from '@/lib/helpers'
import { getEffectivePlan } from '@/lib/plans'
import { buildSuggestions, memorizePrestations } from '@/lib/prestations-memo'
import { mergeCatalogueSuggestions } from '@/lib/catalogue'
import LineCard from '@/components/mobile/LineCard'
import LineSheet, { type SheetLine } from '@/components/mobile/LineSheet'
import DesignationAutocomplete from '@/components/DesignationAutocomplete'
import SituationParLigne, { type SituationParLigneResultat, type LigneDevisMarche } from '@/components/factures/SituationParLigne'
import { cumulDejaFactureParLigne } from '@/lib/situation'
import { genererImagePlanNiveau } from '@/lib/plan/export'
import type { PlanData } from '@/lib/plan/types'

// ─── Types ────────────────────────────────────────────────────────────────

interface LineItem {
  id: number
  designation: string
  qty: number
  unit: string
  priceHT: number
  // V2.5 — TVA par ligne (parite Obat). Defaut 10% (sauf franchise AE → 0).
  tva: number
  // V4 — type pour gérer sections/sous-sections/commentaires (parité devis)
  type: 'line' | 'section' | 'subsection' | 'text'
  // Push 7B — ligne de devis d'origine (situation par ligne). Absent = ligne manuelle.
  devisLigneId?: string
}

interface ClientRecord { id: string; nom: string; prenom?: string; civilite?: string; adresse?: string; telephone?: string; email?: string; code_postal?: string; ville?: string }

// V3.1 — ChantierRecord enrichi pour le sélecteur de situation (P2).
// On a besoin du client_id (pour résoudre le nom du client) et du montant_devis_total
// (snapshot devisé) à l'affichage. Le devis lié est résolu via une requête séparée
// car la table chantiers ne stocke pas directement le n° de devis.
interface ChantierRecord {
  id: string
  nom?: string
  titre?: string
  objet?: string
  client_id?: string | null
  client_nom?: string | null
  ville_chantier?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────

const UNIT_SUGGESTIONS = ['U', 'm²', 'm', 'ml', 'h', 'jour', 'forfait', 'lot', 'ensemble']
const TVA_RATES = [0, 5.5, 10, 20]
const DEFAULT_CONDITIONS_PAIEMENT =
  'Méthodes de paiement acceptées : Virement bancaire, Chèque.'
let nextId = 200

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

// V4 light : style input premium (fond #fafbfc, bordure 1.5px, halo orange au focus).
const inputCls = 'w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4] placeholder:text-gray-400 focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all duration-200'

// ─── Page ─────────────────────────────────────────────────────────────────

export default function NouvelleFacturePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: clientsRaw } = useClients()
  const { data: chantiersRaw } = useChantiers()
  // entreprise — utilisée pour auto-détection franchise TVA (micro / EI / auto-entrepreneur)
  const { entreprise } = useEntreprise()
  const { data: prestationsRows } = usePrestations()
  const prestationSuggestions = useMemo(
    () => mergeCatalogueSuggestions(buildSuggestions(prestationsRows), (entreprise as { metier?: string } | null | undefined)?.metier),
    [prestationsRows, entreprise],
  )
  // AE (franchise TVA) : source de vérité = helper isAutoEntrepreneur. Sert à forcer
  // la TVA à 0 lors d'une sélection de suggestion de prestation.
  const autoEntrepreneur = isAutoEntrepreneur(entreprise)
  // Gating : les factures de situation sont réservées à l'offre Complet (essai inclus).
  // Les acomptes simples restent disponibles dans l'Essentiel.
  const canSituation = getEffectivePlan(entreprise).hasFullAccess
  const clients = clientsRaw as unknown as ClientRecord[]
  const chantiers = (chantiersRaw as unknown as ChantierRecord[]) || []

  // Dates
  const today = new Date().toISOString().slice(0, 10)
  const inMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) })()
  const [dateFacture, setDateFacture] = useState(today)
  const [dateEcheance, setDateEcheance] = useState(inMonth)

  // V3.0c.17 — Type de facture (standard / acompte / situation / avoir)
  // Backend (DB col `type`, FactureData lib/pdf.ts) gere deja les 4 valeurs.
  // Pour 'situation' on collecte en plus : devis_ref, numero_situation, pourcentage_situation.
  const [factureType, setFactureType] = useState<'standard' | 'acompte' | 'situation' | 'avoir'>('standard')
  const [devisRef, setDevisRef] = useState('')
  const [numeroSituation, setNumeroSituation] = useState<number>(1)
  const [pourcentageSituation, setPourcentageSituation] = useState<number>(0)
  // V3.0c.18 — Pré-remplissage intelligent des situations :
  //   - cumul HT/TTC des situations précédentes (calculé depuis la DB)
  //   - reste à facturer HT/TTC (si on retrouve le devis lié → totalHT - cumul - cette situation)
  //   - numero_situation suggéré (max(N) des situations existantes + 1)
  // null = pas encore calculé ou pas de devis_ref valide.
  const [cumulPrecedentHT, setCumulPrecedentHT] = useState<number | null>(null)
  const [cumulPrecedentTTC, setCumulPrecedentTTC] = useState<number | null>(null)
  const [devisTotalHT, setDevisTotalHT] = useState<number | null>(null)
  const [devisTotalTTC, setDevisTotalTTC] = useState<number | null>(null)
  const [devisDateLiee, setDevisDateLiee] = useState<string | null>(null)
  const [situationLookupMsg, setSituationLookupMsg] = useState<string>('')
  // Push 7B — facturation de situation PAR LIGNE (additif). Le détail par ligne
  // (situation_lignes) est RECALCULÉ au save depuis les lignes réelles (jamais figé).
  const [situationPlan, setSituationPlan] = useState<{
    lignes: LigneDevisMarche[]
    dejaFacture: Record<string, number>
    etats: Record<string, string>
    noms: Record<string, string>
    /** Plans du chantier (pour générer le snapshot colorié au save, Push 7C). */
    plans: Array<{ id: string; name: string; data: PlanData }>
  } | null>(null)

  // Client (texte libre ou sélection)
  const [clientNom, setClientNom] = useState('')
  const [clientPrenom, setClientPrenom] = useState('')
  const [clientCivilite, setClientCivilite] = useState('')
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

  // Objet — autocomplete sur les chantiers existants
  const [objet, setObjet] = useState('')
  const [chantierId, setChantierId] = useState<string | null>(null)
  const [chantierSuggestions, setChantierSuggestions] = useState<ChantierRecord[]>([])
  const [chantierDropdownOpen, setChantierDropdownOpen] = useState(false)

  // Lignes — bug fix (V8) : on demarre avec une liste vide. L'artisan cree lui-meme
  // sa premiere ligne / section via les boutons "+ Ligne" / "+ Section". Parite devis.
  const [lines, setLines] = useState<LineItem[]>([])
  const [globalTvaRate, setGlobalTvaRate] = useState(10)

  // V2 imputation avoir — quand on choisit un client existant, on detecte ses
  // avoirs "a valoir" avec credit dispo et on propose de les deduire.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [avoirsDispo, setAvoirsDispo] = useState<Array<{ id: string; numero: string; creditDispo: number }>>([])
  const [avoirChoisi, setAvoirChoisi] = useState<{ id: string; numero: string; creditDispo: number } | null>(null)

  // V3.1 : indique si la facture provient de la commande vocale (force brouillon)
  const [fromVoice, setFromVoice] = useState(false)

  // V3.1 : Pre-remplissage depuis la commande vocale universelle (?voicePayload=...)
  useEffect(() => {
    const encoded = searchParams.get('voicePayload')
    if (!encoded) return
    setFromVoice(true)
    try {
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      while (b64.length % 4) b64 += '='
      const json = decodeURIComponent(escape(atob(b64)))
      const data = JSON.parse(json) as Record<string, unknown>
      if (data.client_civilite) setClientCivilite(data.client_civilite as string)
      if (data.client_nom) setClientNom(data.client_nom as string)
      if (data.client_prenom) setClientPrenom(data.client_prenom as string)
      if (data.client_adresse) setClientAdresse(data.client_adresse as string)
      if (data.client_code_postal) setClientCodePostal(data.client_code_postal as string)
      if (data.client_ville) setClientVille(data.client_ville as string)
      if (data.client_telephone) setClientTelephone(data.client_telephone as string)
      if (data.client_email) setClientEmail(data.client_email as string)
      if (data.objet) setObjet(data.objet as string)
      if (data.facture_type) setFactureType(data.facture_type as 'standard' | 'acompte' | 'situation' | 'avoir')
      if (data.devis_ref) setDevisRef(data.devis_ref as string)
      // V3.1 — P3 : si la création vient de la fiche chantier (bouton "Émettre une
      // facture de situation"), on récupère le chantier_id pour le persister à la
      // sauvegarde et pré-cocher le sélecteur de chantier en mode situation.
      if (data.chantier_id) setChantierId(data.chantier_id as string)
      // V2.2 10/06/2026 — Pre-remplissage du % d'avancement situation
      // depuis le bouton planning (calcule a partir des interventions du
      // chantier dont la date est <= aujourd'hui). L'artisan peut toujours
      // ajuster manuellement la valeur.
      if (typeof data.pourcentage_situation_suggere === 'number' && data.pourcentage_situation_suggere > 0) {
        setPourcentageSituation(Math.min(100, Math.max(0, data.pourcentage_situation_suggere)))
      }
      if (data.tva_taux != null) setGlobalTvaRate(data.tva_taux as number)
      const voiceLines = data.lignes as Array<{ designation: string; quantite: number; unite: string; prix_unitaire: number }> | null
      if (voiceLines && voiceLines.length > 0) {
        let baseId = 1
        setLines(voiceLines.map((vl) => ({
          id: baseId++,
          designation: vl.designation,
          qty: vl.quantite || 1,
          unit: vl.unite || 'U',
          priceHT: vl.prix_unitaire || 0,
          tva: (data.tva_taux as number) ?? 10,
          type: 'line' as const,
        })))
      }
    } catch (e) {
      console.warn('[factures/nouveau] voicePayload decode error:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Bottom sheet mobile (saisie/édition d'une ligne) ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLine, setSheetLine] = useState<LineItem | null>(null)
  const [sheetDefaultType, setSheetDefaultType] = useState<'line' | 'section' | 'subsection' | 'text'>('line')

  const openCreateSheet = (type: 'line' | 'section' | 'subsection' | 'text' = 'line') => {
    setSheetLine(null)
    setSheetDefaultType(type)
    setSheetOpen(true)
  }
  const openEditSheet = (line: LineItem) => {
    setSheetLine(line)
    setSheetDefaultType(line.type)
    setSheetOpen(true)
  }

  // Sauvegarde depuis le sheet : update si on édite, push si nouvelle ligne
  const handleSheetSave = (payload: SheetLine) => {
    if (sheetLine) {
      // Édition d'une ligne existante
      setLines(prev => prev.map(l => l.id === sheetLine.id ? {
        ...l,
        designation: payload.designation,
        qty: payload.qty,
        unit: payload.unit || l.unit,
        priceHT: payload.priceHT,
        type: payload.type,
      } : l))
    } else {
      // Création
      // V2.5 : nouvelle ligne herite du taux global (raccourci) ou 10% par defaut.
      setLines(prev => [...prev, {
        id: nextId++,
        designation: payload.designation,
        qty: payload.qty,
        unit: payload.unit || 'U',
        priceHT: payload.priceHT,
        tva: globalTvaRate || 10,
        type: payload.type,
      }])
    }
  }
  // Valider + enchaîner : on enregistre puis on rouvre un sheet vide
  const handleSheetSaveAndNew = (payload: SheetLine) => {
    handleSheetSave(payload)
    setSheetLine(null)
    setSheetDefaultType('line')
    // Astuce : on garde sheetOpen=true, mais on relance le mount via key
    setSheetOpen(false)
    setTimeout(() => setSheetOpen(true), 50)
  }
  // V6 — Si l'utilisateur change manuellement la TVA, on ne ré-impose plus 0 automatiquement
  const [tvaUserOverride, setTvaUserOverride] = useState(false)

  // 2026-06-10 — Autoliquidation TVA BTP (sous-traitance, art. 283-2 nonies CGI).
  // Quand actif : TVA forcee a 0 sur toutes les lignes + mention auto en pied de doc.
  const [autoliquidationBtp, setAutoliquidationBtp] = useState(false)

  // V6 — Auto-détection franchise TVA via helper unique isAutoEntrepreneur.
  // Si l'entreprise est en franchise, on force globalTvaRate=0 (parité avec le devis).
  // L'artisan peut malgré tout remettre 10/20% (cas dépassement seuil), auquel cas
  // tvaUserOverride passe à true et on respecte son choix sans le ré-écraser.
  useEffect(() => {
    if (tvaUserOverride) return
    if (isAutoEntrepreneur(entreprise)) {
      setGlobalTvaRate(0)
    }
  }, [entreprise, tvaUserOverride])

  // V3.0c.18 — Pré-remplissage intelligent des factures de situation.
  // Quand l'artisan saisit (ou colle) un devis_ref en mode situation, on cherche :
  //   1. Le devis correspondant en BDD (table devis, col numero) → on cache totalHT/TTC.
  //   2. Toutes les factures déjà émises pour ce devis_ref → on calcule le cumul HT/TTC
  //      et on suggère le numero_situation suivant.
  // Le state local est ensuite injecté à la sauvegarde (factureData) pour persister
  // montant_situation_precedent_* et reste_a_facturer_*.
  // Debounce 500ms pour éviter de spammer la DB sur chaque keystroke.
  useEffect(() => {
    if (factureType !== 'situation') {
      setCumulPrecedentHT(null)
      setCumulPrecedentTTC(null)
      setDevisTotalHT(null)
      setDevisTotalTTC(null)
      setDevisDateLiee(null)
      setSituationLookupMsg('')
      return
    }
    const ref = devisRef.trim()
    if (!ref) {
      setCumulPrecedentHT(null)
      setCumulPrecedentTTC(null)
      setDevisTotalHT(null)
      setDevisTotalTTC(null)
      setDevisDateLiee(null)
      setSituationLookupMsg('')
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || ctrl.signal.aborted) return

        // 1. Devis lié (pour totalHT/TTC + date)
        const { data: devisRow } = await supabase
          .from('devis')
          .select('montant_ht, montant_ttc, date_emission')
          .eq('user_id', user.id)
          .eq('numero', ref)
          .maybeSingle()
        if (ctrl.signal.aborted) return
        const dHT = devisRow ? Number(devisRow.montant_ht ?? 0) : null
        const dTTC = devisRow ? Number(devisRow.montant_ttc ?? 0) : null
        const dDate = devisRow ? (devisRow.date_emission as string | null) : null
        setDevisTotalHT(dHT)
        setDevisTotalTTC(dTTC)
        setDevisDateLiee(dDate)

        // 2. Factures de situation déjà émises sur ce devis_ref
        const { data: situations } = await supabase
          .from('factures')
          .select('numero_situation, montant_ht, montant_ttc')
          .eq('user_id', user.id)
          .eq('type', 'situation')
          .eq('devis_ref', ref)
        if (ctrl.signal.aborted) return
        const rows = (situations ?? []) as Array<{ numero_situation: number | null; montant_ht: number | null; montant_ttc: number | null }>
        const cumulHT = rows.reduce((acc, r) => acc + Number(r.montant_ht ?? 0), 0)
        const cumulTTC = rows.reduce((acc, r) => acc + Number(r.montant_ttc ?? 0), 0)
        const maxN = rows.reduce((m, r) => Math.max(m, Number(r.numero_situation ?? 0)), 0)
        setCumulPrecedentHT(cumulHT)
        setCumulPrecedentTTC(cumulTTC)
        // Suggestion numéro suivant — uniquement si l'artisan n'a pas déjà personnalisé
        // (= numero_situation est resté à 1 ET il y a déjà des situations).
        if (maxN > 0 && numeroSituation === 1) setNumeroSituation(maxN + 1)

        // Message utilisateur
        if (devisRow && rows.length === 0) {
          setSituationLookupMsg(`Devis trouvé (${dHT?.toFixed(2) ?? '—'} € HT). Aucune situation antérieure.`)
        } else if (devisRow && rows.length > 0) {
          setSituationLookupMsg(`${rows.length} situation${rows.length > 1 ? 's' : ''} antérieure${rows.length > 1 ? 's' : ''} trouvée${rows.length > 1 ? 's' : ''} (cumul ${cumulHT.toFixed(2)} € HT). Suggéré : situation N°${maxN + 1}.`)
        } else if (rows.length > 0) {
          setSituationLookupMsg(`${rows.length} situation${rows.length > 1 ? 's' : ''} antérieure${rows.length > 1 ? 's' : ''} sur cette référence (cumul ${cumulHT.toFixed(2)} € HT).`)
        } else {
          setSituationLookupMsg('Référence devis non trouvée — saisie libre acceptée.')
        }
      } catch {
        // Silencieux : pas bloquant pour l'artisan
        setSituationLookupMsg('')
      }
    }, 500)
    return () => { ctrl.abort(); clearTimeout(timer) }
    // numeroSituation NE figure PAS dans deps pour éviter une boucle infinie
    // (on l'utilise en lecture pour décider d'auto-suggérer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factureType, devisRef])

  // Push 7B — chargement des données de facturation PAR LIGNE (additif, ne touche
  // pas au lookup existant) : lignes du devis (+ source_plan), déjà-facturé par ligne
  // (situations précédentes) et avancement colorié du plan du chantier.
  useEffect(() => {
    if (factureType !== 'situation') { setSituationPlan(null); return }
    const ref = devisRef.trim()
    if (!ref) { setSituationPlan(null); return }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || ctrl.signal.aborted) return
        const { data: devisRow } = await supabase
          .from('devis').select('id').eq('user_id', user.id).eq('numero', ref).maybeSingle()
        if (ctrl.signal.aborted) return
        if (!devisRow) { setSituationPlan(null); return }
        const devisId = String((devisRow as { id: string }).id)
        const { data: lignesRows } = await supabase
          .from('devis_lignes')
          .select('id, designation, montant_ht, taux_tva, type, optionnel, retenu_par_client, source_plan')
          .eq('devis_id', devisId)
        if (ctrl.signal.aborted) return
        const lignes: LigneDevisMarche[] = (lignesRows ?? [])
          // En base, une ligne facturable a le type 'prestation' (pas 'line', qui est
          // la représentation front). On ne garde que les prestations réellement dues.
          .filter((r) => (String(r.type ?? 'prestation')) === 'prestation' && (!r.optionnel || r.retenu_par_client))
          .map((r) => {
            const sp = (r.source_plan ?? null) as { roomId?: string | null } | null
            return {
              id: String(r.id),
              designation: String(r.designation ?? ''),
              montantMarcheHt: Number(r.montant_ht ?? 0),
              tauxTva: Number(r.taux_tva ?? 0),
              roomId: sp?.roomId ?? null,
            }
          })
        const { data: sits } = await supabase
          .from('factures').select('situation_lignes, montant_ht')
          .eq('user_id', user.id).eq('type', 'situation').eq('devis_ref', ref)
        if (ctrl.signal.aborted) return
        const sitsArr = (sits ?? []) as Array<{ situation_lignes?: { devis_ligne_id: string; montant_ht: number }[] | null; montant_ht?: number | null }>
        // GARDE-FOU ARGENT : si une situation antérieure a été émise SANS le détail
        // par ligne (montant > 0 mais situation_lignes vide), le cumul par ligne est
        // incomplet → on DÉSACTIVE l'écran par ligne pour ne jamais re-facturer du
        // déjà-encaissé. On retombe sur la saisie manuelle (comportement d'avant).
        const historiqueIncomplet = sitsArr.some(
          (s) => Number(s.montant_ht ?? 0) > 0 && !(Array.isArray(s.situation_lignes) && s.situation_lignes.length > 0)
        )
        if (historiqueIncomplet) { setSituationPlan(null); return }
        const dejaFacture = cumulDejaFactureParLigne(sitsArr)
        const etats: Record<string, string> = {}
        const noms: Record<string, string> = {}
        const plansAv: Array<{ id: string; name: string; data: PlanData }> = []
        if (chantierId) {
          const { data: plansRows } = await supabase
            .from('plans').select('id, name, data').eq('user_id', user.id).eq('chantier_id', chantierId).is('deleted_at', null)
          if (ctrl.signal.aborted) return
          for (const p of plansRows ?? []) {
            const d = (p.data ?? null) as { levels?: Array<{ rooms?: Array<{ id?: string; name?: string; avancement?: string }> }> } | null
            for (const niv of d?.levels ?? []) {
              for (const room of niv.rooms ?? []) {
                if (room?.id && room.avancement) etats[room.id] = room.avancement
                if (room?.id && room.name) noms[room.id] = room.name
              }
            }
            if (d) plansAv.push({ id: String(p.id), name: String(p.name ?? 'Plan'), data: d as unknown as PlanData })
          }
        }
        setSituationPlan({ lignes, dejaFacture, etats, noms, plans: plansAv })
      } catch {
        setSituationPlan(null)
      }
    }, 500)
    return () => { ctrl.abort(); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factureType, devisRef, chantierId])

  // Push 7B — « Appliquer » : remplace les lignes de la facture par le détail de la
  // situation (avec confirmation si des lignes non vides existent déjà).
  const appliquerSituation = (r: SituationParLigneResultat) => {
    const aDesDonnees = lines.some((l) => l.type === 'line' && (l.designation.trim() !== '' || l.priceHT > 0))
    if (aDesDonnees && !window.confirm('Remplacer les lignes actuelles par le détail de la situation ?')) return
    setLines(r.lignesFacture.map((lf) => ({
      id: nextId++, designation: lf.designation, qty: 1, unit: 'forfait', priceHT: lf.prix_unitaire_ht, tva: lf.tva, type: 'line' as const, devisLigneId: lf.devisLigneId,
    })))
    setPourcentageSituation(r.pourcentageGlobal)
  }

  // Push 7B — vrai quand l'écran de situation par ligne est disponible (pilote l'UI :
  // masque l'ancien recap TTC et passe le champ % en lecture seule pour éviter deux
  // sources de vérité contradictoires).
  const modeParLigneActif = factureType === 'situation' && !!situationPlan && situationPlan.lignes.length > 0

  // Conditions de paiement (pré-remplies) + notes personnalisées (visibles client)
  const [conditions, setConditions] = useState<string>(DEFAULT_CONDITIONS_PAIEMENT)
  const [notesPerso, setNotesPerso] = useState('')

  // V4 — Forfait global (parité devis) : remplace le calcul ligne par ligne par un montant HT libre
  const [useForfait, setUseForfait] = useState(false)
  const [forfaitHT, setForfaitHT] = useState(0)

  // Acompte
  const [acompteActive, setAcompteActive] = useState(false)
  const [acomptePourcent, setAcomptePourcent] = useState<number>(30)
  const [acompteMontantTTC, setAcompteMontantTTC] = useState<number>(0)
  const [acompteLabel, setAcompteLabel] = useState('')

  // UI
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocomplete chantier sur le champ "Objet"
  const handleObjetChange = (value: string) => {
    setObjet(value)
    setChantierId(null) // dès qu'on tape, on délie du chantier précédent
    if (value.length >= 1 && chantiers.length > 0) {
      const q = value.toLowerCase().trim()
      const filtered = chantiers.filter(c => {
        const txt = `${c.nom || ''} ${c.titre || ''} ${c.objet || ''}`.toLowerCase()
        return txt.includes(q)
      }).slice(0, 6)
      setChantierSuggestions(filtered)
      setChantierDropdownOpen(filtered.length > 0)
    } else {
      setChantierSuggestions([])
      setChantierDropdownOpen(false)
    }
  }
  const selectChantier = (c: ChantierRecord) => {
    const label = c.nom || c.titre || c.objet || ''
    setObjet(label)
    setChantierId(c.id)
    setChantierSuggestions([])
    setChantierDropdownOpen(false)
  }

  // V3.1 — P2 : sélection explicite d'un chantier depuis le dropdown
  // dédié au mode 'situation'. On résout en async :
  //   - l'objet (titre/nom du chantier) si vide
  //   - le client (prénom/nom/adresse) si vide
  //   - le devis_ref via la dernière requête devis du chantier (numero)
  // Le useEffect debounced sur [factureType, devisRef] prendra ensuite le relais
  // pour calculer le cumul des situations précédentes.
  const handleChantierSelection = async (newChantierId: string | null) => {
    setChantierId(newChantierId)
    if (!newChantierId) {
      // L'artisan revient en saisie libre : on n'efface ni l'objet ni le devisRef
      // (il peut vouloir conserver les valeurs déjà saisies).
      return
    }
    const c = chantiers.find(ch => ch.id === newChantierId)
    if (!c) return

    // 1) Objet — on remplit toujours, même si l'artisan avait déjà tapé quelque chose
    //    (l'intention de "lier au chantier" implique de prendre son titre).
    const label = c.titre || c.nom || c.objet || ''
    if (label) setObjet(label)

    // 2) Client — on remplit uniquement si les champs sont vides (pas écraser
    //    une saisie manuelle).
    if (c.client_id && !clientNom.trim()) {
      const cli = clients.find(cl => cl.id === c.client_id)
      if (cli) {
        const rawCli = cli as unknown as Record<string, string>
        if (rawCli.type === 'professionnel') {
          setClientCivilite('Société')
          setClientSiret(rawCli.siret || '')
        } else {
          setClientCivilite(rawCli.civilite || '')
        }
        setClientNom(cli.nom)
        setClientPrenom(cli.prenom || '')
        setClientAdresse(cli.adresse || '')
        setClientCodePostal(cli.code_postal || '')
        setClientVille(cli.ville || '')
        setClientTelephone(cli.telephone || '')
        setClientEmail(cli.email || '')
      }
    }

    // 3) Devis_ref — on cherche le dernier devis lié à ce chantier
    //    (le useEffect calculera ensuite cumul + reste à facturer).
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: devisLies } = await supabase
        .from('devis')
        .select('numero, date_emission')
        .eq('user_id', user.id)
        .eq('chantier_id', newChantierId)
        .is('deleted_at', null)
        .order('date_emission', { ascending: false })
        .limit(1)
      if (devisLies && devisLies.length > 0) {
        const numero = devisLies[0].numero as string | null
        if (numero) setDevisRef(numero)
      }
    } catch (e) {
      console.warn('[factures/nouveau] résolution devis chantier:', e)
    }
  }

  // ── Client autocomplete ──
  const handleClientNomChange = (value: string) => {
    setClientNom(value)
    // V2 imputation : si l'artisan retape le nom (donc s'eloigne du client choisi),
    // on annule la detection d'avoir pour ne pas imputer le credit du mauvais client.
    if (selectedClientId) { setSelectedClientId(null); setAvoirsDispo([]); setAvoirChoisi(null) }
    if (value.length >= 1 && clients && clients.length > 0) {
      const q = value.toLowerCase().trim()
      const filtered = clients.filter(c => {
        const nom = String(c.nom || '').toLowerCase()
        const prenom = String(c.prenom || '').toLowerCase()
        return nom.includes(q) || prenom.includes(q) || (prenom + ' ' + nom).includes(q)
      })
      setClientSuggestions(filtered.slice(0, 8))
      setClientDropdownOpen(filtered.length > 0)
    } else {
      setClientSuggestions([])
      setClientDropdownOpen(false)
    }
  }

  const selectClient = (c: ClientRecord) => {
    const raw = c as unknown as Record<string, string>
    setClientSiretError(null)
    if (raw.type === 'professionnel') {
      setClientCivilite('Société')
      setClientSiret(raw.siret || '')
    } else {
      setClientCivilite(raw.civilite || '')
    }
    setClientNom(c.nom)
    setClientPrenom(c.prenom || '')
    setClientAdresse(c.adresse || '')
    setClientCodePostal(c.code_postal || '')
    setClientVille(c.ville || '')
    setClientTelephone(c.telephone || '')
    setClientEmail(c.email || '')
    setClientSuggestions([])
    setClientDropdownOpen(false)
    // V2 imputation : on memorise l'id du client choisi et on detecte ses avoirs
    // "a valoir" avec credit dispo (pour proposer une deduction).
    setSelectedClientId(c.id)
    detecterAvoirsAValoir(c.id)
  }

  // V2 imputation — detecte les avoirs "a valoir" du client avec credit restant.
  // Filtrage STRICT par client_id (jamais par nom -> pas d'homonyme). FIFO (le plus
  // ancien d'abord). Defensif : si la colonne n'existe pas, on n'affiche rien.
  async function detecterAvoirsAValoir(clientId: string) {
    setAvoirChoisi(null)
    setAvoirsDispo([])
    if (!clientId) return
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('factures')
        .select('id, numero, montant_ttc, avoir_montant_impute, date_emission')
        .eq('client_id', clientId)
        .eq('type', 'avoir')
        .eq('remboursement_statut', 'a_valoir')
        .is('deleted_at', null)
        .order('date_emission', { ascending: true })
      const dispo = ((data as Array<Record<string, unknown>>) ?? [])
        .map((a) => ({
          id: a.id as string,
          numero: (a.numero as string | null) ?? '',
          creditDispo: creditDisponibleAvoir(Number(a.montant_ttc ?? 0), Number(a.avoir_montant_impute ?? 0)),
        }))
        .filter((a) => a.creditDispo > 0.01)
      setAvoirsDispo(dispo)
    } catch {
      setAvoirsDispo([])
    }
  }

  // ── Line operations ──
  function updateLine(id: number, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }
  function removeLine(id: number) { setLines(prev => prev.filter(l => l.id !== id)) }
  function addLine(type: 'line' | 'section' | 'subsection' | 'text' = 'line') {
    // V2.5 : nouvelle ligne herite du taux global (raccourci) ou 10% par defaut.
    setLines(prev => [...prev, { id: nextId++, designation: '', qty: type === 'line' ? 1 : 0, unit: 'U', priceHT: 0, tva: globalTvaRate || 10, type }])
  }
  // Calcule le sous-total d'une section ou sous-section (somme des prestations enfants)
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

  // ── Computations ──
  // V2.5 — TVA par ligne (parite Obat) : agregation par taux saisi sur chaque ligne.
  let totalHT = 0
  const tvaGroups: Record<number, { ht: number; tva: number }> = {}
  if (useForfait) {
    totalHT = forfaitHT
    if (globalTvaRate > 0) {
      tvaGroups[globalTvaRate] = { ht: totalHT, tva: totalHT * (globalTvaRate / 100) }
    }
  } else {
    lines.forEach(l => {
      if (l.type !== 'line') return
      const lineTotal = l.qty * l.priceHT
      totalHT += lineTotal
      const taux = l.tva ?? 0
      if (taux > 0) {
        if (!tvaGroups[taux]) tvaGroups[taux] = { ht: 0, tva: 0 }
        tvaGroups[taux].ht += lineTotal
        tvaGroups[taux].tva += lineTotal * (taux / 100)
      }
    })
  }
  const totalTVA = Object.values(tvaGroups).reduce((s, g) => s + g.tva, 0)
  const totalTTC = totalHT + totalTVA
  const acompteTTCcalc = acompteActive
    ? (acompteMontantTTC > 0 ? acompteMontantTTC : totalTTC * (acomptePourcent / 100))
    : 0
  const acompteHTcalc = acompteActive && totalTTC > 0 ? totalHT * (acompteTTCcalc / totalTTC) : 0
  // V2 imputation : montant reellement deductible = min(credit dispo de l'avoir,
  // ce qui reste a payer apres acompte). On ne deduit jamais plus que le net.
  const avoirImputeEffectif = avoirChoisi
    ? Math.max(0, Math.min(avoirChoisi.creditDispo, Math.max(0, totalTTC - acompteTTCcalc)))
    : 0
  const netAPayer = Math.max(totalTTC - acompteTTCcalc - avoirImputeEffectif, 0)

  // ── Save ──
  const handleSave = useCallback(async (statut: 'brouillon' | 'envoyee') => {
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
    setSaving(true)
    setError(null)
    try {
      const yearFromDate = (() => {
        const y = Number((dateFacture || '').slice(0, 4))
        return Number.isFinite(y) && y > 2000 ? y : new Date().getFullYear()
      })()
      const numero = `F-${yearFromDate}-${String(Date.now()).slice(-5)}`
      const clientDisplay = `${clientCivilite ? clientCivilite + ' ' : ''}${clientPrenom ? clientPrenom + ' ' : ''}${clientNom}`.trim()

      // V3.0c.18 — Pré-remplissage intelligent (situation) :
      // cumul HT/TTC déjà facturé + reste à facturer (uniquement si devis lié trouvé).
      const isSit = factureType === 'situation'
      const resteHT = (isSit && devisTotalHT !== null && cumulPrecedentHT !== null)
        ? Math.max(devisTotalHT - cumulPrecedentHT - totalHT, 0)
        : null
      const resteTTC = (isSit && devisTotalTTC !== null && cumulPrecedentTTC !== null)
        ? Math.max(devisTotalTTC - cumulPrecedentTTC - totalTTC, 0)
        : null

      // V2 imputation — REVALIDATION au moment d'enregistrer (anti double-usage) :
      // on relit le credit REELLEMENT dispo de l'avoir et on plafonne au net a payer.
      // Si l'avoir a ete consomme/rembourse entre-temps, on n'impute rien (pas d'erreur).
      let imputeId: string | null = null
      let imputeNumero: string | null = null
      let imputeMontant = 0
      if (avoirChoisi && factureType !== 'avoir') {
        try {
          const sb = createClient()
          // Plafond = ce qui reste a payer apres acompte. On ne debite jamais plus.
          const cap = Math.max(0, totalTTC - acompteTTCcalc)
          const demande = Math.round((Math.min(avoirChoisi.creditDispo, cap) + Number.EPSILON) * 100) / 100
          if (demande > 0.01) {
            // Debit ATOMIQUE cote base (garde anti double-usage + plafond dans le
            // WHERE). Retourne le montant reellement debite (0 si avoir indisponible).
            const { data: debite } = await sb.rpc('debiter_avoir_impute', { p_avoir_id: avoirChoisi.id, p_montant: demande })
            const m = Number(debite ?? 0)
            if (m > 0.01) {
              imputeMontant = m
              imputeId = avoirChoisi.id
              imputeNumero = avoirChoisi.numero || null
            }
          }
        } catch { imputeMontant = 0 }
      }

      // V2 imputation : si l'avoir couvre TOUT le net (et pas d'acompte), la facture
      // est soldee sans cash -> on l'emet directement "payee" (sinon elle resterait
      // "envoyee" non soldee a vie). montant_paye reste 0 (aucun cash encaisse).
      const netApresImpute = Math.max(0, totalTTC - acompteTTCcalc - imputeMontant)
      const statutFinal = (statut === 'envoyee' && !acompteActive && imputeMontant > 0.01 && netApresImpute <= 0.01)
        ? 'payee'
        : statut

      // Push 7B — détail par ligne recalculé depuis les lignes RÉELLES au moment du
      // save (jamais un snapshot figé) : toute édition manuelle post-Apply est reflétée,
      // donc le cumul « déjà facturé » des situations suivantes reste exact.
      const situationLignesCalc = isSit
        ? lines
            .filter((l) => l.type === 'line' && l.devisLigneId)
            .map((l) => ({ devis_ligne_id: l.devisLigneId as string, montant_ht: Math.round(l.priceHT * l.qty * 100) / 100 }))
        : []

      // Push 7C — snapshot du plan COLORIÉ (avancement) figé sur la facture de
      // situation. Best-effort et JAMAIS bloquant (try/catch, image client via
      // canvas) : une image par niveau qui porte au moins une pièce avancée, capé à 4.
      let planImagesSnap: Array<{ titre: string; dataUrl: string }> | null = null
      if (isSit && modeParLigneActif && situationPlan && situationPlan.plans.length > 0) {
        try {
          const cibles: Array<{ titre: string; data: PlanData; niveauId: string }> = []
          for (const pl of situationPlan.plans) {
            for (const niv of pl.data.levels ?? []) {
              if (cibles.length >= 4) break
              const aAvancement = (niv.rooms ?? []).some((r) => r.avancement && r.avancement !== 'a_faire')
              if (aAvancement) cibles.push({ titre: `${pl.name} — ${niv.name}`, data: pl.data, niveauId: niv.id })
            }
          }
          // Génération EN PARALLÈLE (Promise.all) pour ne pas allonger la sauvegarde.
          const res = await Promise.all(
            cibles.map((c) =>
              genererImagePlanNiveau(c.data, c.niveauId, { avancementVisible: true }).then((u) =>
                u ? { titre: c.titre, dataUrl: u } : null
              )
            )
          )
          const imgs = res.filter((x): x is { titre: string; dataUrl: string } => x !== null)
          planImagesSnap = imgs.length > 0 ? imgs : null
        } catch {
          planImagesSnap = null
        }
      }

      const factureData: Record<string, unknown> = {
        numero,
        statut: statutFinal,
        // V3.0c.17 — Type de facture + champs specifiques situation
        type: factureType,
        // 2026-06-10 — Autoliquidation BTP (boolean, default false en DB).
        // Si la colonne n'existe pas en DB (migration non executee), on retombe
        // sur le catch 42703 plus bas pour ne pas planter l'insertion.
        autoliquidation_btp: autoliquidationBtp,
        devis_ref: isSit ? (devisRef.trim() || null) : null,
        devis_date: isSit ? (devisDateLiee || null) : null,
        numero_situation: isSit ? numeroSituation : null,
        // Push 7B — en mode par ligne, on RECALCULE le % d'avancement au save depuis
        // les vrais montants (cumul précédent + cette situation) / total du devis, pour
        // qu'il ne mente jamais sur le PDF même après une édition manuelle des lignes.
        pourcentage_situation: isSit
          ? (situationLignesCalc.length > 0 && devisTotalHT && devisTotalHT > 0
              ? Math.min(100, Math.round((((cumulPrecedentHT ?? 0) + totalHT) / devisTotalHT) * 100))
              : pourcentageSituation)
          : null,
        // Push 7B — détail par ligne (null si saisie manuelle sans lignes de devis).
        situation_lignes: situationLignesCalc.length > 0 ? situationLignesCalc : null,
        // Push 7C — snapshot du plan colorié figé (best-effort, peut être null).
        plan_images: planImagesSnap,
        // V3.0c.18 — Cumul des situations précédentes + reste à facturer (snapshot
        // figé à la création). null si impossible à calculer (pas de devis lié en BDD).
        montant_situation_precedent_ht: isSit ? cumulPrecedentHT : null,
        montant_situation_precedent_ttc: isSit ? cumulPrecedentTTC : null,
        reste_a_facturer_ht: resteHT,
        reste_a_facturer_ttc: resteTTC,
        date_emission: dateFacture,
        date_echeance: dateEcheance,
        objet: objet || null,
        chantier_id: chantierId,
        conditions_paiement: (conditions && conditions.trim()) || DEFAULT_CONDITIONS_PAIEMENT,
        notes_personnalisees: notesPerso || null,
        // Legacy : on garde `notes` synchronisé avec les conditions pour la rétrocompat
        notes: (conditions && conditions.trim()) || null,
        acompte_pourcent: acompteActive ? acomptePourcent || null : null,
        acompte_montant_ht: acompteActive ? acompteHTcalc || null : null,
        acompte_montant_ttc: acompteActive ? acompteTTCcalc || null : null,
        acompte_label: acompteActive ? (acompteLabel || null) : null,
        // V2 imputation : avoir d'un autre dossier impute EN reglement (TTC reste plein).
        avoir_impute_id: imputeId,
        avoir_impute_numero: imputeNumero,
        avoir_impute_montant: imputeMontant > 0.01 ? imputeMontant : null,
        notes_client: clientDisplay
          ? `${clientDisplay}${clientAdresse ? ` | ${clientAdresse}` : ''}${clientCodePostal || clientVille ? ` | ${clientCodePostal} ${clientVille}`.trim() : ''}${clientTelephone ? ` | ${clientTelephone}` : ''}${clientEmail ? ` | ${clientEmail}` : ''}`
          : null,
        client_nom: clientNom || null,
        // V2 imputation : on prefere l'id du client REELLEMENT choisi (anti-homonyme),
        // sinon il sera resolu par nom plus bas.
        client_id: selectedClientId ?? null,
        client_adresse: clientAdresse || null,
        montant_ht: totalHT,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
      }

      // Sauvegarder/mettre à jour le client dans la base de données
      if (clientNom.trim()) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .eq('user_id', user.id)
              .ilike('nom', clientNom.trim())
              .maybeSingle()

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
              // On garde l'id deja choisi (selectedClientId) s'il existe (anti-homonyme),
              // sinon on prend celui resolu par nom. Dans les deux cas on met a jour la fiche.
              if (!selectedClientId) factureData.client_id = existingClient.id
              await supabase.from('clients').update(clientData).eq('id', (selectedClientId ?? existingClient.id) as string)
            } else {
              const { data: newClient } = await supabase
                .from('clients')
                .insert({ ...clientData, actif: true })
                .select('id')
                .single()
              if (newClient && !selectedClientId) factureData.client_id = newClient.id
            }
          }
        } catch (err) { console.error('Erreur sauvegarde client:', err) }
      }

      // 2026-06-10 — Code defensif : la colonne autoliquidation_btp peut etre
      // absente de la DB si la migration SQL n'a pas tourne (erreur Postgres 42703).
      // Dans ce cas on retire le champ et on retente, pour ne pas bloquer la creation.
      // V2 imputation : le credit de l'avoir a deja ete DEBITE (atomiquement) plus
      // haut. Si la creation de la facture echoue, on RE-CREDITE l'avoir pour ne
      // jamais perdre le credit du client.
      const rollbackImpute = async () => {
        if (imputeId && imputeMontant > 0.01) {
          try {
            const sb = createClient()
            await sb.rpc('recrediter_avoir_impute', { p_avoir_id: imputeId, p_montant: imputeMontant })
          } catch (e) { console.error('Imputation avoir: rollback echoue', e) }
        }
      }

      let facture: unknown
      try {
        facture = await insertRow('factures', factureData)
      } catch (e) {
        const msg = (e as { message?: string; code?: string })?.message || ''
        const code = (e as { code?: string })?.code || ''
        if (msg.includes('autoliquidation_btp') || code === '42703' || msg.includes('42703')) {
          const fallback = { ...factureData }
          delete fallback.autoliquidation_btp
          try {
            facture = await insertRow('factures', fallback)
          } catch (e2) {
            await rollbackImpute()
            throw e2
          }
        } else {
          await rollbackImpute()
          throw e
        }
      }
      const factureId = (facture as Record<string, unknown>).id as string

      // V4 : on persiste type/niveau pour sections + sous-sections + lignes
      const lignesPourNumero = lines
        .filter(l => l.designation || (l.type === 'line' && l.priceHT !== 0))
        .map(l => ({
          type: (l.type === 'section' ? 'section' : l.type === 'subsection' ? 'sous_section' : l.type === 'text' ? 'commentaire' : 'prestation') as 'section' | 'sous_section' | 'prestation' | 'commentaire',
          _orig: l,
        }))
      const lignesAvecNumero = computeHierarchicalNumbers(lignesPourNumero)
      for (let i = 0; i < lignesAvecNumero.length; i++) {
        const item = lignesAvecNumero[i]
        const l = item._orig as typeof lines[0]
        const dbType = l.type === 'section' ? 'section' : l.type === 'subsection' ? 'sous_section' : l.type === 'text' ? 'commentaire' : 'prestation'
        const niveau = dbType === 'section' ? 1 : dbType === 'sous_section' ? 2 : 3
        await insertRow('facture_lignes', {
          facture_id: factureId,
          designation: l.designation,
          quantite: l.type === 'line' ? l.qty : 0,
          unite: l.type === 'line' ? l.unit : '',
          prix_unitaire_ht: l.type === 'line' ? l.priceHT : 0,
          // V2.5 — TVA par ligne : on persiste le taux saisi sur chaque ligne.
          // En mode forfait, on retombe sur globalTvaRate (1 seule ligne).
          taux_tva: useForfait ? globalTvaRate : (l.tva ?? globalTvaRate),
          ordre: i + 1,
          type: dbType,
          niveau,
          numero: item.numero || null,
        })
      }

      // Mémorisation auto des prestations (best-effort, ne bloque jamais le succès)
      await memorizePrestations(lines.map(l => ({ designation: l.designation, unit: l.unit, priceHT: l.priceHT, tva: (l as { tva?: number }).tva, type: l.type })))

      router.push(`/dashboard/factures/${factureId}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }, [clientCivilite, clientSiret, clientNom, clientPrenom, clientAdresse, clientCodePostal, clientVille, clientTelephone, clientEmail, dateFacture, dateEcheance, objet, chantierId, conditions, notesPerso, acompteActive, acomptePourcent, acompteHTcalc, acompteTTCcalc, acompteLabel, totalHT, totalTVA, totalTTC, globalTvaRate, lines, router, factureType, devisRef, numeroSituation, pourcentageSituation, cumulPrecedentHT, cumulPrecedentTTC, devisTotalHT, devisTotalTTC, devisDateLiee, autoliquidationBtp, avoirChoisi, selectedClientId])

  return (
    <div className="min-h-screen">
      {/* Top bar V4 light : sticky en haut, fond blanc, CTA orange à droite. */}
      <div className="sticky top-0 bg-white border-b border-[#0f1a3a]/[0.06] z-10 py-3 px-6 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/factures" className="p-2 rounded-xl hover:bg-[#fafbfc] transition-colors" aria-label="Retour">
            <ArrowLeft size={18} className="text-gray-600" />
          </Link>
          <h2 className="hidden sm:block font-hanken font-extrabold text-lg text-[#0f1a3a] tracking-[-0.025em]">Nouvelle facture</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave('brouillon')}
            disabled={saving}
            className="h-9 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white font-hanken text-[13px] font-semibold text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all disabled:opacity-50"
          >
            Brouillon
          </button>
          {!fromVoice && (
            <button
              onClick={() => handleSave('envoyee')}
              disabled={saving}
              className="h-9 px-5 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50/80 border border-red-200/70 rounded-xl px-4 py-3">
            <p className="font-hanken text-sm text-red-700">{error}</p>
          </div>
        )}
        {fromVoice && (
          <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl px-4 py-3.5 flex items-start gap-3">
            <span className="text-xl" aria-hidden>🎤</span>
            <div>
              <p className="font-hanken font-bold text-sm text-blue-800 mb-1">Facture générée par la voix</p>
              <p className="font-hanken text-xs text-blue-800/90 leading-relaxed">
                Cette facture sera enregistrée <strong>modifiable</strong> pour que tu puisses corriger les erreurs vocales et compléter les infos manquantes.
                Tu pourras l&apos;émettre définitivement depuis la page détail après vérification (l&apos;émission verrouille la facture, obligation légale art. L441-9 C. comm.).
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Carte Dates + Objet — V4 light */}
          <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 space-y-4 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
            <div>
              <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">Date de facture</label>
              <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)} className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'} />
            </div>
            <div>
              <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">Date d&apos;échéance</label>
              <input type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'} />
            </div>
            <div className="relative">
              <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
                Objet / Chantier
                {chantierId && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-br from-emerald-100/80 to-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-hanken font-bold tracking-wider uppercase">
                    Lié au chantier
                  </span>
                )}
              </label>
              <input
                type="text"
                value={objet}
                onChange={e => handleObjetChange(e.target.value)}
                onBlur={() => setTimeout(() => { setChantierDropdownOpen(false); setChantierSuggestions([]) }, 200)}
                placeholder="Ex. : Salle de bain, Installation électrique..."
                className={inputCls}
                autoComplete="off"
              />
              {chantierDropdownOpen && chantierSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border border-[#0f1a3a]/[0.08] shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 font-hanken text-[10px] font-bold text-[#ff7a1a] uppercase tracking-wider border-b border-gray-100 bg-[#fff5ec]">
                    Chantiers existants
                  </div>
                  {chantierSuggestions.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); selectChantier(c) }}
                      className="w-full text-left px-4 py-2.5 font-hanken hover:bg-[#fafbfc] border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <span className="font-semibold text-[#0f1a3a] text-sm">{c.nom || c.titre || c.objet || 'Chantier'}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1.5 font-hanken text-xs text-gray-500">Tapez pour rechercher un chantier existant, ou saisissez librement.</p>
            </div>

            {/* Type de facture (standard / acompte / situation / avoir) */}
            <div>
              <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">Type de facture</label>
              <select
                value={factureType}
                onChange={e => {
                  const v = e.target.value as 'standard' | 'acompte' | 'situation' | 'avoir'
                  if (v === 'situation' && !canSituation) return
                  setFactureType(v)
                }}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="standard">Facture standard</option>
                <option value="acompte">Facture d&apos;acompte</option>
                <option value="situation" disabled={!canSituation}>
                  {canSituation ? 'Facture de situation' : 'Facture de situation — offre Complet'}
                </option>
                <option value="avoir">Avoir (facture negative)</option>
              </select>
              <p className="mt-1.5 font-hanken text-xs text-gray-500">
                Une <strong>facture de situation</strong> facture une tranche d&apos;un chantier en cours (#1, #2, #3...).
                {!canSituation && (
                  <>
                    {' '}
                    <Link href="/dashboard/abonnement?upgrade=factures_situation" className="font-semibold text-[#ff7a1a] underline">
                      Réservée à l&apos;offre Complet.
                    </Link>
                  </>
                )}
              </p>
            </div>

            {/* 2026-06-10 — Autoliquidation TVA BTP (sous-traitance, art. 283-2 nonies CGI).
                 Quand cochee : TVA forcee a 0 sur toutes les lignes + mention auto en pied. */}
            <div className="rounded-2xl border border-[#0f1a3a]/[0.06] bg-[#fafbfc] p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoliquidationBtp}
                  onChange={e => {
                    const v = e.target.checked
                    setAutoliquidationBtp(v)
                    if (v) {
                      setTvaUserOverride(true)
                      setGlobalTvaRate(0)
                      setLines(prev => prev.map(l => l.type === 'line' ? { ...l, tva: 0 } : l))
                    }
                  }}
                  className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/30 cursor-pointer accent-[#ff7a1a]"
                />
                <div>
                  <span className="block font-hanken text-[15px] font-semibold text-[#0f1a3a]">
                    🏗️ Autoliquidation TVA (sous-traitance BTP)
                  </span>
                  <span className="block font-hanken text-xs text-gray-500 mt-1">
                    Art. 283-2 nonies CGI — la TVA est due par le preneur (donneur d&apos;ordre). Tous les taux sont forces a 0 % et la mention legale est ajoutee automatiquement en pied de document.
                  </span>
                </div>
              </label>
            </div>

            {factureType === 'situation' && (
              <div className="rounded-2xl border border-[#0f1a3a]/[0.06] bg-[#fafbfc] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-hanken text-[10px] font-bold text-[#ff7a1a] bg-[#fff5ec] px-2 py-0.5 rounded uppercase tracking-wider">
                    Facture de situation
                  </span>
                </div>

                {/* V3.1 — P2 : sélecteur Chantier fiable (vs saisie libre devis_ref).
                    Le choix d'un chantier auto-remplit le devis_ref, le chantier_id,
                    l'objet et le client si vides. La saisie libre reste possible en
                    fallback (anciens devis sans chantier en DB). */}
                <div>
                  <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">Chantier lié</label>
                  <select
                    value={chantierId ?? ''}
                    onChange={e => handleChantierSelection(e.target.value || null)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    <option value="">— Aucun (saisir le devis ci-dessous) —</option>
                    {chantiers.map(c => {
                      const label = c.titre || c.nom || c.objet || 'Chantier sans titre'
                      const clientLabel = (() => {
                        if (c.client_id) {
                          const cli = clients.find(cl => cl.id === c.client_id)
                          if (cli) return `${cli.prenom ? cli.prenom + ' ' : ''}${cli.nom}`.trim()
                        }
                        return c.client_nom || '—'
                      })()
                      return (
                        <option key={c.id} value={c.id}>
                          {label} — {clientLabel}
                        </option>
                      )
                    })}
                  </select>
                  <p className="mt-1.5 font-hanken text-[11px] text-gray-500">
                    Le chantier sélectionné renseigne automatiquement le devis lié, le client et l&apos;objet. Choisissez « Aucun » pour saisir un devis non rattaché à un chantier.
                  </p>
                </div>

                <div>
                  <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">
                    Référence du devis
                    {chantierId && devisRef && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 text-[9.5px] font-bold tracking-wider uppercase">
                        Auto-remplie
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={devisRef}
                    onChange={e => setDevisRef(e.target.value)}
                    placeholder="Ex. : D-2026-12345"
                    className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'}
                  />
                  {situationLookupMsg && (
                    <p className="mt-1.5 font-hanken text-[11px] text-[#0f1a3a]/70">{situationLookupMsg}</p>
                  )}
                </div>
                {situationPlan && situationPlan.lignes.length > 0 && (
                  <div className="rounded-2xl border border-[#0f1a3a]/[0.06] bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="font-hanken text-[10px] font-bold text-[#ff7a1a] bg-[#fff5ec] px-2 py-0.5 rounded uppercase tracking-wider">
                        Depuis le plan
                      </span>
                      <span className="font-hanken text-[12px] text-gray-500">Facturer par ligne selon l&apos;avancement</span>
                    </div>
                    <SituationParLigne
                      lignes={situationPlan.lignes}
                      dejaFactureParLigne={situationPlan.dejaFacture}
                      etatsPieces={situationPlan.etats}
                      nomsPieces={situationPlan.noms}
                      onAppliquer={appliquerSituation}
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">N° de situation</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={numeroSituation}
                      onChange={e => setNumeroSituation(Math.max(1, Number(e.target.value) || 1))}
                      className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'}
                    />
                  </div>
                  <div>
                    <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">% d&apos;avancement</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={pourcentageSituation}
                      onChange={e => setPourcentageSituation(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      readOnly={modeParLigneActif}
                      className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]' + (modeParLigneActif ? ' opacity-60' : '')}
                    />
                    {modeParLigneActif && (
                      <p className="mt-1 font-hanken text-[10.5px] text-gray-400">Calculé depuis le tableau par ligne ci-dessus.</p>
                    )}
                  </div>
                </div>
                {/* V2.3 10/06/2026 — Recap visuel progression chantier.
                    Affiche : montant deja facture (situations precedentes) +
                    montant de cette situation + reste a facturer + barre de
                    progression. S'appuie sur devisTotalTTC + cumulPrecedentTTC
                    deja charges. Si les donnees du devis manquent, fallback
                    sur un message d'aide pour saisir un n° de devis. */}
                {!modeParLigneActif && (() => {
                  const devisTotal = devisTotalTTC ?? 0
                  const cumulPrec = cumulPrecedentTTC ?? 0
                  if (devisTotal <= 0) {
                    return (
                      <p className="font-hanken text-xs text-gray-500 leading-relaxed">
                        Saisissez un numéro de devis valide pour activer le calcul automatique du reste à facturer.
                      </p>
                    )
                  }
                  const pct = Math.min(100, Math.max(0, pourcentageSituation || 0))
                  const totalApresCetteSit = devisTotal * (pct / 100)
                  const cetteSituation = Math.max(0, totalApresCetteSit - cumulPrec)
                  const resteApres = Math.max(0, devisTotal - totalApresCetteSit)
                  const pctPrec = devisTotal > 0 ? Math.min(100, (cumulPrec / devisTotal) * 100) : 0
                  const pctCetteSit = Math.max(0, pct - pctPrec)
                  const pctReste = Math.max(0, 100 - pct)
                  const fmt = (n: number) =>
                    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                  const isWarning = totalApresCetteSit > devisTotal + 0.5
                  return (
                    <div className="rounded-xl border-[1.5px] border-gray-200 bg-gradient-to-br from-[#fafbfc] to-white p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-hanken font-bold text-[13px] text-[#0f1a3a]">
                          Progression du chantier
                        </p>
                        <span className="font-spline-mono font-semibold text-[12.5px] text-[#0f1a3a]/70">
                          {fmt(devisTotal)} TTC au total
                        </span>
                      </div>

                      {/* Barre de progression segmentee (deja facture / cette sit / reste) */}
                      <div
                        className="relative h-3 rounded-full overflow-hidden bg-gray-100"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                        aria-label={`Progression du chantier : ${Math.round(pct)}%`}
                      >
                        {pctPrec > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 bg-[#0f1a3a]/70 transition-all"
                            style={{ width: `${pctPrec}%` }}
                            aria-hidden="true"
                          />
                        )}
                        {pctCetteSit > 0 && (
                          <div
                            className="absolute inset-y-0 bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d] transition-all"
                            style={{
                              left: `${pctPrec}%`,
                              width: `${pctCetteSit}%`,
                            }}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-[#0f1a3a]/[0.04] px-2 py-2">
                          <p className="font-hanken text-[10.5px] uppercase tracking-wider text-gray-500 mb-0.5">
                            Déjà facturé
                          </p>
                          <p className="font-spline-mono font-bold text-[13px] text-[#0f1a3a]">
                            {fmt(cumulPrec)}
                          </p>
                          <p className="font-hanken text-[10.5px] text-gray-500 mt-0.5">
                            {Math.round(pctPrec)}%
                          </p>
                        </div>
                        <div className="rounded-lg bg-[#ff7a1a]/[0.08] border border-[#ff7a1a]/30 px-2 py-2">
                          <p className="font-hanken text-[10.5px] uppercase tracking-wider text-[#c2410c] mb-0.5">
                            Cette situation
                          </p>
                          <p className="font-spline-mono font-bold text-[13px] text-[#c2410c]">
                            {fmt(cetteSituation)}
                          </p>
                          <p className="font-hanken text-[10.5px] text-[#c2410c]/80 mt-0.5">
                            +{Math.round(pctCetteSit)}%
                          </p>
                        </div>
                        <div className="rounded-lg bg-[#0f1a3a]/[0.04] px-2 py-2">
                          <p className="font-hanken text-[10.5px] uppercase tracking-wider text-gray-500 mb-0.5">
                            Reste après
                          </p>
                          <p className="font-spline-mono font-bold text-[13px] text-[#0f1a3a]">
                            {fmt(resteApres)}
                          </p>
                          <p className="font-hanken text-[10.5px] text-gray-500 mt-0.5">
                            {Math.round(pctReste)}%
                          </p>
                        </div>
                      </div>

                      {isWarning && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                          <p className="font-hanken font-semibold text-[12px] text-red-800">
                            ⚠ Ce % dépasse 100 % du devis. Vérifiez le montant ou un avenant signé.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Carte Client — V4 light */}
          <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
            <h3 className="font-hanken font-extrabold text-base text-[#0f1a3a] tracking-[-0.025em] mb-4">Client</h3>
            <div className="space-y-3">
              <div className="relative">
                <div className="flex gap-2">
                  <select
                    value={clientCivilite}
                    onChange={e => { setClientCivilite(e.target.value); if (e.target.value !== 'Société') setClientSiretError(null) }}
                    className="w-28 shrink-0 py-2.5 px-3 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] cursor-pointer focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all"
                  >
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Société">Société</option>
                  </select>
                  <input
                    type="text"
                    value={clientNom}
                    onChange={e => handleClientNomChange(e.target.value)}
                    onBlur={() => setTimeout(() => { setClientDropdownOpen(false); setClientSuggestions([]) }, 200)}
                    placeholder="Nom (tapez pour rechercher)"
                    className={inputCls}
                    autoComplete="off"
                  />
                </div>
                {clientDropdownOpen && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border border-[#0f1a3a]/[0.08] shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                    {clientSuggestions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); selectClient(c) }}
                        className="w-full text-left px-4 py-3 font-hanken hover:bg-[#fafbfc] border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <span className="font-semibold text-[#0f1a3a] text-sm">{c.prenom ? `${c.prenom} ${c.nom}` : c.nom}</span>
                        {c.adresse && <span className="text-gray-500 text-xs block mt-0.5">{c.adresse}</span>}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={clientCodePostal}
                  onChange={e => setClientCodePostal(e.target.value)}
                  placeholder="Code postal"
                  className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'}
                />
                <input type="text" value={clientVille} onChange={e => setClientVille(e.target.value)} placeholder="Ville" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="tel"
                  value={clientTelephone}
                  onChange={e => setClientTelephone(e.target.value)}
                  placeholder="Téléphone"
                  className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'}
                />
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email" className={inputCls} />
              </div>
              {/* V2 imputation — bandeau : ce client a un avoir "a valoir" a deduire. */}
              {avoirsDispo.length > 0 && (
                <div className="mt-1 rounded-2xl border-[1.5px] border-[#bfe3f4] bg-[#eef8fd] p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#d7eefa] text-[#1a6fb5] flex items-center justify-center font-extrabold flex-shrink-0">€</div>
                    <div className="flex-1 min-w-0">
                      {avoirChoisi ? (
                        <>
                          <p className="font-hanken text-sm font-bold text-[#0f1a3a]">Avoir {avoirChoisi.numero} déduit — {formatCurrency(avoirImputeEffectif)}</p>
                          <p className="font-hanken text-[12.5px] text-gray-500 mt-0.5">La facture reste émise à son montant complet ; l&apos;avoir vient en déduction du montant à régler.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-hanken text-sm font-bold text-[#0f1a3a]">{clientPrenom ? `${clientPrenom} ` : ''}{clientNom} dispose d&apos;un avoir de {formatCurrency(avoirsDispo[0].creditDispo)} à valoir</p>
                          <p className="font-hanken text-[12.5px] text-gray-500 mt-0.5">Le déduire de cette facture ? La facture reste à son montant complet, l&apos;avoir réduit le net à payer.{avoirsDispo.length > 1 ? ` (+${avoirsDispo.length - 1} autre${avoirsDispo.length - 1 > 1 ? 's' : ''})` : ''}</p>
                        </>
                      )}
                    </div>
                    {avoirChoisi ? (
                      <button type="button" onClick={() => setAvoirChoisi(null)} className="text-[12.5px] text-gray-500 underline flex-shrink-0 mt-1">Annuler</button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAvoirChoisi(avoirsDispo[0])}
                        disabled={(totalTTC - acompteTTCcalc) <= 0.01}
                        title={(totalTTC - acompteTTCcalc) <= 0.01 ? 'Ajoutez d’abord des lignes a la facture' : undefined}
                        className="inline-flex items-center h-9 px-4 rounded-xl bg-gradient-to-br from-[#5ab4e0] to-[#7cc6e8] text-white font-hanken text-[13px] font-bold flex-shrink-0 shadow-[0_5px_14px_rgba(90,180,224,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >Déduire</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tableau des lignes — V4 light. Mobile = cards + bottom sheet, desktop = grille. */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
          {/* Mobile : cards + bottom sheet (composant LineCard non modifié) */}
          <div className="sm:hidden p-3 space-y-2">
            {lines.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-[#fafbfc] px-4 py-6 text-center">
                <p className="font-hanken text-sm text-gray-600">Aucune ligne pour l&apos;instant.</p>
                <p className="font-hanken text-[12px] text-gray-400 mt-1">Touchez <strong>+ Ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
              </div>
            )}
            {lines.map((line, idx) => (
              <LineCard
                key={line.id}
                line={line}
                subtotal={subtotalAt(idx)}
                onTap={() => openEditSheet(line)}
                onDelete={() => removeLine(line.id)}
                formatCurrency={formatCurrency}
              />
            ))}
            {/* Barre d'ajout mobile : 3 boutons sous la liste — CTA orange + outline secondaires */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => openCreateSheet('line')}
                className="flex-1 min-w-[44%] inline-flex items-center justify-center gap-1.5 bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-sm font-bold rounded-full px-4 py-2.5 shadow-[0_4px_12px_rgba(255,122,26,0.25)] active:scale-95 transition-all"
              >
                <Plus size={16} /> Ligne
              </button>
              <button
                type="button"
                onClick={() => openCreateSheet('section')}
                className="flex-1 min-w-[44%] inline-flex items-center justify-center gap-1.5 bg-white border-[1.5px] border-gray-200 rounded-full px-4 py-2.5 font-hanken text-sm font-semibold text-[#0f1a3a] hover:border-[#ff7a1a] active:scale-95 transition-all"
              >
                <Plus size={16} /> Section
              </button>
              <button
                type="button"
                onClick={() => openCreateSheet('subsection')}
                className="flex-1 min-w-[44%] inline-flex items-center justify-center gap-1.5 bg-white border-[1.5px] border-gray-200 rounded-full px-4 py-2.5 font-hanken text-sm font-semibold text-[#0f1a3a] hover:border-[#ff7a1a] active:scale-95 transition-all"
              >
                <Plus size={16} /> Sous-section
              </button>
            </div>
          </div>

          {/* Desktop : table grille 7 colonnes (designation, qté, unité, prix HT, TVA, total, supprimer). */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="bg-[#0f1a3a] text-white grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-3 font-hanken text-[11px] font-semibold uppercase tracking-wider">
              <span>Désignation</span><span className="text-center">Qté</span><span className="text-center">Unité</span><span className="text-right">Prix U. HT</span><span className="text-center">TVA</span><span className="text-right">Total HT</span><span />
            </div>
            {lines.length === 0 && (
              <div className="px-4 py-8 text-center border-b border-gray-100">
                <p className="font-hanken text-sm text-gray-600">Aucune ligne pour l&apos;instant.</p>
                <p className="font-hanken text-[12px] text-gray-400 mt-1">Cliquez sur <strong>+ Ajouter une ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
              </div>
            )}
            {lines.map((line, idx) => {
              // Section : bandeau orange clair, designation gras uppercase
              if (line.type === 'section') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_36px] min-w-[500px] items-center px-4 py-2 bg-[#fff5ec] border-l-4 border-[#ff7a1a] border-b border-gray-100">
                    <input
                      type="text"
                      value={line.designation}
                      onChange={e => updateLine(line.id, 'designation', e.target.value)}
                      className="font-hanken text-sm font-bold text-[#0f1a3a] uppercase border-[1.5px] border-transparent hover:border-[#ff7a1a]/30 rounded-lg outline-none bg-white/70 focus:border-[#ff7a1a] focus:bg-white px-2 h-9 placeholder-[#ff7a1a]/50 transition-all"
                      placeholder="Nom de la section (ex : Démolition, Maçonnerie...)"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-spline-mono font-medium text-sm text-[#ff7a1a]">{formatCurrency(subtotalAt(idx))}</span>
                      <button onClick={() => removeLine(line.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              }
              // Sous-section : bandeau orange pâle
              if (line.type === 'subsection') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_36px] min-w-[500px] items-center px-4 py-2 bg-[#fff9f2] border-l-4 border-[#ff9d4d] border-b border-gray-100">
                    <input
                      type="text"
                      value={line.designation}
                      onChange={e => updateLine(line.id, 'designation', e.target.value)}
                      className="font-hanken text-sm font-semibold text-[#0f1a3a] border-[1.5px] border-transparent hover:border-[#ff9d4d]/30 rounded-lg outline-none bg-white/70 focus:border-[#ff9d4d] focus:bg-white px-2 h-9 placeholder-[#ff9d4d]/60 transition-all"
                      placeholder="Nom de la sous-section (ex : Cuisine, Plomberie...)"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-spline-mono font-medium text-sm text-[#ff7a1a]">{formatCurrency(subtotalAt(idx))}</span>
                      <button onClick={() => removeLine(line.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              }
              // Ligne de prestation classique
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
                      className="w-full font-hanken text-sm text-[#0f1a3a] border-[1.5px] border-gray-100 hover:border-gray-200 rounded-lg outline-none bg-white focus:border-[#ff7a1a] focus:shadow-[0_0_0_3px_rgba(255,122,26,0.10)] px-2 py-1.5 resize-none overflow-hidden min-h-[36px] transition-all"
                    />
                  </div>
                  <input
                    type="number"
                    value={line.qty}
                    onChange={e => updateLine(line.id, 'qty', Number(e.target.value))}
                    className="font-spline-mono font-medium text-sm text-center border-[1.5px] border-gray-100 hover:border-gray-200 rounded-lg outline-none bg-white focus:border-[#ff7a1a] focus:shadow-[0_0_0_3px_rgba(255,122,26,0.10)] h-9 mx-1 transition-all"
                    min={0}
                  />
                  <select
                    value={line.unit}
                    onChange={e => updateLine(line.id, 'unit', e.target.value)}
                    className="font-hanken text-sm text-center border-[1.5px] border-gray-100 hover:border-gray-200 rounded-lg outline-none bg-white focus:border-[#ff7a1a] focus:shadow-[0_0_0_3px_rgba(255,122,26,0.10)] h-9 mx-1 w-full cursor-pointer transition-all"
                  >
                    {UNIT_SUGGESTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    type="number"
                    value={line.priceHT}
                    onChange={e => updateLine(line.id, 'priceHT', Number(e.target.value))}
                    className="font-spline-mono font-medium text-sm text-right border-[1.5px] border-gray-100 hover:border-gray-200 rounded-lg outline-none bg-white focus:border-[#ff7a1a] focus:shadow-[0_0_0_3px_rgba(255,122,26,0.10)] h-9 px-2 mx-1 transition-all"
                    min={0}
                    step={0.01}
                  />
                  <select
                    value={line.tva}
                    onChange={e => updateLine(line.id, 'tva', Number(e.target.value))}
                    className="font-spline-mono font-medium text-sm text-center border-[1.5px] border-gray-100 hover:border-gray-200 rounded-lg outline-none bg-white focus:border-[#ff7a1a] focus:shadow-[0_0_0_3px_rgba(255,122,26,0.10)] h-9 mx-1 w-full cursor-pointer transition-all"
                  >
                    {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? '0%' : r === 5.5 ? '5,5%' : `${r}%`}</option>)}
                  </select>
                  <span className="font-spline-mono font-medium text-sm text-right text-[#0f1a3a]">{line.priceHT > 0 ? formatCurrency(line.qty * line.priceHT) : '—'}</span>
                  <button onClick={() => removeLine(line.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" aria-label="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Boutons "ajouter" desktop — CTA orange + outline secondaires */}
          <div className="flex flex-wrap gap-2 p-4 border-t border-gray-100">
            <button
              onClick={() => addLine('line')}
              className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-sm font-bold rounded-xl px-4 py-2 shadow-[0_4px_12px_rgba(255,122,26,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <Plus size={14} /> Ajouter une ligne
            </button>
            <button
              onClick={() => addLine('section')}
              className="inline-flex items-center gap-1.5 px-4 py-2 font-hanken text-sm font-semibold text-[#0f1a3a] bg-white border-[1.5px] border-gray-200 rounded-xl hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all"
            >
              <Plus size={14} /> Section
            </button>
            <button
              onClick={() => addLine('subsection')}
              className="inline-flex items-center gap-1.5 px-4 py-2 font-hanken text-sm font-semibold text-[#0f1a3a] bg-white border-[1.5px] border-gray-200 rounded-xl hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all"
            >
              <Plus size={14} /> Sous-section
            </button>
          </div>
        </div>

        {/* Sélecteur TVA global — raccourci pour appliquer un taux à toutes les lignes. */}
        <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-4 sm:p-5 flex flex-wrap items-center gap-4 shadow-[0_2px_6px_rgba(15,26,58,0.04)]">
          <label className="font-hanken text-sm font-semibold text-[#0f1a3a]">Appliquer à toutes les lignes :</label>
          <select
            value={globalTvaRate}
            onChange={e => {
              const v = Number(e.target.value)
              setTvaUserOverride(true)
              setGlobalTvaRate(v)
              setLines(prev => prev.map(l => l.type === 'line' ? { ...l, tva: v } : l))
            }}
            className="py-2 px-3 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-spline-mono font-medium text-[13.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12)] cursor-pointer transition-all"
          >
            {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'Sans TVA' : `${r}%`}</option>)}
          </select>
          <span className="font-hanken text-xs text-gray-500 italic">Astuce : modifiable aussi ligne par ligne dans le tableau.</span>
          {globalTvaRate === 0 && (
            <span className="font-hanken text-xs text-gray-500 italic">TVA non applicable, art. 293 B du CGI</span>
          )}
        </div>

        {/* Forfait global — alternative au calcul ligne par ligne */}
        <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-4 sm:p-5 flex flex-wrap items-center gap-4 shadow-[0_2px_6px_rgba(15,26,58,0.04)]">
          <label className="inline-flex items-center gap-2 font-hanken text-sm font-semibold text-[#0f1a3a] cursor-pointer">
            <input
              type="checkbox"
              checked={useForfait}
              onChange={e => setUseForfait(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a]"
            />
            Appliquer un prix forfaitaire global
          </label>
          {useForfait && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={forfaitHT}
                onChange={e => setForfaitHT(Number(e.target.value))}
                className="w-32 py-2 px-3 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-spline-mono font-medium text-[13.5px] text-right text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12)] transition-all"
                min={0}
                step={0.01}
              />
              <span className="font-hanken text-sm text-gray-600">€ HT</span>
              <span className="font-hanken text-[11px] text-gray-400">(remplace le calcul ligne par ligne)</span>
            </div>
          )}
        </div>

        {/* Acompte versé — option pour afficher acompte → reste à payer dans le récap */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acompteActive}
              onChange={e => setAcompteActive(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/30 cursor-pointer accent-[#ff7a1a]"
            />
            <div>
              <span className="block font-hanken text-[15px] font-semibold text-[#0f1a3a]">Un acompte a déjà été versé</span>
              <span className="block font-hanken text-xs text-gray-500 mt-1">
                Cochez si le client a versé un acompte (souvent via un devis signé). Il sera affiché dans le récapitulatif (sous-total brut → acompte → reste à payer).
              </span>
            </div>
          </label>
          {acompteActive && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">Pourcentage (%)</label>
                <input
                  type="number"
                  value={acomptePourcent}
                  min={0}
                  max={100}
                  step={1}
                  onChange={e => { setAcomptePourcent(Number(e.target.value)); setAcompteMontantTTC(0) }}
                  className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'}
                />
              </div>
              <div>
                <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">Ou montant TTC (€)</label>
                <input
                  type="number"
                  value={acompteMontantTTC}
                  min={0}
                  step={0.01}
                  onChange={e => setAcompteMontantTTC(Number(e.target.value))}
                  className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]'}
                />
              </div>
              <div>
                <label className="block font-hanken font-semibold text-[11px] uppercase tracking-wider text-gray-700 mb-2">Libellé (optionnel)</label>
                <input
                  type="text"
                  value={acompteLabel}
                  onChange={e => setAcompteLabel(e.target.value)}
                  placeholder="Ex. : versé le 02/05/2026"
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Totaux — récap V4 light, NET À PAYER en gradient orange (signature CTA). */}
        <div className="flex justify-end">
          <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 w-full sm:w-96 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
            <div className="flex justify-between py-1.5">
              <span className="font-hanken text-sm text-gray-500">Sous-total HT</span>
              <span className="font-spline-mono font-medium text-[14px] text-[#0f1a3a]">{formatCurrency(totalHT)}</span>
            </div>
            {Object.entries(tvaGroups).filter(([r, g]) => Number(r) > 0 && g.tva > 0.005).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, group]) => (
              <div key={rate} className="flex justify-between py-1.5">
                <span className="font-hanken text-sm text-gray-500">TVA {rate}%</span>
                <span className="font-spline-mono font-medium text-[14px] text-[#0f1a3a]">{formatCurrency(group.tva)}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-3 flex justify-between py-1.5">
              <span className="font-hanken font-bold text-[15px] text-[#0f1a3a]">Total TTC</span>
              <span className="font-spline-mono font-medium text-[15px] text-[#0f1a3a]">{formatCurrency(totalTTC)}</span>
            </div>
            {acompteActive && acompteTTCcalc > 0 && (
              <div className="flex justify-between py-1.5 border-t border-gray-100 mt-0.5 pt-2">
                <span className="font-hanken font-bold text-sm text-emerald-700">Acompte versé</span>
                <span className="font-spline-mono font-medium text-[14px] text-emerald-700">- {formatCurrency(acompteTTCcalc)}</span>
              </div>
            )}
            {avoirImputeEffectif > 0.01 && (
              <div className="flex justify-between py-1.5 border-t border-gray-100 mt-0.5 pt-2">
                <span className="font-hanken font-bold text-sm text-[#1a6fb5]">Avoir{avoirChoisi?.numero ? ` ${avoirChoisi.numero}` : ''} déduit</span>
                <span className="font-spline-mono font-medium text-[14px] text-[#1a6fb5]">- {formatCurrency(avoirImputeEffectif)}</span>
              </div>
            )}
            <div className="bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white rounded-xl p-3.5 mt-3 flex justify-between items-center shadow-[0_8px_20px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)]">
              <span className="font-hanken font-extrabold text-sm uppercase tracking-wider">Net à payer</span>
              <span className="font-spline-mono font-medium text-lg tracking-[0.5px]">{formatCurrency(netAPayer)}</span>
            </div>
          </div>
        </div>

        {/* Conditions de paiement + Notes personnalisées — V4 light */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 space-y-4 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Conditions de paiement
              <span className="ml-2 font-hanken text-[10px] text-gray-400 font-normal normal-case tracking-normal">(pré-rempli, modifiable)</span>
            </label>
            <textarea
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              rows={2}
              placeholder={DEFAULT_CONDITIONS_PAIEMENT}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] leading-[1.4] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] resize-none transition-all"
            />
            <p className="mt-1.5 font-hanken text-xs text-gray-500">Visible sur la facture (PDF + aperçu).</p>
          </div>
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Notes personnalisées
              <span className="ml-2 font-hanken text-[10px] text-gray-400 font-normal normal-case tracking-normal">(visibles par le client)</span>
            </label>
            <textarea
              value={notesPerso}
              onChange={e => setNotesPerso(e.target.value)}
              rows={3}
              placeholder="Écrire ici…"
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] leading-[1.4] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] resize-none transition-all"
            />
          </div>
        </div>

        {/* Boutons bas — actions de sauvegarde finales (V4 : CTA orange + outline) */}
        <div className="flex flex-wrap items-center gap-3 justify-end pb-8">
          <button
            onClick={() => handleSave('brouillon')}
            disabled={saving}
            className="h-12 px-6 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[14.5px] font-bold shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
          >
            {fromVoice ? (saving ? 'Enregistrement...' : 'Enregistrer (modifiable)') : 'Sauvegarder en brouillon'}
          </button>
          {!fromVoice && (
            <button
              onClick={() => handleSave('envoyee')}
              disabled={saving}
              className="h-12 px-8 rounded-xl border-[1.5px] border-[#ff7a1a] bg-white text-[#ff7a1a] font-hanken text-[14.5px] font-bold hover:bg-[#fff5ec] transition-all disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Émettre la facture (verrouillée)'}
            </button>
          )}
        </div>
      </div>

      {/* --- Bottom sheet mobile (saisie/edition ligne) --- */}
      <LineSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        line={sheetLine as SheetLine | null}
        onSave={handleSheetSave}
        onSaveAndNew={handleSheetSaveAndNew}
        defaultType={sheetDefaultType}
        unitOptions={UNIT_SUGGESTIONS}
        prestations={prestationSuggestions}
        autoEntrepreneur={autoEntrepreneur}
      />
    </div>
  )
}
