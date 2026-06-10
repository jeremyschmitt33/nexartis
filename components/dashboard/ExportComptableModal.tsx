'use client'

/**
 * ExportComptableModal — Modal partagé pour l'export comptable CSV.
 *
 * Utilisé sur :
 *   - app/dashboard/factures/page.tsx (type="factures")
 *   - app/dashboard/devis/page.tsx    (type="devis")
 *
 * UX :
 *   - Plein écran sur mobile (h-screen), card centrée sur desktop.
 *   - Sélecteur de période : "Mois en cours", "Trimestre en cours", "Année en cours", "Personnalisé"
 *     → en mode "Personnalisé", deux champs date apparaissent.
 *   - Sélecteur de format : "CSV simple" (FEC arrivera plus tard).
 *   - Bouton "Télécharger" → POST /api/export-comptable → blob → download forcé.
 */

import { useState, useMemo, useEffect } from 'react'
import { X, Download, FileSpreadsheet } from 'lucide-react'
import { PremiumInput, PremiumSelect, PremiumButton } from '@/components/ui/v4'

type ExportType = 'factures' | 'devis'
type Periode = 'mois' | 'trimestre' | 'annee' | 'personnalise'
type Format = 'csv-simple'

interface ExportComptableModalProps {
  open: boolean
  onClose: () => void
  type: ExportType
}

// ─── Helpers dates ────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function bornes(periode: Periode, custom: { debut: string; fin: string }): { debut: string; fin: string } {
  if (periode === 'personnalise') return custom

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-11

  if (periode === 'mois') {
    const debut = new Date(y, m, 1)
    const fin = new Date(y, m + 1, 0) // dernier jour du mois
    return { debut: isoDate(debut), fin: isoDate(fin) }
  }

  if (periode === 'trimestre') {
    const startMonth = Math.floor(m / 3) * 3
    const debut = new Date(y, startMonth, 1)
    const fin = new Date(y, startMonth + 3, 0)
    return { debut: isoDate(debut), fin: isoDate(fin) }
  }

  // annee
  return { debut: `${y}-01-01`, fin: `${y}-12-31` }
}

// ─── Component ─────────────────────────────────────────────────

