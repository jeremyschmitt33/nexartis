'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LineStatut — sélecteur de statut d'inclusion d'une ligne de devis
// ─────────────────────────────────────────────────────────────────────────────
// 3 statuts, choisis par l'artisan sur chaque ligne :
//   • ferme      → toujours inclus, le client ne peut pas le retirer
//   • facultatif → inclus par défaut, le client peut le décocher (retirer)
//   • option     → pas inclus par défaut, le client peut le cocher (ajouter)
//
// Correspondance base de données (devis_lignes) :
//   ferme      → optionnel=false
//   facultatif → optionnel=true,  inclus_par_defaut=true
//   option     → optionnel=true,  inclus_par_defaut=false
// ─────────────────────────────────────────────────────────────────────────────

export type InclusionStatut = 'ferme' | 'facultatif' | 'option'

// Statut React -> colonnes base de données
export function inclusionToDb(s: InclusionStatut): { optionnel: boolean; inclus_par_defaut: boolean } {
  return { optionnel: s !== 'ferme', inclus_par_defaut: s !== 'option' }
}

// Colonnes base de données -> statut React
export function dbToInclusion(optionnel?: boolean | null, inclusParDefaut?: boolean | null): InclusionStatut {
  if (!optionnel) return 'ferme'
  return inclusParDefaut === false ? 'option' : 'facultatif'
}

const OPTIONS: { key: InclusionStatut; label: string; active: string }[] = [
  { key: 'ferme', label: 'Ferme', active: 'bg-[#0f1a3a] text-white border-[#0f1a3a]' },
  { key: 'facultatif', label: 'Facultatif', active: 'bg-[#e87a2a] text-white border-[#e87a2a]' },
  { key: 'option', label: 'Option +', active: 'bg-[#2f6fb0] text-white border-[#2f6fb0]' },
]

export default function LineStatutSelect({
  value,
  onChange,
  size = 'sm',
}: {
  value: InclusionStatut
  onChange: (s: InclusionStatut) => void
  size?: 'sm' | 'lg'
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 overflow-hidden"
      role="group"
      aria-label="Statut de la ligne"
    >
      {OPTIONS.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`font-hanken font-semibold text-center border-r last:border-r-0 border-gray-200 transition-colors ${
            size === 'lg' ? 'px-3 py-2 text-sm min-w-[88px]' : 'px-2 py-1.5 text-[11px] min-w-[68px]'
          } ${value === o.key ? o.active : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
