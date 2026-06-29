'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LineSheet — bottom sheet d'édition/création d'une ligne (mobile)
// ─────────────────────────────────────────────────────────────────────────────
// Le cœur de la saisie mobile. Glisse depuis le bas via translate-y, overlay
// sombre tapable pour fermer, panneau scrollable, poignée drag visuelle.
// Champs énormes (h-14 / text-2xl) car on travaille un champ à la fois.
//
//   • Mode 'line'                  → désignation + Stepper qty + UnitChips + prix + total live
//   • Mode 'section' / 'subsection'→ uniquement désignation (placeholder adapté)
//   • Mode 'text'                  → textarea libre
//
// `onSaveAndNew` (optionnel) : enchaîne une nouvelle ligne après validation,
// sans fermer le sheet — flux "saisie rapide".
//
// Effet de bord : verrouille le scroll du body quand open === true.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import Stepper from './Stepper'
import UnitChips from './UnitChips'
import DesignationAutocomplete from '../DesignationAutocomplete'
import LineStatutSelect, { type InclusionStatut } from '../devis/LineStatut'
import type { PrestationSuggestion } from '@/lib/prestations-memo'

export interface SheetLine {
  id: number
  designation: string
  qty: number
  unit: string
  priceHT: number
  type: 'line' | 'section' | 'subsection' | 'text'
  // Champ optionnel : présent côté devis (TVA par ligne), absent côté facture
  tva?: number
  // Statut d'inclusion (devis uniquement) : ferme / facultatif / option
  inclusion?: InclusionStatut
}

interface LineSheetProps {
  open: boolean
  onClose: () => void
  line: SheetLine | null // null = mode création
  onSave: (line: SheetLine) => void
  onSaveAndNew?: (line: SheetLine) => void
  defaultUnit?: string
  unitOptions?: string[]
  // Type forcé si on crée une nouvelle ligne (depuis bouton "Section" par ex.)
  defaultType?: 'line' | 'section' | 'subsection' | 'text'
  // Anciennes prestations de l'artisan pour l'autocomplétion (mode 'line')
  prestations?: PrestationSuggestion[]
  // Auto-entrepreneur : force TVA à 0 lors d'une sélection de suggestion
  autoEntrepreneur?: boolean
  // Affiche le sélecteur de statut (Ferme/Facultatif/Option) — devis uniquement
  showStatut?: boolean
}

