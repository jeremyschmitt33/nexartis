'use client'

/**
 * PlanPalette — Palette d'outils à libellés, FILTRÉE PAR PROFIL MÉTIER
 * (Push 3a → 3b). Extraite de PlanEditor (limite 450 lignes).
 *
 * Groupes : Dessin / Ouvertures / [symboles du métier actif] / Extérieur.
 * Le groupe Extérieur (Push 3b) est proposé à TOUS les profils : Terrasse,
 * Piscine, Pelouse (zones cat 'ext' via la modale pièce), Clôture (polyligne
 * ouverte) et Portail (symbole projeté sur la clôture la plus proche).
 * `outilsMobiles` fournit la même liste à la barre mobile de PlanEditor.
 */

import type { TypeExterieur, TypeOuverture } from '@/lib/plan/types'
import { PROFILS, profilDe, type MetierId } from '@/lib/plan/profils'
import { labelSymbole } from '@/lib/plan/symboles'
import { IconeSymbole } from './SymboleSvg'
import type { Outil } from './PlanCanvas'

export const OUTILS_OUVERTURE: { key: TypeOuverture; label: string }[] = [
  { key: 'porte', label: 'Porte' },
  { key: 'fenetre', label: 'Fenêtre' },
  { key: 'porte_fenetre', label: 'Porte-fenêtre' },
  { key: 'baie', label: 'Baie vitrée' },
]

export interface GroupeSymboles {
  titre: string
  outils: { key: Outil; label: string; sym: string }[]
}

/** Groupes de symboles proposés pour une vue métier donnée. */
export function groupesSymboles(metier: MetierId): GroupeSymboles[] {
  const versOutils = (types: readonly string[]) =>
    types.map((t) => ({ key: `sym:${t}` as Outil, label: labelSymbole(t), sym: t }))
  if (metier === 'tce') {
    return [
      { titre: PROFILS.electricien.label, outils: versOutils(PROFILS.electricien.symboles) },
      { titre: PROFILS.plombier.label, outils: versOutils(PROFILS.plombier.symboles) },
      { titre: PROFILS.chauffagiste.label, outils: versOutils(PROFILS.chauffagiste.symboles) },
    ]
  }
  const profil = profilDe(metier)
  if (profil.symboles.length === 0) return []
  return [{ titre: profil.label, outils: versOutils(profil.symboles) }]
}

/** Zones extérieures (SURFACES sans murs). La nature est portée par l'OUTIL,
 *  jamais par le nom : chaque entrée pose son sous-type explicitement. */
export const ZONES_EXTERIEURES: { extType: TypeExterieur; label: string; icone: string }[] = [
  { extType: 'terrasse', label: 'Terrasse', icone: 'Terrasse' },
  { extType: 'piscine', label: 'Piscine', icone: 'Piscine' },
  { extType: 'pelouse', label: 'Pelouse', icone: 'Pelouse' },
  { extType: 'allee', label: 'Allée', icone: 'Allee' },
  { extType: 'autre_ext', label: 'Autre extérieur', icone: 'Autre' },
]

/** Liste plate pour la barre d'outils mobile (portail inclus, Push 3b). */
export function outilsMobiles(metier: MetierId): { key: Outil; label: string }[] {
  return [
    { key: 'select', label: 'Sélection' },
    ...OUTILS_OUVERTURE.map((o) => ({ key: o.key as Outil, label: o.label })),
    ...groupesSymboles(metier).flatMap((g) => g.outils.map((o) => ({ key: o.key, label: o.label }))),
    { key: 'sym:portail', label: 'Portail' },
  ]
}

function IconeOutil({ type }: { type: Outil }) {
  const common = {
    className: 'h-4 w-4 flex-shrink-0',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  }
  if (type === 'select')
    return (
      <svg {...common}>
        <path d="M5 3l14 8-6 2-3 6-5-16z" strokeLinejoin="round" />
      </svg>
    )
  if (type === 'porte')
    return (
      <svg {...common}>
        <path d="M3 21h18M5 21V4h9" />
        <path d="M14 4a9 9 0 017 9" strokeDasharray="3 3" />
        <path d="M21 13v8" />
      </svg>
    )
  if (type === 'fenetre')
    return (
      <svg {...common}>
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <path d="M4 12h16M12 6v12" />
      </svg>
    )
  if (type === 'porte_fenetre')
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="1" />
        <path d="M12 3v18M5 12h14" />
      </svg>
    )
  return (
    <svg {...common}>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M8 6v12M16 6v12" />
    </svg>
  )
}

/** Icônes du groupe Extérieur (tracés repris de la maquette V2.1 validée). */
function IconeExt({ type }: { type: string }) {
  const common = {
    className: 'h-4 w-4 flex-shrink-0',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (type === 'Terrasse')
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="M7.5 5v14M12 5v14M16.5 5v14" />
      </svg>
    )
  if (type === 'Piscine')
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M6 10.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 2-1 3 0" />
        <path d="M6 15c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 2-1 3 0" />
      </svg>
    )
  if (type === 'Pelouse')
    return (
      <svg {...common}>
        <path d="M7 20v-6c0-2-1-3.5-2.5-4.5M12 20v-8c0-2.5-1-4.5-3-6M12 20v-8c0-2.5 1-4.5 3-6M17 20v-6c0-2 1-3.5 2.5-4.5" />
      </svg>
    )
  if (type === 'Allee')
    return (
      <svg {...common}>
        <path d="M8 3L5 21M16 3l3 18" />
        <path d="M6.5 9h11M5.7 15h12.6" />
      </svg>
    )
  if (type === 'Cloture')
    return (
      <svg {...common}>
        <path d="M5 21V8l1.5-2.5L8 8v13M16 21V8l1.5-2.5L19 8v13" />
        <path d="M2 12h20M2 17h20" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M3 21V9M21 21V9" />
      <path d="M3 9c3-2.4 5.6-3.5 9-3.5S18 6.6 21 9" />
      <path d="M3 13h18M3 17h18M12 21V5.5" />
    </svg>
  )
}

