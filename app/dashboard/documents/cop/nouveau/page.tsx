'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, KeyRound } from 'lucide-react'
import { useEntreprise, LoadingSkeleton } from '@/lib/hooks'
import { PremiumButton, PremiumInput, PremiumSelect, FieldLabel } from '@/components/ui/v4'
import { isAutoEntrepreneur } from '@/lib/helpers'
import { defaultCopLignes, type CopLigne } from '@/lib/cop-data'
import { hasMetier } from '@/lib/metiers'

const TVA_RATES = [0, 5.5, 10, 20]
const UNITES = ['forfait', 'U', 'h', 'jour', 'ml', 'm']

// Datetime-local au format "YYYY-MM-DDTHH:MM" a partir de maintenant.
function nowLocalDatetime(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function CopNouveauPage() {
  const router = useRouter()
  const { entreprise, loading: loadingEntreprise } = useEntreprise()

  const isSerrurier = hasMetier(entreprise as Record<string, unknown> | null, 'serrurier')

  // ── Etat du formulaire ────────────────────────────────────────────────
  const [clientNom, setClientNom] = useState('')
  const [clientPrenom, setClientPrenom] = useState('')
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientCp, setClientCp] = useState('')
  const [clientVille, setClientVille] = useState('')
  const [statutOccupant, setStatutOccupant] = useState<'locataire' | 'proprietaire'>('locataire')
  const [identiteVerifiee, setIdentiteVerifiee] = useState(false)
  const [pieceNature, setPieceNature] = useState('')
  const [dateIntervention, setDateIntervention] = useState(nowLocalDatetime())
  const [lieu, setLieu] = useState('')
  const [natureUrgence, setNatureUrgence] = useState('')
  const [lignes, setLignes] = useState<CopLigne[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prereglage du bareme des que l'entreprise est chargee.
  useEffect(() => {
    if (!entreprise) return
    setLignes(defaultCopLignes(entreprise as unknown as Record<string, unknown>))
    // Lieu par defaut = code postal + ville de l'entreprise laisse vide (chantier).
  }, [entreprise])

  // Auto-entrepreneur : forcer TVA 0 sur toutes les lignes.
  useEffect(() => {
    if (isAutoEntrepreneur(entreprise)) {
      setLignes((prev) => prev.map((l) => ({ ...l, tva_taux: 0 })))
    }
  }, [entreprise])

  // ── Operations sur les lignes ─────────────────────────────────────────
  function updateLigne(idx: number, field: keyof CopLigne, value: string | number) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }
  function addLigne() {
    const tvaDefaut = isAutoEntrepreneur(entreprise) ? 0 : Number((entreprise as { tva_defaut?: number } | null)?.tva_defaut ?? 10)
    setLignes((prev) => [...prev, { designation: '', quantite: 1, unite: 'forfait', pu_ht: 0, tva_taux: tvaDefaut }])
  }
  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx))
  }


  // ── Enregistrement ────────────────────────────────────────────────────
  async function handleSave() {
    setError(null)
    if (lignes.length === 0) { setError('Ajoutez au moins une ligne au bareme.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/documents/cop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: clientNom,
          client_prenom: clientPrenom,
          client_adresse: clientAdresse,
          client_cp: clientCp,
          client_ville: clientVille,
          statut_occupant: statutOccupant,
          identite_verifiee: identiteVerifiee,
          piece_nature: pieceNature,
          date_intervention: dateIntervention ? new Date(dateIntervention).toISOString() : null,
          lieu,
          nature_urgence: natureUrgence,
          lignes,
        }),
      })
      if (!res.ok) {
        let msg = `Erreur serveur (${res.status})`
        try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
        setError(msg)
        setSaving(false)
        return
      }
      const j = await res.json()
      if (j?.id) router.push(`/dashboard/documents/cop/${j.id}`)
      else { setError('Reponse serveur inattendue.'); setSaving(false) }
    } catch {
      setError('Erreur reseau. Verifiez votre connexion et reessayez.')
      setSaving(false)
    }
  }

  // ── Etats de chargement / gating ──────────────────────────────────────
  if (loadingEntreprise) {
    return <div className="p-6"><LoadingSkeleton rows={8} /></div>
  }

  if (!isSerrurier) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1e6] text-[#ff7a1a]">
          <KeyRound size={26} />
        </span>
        <h1 className="font-hanken text-xl font-bold text-[#0f1a3a]">Reserve aux serruriers</h1>
        <p className="mt-2 font-manrope text-sm text-gray-500">
          Le contrat d&apos;ouverture de porte est un document specifique au metier de serrurier.
        </p>
        <div className="mt-6">
          <Link href="/dashboard/documents">
            <PremiumButton variant="secondary" icon={<ArrowLeft size={18} />}>Retour aux documents</PremiumButton>
          </Link>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white transition-all'

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/documents" className="inline-flex items-center gap-1.5 font-manrope text-xs text-gray-400 hover:text-[#0f1a3a]">
            <ArrowLeft size={14} /> Documents
          </Link>
          <h1 className="mt-1 font-hanken text-2xl font-bold text-[#0f1a3a]">Contrat d&apos;ouverture de porte</h1>
        </div>
        <PremiumButton onClick={handleSave} loading={saving}>Enregistrer</PremiumButton>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-hanken text-sm text-red-700">{error}</p>
        </div>
      )}

      <p className="mb-5 font-manrope text-xs italic text-gray-400">
        Modele fourni a titre indicatif, adaptez-le a votre situation.
      </p>

      <div className="mx-auto max-w-2xl">
        {/* ── Formulaire (apercu complet apres enregistrement) ── */}
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">Occupant</h2>
            <div className="grid grid-cols-2 gap-3">
              <PremiumInput label="Prenom" value={clientPrenom} onChange={(e) => setClientPrenom(e.target.value)} />
              <PremiumInput label="Nom" value={clientNom} onChange={(e) => setClientNom(e.target.value)} />
            </div>
            <PremiumInput label="Adresse du logement" value={clientAdresse} onChange={(e) => setClientAdresse(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <PremiumInput label="Code postal" value={clientCp} onChange={(e) => setClientCp(e.target.value)} />
              <PremiumInput className="col-span-2" label="Ville" value={clientVille} onChange={(e) => setClientVille(e.target.value)} />
            </div>
            <PremiumSelect label="Statut de l'occupant" value={statutOccupant} onChange={(e) => setStatutOccupant(e.target.value as 'locataire' | 'proprietaire')}>
              <option value="locataire">Locataire</option>
              <option value="proprietaire">Proprietaire</option>
            </PremiumSelect>
            <div className="flex items-center gap-2">
              <input id="idverif" type="checkbox" checked={identiteVerifiee} onChange={(e) => setIdentiteVerifiee(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a]" />
              <label htmlFor="idverif" className="font-hanken text-sm text-[#0f1a3a]">Identite verifiee sur place par l&apos;intervenant</label>
            </div>
            <PremiumInput label="Type de piece (optionnel, sans numero)" placeholder="ex : CNI" value={pieceNature} onChange={(e) => setPieceNature(e.target.value)} hint="On n'enregistre jamais le numero de la piece (RGPD)." />
          </section>

          <section className="space-y-3">
            <h2 className="font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">Intervention</h2>
            <div>
              <FieldLabel>Date et heure</FieldLabel>
              <input type="datetime-local" value={dateIntervention} onChange={(e) => setDateIntervention(e.target.value)} className={inputCls} />
            </div>
            <PremiumInput label="Lieu de l'intervention" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Adresse du chantier si differente" />
            <PremiumInput label="Nature de l'urgence (optionnel)" value={natureUrgence} onChange={(e) => setNatureUrgence(e.target.value)} placeholder="ex : porte claquee, cle perdue" />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">Bareme</h2>
              <button onClick={addLigne} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-hanken text-xs font-semibold text-[#ff7a1a] hover:bg-[#fff1e6]">
                <Plus size={14} /> Ligne
              </button>
            </div>
            <div className="space-y-3">
              {lignes.map((l, idx) => (
                <div key={idx} className="rounded-xl border border-gray-100 bg-white p-3 shadow-[0_1px_3px_rgba(15,26,58,0.04)]">
                  <div className="mb-2 flex items-start gap-2">
                    <input value={l.designation} onChange={(e) => updateLigne(idx, 'designation', e.target.value)} placeholder="Designation" className={inputCls} />
                    <button onClick={() => removeLigne(idx)} aria-label="Supprimer la ligne" className="mt-1 shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <FieldLabel>Qte</FieldLabel>
                      <input type="number" min={0} step="0.5" value={l.quantite} onChange={(e) => updateLigne(idx, 'quantite', Number(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                      <FieldLabel>Unite</FieldLabel>
                      <select value={l.unite} onChange={(e) => updateLigne(idx, 'unite', e.target.value)} className={inputCls}>
                        {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>P.U. HT</FieldLabel>
                      <input type="number" min={0} step="0.01" value={l.pu_ht} onChange={(e) => updateLigne(idx, 'pu_ht', Number(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                      <FieldLabel>TVA</FieldLabel>
                      <select value={l.tva_taux} onChange={(e) => updateLigne(idx, 'tva_taux', Number(e.target.value))} className={inputCls}>
                        {TVA_RATES.map((t) => <option key={t} value={t}>{t}%</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {lignes.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center font-manrope text-sm text-gray-400">
                  Aucune ligne. Cliquez sur « Ligne » pour en ajouter une.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