function formatCurrencyFR(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function LineSheet({
  open,
  onClose,
  line,
  onSave,
  onSaveAndNew,
  defaultUnit = 'U',
  unitOptions,
  defaultType = 'line',
  prestations,
  autoEntrepreneur = false,
  showStatut = false,
}: LineSheetProps) {
  // État local du form (réinitialisé à chaque ouverture)
  const [designation, setDesignation] = useState('')
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState(defaultUnit)
  const [priceHT, setPriceHT] = useState(0)
  const [type, setType] = useState<SheetLine['type']>(defaultType)
  // TVA par ligne (devis). undefined côté facture pour ne pas l'injecter dans le payload.
  const [tva, setTva] = useState<number | undefined>(undefined)
  // Statut d'inclusion (devis). 'ferme' par défaut.
  const [inclusion, setInclusion] = useState<InclusionStatut>('ferme')

  // Re-sync à chaque ouverture / changement de ligne
  useEffect(() => {
    if (!open) return
    if (line) {
      setDesignation(line.designation || '')
      setQty(line.qty ?? 1)
      setUnit(line.unit || defaultUnit)
      setPriceHT(line.priceHT ?? 0)
      setType(line.type)
      setTva(line.tva)
      setInclusion(line.inclusion ?? 'ferme')
    } else {
      // Mode création
      setDesignation('')
      setQty(defaultType === 'line' ? 1 : 0)
      setUnit(defaultUnit)
      setPriceHT(0)
      setType(defaultType)
      setTva(undefined)
      setInclusion('ferme')
    }
  }, [open, line, defaultUnit, defaultType])

  // Verrouillage scroll body
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Construction de l'objet à sauver (préserve les champs additionnels comme tva)
  const buildPayload = (): SheetLine => ({
    ...(line || {}),
    id: line?.id ?? Date.now(),
    designation: designation.trim(),
    qty: type === 'line' ? qty : 0,
    unit: type === 'line' ? unit : '',
    priceHT: type === 'line' ? priceHT : 0,
    type,
    // N'inclut la TVA QUE si elle est définie (devis) — préserve le comportement facture.
    ...(tva !== undefined ? { tva } : {}),
    // N'inclut le statut QUE côté devis (showStatut) — préserve le comportement facture.
    ...(showStatut ? { inclusion: type === 'line' ? inclusion : 'ferme' } : {}),
  })

  const handleSave = () => {
    onSave(buildPayload())
    onClose()
  }

  const handleSaveAndNew = () => {
    if (!onSaveAndNew) return
    onSaveAndNew(buildPayload())
    // On NE ferme PAS — le parent doit rouvrir un sheet vide
  }

  const totalLigne = qty * priceHT

  // ── Titre selon mode ──
  const sheetTitle = (() => {
    if (type === 'section') return line ? 'Modifier la section' : 'Nouvelle section'
    if (type === 'subsection') return line ? 'Modifier la sous-section' : 'Nouvelle sous-section'
    if (type === 'text') return line ? 'Modifier le texte' : 'Nouveau texte libre'
    return line ? 'Modifier la ligne' : 'Nouvelle ligne'
  })()

  const designationPlaceholder = (() => {
    if (type === 'section') return 'Nom de la section (ex : Demolition, Maconnerie...)'
    if (type === 'subsection') return 'Nom de la sous-section (ex : Cuisine, Plomberie...)'
    if (type === 'text') return 'Texte libre (note, remarque...)'
    return 'Ex : Installation prise de courant 16A'
  })()

  return (
    <>
      {/* Overlay sombre */}
      <div
        onClick={onClose}
        className={[
          'fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        aria-hidden="true"
      />

      {/* Panneau bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={sheetTitle}
        className={[
          'fixed left-0 right-0 bottom-0 z-[61] bg-white rounded-t-3xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          'max-h-[90vh] flex flex-col',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Poignée drag visuelle */}
        <div className="pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 bg-gray-300 rounded-full mx-auto" />
        </div>

        {/* Header sheet */}
        <div className="px-5 pt-2 pb-3 flex items-center justify-between shrink-0">
          <h3 className="font-syne font-extrabold text-[#0f1a3a] text-lg">{sheetTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full grid place-items-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="px-5 pb-4 space-y-5 overflow-y-auto flex-1">
          {/* Désignation — toujours présent */}
          <div>
            <label className="block text-[13px] font-semibold text-[#4b5563] mb-2 tracking-wide">
              {type === 'line' ? 'Désignation' : type === 'text' ? 'Texte' : 'Nom'}{' '}
              <span className="text-[#e87a2a]">*</span>
            </label>
            {type === 'line' ? (
              <DesignationAutocomplete
                value={designation}
                onChange={setDesignation}
                onPick={s => {
                  setDesignation(s.designation)
                  setUnit(s.unite)
                  setPriceHT(s.prix_unitaire_ht)
                  setTva(autoEntrepreneur ? 0 : s.taux_tva)
                }}
                suggestions={prestations || []}
                placeholder={designationPlaceholder}
                rows={3}
                className="w-full rounded-2xl border-2 border-[#5ab4e0]/40 px-4 py-3 text-base text-[#0f1a3a] font-medium outline-none focus:border-[#5ab4e0] focus:ring-4 focus:ring-[#5ab4e0]/15 transition-all bg-white placeholder:text-gray-400 placeholder:font-normal resize-none"
                autoFocus
              />
            ) : (
              <textarea
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder={designationPlaceholder}
                rows={2}
                className="w-full rounded-2xl border-2 border-[#5ab4e0]/40 px-4 py-3 text-base text-[#0f1a3a] font-medium outline-none focus:border-[#5ab4e0] focus:ring-4 focus:ring-[#5ab4e0]/15 transition-all bg-white placeholder:text-gray-400 placeholder:font-normal resize-none"
                autoFocus
              />
            )}
          </div>

          {/* Champs spécifiques au mode 'line' */}
          {type === 'line' && (
            <>
              {/* Quantité — Stepper */}
              <div>
                <label className="block text-[13px] font-semibold text-[#4b5563] mb-2 tracking-wide">
                  Quantité
                </label>
                <Stepper value={qty} onChange={setQty} min={0} step={1} />
              </div>

              {/* Unité — UnitChips */}
              <div>
                <label className="block text-[13px] font-semibold text-[#4b5563] mb-2 tracking-wide">
                  Unité
                </label>
                <UnitChips value={unit} onChange={setUnit} options={unitOptions} />
              </div>

              {/* Prix unitaire HT — gros input */}
              <div>
                <label className="block text-[13px] font-semibold text-[#4b5563] mb-2 tracking-wide">
                  Prix unitaire HT
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={priceHT}
                    onChange={e => setPriceHT(Number(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="w-full h-14 rounded-2xl border-2 border-[#5ab4e0]/40 pl-4 pr-12 text-2xl font-bold text-[#0f1a3a] text-right outline-none focus:border-[#5ab4e0] focus:ring-4 focus:ring-[#5ab4e0]/15 transition-all bg-white"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1a6fb5] font-bold text-xl pointer-events-none">
                    €
                  </span>
                </div>
              </div>

              {/* Total ligne live */}
              <div className="bg-[#1a6fb5] text-white rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider opacity-90">
                  Total ligne
                </span>
                <span className="font-syne font-extrabold text-2xl">
                  {formatCurrencyFR(totalLigne)}
                </span>
              </div>

              {/* Statut d'inclusion — devis uniquement */}
              {showStatut && (
                <div>
                  <label className="block text-[13px] font-semibold text-[#4b5563] mb-2 tracking-wide">
                    Le client peut-il modifier cette ligne ?
                  </label>
                  <LineStatutSelect value={inclusion} onChange={setInclusion} size="lg" />
                  <p className="mt-2 text-[12px] text-gray-500 leading-snug">
                    {inclusion === 'ferme'
                      ? 'Ferme : toujours inclus, le client ne peut pas le retirer.'
                      : inclusion === 'facultatif'
                      ? 'Facultatif : inclus par défaut, le client peut le retirer.'
                      : 'Option + : pas inclus, le client peut l’ajouter.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer sticky avec actions */}
        <div className="px-5 pt-3 pb-6 border-t border-gray-100 bg-white shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-2xl border-2 border-gray-200 font-syne font-bold text-gray-600 active:scale-[.97] transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-12 rounded-2xl bg-[#e87a2a] text-white font-syne font-bold active:scale-[.97] shadow-md hover:bg-[#f09050] transition-all"
            >
              Valider
            </button>
          </div>

          {/* Lien "Valider et ajouter" — uniquement en mode line + handler fourni */}
          {type === 'line' && onSaveAndNew && (
            <button
              type="button"
              onClick={handleSaveAndNew}
              className="w-full text-center text-sm font-semibold text-[#1a6fb5] underline py-2 active:opacity-70"
            >
              + Valider et ajouter une autre ligne
            </button>
          )}
        </div>
      </div>
    </>
  )
}