export interface PlanPaletteProps {
  metier: MetierId
  outil: Outil
  onOutil: (outil: Outil) => void
  onAjouterPiece: () => void
  /** Ouvre la modale avec une SURFACE extérieure du sous-type donné. */
  onZoneExt: (extType: TypeExterieur) => void
  /** Démarre le tracé d'une clôture (polyligne ouverte). */
  onCloture: () => void
  /** Démarre le tracé d'une bordure (polyligne ouverte, ml). */
  onBordure: () => void
  /** Démarre le tracé d'une tranchée (polyligne ouverte, ml + volume). */
  onTranchee: () => void
  /** Démarre le tracé d'un mur extérieur / façade (polyligne + hauteur). */
  onMur: () => void
}

export default function PlanPalette({ metier, outil, onOutil, onAjouterPiece, onZoneExt, onCloture, onBordure, onTranchee, onMur }: PlanPaletteProps) {
  const groupes = groupesSymboles(metier)

  const bouton = (key: Outil, label: string, icone: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => onOutil(key)}
      aria-pressed={outil === key}
      className={`flex w-full items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold transition-colors ${
        outil === key ? 'border-orange bg-orange/5 text-orange' : 'border-transparent text-navy hover:bg-gray-50'
      }`}
    >
      {icone}
      <span className="truncate">{label}</span>
    </button>
  )

  const titre = (t: string) => (
    <span key={`t-${t}`} className="px-2 pt-2 font-hanken text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
      {t}
    </span>
  )

  const outilSym = outil.startsWith('sym:')

  return (
    <aside
      className="hidden w-44 flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-white p-2 sm:flex"
      aria-label="Outils du plan"
    >
      <span className="px-2 pt-1 font-hanken text-[10.5px] font-bold uppercase tracking-wider text-gray-400">Dessin</span>
      <button
        type="button"
        onClick={onAjouterPiece}
        className="flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-2.5 py-2 text-left font-hanken text-[12.5px] font-bold text-white shadow-[0_4px_12px_rgba(255,122,26,0.3)] transition-all hover:brightness-105"
      >
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter une pièce
      </button>
      {bouton('select', 'Sélection', <IconeOutil type="select" />)}

      {titre('Ouvertures')}
      {OUTILS_OUVERTURE.map((o) => bouton(o.key, o.label, <IconeOutil type={o.key} />))}

      {groupes.map((g) => (
        <div key={g.titre} className="flex flex-col gap-1">
          {titre(g.titre)}
          {g.outils.map((o) =>
            bouton(o.key, o.label, <IconeSymbole type={o.sym} className="h-4 w-4 flex-shrink-0" />)
          )}
        </div>
      ))}

      {titre('Extérieur')}
      {ZONES_EXTERIEURES.map((z) => (
        <button
          key={z.extType}
          type="button"
          onClick={() => onZoneExt(z.extType)}
          className="flex w-full items-center gap-2 rounded-xl border-[1.5px] border-transparent px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold text-navy transition-colors hover:bg-gray-50"
        >
          <IconeExt type={z.icone} />
          <span className="truncate">{z.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onCloture}
        className="flex w-full items-center gap-2 rounded-xl border-[1.5px] border-transparent px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold text-navy transition-colors hover:bg-gray-50"
      >
        <IconeExt type="Cloture" />
        <span className="truncate">Clôture / grillage</span>
      </button>
      <button
        type="button"
        onClick={onBordure}
        className="flex w-full items-center gap-2 rounded-xl border-[1.5px] border-transparent px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold text-navy transition-colors hover:bg-gray-50"
      >
        <IconeExt type="Cloture" />
        <span className="truncate">Bordure</span>
      </button>
      <button
        type="button"
        onClick={onTranchee}
        className="flex w-full items-center gap-2 rounded-xl border-[1.5px] border-transparent px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold text-navy transition-colors hover:bg-gray-50"
      >
        <IconeExt type="Cloture" />
        <span className="truncate">Tranchée</span>
      </button>
      <button
        type="button"
        onClick={onMur}
        className="flex w-full items-center gap-2 rounded-xl border-[1.5px] border-transparent px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold text-navy transition-colors hover:bg-gray-50"
      >
        <IconeExt type="Cloture" />
        <span className="truncate">Mur extérieur</span>
      </button>
      {bouton('sym:portail', 'Portail', <IconeExt type="Portail" />)}

      {outil !== 'select' && (
        <p className="mx-1 mt-1 rounded-lg bg-sky/10 px-2 py-1.5 font-hanken text-[11px] leading-snug text-navy">
          {outil === 'sym:portail'
            ? 'Cliquez sur une clôture pour y poser le portail.'
            : outilSym
              ? 'Cliquez dans une pièce pour poser le symbole — posez-en plusieurs à la suite, Échap pour terminer.'
              : "Cliquez dans une pièce, près du mur qui recevra l'ouverture."}
        </p>
      )}
    </aside>
  )
}
