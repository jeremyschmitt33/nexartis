'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Upload,
  Check,
  Users,
  FileText,
  Receipt,
  BookOpen,
  HardHat,
  Calendar,
  Wrench,
  Truck,
  UserCheck,
  CreditCard,
  ShoppingCart,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
} from 'lucide-react'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type SourceType = 'obat' | 'obat_comptable' | 'tolteck' | 'batappli' | 'henrri' | 'excel'

type DataCategory =
  | 'clients'
  | 'devis'
  | 'factures'
  | 'devis_lignes'
  | 'facture_lignes'
  | 'chantiers'
  | 'prestations'
  | 'fournisseurs'
  | 'intervenants'
  | 'planning'
  | 'paiements'
  | 'achats'

interface CategoryPreview {
  count: number
  data: Record<string, unknown>[]
  columns: string[]
}

interface ParseResponse {
  preview: Record<DataCategory, CategoryPreview>
  source: SourceType
  warnings: string[]
}

interface ExecuteResponse {
  success: boolean
  imported: Record<string, number>
  skipped: Record<string, number>
  errors: string[]
}

type DuplicateHandling = 'skip' | 'overwrite' | 'create_new'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

interface SourceOption {
  id: SourceType
  name: string
  format: string
  description: string
  exportGuide: string
}

const SOURCES: SourceOption[] = [
  {
    id: 'obat',
    name: 'Obat',
    format: '.csv',
    description: 'Logiciel de devis/factures BTP — export standard',
    exportGuide: 'Obat → Paramètres → Exporter mes données → Télécharger les CSV',
  },
  {
    id: 'obat_comptable',
    name: 'Obat (export comptable)',
    format: '.csv',
    description: 'Format comptable Obat — écritures regroupées automatiquement par devis/facture',
    exportGuide: 'Obat → Exports → Liste des devis ou Liste des factures (format pour expert-comptable). Reconnait les colonnes "Référence de la pièce justificative", "Numéro de compte", "Sens d\'écriture".',
  },
  {
    id: 'tolteck',
    name: 'Tolteck',
    format: '.csv',
    description: 'Logiciel artisan tout-en-un',
    exportGuide: 'Tolteck → Mon compte → Export de données → Télécharger',
  },
  {
    id: 'batappli',
    name: 'Batappli',
    format: '.csv / .xlsx',
    description: 'Gestion chantier & devis',
    exportGuide: 'Batappli → Outils → Export → Sélectionner les données → Exporter',
  },
  {
    id: 'henrri',
    name: 'Henrri',
    format: '.csv',
    description: 'Facturation gratuite',
    exportGuide: 'Henrri → Paramètres → Données → Exporter en CSV',
  },
  {
    id: 'excel',
    name: 'Excel / CSV',
    format: '.xlsx / .csv',
    description: 'Import générique depuis n\'importe quel fichier',
    exportGuide: 'Déposez directement vos fichiers Excel ou CSV. Les colonnes seront détectées automatiquement.',
  },
]

const STEP_LABELS = ['Source', 'Fichiers', 'Vérification', 'Import']

interface CategoryInfo {
  key: DataCategory
  label: string
  icon: typeof Users
  color: string
}

const CATEGORY_INFO: CategoryInfo[] = [
  { key: 'clients', label: 'Clients', icon: Users, color: 'text-blue-500' },
  { key: 'devis', label: 'Devis', icon: FileText, color: 'text-indigo-500' },
  { key: 'factures', label: 'Factures', icon: Receipt, color: 'text-green-500' },
  { key: 'devis_lignes', label: 'Lignes de devis', icon: FileText, color: 'text-indigo-400' },
  { key: 'facture_lignes', label: 'Lignes de factures', icon: Receipt, color: 'text-green-400' },
  { key: 'chantiers', label: 'Chantiers', icon: HardHat, color: 'text-orange-500' },
  { key: 'prestations', label: 'Prestations', icon: BookOpen, color: 'text-purple-500' },
  { key: 'fournisseurs', label: 'Fournisseurs', icon: Truck, color: 'text-red-500' },
  { key: 'intervenants', label: 'Intervenants', icon: UserCheck, color: 'text-teal-500' },
  { key: 'planning', label: 'Planning', icon: Calendar, color: 'text-cyan-500' },
  { key: 'paiements', label: 'Paiements', icon: CreditCard, color: 'text-emerald-500' },
  { key: 'achats', label: 'Achats', icon: ShoppingCart, color: 'text-amber-500' },
]

