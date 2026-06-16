'use client'
// components/parametres/LogoThemeProposals.tsx — V3.1
// Analyse les couleurs dominantes du logo de l'artisan et propose 2 themes
// auto-generes. L'artisan clique pour appliquer en 1 click.

import { useState, useMemo } from 'react'
import { useEntreprise } from '@/lib/hooks'
import { useDominantColors, type DominantColor } from '@/hooks/useDominantColors'
import type { DocumentTheme } from '@/lib/document-theme'
import { Sparkles, Check, Loader2 } from 'lucide-react'

interface LogoBasedTheme {
  id: 'logo-1' | 'logo-2'
  nom: string
  theme: DocumentTheme
}

function darken(rgb: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.max(0, Math.round(rgb[0] * (1 - factor))),
    Math.max(0, Math.round(rgb[1] * (1 - factor))),
    Math.max(0, Math.round(rgb[2] * (1 - factor))),
  ]
}

function rgbToHex(rgb: [number, number, number]): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

/**
 * Construit 2 propositions de theme a partir des couleurs dominantes du logo.
 * - Proposition 1 : gauche = couleur la plus foncee, droite = 2e couleur, accent = couleur vive
 * - Proposition 2 : gauche = couleur la plus vive assombrie, droite = autre couleur, accent = couleur originale
 */
function buildLogoThemes(colors: DominantColor[]): LogoBasedTheme[] | null {
  if (colors.length < 2) return null

  // Tri par luminance croissante (foncees en premier)
  const sortedByLum = [...colors].sort((a, b) => a.luminance - b.luminance)
  // Tri par saturation decroissante (vives en premier)
  const sortedBySat = [...colors].sort((a, b) => b.saturation - a.saturation)

  // Proposition 1 : couleurs foncees pour les bandeaux, couleur vive pour l'accent
  const dark1 = sortedByLum[0]
  const dark2 = sortedByLum.length > 1 ? sortedByLum[1] : sortedByLum[0]
  const vivid1 = sortedBySat[0]
  const theme1: DocumentTheme = {
    bandeauHaut: dark1.hex,
    bandeauHautDroite: dark2.hex !== dark1.hex ? dark2.hex : rgbToHex(darken(dark1.rgb, -0.3) as [number, number, number]),
    accent: vivid1.hex,
    cadreEmetteur: '#ffffff',
    cadreAdresse: dark1.hex,
    netPayer: vivid1.hex,
    footer: dark1.hex,
  }

  // Proposition 2 : inverse - gauche vive assombrie, droite autre couleur, accent vive originale
  const vivid2 = sortedBySat[0]
  const otherDark = sortedByLum.length > 2 ? sortedByLum[2] : sortedByLum[1] || sortedByLum[0]
  const vividDark = rgbToHex(darken(vivid2.rgb, 0.5))
  const theme2: DocumentTheme = {
    bandeauHaut: vividDark,
    bandeauHautDroite: otherDark.hex !== vividDark ? otherDark.hex : dark1.hex,
    accent: vivid2.hex,
    cadreEmetteur: '#ffffff',
    cadreAdresse: vividDark,
    netPayer: vivid2.hex,
    footer: vividDark,
  }

  return [
    { id: 'logo-1', nom: 'Proposition 1 - Sobre', theme: theme1 },
    { id: 'logo-2', nom: 'Proposition 2 - Audacieuse', theme: theme2 },
  ]
}

