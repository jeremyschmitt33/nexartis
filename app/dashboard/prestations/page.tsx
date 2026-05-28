'use client'

import { useState } from 'react'
import { Search, Wrench, Plus, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { usePrestations, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'

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

export default function PrestationsPage() {
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
    if (!confirm(`Supprimer "${label}" ? Elle ne sera plus proposée en autocomplétion.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('prestations').delete().eq('id', id)
    if (error) {
      console.error('Erreur suppression prestation :', error)
    }
    refetch()
  }

  return (
    <div className="space-y-6">

      {/* Barre de recherche + bouton ajouter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="Rechercher parmi mes prestations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          onClick={() => { setNom(''); setFormError(null); setShowModal(true) }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouvelle prestation
        </button>
      </div>

      {/* Mes prestations enregistrées */}
      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <Wrench size={15} className="text-[#5ab4e0]" />
            <span className="text-sm font-syne font-bold text-[#1a1a2e]">Mes prestations enregistrées</span>
            <span className="ml-auto text-xs font-manrope text-gray-400">{prestations.length} prestation{prestations.length > 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-manrope text-gray-500 mb-1">Aucune prestation enregistrée pour l&apos;instant</p>
              <p className="text-xs font-manrope text-gray-400">
                Ajoutez des prestations depuis les suggestions ci-dessous,<br />
                ou créez-en via le bouton orange.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 p-4">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 bg-[#eef7fc] border border-[#5ab4e0] rounded-full text-sm font-manrope text-[#1a1a2e] group"
                >
                  <span>{p.designation}</span>
                  <button
                    onClick={() => handleDelete(p.id, p.designation)}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Supprimer"
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
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#e87a2a]" />
          <h3 className="text-sm font-syne font-bold text-[#1a1a2e]">Suggestions par métier</h3>
          <span className="text-xs font-manrope text-gray-400">— Cliquez sur « + » pour ajouter à vos prestations</span>
        </div>

        {SUGGESTIONS.map(({ categorie, emoji, items }) => {
          const isOpen = openCategories[categorie] ?? false
          const countAdded = items.filter(it => savedNoms.has(it.toLowerCase())).length

          return (
            <div key={categorie} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleCategory(categorie)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emoji}</span>
                  <span className="text-sm font-syne font-bold text-[#1a1a2e]">{categorie}</span>
                  {countAdded > 0 && (
                    <span className="text-xs font-manrope bg-[#eef7fc] text-[#5ab4e0] border border-[#5ab4e0] px-2 py-0.5 rounded-full">
                      {countAdded} ajoutée{countAdded > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap gap-2">
                  {items.map(item => {
                    const already = savedNoms.has(item.toLowerCase())
                    const isAdding = addingItem === item
                    return (
                      <button
                        key={item}
                        onClick={() => !already && addPrestation(item)}
                        disabled={already || isAdding}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-manrope border transition-all min-h-[44px] ${
                          already
                            ? 'bg-[#eef7fc] border-[#5ab4e0] text-[#5ab4e0] cursor-default'
                            : isAdding
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-wait'
                            : 'bg-white border-gray-200 text-[#1a1a2e] hover:border-[#5ab4e0] hover:bg-[#eef7fc] hover:text-[#5ab4e0] cursor-pointer'
                        }`}
                      >
                        {already ? (
                          <span className="text-[#5ab4e0] font-bold">✓</span>
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

      {/* Modal création manuelle */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">Nouvelle prestation</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formError && <ErrorBanner message={formError} />}
              <Input
                label="Désignation"
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex. : Salle de bain, Pose carrelage..."
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="h-10 px-5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-syne font-bold text-[#1a1a2e] transition-colors">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving || !nom.trim()} className="h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors">
                {saving ? 'Enregistrement...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