export default function ExportComptableModal({ open, onClose, type }: ExportComptableModalProps) {
  const [periode, setPeriode] = useState<Periode>('mois')
  const [format, setFormat] = useState<Format>('csv-simple')
  const [dateDebut, setDateDebut] = useState<string>('')
  const [dateFin, setDateFin] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // V3.1 — P5 : option "détaillé" pour décomposer les factures multi-taux
  // en une ligne CSV par taux de TVA. Activable uniquement pour le type 'factures'
  // (les devis n'ont pas l'aggrégat lignes côté API).
  const [detail, setDetail] = useState(false)

  const { debut: debutAuto, fin: finAuto } = useMemo(
    () => bornes(periode, { debut: dateDebut, fin: dateFin }),
    [periode, dateDebut, dateFin],
  )

  // Reset état à chaque ouverture (évite états résiduels d'une session précédente)
  useEffect(() => {
    if (open) {
      setError(null)
      setLoading(false)
    }
  }, [open])

  if (!open) return null

  const label = type === 'factures' ? 'factures' : 'devis'
  const labelCap = type === 'factures' ? 'Factures' : 'Devis'

  const handleDownload = async () => {
    setError(null)

    // Validation côté client (UX)
    if (periode === 'personnalise') {
      if (!dateDebut || !dateFin) {
        setError('Veuillez renseigner les deux dates.')
        return
      }
      if (dateDebut > dateFin) {
        setError('La date de début doit être antérieure à la date de fin.')
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/export-comptable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          format,
          dateDebut: debutAuto || undefined,
          dateFin: finAuto || undefined,
          // V3.1 — P5 : envoyé seulement pour 'factures' (pas exploité côté devis).
          detail: type === 'factures' ? detail : undefined,
        }),
      })

      if (!res.ok) {
        let msg = `Erreur ${res.status}`
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          // pas de json (cas rare) — on garde le code
        }
        setError(msg)
        return
      }

      // Récupération + download forcé
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const today = new Date().toISOString().slice(0, 10)
      const filename = `export-${type}-${today}.csv`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Nettoyage différé (Safari iOS peut nécessiter un délai avant revoke)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      onClose()
    } catch (e) {
      setError((e as Error).message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fafbfc] border border-[#0f1a3a]/[0.08] flex items-center justify-center text-[#ff7a1a]">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] tracking-[-0.01em] leading-tight">
                Exporter en CSV
              </h2>
              <p className="font-hanken text-[12.5px] text-gray-500 mt-0.5">
                {labelCap} pour expert-comptable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-7 py-5 space-y-5">
          {/* Période */}
          <PremiumSelect
            label="Période"
            value={periode}
            onChange={(e) => setPeriode(e.target.value as Periode)}
          >
            <option value="mois">Mois en cours</option>
            <option value="trimestre">Trimestre en cours</option>
            <option value="annee">Année en cours</option>
            <option value="personnalise">Période personnalisée</option>
          </PremiumSelect>

          {periode === 'personnalise' && (
            <div className="grid grid-cols-2 gap-3">
              <PremiumInput
                label="Du"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
              <PremiumInput
                label="Au"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
          )}

          {/* Récap de la fenêtre auto */}
          {periode !== 'personnalise' && (
            <div className="bg-[#fafbfc] border border-[#0f1a3a]/[0.06] rounded-xl px-4 py-3">
              <p className="font-hanken text-[12px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Plage exportée
              </p>
              <p className="font-spline-mono text-[13px] text-[#0f1a3a]">
                Du {debutAuto.split('-').reverse().join('/')} au {finAuto.split('-').reverse().join('/')}
              </p>
            </div>
          )}

          {/* Format */}
          <PremiumSelect
            label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
          >
            <option value="csv-simple">CSV simple (Excel, expert-comptable)</option>
            <option value="fec" disabled>
              FEC (Fichier des Écritures Comptables) — bientôt
            </option>
          </PremiumSelect>

          <p className="font-hanken text-[12px] text-gray-500 leading-relaxed">
            Le fichier contient le numéro, la date, le client, le SIRET, l&apos;objet,
            les montants HT/TVA/TTC, le statut et la date de paiement. Compatible
            Excel français (UTF-8 + BOM, séparateur point-virgule).
          </p>

          {/* V3.1 — P5 : option détaillée multi-taux (factures uniquement). */}
          {type === 'factures' && (
            <label className="flex items-start gap-3 bg-[#fafbfc] border border-[#0f1a3a]/[0.06] rounded-xl px-4 py-3 cursor-pointer hover:border-[#ff7a1a]/40 transition-colors">
              <input
                type="checkbox"
                checked={detail}
                onChange={(e) => setDetail(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#ff7a1a] focus:ring-[#ff7a1a] cursor-pointer"
              />
              <div className="flex-1">
                <span className="block font-hanken text-[13.5px] font-semibold text-[#0f1a3a]">
                  Décomposer les factures multi-taux
                </span>
                <span className="block font-hanken text-[11.5px] text-gray-500 mt-0.5 leading-snug">
                  Décoche : factures multi-taux affichées sur 1 ligne avec mention « Multi-taux ».<br />
                  Coche : 1 ligne CSV par taux de TVA (recommandé pour l&apos;expert-comptable).
                </span>
              </div>
            </label>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="font-hanken text-[13px] text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-5 sm:px-7 pb-6 pt-2 border-t border-[#0f1a3a]/[0.06]">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-11 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white font-hanken font-semibold text-sm text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all disabled:opacity-50"
          >
            Annuler
          </button>
          <PremiumButton
            variant="primary"
            icon={<Download size={16} />}
            onClick={handleDownload}
            loading={loading}
            className="!h-11 !px-6"
          >
            {loading ? 'Génération...' : `Télécharger le CSV`}
          </PremiumButton>
        </div>
      </div>
    </div>
  )
}
