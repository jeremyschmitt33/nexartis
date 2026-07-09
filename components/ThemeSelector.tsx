'use client'

import { useEffect, useState } from 'react'

// -------------------------------------------------------------------
// Sélecteur de thème de couleur pour la sidebar.
//
// L'utilisateur choisit parmi 8 couleurs préfabriquées (palette curatée
// pour rester pro et lisible). Le choix est stocké en localStorage sous
// la clé `nexartis-sidebar-theme` puis injecté en CSS variable
// `--nexartis-accent` sur <html>, ce qui change instantanément :
//   • la couleur du bouton "Créer" en haut de la sidebar
//   • la barre verticale d'item actif
//   • la couleur de l'item actif dans la nav mobile
// -------------------------------------------------------------------

// Palette de 14 thèmes pour la sidebar.
// Choix volontairement limité à des couleurs lisibles sur fond clair (le fond
// de la sidebar est ensuite assombri à 75%, donc chaque couleur reste sobre).
// Le blanc est exclu (illisible), le noir est rendu en "ardoise" (slate).
export const SIDEBAR_THEMES = [
  { id: 'orange', label: 'Orange (défaut)', color: '#e87a2a' },
  { id: 'blue', label: 'Bleu', color: '#2563eb' },
  { id: 'sky', label: 'Ciel', color: '#0284c7' },
  { id: 'teal', label: 'Turquoise', color: '#0d9488' },
  { id: 'green', label: 'Vert', color: '#059669' },
  { id: 'yellow', label: 'Jaune', color: '#ca8a04' },
  { id: 'red', label: 'Rouge', color: '#dc2626' },
  { id: 'rose', label: 'Rose', color: '#db2777' },
  { id: 'fuchsia', label: 'Fuchsia', color: '#c026d3' },
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { id: 'brown', label: 'Marron', color: '#8b5a2b' },
  { id: 'slate', label: 'Gris', color: '#475569' },
  { id: 'black', label: 'Noir', color: '#1e293b' },
] as const

export type SidebarThemeId = typeof SIDEBAR_THEMES[number]['id']

const STORAGE_KEY = 'nexartis-sidebar-theme'
const DEFAULT_THEME: SidebarThemeId = 'orange'

// ───── Helpers couleur ─────
// Convertit "#e87a2a" en [r, g, b] ints.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

// Assombrit une couleur en mélangeant avec du noir.
// amount = 0 → couleur d'origine, amount = 1 → noir pur.
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const dr = Math.round(r * (1 - amount))
  const dg = Math.round(g * (1 - amount))
  const db = Math.round(b * (1 - amount))
  return `#${[dr, dg, db].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

// Luminance perçue (formule simple, suffisante pour décider clair/foncé).
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Lit le thème stocké et l'applique sur <html>. À appeler au mount du dashboard. */
export function applySidebarTheme(themeId: SidebarThemeId | null = null): void {
  if (typeof window === 'undefined') return
  const id = themeId || (localStorage.getItem(STORAGE_KEY) as SidebarThemeId) || DEFAULT_THEME
  const theme = SIDEBAR_THEMES.find(t => t.id === id) || SIDEBAR_THEMES[0]

  // Couleur d'origine (utilisée pour les accents : bouton Créer, barre active...)
  document.documentElement.style.setProperty('--nexartis-accent', theme.color)

  // Fond de la sidebar : on assombrit la couleur à 75% pour rester foncé et lisible
  // même avec une couleur saturée comme jaune ou rouge. Sinon la sidebar entière
  // serait fluo et insupportable.
  const sidebarBg = darken(theme.color, 0.75)
  document.documentElement.style.setProperty('--nexartis-sidebar-bg', sidebarBg)

  // Le fond assombri à 75% est toujours foncé → texte blanc partout.
  // Mais si jamais on change la stratégie (ex: thème "blanc"), on calcule auto.
  const textColor = luminance(sidebarBg) > 0.5 ? '#0f172a' : '#ffffff'
  document.documentElement.style.setProperty('--nexartis-sidebar-text', textColor)
  // Version semi-transparente pour les textes secondaires (icônes inactives, etc.)
  const isLightText = textColor === '#ffffff'
  document.documentElement.style.setProperty(
    '--nexartis-sidebar-text-muted',
    isLightText ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)',
  )
  document.documentElement.style.setProperty(
    '--nexartis-sidebar-hover-bg',
    isLightText ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
  )
  document.documentElement.style.setProperty(
    '--nexartis-sidebar-active-bg',
    isLightText ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)',
  )
  document.documentElement.style.setProperty(
    '--nexartis-sidebar-border',
    isLightText ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
  )
}

/** Sauvegarde + applique un nouveau thème. */
export function setSidebarTheme(themeId: SidebarThemeId): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, themeId)
  applySidebarTheme(themeId)
}

/** Composant React : grille de boutons couleur a mettre dans la page Parametres. */
export default function ThemeSelector() {
  const [current, setCurrent] = useState<SidebarThemeId>(DEFAULT_THEME)

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as SidebarThemeId) || DEFAULT_THEME
    setCurrent(stored)
    applySidebarTheme(stored)
  }, [])

  const onSelect = (id: SidebarThemeId) => {
    setCurrent(id)
    setSidebarTheme(id)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h3 className="font-syne font-bold text-base text-[#1a1a2e]">Couleur de la sidebar</h3>
        <p className="text-xs text-[#6b7280] font-manrope mt-0.5">
          Personnalise la couleur de ta barre laterale. Le contraste du texte est calcule automatiquement.
          Le choix est sauvegarde sur ton appareil.
        </p>
      </div>
      {/* Carrés compacts qui s'enroulent sur 2 lignes si besoin, sans prendre
          plus de place que l'ancienne rangée unique de grands carrés. */}
      <div className="flex flex-wrap gap-2.5">
        {SIDEBAR_THEMES.map(theme => {
          const isActive = current === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelect(theme.id)}
              title={theme.label}
              aria-label={`Choisir le theme ${theme.label}`}
              className={`relative w-11 h-11 rounded-lg border-2 transition-all ${isActive ? 'border-[#1a1a2e] shadow-md scale-105' : 'border-transparent hover:border-gray-300 hover:scale-105'}`}
              style={{ backgroundColor: theme.color }}
            >
              {isActive && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-[#9ca3af] font-manrope mt-3 italic">
        Theme actuel : <span className="font-semibold text-[#1a1a2e]">{SIDEBAR_THEMES.find(t => t.id === current)?.label}</span>
      </p>
    </div>
  )
}