// -------------------------------------------------------------------
// Step indicator
// -------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1
        const isActive = step === currentStep
        const isCompleted = step < currentStep

        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-10 sm:w-20 h-0.5 ${
                  isCompleted || isActive ? 'bg-[#5ab4e0]' : 'bg-gray-200'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-syne font-bold transition-colors ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-[#5ab4e0] text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? <Check size={18} /> : step}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-manrope font-medium whitespace-nowrap ${
                  isActive ? 'text-[#1a1a2e]' : 'text-[#6b7280]'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------------
// Step 1 — Source selection
// -------------------------------------------------------------------

function Step1({
  selectedSource,
  onSelect,
  onNext,
}: {
  selectedSource: SourceType | null
  onSelect: (id: SourceType) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
        D&apos;où viennent vos données ?
      </h2>
      <p className="font-manrope text-[#6b7280] mb-8">
        Sélectionnez votre logiciel actuel pour importer automatiquement toutes vos données
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {SOURCES.map((src) => {
          const selected = selectedSource === src.id
          return (
            <button
              key={src.id}
              onClick={() => onSelect(src.id)}
              className={`bg-white rounded-xl border-2 p-6 text-left cursor-pointer transition-all duration-200 hover:border-[#5ab4e0] hover:shadow-md ${
                selected
                  ? 'border-[#5ab4e0] bg-[#5ab4e0]/5 shadow-md'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selected ? 'bg-[#5ab4e0]/20' : 'bg-gray-100'
                }`}>
                  <FileSpreadsheet size={22} className={selected ? 'text-[#5ab4e0]' : 'text-[#6b7280]'} />
                </div>
                <div>
                  <p className="font-syne font-bold text-[#1a1a2e]">{src.name}</p>
                  <p className="font-manrope text-xs text-[#6b7280]">{src.format}</p>
                </div>
              </div>
              <p className="font-manrope text-sm text-[#6b7280]">{src.description}</p>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          disabled={!selectedSource}
          onClick={onNext}
          className={`h-12 px-8 rounded-lg font-syne font-bold text-white transition-all flex items-center gap-2 ${
            selectedSource
              ? 'bg-[#e87a2a] hover:bg-[#f09050] cursor-pointer shadow-lg shadow-[#e87a2a]/20'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Suivant <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Step 2 — File upload (real)
// -------------------------------------------------------------------

function Step2({
  selectedSource,
  files,
  onFilesChange,
  parsing,
  parseError,
  onParse,
  onBack,
}: {
  selectedSource: SourceType | null
  files: File[]
  onFilesChange: (files: File[]) => void
  parsing: boolean
  parseError: string | null
  onParse: () => void
  onBack: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const sourceInfo = SOURCES.find(s => s.id === selectedSource)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    )
    if (droppedFiles.length > 0) {
      onFilesChange([...files, ...droppedFiles])
    }
  }, [files, onFilesChange])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      onFilesChange([...files, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  return (
    <div>
      <h2 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
        Déposez vos fichiers
      </h2>

      {/* Export guide */}
      {sourceInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-manrope text-sm text-blue-800 font-bold mb-1">
                Comment exporter depuis {sourceInfo.name} ?
              </p>
              <p className="font-manrope text-sm text-blue-700">
                {sourceInfo.exportGuide}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all mb-6 ${
          dragOver
            ? 'border-[#5ab4e0] bg-[#5ab4e0]/10'
            : 'border-gray-300 hover:border-[#5ab4e0] hover:bg-gray-50'
        }`}
      >
        <Upload size={40} className={`mx-auto mb-4 ${dragOver ? 'text-[#5ab4e0]' : 'text-[#6b7280]'}`} />
        <p className="font-manrope text-[#1a1a2e] font-medium mb-1">
          Glissez vos fichiers ici
        </p>
        <p className="font-manrope text-sm text-[#6b7280] mb-2">ou</p>
        <span className="font-manrope text-sm text-[#5ab4e0] font-bold cursor-pointer hover:underline">
          Parcourir vos fichiers
        </span>
        <p className="font-manrope text-xs text-[#6b7280] mt-4">
          Formats acceptés : .csv, .xlsx, .xls — Plusieurs fichiers possibles
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="font-syne font-bold text-sm text-[#1a1a2e] mb-3">
            {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={18} className="text-[#5ab4e0]" />
                  <div>
                    <span className="font-manrope text-sm text-[#1a1a2e] font-medium">{f.name}</span>
                    <span className="font-manrope text-xs text-[#6b7280] ml-2">{formatSize(f.size)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="font-manrope text-sm text-red-700">{parseError}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="h-12 px-8 rounded-lg font-syne font-bold text-[#6b7280] border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Retour
        </button>
        <button
          disabled={files.length === 0 || parsing}
          onClick={onParse}
          className={`h-12 px-8 rounded-lg font-syne font-bold text-white transition-all flex items-center gap-2 ${
            files.length > 0 && !parsing
              ? 'bg-[#e87a2a] hover:bg-[#f09050] cursor-pointer shadow-lg shadow-[#e87a2a]/20'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {parsing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              Analyser les fichiers <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Step 3 — Preview & verification
// -------------------------------------------------------------------

function Step3({
  preview,
  warnings,
  detectedSource,
  duplicateHandling,
  onDuplicateHandlingChange,
  categoriesToImport,
  onToggleCategory,
  onImport,
  importing,
  onBack,
}: {
  preview: Record<string, CategoryPreview>
  warnings: string[]
  detectedSource: SourceType
  duplicateHandling: DuplicateHandling
  onDuplicateHandlingChange: (v: DuplicateHandling) => void
  categoriesToImport: Set<DataCategory>
  onToggleCategory: (cat: DataCategory) => void
  onImport: () => void
  importing: boolean
  onBack: () => void
}) {
  const [expandedCategory, setExpandedCategory] = useState<DataCategory | null>(null)

  const totalItems = CATEGORY_INFO.reduce((sum, cat) => {
    const prev = preview[cat.key]
    return sum + (prev?.count || 0)
  }, 0)

  const selectedItems = CATEGORY_INFO.reduce((sum, cat) => {
    if (!categoriesToImport.has(cat.key)) return sum
    const prev = preview[cat.key]
    return sum + (prev?.count || 0)
  }, 0)

  const categoriesWithData = CATEGORY_INFO.filter(cat => preview[cat.key]?.count > 0)

  return (
    <div>
      <h2 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
        Vérification des données
      </h2>
      <p className="font-manrope text-[#6b7280] mb-6">
        Source détectée : <span className="font-bold text-[#1a1a2e]">{SOURCES.find(s => s.id === detectedSource)?.name}</span>
        {' — '}
        <span className="font-bold text-[#5ab4e0]">{totalItems} éléments</span> trouvés au total
      </p>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-syne font-bold text-sm text-amber-800 mb-1">Avertissements</p>
              <ul className="space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="font-manrope text-sm text-amber-700">• {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-3 mb-8">
        {categoriesWithData.map((cat) => {
          const prev = preview[cat.key]
          if (!prev || prev.count === 0) return null
          const Icon = cat.icon
          const isSelected = categoriesToImport.has(cat.key)
          const isExpanded = expandedCategory === cat.key

          return (
            <div key={cat.key} className={`bg-white rounded-xl border transition-all ${
              isSelected ? 'border-[#5ab4e0]' : 'border-gray-200 opacity-60'
            }`}>
              <div className="flex items-center gap-4 p-4">
                {/* Checkbox */}
                <button
                  onClick={() => onToggleCategory(cat.key)}
                  className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-[#5ab4e0] text-white' : 'bg-gray-200 text-transparent'
                  }`}
                >
                  <Check size={14} />
                </button>

                {/* Icon + info */}
                <Icon size={22} className={cat.color + ' flex-shrink-0'} />
                <div className="flex-1 min-w-0">
                  <p className="font-syne font-bold text-[#1a1a2e]">{cat.label}</p>
                  <p className="font-manrope text-sm text-[#6b7280]">
                    {prev.count} élément{prev.count > 1 ? 's' : ''} détecté{prev.count > 1 ? 's' : ''}
                  </p>
                </div>

                {/* Count badge */}
                <span className="font-syne font-bold text-lg text-[#5ab4e0] mr-2">{prev.count}</span>

                {/* Expand toggle */}
                {prev.data.length > 0 && (
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                    className="text-gray-400 hover:text-[#5ab4e0] transition-colors p-1"
                  >
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                )}
              </div>

              {/* Preview data */}
              {isExpanded && prev.data.length > 0 && (
                <div className="border-t border-gray-100 p-4">
                  <p className="font-manrope text-xs text-[#6b7280] mb-3 uppercase tracking-wider">
                    Aperçu ({Math.min(prev.data.length, 5)} premiers éléments)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {Object.keys(prev.data[0]).slice(0, 6).map(key => (
                            <th key={key} className="text-left font-manrope font-medium text-[#6b7280] py-2 px-3 whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prev.data.slice(0, 5).map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-50">
                            {Object.values(row).slice(0, 6).map((val, ci) => (
                              <td key={ci} className="font-manrope text-[#1a1a2e] py-2 px-3 whitespace-nowrap max-w-[200px] truncate">
                                {val != null ? String(val) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {categoriesWithData.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle size={40} className="mx-auto mb-4 text-amber-500" />
            <p className="font-syne font-bold text-[#1a1a2e] mb-2">Aucune donnée détectée</p>
            <p className="font-manrope text-sm text-[#6b7280]">
              Vérifiez que vos fichiers contiennent bien des données et sont au bon format.
            </p>
          </div>
        )}
      </div>

      {/* Duplicate handling */}
      {categoriesWithData.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-5 mb-8">
          <p className="font-syne font-bold text-sm text-[#1a1a2e] mb-3">
            Gestion des doublons
          </p>
          <p className="font-manrope text-xs text-[#6b7280] mb-4">
            Si un client, devis ou facture existe déjà dans Nexartis avec le même nom/numéro :
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { value: 'skip' as DuplicateHandling, label: 'Ignorer les doublons', desc: 'Ne pas importer les données qui existent déjà' },
              { value: 'overwrite' as DuplicateHandling, label: 'Écraser', desc: 'Remplacer les données existantes' },
              { value: 'create_new' as DuplicateHandling, label: 'Créer en double', desc: 'Importer même si ça existe déjà' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => onDuplicateHandlingChange(opt.value)}
                className={`flex-1 rounded-lg border-2 p-3 text-left transition-all ${
                  duplicateHandling === opt.value
                    ? 'border-[#5ab4e0] bg-white shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className={`font-manrope text-sm font-bold ${
                  duplicateHandling === opt.value ? 'text-[#5ab4e0]' : 'text-[#1a1a2e]'
                }`}>
                  {opt.label}
                </p>
                <p className="font-manrope text-xs text-[#6b7280] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="h-12 px-8 rounded-lg font-syne font-bold text-[#6b7280] border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Retour
        </button>

        <div className="flex items-center gap-4">
          {categoriesWithData.length > 0 && (
            <p className="font-manrope text-sm text-[#6b7280] hidden sm:block">
              <span className="font-bold text-[#5ab4e0]">{selectedItems}</span> éléments sélectionnés
            </p>
          )}
          <button
            disabled={selectedItems === 0 || importing}
            onClick={onImport}
            className={`h-14 px-10 rounded-lg font-syne font-bold text-white transition-all text-lg flex items-center gap-2 ${
              selectedItems > 0 && !importing
                ? 'bg-[#e87a2a] hover:bg-[#f09050] cursor-pointer shadow-lg shadow-[#e87a2a]/20'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {importing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                Lancer l&apos;import <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Step 4 — Results
// -------------------------------------------------------------------

function Step4({
  results,
  onReset,
}: {
  results: ExecuteResponse
  onReset: () => void
}) {
  const totalImported = Object.values(results.imported).reduce((a, b) => a + b, 0)
  const totalSkipped = Object.values(results.skipped).reduce((a, b) => a + b, 0)

  const categoriesImported = CATEGORY_INFO.filter(cat => (results.imported[cat.key] || 0) > 0)

  return (
    <div>
      {/* Success / Error header */}
      {results.success && results.errors.length === 0 ? (
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
            Import terminé avec succès !
          </h2>
          <p className="font-manrope text-[#6b7280]">
            <span className="font-bold text-green-600">{totalImported}</span> éléments importés
            {totalSkipped > 0 && (
              <>, <span className="font-bold text-amber-600">{totalSkipped}</span> ignorés</>
            )}
          </p>
        </div>
      ) : (
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full bg-amber-100 mx-auto mb-4 flex items-center justify-center">
            <AlertTriangle size={40} className="text-amber-500" />
          </div>
          <h2 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
            Import terminé avec des avertissements
          </h2>
          <p className="font-manrope text-[#6b7280]">
            <span className="font-bold text-green-600">{totalImported}</span> importés,
            {' '}<span className="font-bold text-amber-600">{totalSkipped}</span> ignorés,
            {' '}<span className="font-bold text-red-600">{results.errors.length}</span> erreur{results.errors.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Detail per category */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {categoriesImported.map(cat => {
          const Icon = cat.icon
          const count = results.imported[cat.key] || 0
          const skip = results.skipped[cat.key] || 0
          return (
            <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Icon size={24} className={`${cat.color} mx-auto mb-2`} />
              <p className="font-syne font-bold text-xl text-[#1a1a2e]">{count}</p>
              <p className="font-manrope text-xs text-[#6b7280]">{cat.label}</p>
              {skip > 0 && (
                <p className="font-manrope text-xs text-amber-600 mt-1">{skip} ignoré{skip > 1 ? 's' : ''}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Errors */}
      {results.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="font-syne font-bold text-sm text-red-800 mb-2">
            Erreurs rencontrées ({results.errors.length})
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {results.errors.map((err, i) => (
              <p key={i} className="font-manrope text-xs text-red-700">• {err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link
          href="/dashboard"
          className="h-12 px-8 rounded-lg font-syne font-bold text-white bg-[#5ab4e0] hover:bg-[#4a9bc4] transition-colors flex items-center justify-center gap-2"
        >
          Aller au tableau de bord <ArrowRight size={18} />
        </Link>
        <button
          onClick={onReset}
          className="h-12 px-8 rounded-lg font-syne font-bold text-[#6b7280] border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} /> Nouvel import
        </button>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Main page
// -------------------------------------------------------------------

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedSource, setSelectedSource] = useState<SourceType | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Record<string, CategoryPreview> | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [detectedSource, setDetectedSource] = useState<SourceType>('excel')
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>('skip')
  const [categoriesToImport, setCategoriesToImport] = useState<Set<DataCategory>>(new Set())
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ExecuteResponse | null>(null)

  // Parse files via API
  const handleParse = async () => {
    if (files.length === 0) return
    setParsing(true)
    setParseError(null)

    try {
      const formData = new FormData()
      formData.append('source', selectedSource || 'excel')
      for (const file of files) {
        formData.append('files', file)
      }

      const res = await fetch('/api/import/parse', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erreur lors de l\'analyse')
      }

      const data = (await res.json()) as ParseResponse
      setPreview(data.preview)
      setWarnings(data.warnings)
      setDetectedSource(data.source)

      // Auto-select all categories with data
      const cats = new Set<DataCategory>()
      for (const [key, val] of Object.entries(data.preview)) {
        if (val && (val as CategoryPreview).count > 0) {
          cats.add(key as DataCategory)
        }
      }
      setCategoriesToImport(cats)

      setCurrentStep(3)
    } catch (err) {
      setParseError((err as Error).message)
    } finally {
      setParsing(false)
    }
  }

  // Execute import via API
  const handleImport = async () => {
    if (!preview) return
    setImporting(true)

    try {
      // Build data payload with only selected categories' full data
      const importData: Record<string, unknown[]> = {}
      for (const cat of Array.from(categoriesToImport)) {
        const prev = preview[cat]
        if (prev && prev.count > 0) {
          importData[cat] = prev.data
        }
      }

      const res = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: importData,
          options: { duplicateHandling },
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erreur lors de l\'import')
      }

      const data = (await res.json()) as ExecuteResponse
      setResults(data)
      setCurrentStep(4)
    } catch (err) {
      setResults({
        success: false,
        imported: {},
        skipped: {},
        errors: [(err as Error).message],
      })
      setCurrentStep(4)
    } finally {
      setImporting(false)
    }
  }

  const toggleCategory = (cat: DataCategory) => {
    const next = new Set(categoriesToImport)
    if (next.has(cat)) {
      next.delete(cat)
    } else {
      next.add(cat)
    }
    setCategoriesToImport(next)
  }

  const handleReset = () => {
    setCurrentStep(1)
    setSelectedSource(null)
    setFiles([])
    setPreview(null)
    setWarnings([])
    setResults(null)
    setCategoriesToImport(new Set())
    setDuplicateHandling('skip')
    setParseError(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 && (
        <Step1
          selectedSource={selectedSource}
          onSelect={setSelectedSource}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && (
        <Step2
          selectedSource={selectedSource}
          files={files}
          onFilesChange={setFiles}
          parsing={parsing}
          parseError={parseError}
          onParse={handleParse}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && preview && (
        <Step3
          preview={preview}
          warnings={warnings}
          detectedSource={detectedSource}
          duplicateHandling={duplicateHandling}
          onDuplicateHandlingChange={setDuplicateHandling}
          categoriesToImport={categoriesToImport}
          onToggleCategory={toggleCategory}
          onImport={handleImport}
          importing={importing}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && results && (
        <Step4
          results={results}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
