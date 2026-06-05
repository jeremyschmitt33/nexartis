'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useClients, useEntreprise, useChantiers, insertRow } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
import { isAutoEntrepreneur } from '@/lib/helpers'
import LineCard from '@/components/mobile/LineCard'
import LineSheet, { type SheetLine } from '@/components/mobile/LineSheet'

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
}

interface ClientRecord { id: string; nom: string; prenom?: string; civilite?: string; adresse?: string; telephone?: string; email?: string; code_postal?: string; ville?: string }

interface ChantierRecord { id: string; nom?: string; titre?: string; objet?: string }

// ─── Constants ────────────────────────────────────────────────────────────

const UNIT_SUGGESTIONS = ['U', 'm²', 'm', 'ml', 'h', 'jour', 'forfait', 'lot', 'ensemble']
const TVA_RATES = [0, 5.5, 10, 20]
const DEFAULT_CONDITIONS_PAIEMENT =
  'Méthodes de paiement acceptées : Virement bancaire, Chèque.'
let nextId = 200

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const inputCls = 'w-full h-11 rounded-xl border-2 border-[#5ab4e0]/40 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/20 transition-all bg-white placeholder:text-gray-400'

// ─── Page ─────────────────────────────────────────────────────────────────

export default function NouvelleFacturePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: clientsRaw } = useClients()
  const { data: chantiersRaw } = useChantiers()
  // entreprise — utilisée pour auto-détection franchise TVA (micro / EI / auto-entrepreneur)
  const { entreprise } = useEntreprise()
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

  // Client (texte libre ou sélection)
  const [clientNom, setClientNom] = useState('')
  const [clientPrenom, setClientPrenom] = useState('')
  const [clientCivilite, setClientCivilite] = useState('')
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

  // ── Client autocomplete ──
  const handleClientNomChange = (value: string) => {
    setClientNom(value)
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
    setClientCivilite((c as unknown as Record<string, string>).civilite || '')
    setClientNom(c.nom)
    setClientPrenom(c.prenom || '')
    setClientAdresse(c.adresse || '')
    setClientCodePostal(c.code_postal || '')
    setClientVille(c.ville || '')
    setClientTelephone(c.telephone || '')
    setClientEmail(c.email || '')
    setClientSuggestions([])
    setClientDropdownOpen(false)
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
  const netAPayer = Math.max(totalTTC - acompteTTCcalc, 0)

  // ── Save ──
  const handleSave = useCallback(async (statut: 'brouillon' | 'envoyee') => {
    setSaving(true)
    setError(null)
    try {
      const yearFromDate = (() => {
        const y = Number((dateFacture || '').slice(0, 4))
        return Number.isFinite(y) && y > 2000 ? y : new Date().getFullYear()
      })()
      const numero = `F-${yearFromDate}-${String(Date.now()).slice(-5)}`
      const clientDisplay = `${clientCivilite ? clientCivilite + ' ' : ''}${clientPrenom ? clientPrenom + ' ' : ''}${clientNom}`.trim()

      const factureData: Record<string, unknown> = {
        numero,
        statut,
        // V3.0c.17 — Type de facture + champs specifiques situation
        type: factureType,
        devis_ref: factureType === 'situation' ? (devisRef.trim() || null) : null,
        numero_situation: factureType === 'situation' ? numeroSituation : null,
        pourcentage_situation: factureType === 'situation' ? pourcentageSituation : null,
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
        notes_client: clientDisplay
          ? `${clientDisplay}${clientAdresse ? ` | ${clientAdresse}` : ''}${clientCodePostal || clientVille ? ` | ${clientCodePostal} ${clientVille}`.trim() : ''}${clientTelephone ? ` | ${clientTelephone}` : ''}${clientEmail ? ` | ${clientEmail}` : ''}`
          : null,
        client_nom: clientNom || null,
        client_id: null,
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

            if (existingClient) {
              factureData.client_id = existingClient.id
              await supabase.from('clients').update(clientData).eq('id', existingClient.id)
            } else {
              const { data: newClient } = await supabase
                .from('clients')
                .insert({ ...clientData, type: 'particulier', actif: true })
                .select('id')
                .single()
              if (newClient) factureData.client_id = newClient.id
            }
          }
        } catch (err) { console.error('Erreur sauvegarde client:', err) }
      }

      const facture = await insertRow('factures', factureData)
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

      router.push(`/dashboard/factures/${factureId}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }, [clientCivilite, clientNom, clientPrenom, clientAdresse, clientCodePostal, clientVille, clientTelephone, clientEmail, dateFacture, dateEcheance, objet, chantierId, conditions, notesPerso, acompteActive, acomptePourcent, acompteHTcalc, acompteTTCcalc, acompteLabel, totalHT, totalTVA, totalTTC, globalTvaRate, lines, router, factureType, devisRef, numeroSituation, pourcentageSituation])

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 py-3 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/factures" className="p-1.5 rounded-md hover:bg-gray-100">
            <ArrowLeft size={18} className="text-[#6b7280]" />
          </Link>
          <h2 className="hidden sm:block font-syne font-bold text-lg text-[#1a1a2e]">Nouvelle facture</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave('brouillon')} disabled={saving}
            className="h-9 px-4 rounded-xl border-2 border-gray-300 text-sm font-syne font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50">
            Brouillon
          </button>
          {!fromVoice && (
            <button onClick={() => handleSave('envoyee')} disabled={saving}
              className="h-9 px-5 rounded-xl bg-[#e87a2a] text-white font-syne font-bold text-sm hover:bg-[#f09050] transition-all disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600 font-manrope">{error}</p></div>}
        {fromVoice && (
          <div className="bg-sky/10 border-2 border-sky/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-xl" aria-hidden>🎤</span>
            <div>
              <p className="font-syne font-bold text-sm text-navy mb-1">Facture générée par la voix</p>
              <p className="text-xs font-manrope text-navy/80 leading-relaxed">
                Cette facture sera enregistrée <strong>modifiable</strong> pour que tu puisses corriger les erreurs vocales et compléter les infos manquantes.
                Tu pourras l'émettre définitivement depuis la page détail après vérification (l'émission verrouille la facture, obligation légale art. L441-9 C. comm.).
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dates + Objet */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Date de facture</label>
              <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Date d&apos;échéance</label>
              <input type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} className={inputCls} />
            </div>
            <div className="relative">
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">
                Objet / Chantier
                {chantierId && <span className="ml-2 text-[10px] font-syne font-bold text-[#1a6fb5] bg-[#e8f4fb] px-2 py-0.5 rounded uppercase tracking-wider">Lié au chantier</span>}
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
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border-2 border-[#5ab4e0] shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] font-syne font-bold text-[#1a6fb5] uppercase tracking-wider border-b border-gray-100 bg-[#e8f4fb]">Chantiers existants</div>
                  {chantierSuggestions.map(c => (
                    <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); selectChantier(c) }}
                      className="w-full text-left px-4 py-2.5 font-manrope hover:bg-[#eef7fc] border-b border-gray-100 last:border-0 transition-colors">
                      <span className="font-semibold text-[#1a1a2e] text-sm">{c.nom || c.titre || c.objet || 'Chantier'}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] font-manrope text-gray-400 mt-1">Tapez pour rechercher un chantier existant, ou saisissez librement.</p>
            </div>

            {/* V3.0c.17 — Type de facture */}
            <div>
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Type de facture</label>
              <select
                value={factureType}
                onChange={e => setFactureType(e.target.value as 'standard' | 'acompte' | 'situation' | 'avoir')}
                className={inputCls}
              >
                <option value="standard">Facture standard</option>
                <option value="acompte">Facture d&apos;acompte</option>
                <option value="situation">Facture de situation</option>
                <option value="avoir">Avoir (facture negative)</option>
              </select>
              <p className="text-[11px] font-manrope text-gray-400 mt-1">
                Une <strong>facture de situation</strong> facture une tranche d&apos;un chantier en cours (#1, #2, #3...).
              </p>
            </div>

            {factureType === 'situation' && (
              <div className="rounded-xl border-2 border-[#5ab4e0]/30 bg-[#f8fbfd] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-syne font-bold text-[#1a6fb5] bg-[#e8f4fb] px-2 py-0.5 rounded uppercase tracking-wider">Facture de situation</span>
                </div>
                <div>
                  <label className="block text-[11px] font-manrope font-medium text-gray-500 uppercase tracking-wider mb-1">Reference du devis</label>
                  <input
                    type="text"
                    value={devisRef}
                    onChange={e => setDevisRef(e.target.value)}
                    placeholder="Ex. : D-2026-12345"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-manrope font-medium text-gray-500 uppercase tracking-wider mb-1">N&deg; de situation</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={numeroSituation}
                      onChange={e => setNumeroSituation(Math.max(1, Number(e.target.value) || 1))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-manrope font-medium text-gray-500 uppercase tracking-wider mb-1">% d&apos;avancement</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={pourcentageSituation}
                      onChange={e => setPourcentageSituation(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-[11px] font-manrope text-gray-400">
                  Indicatif pour cette version. Le calcul automatique du reste a facturer arrivera plus tard.
                </p>
              </div>
            )}
          </div>

          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-manrope font-semibold text-[#1a1a2e] mb-3">Client</label>
            <div className="space-y-3">
              <div className="relative">
                <div className="flex gap-2">
                  <select value={clientCivilite} onChange={e => setClientCivilite(e.target.value)} className="w-24 h-11 shrink-0 rounded-xl border-2 border-gray-200 px-2 text-sm font-manrope outline-none focus:border-[#5ab4e0] bg-white">
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Société">Société</option>
                  </select>
                  <input type="text" value={clientNom} onChange={e => handleClientNomChange(e.target.value)}
                    onBlur={() => setTimeout(() => { setClientDropdownOpen(false); setClientSuggestions([]) }, 200)}
                    placeholder="Nom (tapez pour rechercher)" className={inputCls} autoComplete="off" />
                </div>
                {clientDropdownOpen && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border-2 border-[#5ab4e0] shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                    {clientSuggestions.map(c => (
                      <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); selectClient(c) }}
                        className="w-full text-left px-4 py-3 font-manrope hover:bg-[#eef7fc] border-b border-gray-100 last:border-0 transition-colors">
                        <span className="font-semibold text-[#1a1a2e] text-sm">{c.prenom ? `${c.prenom} ${c.nom}` : c.nom}</span>
                        {c.adresse && <span className="text-[#6b7280] text-xs block mt-0.5">{c.adresse}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input type="text" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} placeholder="Prénom" className={inputCls} />
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

        {/* Tableau des lignes */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* ─── Mobile : cards + bottom sheet (V2 maquette validée) ─── */}
          <div className="sm:hidden p-3 space-y-2">
            {lines.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-[#5ab4e0]/40 bg-[#f8fbfd] px-4 py-6 text-center">
                <p className="text-sm font-manrope text-[#5f6c80]">Aucune ligne pour l&apos;instant.</p>
                <p className="text-[12px] font-manrope text-gray-400 mt-1">Touchez <strong>+ Ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
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
            {/* Barre d'ajout : 3 boutons sous la liste */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => openCreateSheet('line')}
                className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-[#e8f4fb] border border-[#5ab4e0]/60 rounded-full px-4 py-2.5 text-sm font-syne font-semibold text-[#1a6fb5] active:scale-95 transition-all"
              >
                <Plus size={16} /> Ligne
              </button>
              <button
                type="button"
                onClick={() => openCreateSheet('section')}
                className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-syne font-semibold text-[#0f1a3a] active:scale-95 transition-all"
              >
                <Plus size={16} /> Section
              </button>
              <button
                type="button"
                onClick={() => openCreateSheet('subsection')}
                className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-syne font-semibold text-[#0f1a3a] active:scale-95 transition-all"
              >
                <Plus size={16} /> Sous-section
              </button>
            </div>
          </div>

          {/* Desktop : table — bandeau navy (parité PDF/aperçu) */}
          {/* V2.5 — Colonne TVA par ligne (parite Obat) : 7 colonnes au lieu de 6 */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="bg-[#0f1a3a] text-white grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-3 text-xs font-manrope font-semibold uppercase">
              <span>Désignation</span><span className="text-center">Qté</span><span className="text-center">Unité</span><span className="text-right">Prix U. HT</span><span className="text-center">TVA</span><span className="text-right">Total HT</span><span />
            </div>
            {lines.length === 0 && (
              <div className="px-4 py-8 text-center border-b border-gray-100">
                <p className="text-sm font-manrope text-[#5f6c80]">Aucune ligne pour l&apos;instant.</p>
                <p className="text-[12px] font-manrope text-gray-400 mt-1">Cliquez sur <strong>+ Ajouter une ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
              </div>
            )}
            {lines.map((line, idx) => {
              // Section : bandeau sky foncé pleine largeur
              if (line.type === 'section') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_36px] min-w-[500px] items-center px-4 py-2 bg-[#a8d4ec] border-l-4 border-[#1a6fb5] border-b border-gray-100">
                    <input type="text" value={line.designation} onChange={e => updateLine(line.id, 'designation', e.target.value)}
                      className="text-sm font-bold text-[#0f1a3a] uppercase border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white/60 focus:border-[#5ab4e0] px-2 h-9 placeholder-[#1a6fb5]/60" placeholder="Nom de la section (ex : Demolition, Maconnerie...)" />
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-bold text-[#1a6fb5]">{formatCurrency(subtotalAt(idx))}</span>
                      <button onClick={() => removeLine(line.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              }
              // Sous-section : bandeau sky pâle
              if (line.type === 'subsection') {
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_36px] min-w-[500px] items-center px-4 py-2 bg-[#dceefa] border-l-4 border-[#5ab4e0] border-b border-gray-100">
                    <input type="text" value={line.designation} onChange={e => updateLine(line.id, 'designation', e.target.value)}
                      className="text-sm font-semibold text-[#0f1a3a] border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white/60 focus:border-[#5ab4e0] px-2 h-9 placeholder-[#5ab4e0]/70" placeholder="Nom de la sous-section (ex : Cuisine, Plomberie...)" />
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-semibold text-[#1a6fb5]">{formatCurrency(subtotalAt(idx))}</span>
                      <button onClick={() => removeLine(line.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              }
              // Ligne classique de prestation
              return (
                <div key={line.id} className="grid grid-cols-[1fr_70px_90px_100px_80px_100px_36px] min-w-[580px] items-center px-4 py-2 border-b border-gray-100">
                  <input type="text" value={line.designation} onChange={e => updateLine(line.id, 'designation', e.target.value)}
                    className="text-sm font-manrope border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white focus:border-[#5ab4e0] px-2 h-9 mr-2" placeholder="Désignation..." />
                  <input type="number" value={line.qty} onChange={e => updateLine(line.id, 'qty', Number(e.target.value))}
                    className="text-sm text-center border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white focus:border-[#5ab4e0] h-9 mx-1" min={0} />
                  <select value={line.unit} onChange={e => updateLine(line.id, 'unit', e.target.value)}
                    className="text-sm text-center border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white focus:border-[#5ab4e0] h-9 mx-1 w-full">
                    {UNIT_SUGGESTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" value={line.priceHT} onChange={e => updateLine(line.id, 'priceHT', Number(e.target.value))}
                    className="text-sm text-right border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white focus:border-[#5ab4e0] h-9 px-2 mx-1" min={0} step={0.01} />
                  {/* V2.5 — Selecteur TVA par ligne (parite Obat) */}
                  <select value={line.tva} onChange={e => updateLine(line.id, 'tva', Number(e.target.value))}
                    className="text-sm text-center border border-[#5ab4e0]/25 hover:border-[#5ab4e0]/50 rounded-md outline-none bg-white focus:border-[#5ab4e0] h-9 mx-1 w-full">
                    {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? '0%' : r === 5.5 ? '5,5%' : `${r}%`}</option>)}
                  </select>
                  <span className="text-sm font-semibold text-right">{line.priceHT > 0 ? formatCurrency(line.qty * line.priceHT) : '—'}</span>
                  <button onClick={() => removeLine(line.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2 p-4 border-t border-gray-100">
            <button onClick={() => addLine('line')} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-manrope hover:bg-gray-100">
              <Plus size={14} /> Ajouter une ligne
            </button>
            <button onClick={() => addLine('section')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-manrope text-[#1a6fb5] bg-[#dceefa] border border-[#5ab4e0]/30 rounded-lg hover:bg-[#cde4f5]">
              <Plus size={14} /> Section
            </button>
            <button onClick={() => addLine('subsection')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-manrope text-[#1a6fb5] bg-[#e8f4fb] border border-[#5ab4e0]/20 rounded-lg hover:bg-[#dceefa]">
              <Plus size={14} /> Sous-section
            </button>
          </div>
        </div>

        {/* V2.5 — Selecteur global = raccourci "Appliquer a toutes les lignes". */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
          <label className="text-sm font-manrope font-medium text-[#1a1a2e]">Appliquer à toutes les lignes :</label>
          <select
            value={globalTvaRate}
            onChange={e => {
              const v = Number(e.target.value)
              setTvaUserOverride(true)
              setGlobalTvaRate(v)
              // V2.5 : pousse le taux sur TOUTES les lignes existantes
              setLines(prev => prev.map(l => l.type === 'line' ? { ...l, tva: v } : l))
            }}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] bg-white cursor-pointer">
            {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'Sans TVA' : `${r}%`}</option>)}
          </select>
          <span className="text-xs font-manrope text-[#6b7280] italic">Astuce : modifiable aussi ligne par ligne dans le tableau.</span>
          {globalTvaRate === 0 && (
            <span className="text-xs font-manrope text-[#6b7280] italic">TVA non applicable, art. 293 B du CGI</span>
          )}
        </div>

        {/* V4 — Forfait global (parité devis) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-manrope cursor-pointer">
            <input type="checkbox" checked={useForfait} onChange={e => setUseForfait(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[#5ab4e0] focus:ring-[#5ab4e0]" />
            Appliquer un prix forfaitaire global
          </label>
          {useForfait && (
            <div className="flex items-center gap-2">
              <input type="number" value={forfaitHT} onChange={e => setForfaitHT(Number(e.target.value))} className="w-32 h-9 rounded-lg border border-gray-200 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] text-right" min={0} step={0.01} />
              <span className="text-sm font-manrope text-[#6b7280]">€ HT</span>
              <span className="text-[11px] font-manrope text-gray-400">(remplace le calcul ligne par ligne)</span>
            </div>
          )}
        </div>

        {/* Acompte versé — checkbox simple */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acompteActive}
              onChange={e => setAcompteActive(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-[#5ab4e0] text-[#1a6fb5] focus:ring-2 focus:ring-[#5ab4e0]/30 cursor-pointer accent-[#1a6fb5]"
            />
            <div>
              <span className="block text-sm font-manrope font-semibold text-[#1a1a2e]">Un acompte a déjà été versé</span>
              <span className="block text-[11px] font-manrope text-gray-400 mt-0.5">Cochez si le client a versé un acompte (souvent via un devis signé). Il sera affiché dans le récapitulatif (sous-total brut → acompte → reste à payer).</span>
            </div>
          </label>
          {acompteActive && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div>
                <label className="block text-[11px] font-manrope font-medium text-gray-500 uppercase tracking-wider mb-1">Pourcentage (%)</label>
                <input type="number" value={acomptePourcent} min={0} max={100} step={1}
                  onChange={e => { setAcomptePourcent(Number(e.target.value)); setAcompteMontantTTC(0) }}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-manrope font-medium text-gray-500 uppercase tracking-wider mb-1">Ou montant TTC (€)</label>
                <input type="number" value={acompteMontantTTC} min={0} step={0.01}
                  onChange={e => setAcompteMontantTTC(Number(e.target.value))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-manrope font-medium text-gray-500 uppercase tracking-wider mb-1">Libellé (optionnel)</label>
                <input type="text" value={acompteLabel} onChange={e => setAcompteLabel(e.target.value)}
                  placeholder="Ex. : versé le 02/05/2026"
                  className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Totaux */}
        <div className="flex justify-end">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-80">
            <div className="flex justify-between py-1.5 text-sm font-manrope">
              <span className="text-[#5f6c80]">Sous-total HT</span><span className="font-medium">{formatCurrency(totalHT)}</span>
            </div>
            {/* V2.5 — Ventilation TVA par taux (multi-taux Obat) */}
            {Object.entries(tvaGroups).filter(([r, g]) => Number(r) > 0 && g.tva > 0.005).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, group]) => (
              <div key={rate} className="flex justify-between py-1.5 text-sm font-manrope">
                <span className="text-[#5f6c80]">TVA {rate}%</span><span className="font-medium">{formatCurrency(group.tva)}</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between py-1.5 text-sm font-manrope">
              <span className="text-[#0f1a3a] font-bold">Total TTC</span><span className="font-bold">{formatCurrency(totalTTC)}</span>
            </div>
            {acompteActive && acompteTTCcalc > 0 && (
              <div className="flex justify-between py-1.5 text-sm font-manrope border-t mt-0.5 pt-2">
                <span className="text-[#15803d] font-bold">Acompte versé</span>
                <span className="text-[#15803d] font-bold">- {formatCurrency(acompteTTCcalc)}</span>
              </div>
            )}
            <div className="bg-[#1a6fb5] text-white rounded-lg p-3 mt-2 flex justify-between items-center">
              <span className="font-syne font-bold text-sm">NET À PAYER</span>
              <span className="font-syne font-bold text-lg">{formatCurrency(netAPayer)}</span>
            </div>
          </div>
        </div>

        {/* Conditions de paiement + Notes personnalisées */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">
              Conditions de paiement
              <span className="ml-2 text-[10px] font-manrope text-gray-400 font-normal">(pre-rempli, modifiable)</span>
            </label>
            <textarea value={conditions} onChange={e => setConditions(e.target.value)} rows={2}
              placeholder={DEFAULT_CONDITIONS_PAIEMENT}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-manrope outline-none focus:border-[#5ab4e0] resize-none" />
            <p className="text-[11px] font-manrope text-gray-400 mt-1">Visible sur la facture (PDF + apercu).</p>
          </div>
          <div>
            <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">
              Notes personnalisees
              <span className="ml-2 text-[10px] font-manrope text-gray-400 font-normal">(visibles par le client)</span>
            </label>
            <textarea value={notesPerso} onChange={e => setNotesPerso(e.target.value)} rows={3}
              placeholder="Écrire ici…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-manrope outline-none focus:border-[#5ab4e0] resize-none" />
          </div>
        </div>

        {/* Boutons bas */}
        <div className="flex flex-wrap items-center gap-3 justify-end pb-8">
          <button onClick={() => handleSave('brouillon')} disabled={saving}
            className="h-12 px-6 rounded-xl bg-[#e87a2a] text-white font-syne font-bold text-sm hover:bg-[#f09050] shadow-md hover:shadow-lg transition-all disabled:opacity-50">
            {fromVoice ? (saving ? 'Enregistrement...' : 'Enregistrer (modifiable)') : 'Sauvegarder en brouillon'}
          </button>
          {!fromVoice && (
            <button onClick={() => handleSave('envoyee')} disabled={saving}
              className="h-12 px-8 rounded-xl border-2 border-[#e87a2a] text-[#e87a2a] font-syne font-bold text-sm hover:bg-[#fef5ee] transition-all disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Emettre la facture (verrouillee)'}
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
      />
    </div>
  )
}