function ThemeCard({ proposal, onApply, applying }: {
  proposal: LogoBasedTheme
  onApply: () => void
  applying: boolean
}) {
  const t = proposal.theme
  return (
    <button
      type="button"
      onClick={onApply}
      disabled={applying}
      className="group relative overflow-hidden rounded-xl border-2 border-gray-200 hover:border-orange transition-all text-left p-0 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-wait"
    >
      {/* Preview du bandeau bicolore */}
      <div className="relative h-20" style={{ background: t.bandeauHaut }}>
        <div
          className="absolute inset-0"
          style={{
            background: t.bandeauHautDroite,
            clipPath: 'polygon(54% 0, 100% 0, 100% 100%, 46% 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: t.accent,
            clipPath: 'polygon(50% 0, 54% 0, 46% 100%, 42% 100%)',
          }}
        />
        <div className="absolute top-2 left-2 text-white text-[10px] font-bold font-syne opacity-80">LOGO</div>
        <div className="absolute top-2 right-2 text-white text-[10px] font-extrabold font-syne">DEVIS</div>
      </div>
      {/* Footer card : label + couleurs */}
      <div className="bg-white p-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-syne font-bold text-sm text-navy">{proposal.nom}</p>
          <div className="flex gap-1 mt-1.5">
            <span className="w-4 h-4 rounded border border-gray-200" style={{ background: t.bandeauHaut }} title={t.bandeauHaut} />
            <span className="w-4 h-4 rounded border border-gray-200" style={{ background: t.bandeauHautDroite }} title={t.bandeauHautDroite} />
            <span className="w-4 h-4 rounded border border-gray-200" style={{ background: t.accent }} title={t.accent} />
          </div>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange/10 text-orange text-xs font-manrope font-semibold group-hover:bg-orange group-hover:text-white transition-colors">
          {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Appliquer
        </div>
      </div>
    </button>
  )
}

export default function LogoThemeProposals() {
  const { entreprise } = useEntreprise()
  const logoUrl = (entreprise as { logo_url?: string } | null)?.logo_url
  const { colors, loading, error } = useDominantColors(logoUrl)
  const [applying, setApplying] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const proposals = useMemo(() => buildLogoThemes(colors), [colors])

  const applyTheme = async (theme: DocumentTheme, id: string) => {
    setApplying(id)
    try {
      const res = await fetch('/api/parametres/document-theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      })
      if (res.ok) {
        setApplied(true)
        // On garde l'onglet Apparence apres le rechargement : la page Parametres
        // lit le hash de l'URL au montage (voir parametres/page.tsx). Evite de
        // retomber sur l'onglet Entreprise apres l'application d'un theme.
        if (typeof window !== 'undefined') window.location.hash = 'apparence'
        // Rechargement pour que le DocumentThemePicker relise le theme applique.
        setTimeout(() => window.location.reload(), 600)
      }
    } catch {
      // silent
    } finally {
      setApplying(null)
    }
  }

  if (!logoUrl) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="text-orange shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-syne font-bold text-base text-navy">Themes inspires de ton logo</h3>
            <p className="text-sm font-manrope text-navy/70 mt-1">
              Ajoute ton logo plus haut sur cette page, et le systeme te proposera automatiquement 2 themes assortis aux couleurs de ta marque.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-orange/20 bg-gradient-to-br from-orange/5 to-transparent p-5">
      <div className="flex items-start gap-3 mb-4">
        <Sparkles className="text-orange shrink-0 mt-0.5" size={22} />
        <div className="flex-1">
          <h3 className="font-syne font-bold text-base text-navy">Themes inspires de ton logo</h3>
          <p className="text-sm font-manrope text-navy/70 mt-1">
            Le systeme a analyse les couleurs dominantes de ton logo et propose 2 themes pour tes devis et factures. Clique sur celui qui te plait.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm font-manrope text-navy/60">
          <Loader2 size={16} className="animate-spin" />
          Analyse des couleurs du logo en cours...
        </div>
      )}

      {error && (
        <p className="text-sm font-manrope text-red-600">{error}</p>
      )}

      {!loading && !error && !proposals && colors.length > 0 && (
        <p className="text-sm font-manrope text-navy/60 italic">
          Le logo contient une seule couleur dominante - propositions impossibles. Choisis manuellement un style ci-dessous.
        </p>
      )}

      {applied && (
        <p className="text-sm font-manrope text-green-700 font-semibold mb-3">✓ Theme applique, rechargement...</p>
      )}

      {proposals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {proposals.map((p) => (
            <ThemeCard
              key={p.id}
              proposal={p}
              applying={applying === p.id}
              onApply={() => applyTheme(p.theme, p.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
