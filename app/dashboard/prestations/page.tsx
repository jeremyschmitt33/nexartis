'use client'

import { useState } from 'react'
import { Search, Wrench, Plus, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { usePrestations, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

// La table `prestations` utilise `designation` comme libellé principal.
// Voir : SELECT * FROM information_schema.columns WHERE table_name='prestations'
interface PrestationRow {
  id: string
  designation: string
  unite?: string | null
  prix_unitaire_ht?: number | null
  taux_tva?: number | null
  categorie?: string | null
  tags?: string[] | null
  usage_count?: number | null
  created_at?: string | null
  updated_at?: string | null
}

// ─── Suggestions par catégorie de métier ───────────────────────────────────

const SUGGESTIONS: { categorie: string; emoji: string; items: string[] }[] = [
  {
    categorie: 'Électricité',
    emoji: '⚡',
    items: [
      'Installation tableau électrique',
      'Remplacement tableau électrique',
      'Mise aux normes électriques',
      'Installation prises de courant',
      'Installation interrupteurs',
      'Câblage / tirage de câbles',
      'Installation éclairage intérieur',
      'Installation éclairage extérieur',
      'Pose spots encastrés',
      'Installation VMC (ventilation)',
      'Installation chauffe-eau électrique',
      'Installation radiateurs électriques',
      'Domotique / automatisation',
      'Borne de recharge véhicule électrique',
      'Mise à la terre',
      'Diagnostic électrique',
      'Installation alarme / sécurité',
      'Sonette / interphone / visiophone',
    ],
  },
  {
    categorie: 'Plomberie',
    emoji: '🔧',
    items: [
      'Installation sanitaires (WC, lavabo, douche)',
      'Remplacement robinetterie',
      'Débouchage canalisations',
      'Réparation fuite d\'eau',
      'Installation chauffe-eau',
      'Installation adoucisseur d\'eau',
      'Remplacement chaudière',
      'Installation pompe à chaleur',
      'Pose radiateurs',
      'Travaux de plomberie générale',
    ],
  },
  {
    categorie: 'Maçonnerie / Gros œuvre',
    emoji: '🧱',
    items: [
      'Construction mur / cloison',
      'Démolition mur / cloison',
      'Ouverture de mur porteur',
      'Coulage dalle béton',
      'Ragréage sol',
      'Enduit / crépi extérieur',
      'Isolation thermique par l\'extérieur',
      'Réparation fissures',
      'Pose linteau',
      'Travaux de fondations',
    ],
  },
  {
    categorie: 'Menuiserie / Charpente',
    emoji: '🪵',
    items: [
      'Pose fenêtres double vitrage',
      'Pose porte d\'entrée',
      'Pose porte intérieure',
      'Installation volets roulants',
      'Pose parquet',
      'Pose escalier',
      'Travaux de charpente',
      'Pose Velux / fenêtre de toit',
      'Construction terrasse bois',
      'Pose pergola',
    ],
  },
  {
    categorie: 'Peinture / Revêtements',
    emoji: '🎨',
    items: [
      'Peinture intérieure',
      'Peinture extérieure',
      'Pose papier peint',
      'Pose carrelage / faïence',
      'Pose revêtement sol souple',
      'Pose parquet flottant',
      'Préparation des supports',
      'Ravalement de façade',
    ],
  },
  {
    categorie: 'Général / Tous corps d\'état',
    emoji: '🏠',
    items: [
      'Visite et diagnostic',
      'Devis travaux',
      'Fourniture et pose de matériel',
      'Main d\'œuvre',
      'Déplacement et frais de chantier',
      'Nettoyage fin de chantier',
      'Dépose / évacuation gravats',
      'Location nacelle / échafaudage',
      'Frais de déplacement',
      'Assistance technique',
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function PrestationsPage() {
  const confirm = useConfirm()
  const { data, loading, error, refetch } = usePrestations()
  const prestations = data as unknown as PrestationRow[]

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({ 'Électricité': true })
  const [addingItem, setAddingItem] = useState<string | null>(null)

  const savedNoms = new Set(prestations.map((p) => p.designation.toLowerCase()))

  const filtered = prestations.filter(
    (p) => !search || p.designation.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  // ⚠️ Fix C23 : on insère/lit désormais dans la table `prestations`
  // (anciennement par erreur dans `chantiers`, ce qui polluait la liste des
  // chantiers de l'artisan). Migration SQL associée : sql/create-prestations-table.sql

  const addPrestation = async (label: string) => {
    if (savedNoms.has(label.toLowerCase())) return
    setAddingItem(label)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('prestations').insert({
        designation: label,
        prix_unitaire_ht: 0, // Valeur par défaut, l'artisan ajustera dans le devis
        user_id: user.id,
      })
      if (error) {
        console.error('Erreur ajout prestation :', error)
      }
      refetch()
    } finally {
      setAddingItem(null)
    }
  }

  const handleCreate = async () => {
    if (!nom.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { error } = await supabase.from('prestations').insert({
        designation: nom.trim(),
        prix_unitaire_ht: 0,
        user_id: user.id,
      })
      if (error) throw error
      setShowModal(false)
      setNom('')
      refetch()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, label: string) => {
    if (!(await confirm({ title: `Supprimer "${label}" ?`, message: "Elle ne sera plus proposee en autocompletion.", variant: "danger", confirmLabel: "Supprimer" }))) return
    const supabase = createClient()
    const { error } = await supabase.from('prestations').delete().eq('id', id)
    if (error) {
      console.error('Erreur suppression prestation :', error)
    }
    refetch()
  }

  return (
    // ============ Page Prestations — V4 Light Premium ============
    // Header + barre de recherche + bouton primary V4. Carte "Mes prestations"
    // en pills bleu→orange, suggestions par métier en accordéons V4.
    <div className="space-y-6">
      {/* Header de page */}
      <div>
        <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
          Bibliothèque de prestations
        </h1>
        <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
          Vos prestations enregistrées et les suggestions par métier pour gagner du temps en devis
        </p>
      </div>

      {/* Barre de recherche + bouton ajouter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <input
            type="text"
            placeholder="Rechercher parmi mes prestations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                       placeholder:text-gray-400
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
        </div>
        <button
          onClick={() => { setNom(''); setFormError(null); setShowModal(true) }}
          className="
            inline-flex items-center justify-center gap-2
            h-11 px-5 rounded-xl
            bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
            text-white font-hanken font-bold text-sm tracking-[-0.01em]
            shadow-[0_6px_18px_rgba(255,122,26,0.32),_inset_0_1px_0_rgba(255,255,255,0.3)]
            hover:-translate-y-0.5 hover:brightness-105
            active:translate-y-0
            transition-all duration-200
          "
        >
          <Plus size={16} />
          Nouvelle prestation
        </button>
      </div>

      {/* Mes prestations enregistrées */}
      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div
          className="relative bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-hidden
                     shadow-[0_4px_16px_rgba(15,26,58,0.04),_0_1px_3px_rgba(15,26,58,0.04)]"
        >
          <div className="px-5 py-3.5 bg-[#fafbfc] border-b border-gray-100 flex items-center gap-2">
            <Wrench size={15} className="text-[#ff7a1a]" />
            <span className="font-hanken font-bold text-sm text-[#0f1a3a]">Mes prestations enregistrées</span>
            <span className="ml-auto font-spline-mono font-medium text-xs text-gray-400">
              {prestations.length} prestation{prestations.length > 1 ? 's' : ''}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-hanken text-sm text-gray-500 mb-1">Aucune prestation enregistrée pour l&apos;instant</p>
              <p className="font-hanken text-xs text-gray-400 leading-relaxed">
                Ajoutez des prestations depuis les suggestions ci-dessous,<br />
                ou créez-en via le bouton orange.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 p-5">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-br from-[#fff3e5] to-[#fff8ef]
                             border border-[#ff7a1a]/40 rounded-full font-hanken text-sm text-[#0f1a3a] group"
                >
                  <span>{p.designation}</span>
                  <button
                    onClick={() => handleDelete(p.id, p.designation)}
                    className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Supprimer"
                    aria-label={`Supprimer ${p.designation}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestions par métier */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles size={16} className="text-[#ff7a1a]" />
          <h3 className="font-hanken font-bold text-sm text-[#0f1a3a]">Suggestions par métier</h3>
          <span className="font-hanken text-xs text-gray-500">— Cliquez sur «&nbsp;+&nbsp;» pour ajouter à vos prestations</span>
        </div>

        {SUGGESTIONS.map(({ categorie, emoji, items }) => {
          const isOpen = openCategories[categorie] ?? false
          const countAdded = items.filter(it => savedNoms.has(it.toLowerCase())).length

          return (
            <div
              key={categorie}
              className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-hidden
                         shadow-[0_4px_16px_rgba(15,26,58,0.04),_0_1px_3px_rgba(15,26,58,0.04)]"
            >
              <button
                onClick={() => toggleCategory(categorie)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafbfc] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg" aria-hidden="true">{emoji}</span>
                  <span className="font-hanken font-bold text-sm text-[#0f1a3a]">{categorie}</span>
                  {countAdded > 0 && (
                    <span className="font-hanken font-semibold text-[11.5px] bg-gradient-to-br from-emerald-100/80 to-emerald-50
                                     text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                      <span className="font-spline-mono font-medium">{countAdded}</span> ajoutée{countAdded > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap gap-2 bg-[#fafbfc]/40">
                  {items.map(item => {
                    const already = savedNoms.has(item.toLowerCase())
                    const isAdding = addingItem === item
                    return (
                      <button
                        key={item}
                        onClick={() => !already && addPrestation(item)}
                        disabled={already || isAdding}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-hanken text-sm border-[1.5px] transition-all min-h-[40px] ${
                          already
                            ? 'bg-gradient-to-br from-emerald-100/80 to-emerald-50 border-emerald-200/60 text-emerald-700 cursor-default'
                            : isAdding
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-wait'
                            : 'bg-white border-gray-200 text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fff8ef] hover:text-[#ff7a1a] cursor-pointer'
                        }`}
                      >
                        {already ? (
                          <span className="text-emerald-600 font-bold">✓</span>
                        ) : (
                          <Plus size={12} />
                        )}
                        {item}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal création manuelle — V4 Light Premium */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-nouvelle-prestation"
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden
                       border border-[#0f1a3a]/[0.06]"
          >
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
            />
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 id="modal-title-nouvelle-prestation" className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.025em]">
                Nouvelle prestation
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-[#0f1a3a] transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && <ErrorBanner message={formError} />}
              <div>
                <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
                  Désignation
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Ex. : Salle de bain, Pose carrelage..."
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                             font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                             placeholder:text-gray-400
                             focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                             focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                             transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-[#fafbfc]/40">
              <button
                onClick={() => setShowModal(false)}
                className="h-11 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white
                           font-hanken font-semibold text-sm text-[#0f1a3a]
                           hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all duration-200"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !nom.trim()}
                className="
                  inline-flex items-center justify-center gap-2
                  h-11 px-5 rounded-xl
                  bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
                  text-white font-hanken font-bold text-sm tracking-[-0.01em]
                  shadow-[0_6px_18px_rgba(255,122,26,0.32),_inset_0_1px_0_rgba(255,255,255,0.3)]
                  hover:-translate-y-0.5 hover:brightness-105
                  active:translate-y-0
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                "
              >
                {saving ? 'Enregistrement…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
