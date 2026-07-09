'use client'

// ---------------------------------------------------------------------------
// ThemeTemplateGallery (V3.0d.1)
//
// Grille de templates prédéfinis affichée AU-DESSUS du mockup et du picker
// dans la section "Apparence des devis & factures".
//
// - 13 templates (Nexartis par défaut + 12 palettes Claude Design)
// - Le premier ("Nexartis (par défaut)") sert également de bouton reset
// - Clic sur une card = applique les 6 couleurs d'un coup (1 seul PATCH API)
// - Le template actif (correspondance exacte) est surligné en orange
// - Si l'utilisateur personnalise une zone après, aucun template n'est actif
//
// Card visuelle : preview "bandeau navy + bande orange" en miniature, qui
// rappelle le rendu réel du devis. Nom affiché en bas, font-manrope.
// ---------------------------------------------------------------------------

import { THEME_PRESETS, type ThemePreset } from '@/lib/document-theme-presets'
import type { DocumentTheme } from '@/lib/document-theme'

interface Props {
  /** Thème courant (utilisé pour highlight le template actif) */
  currentTheme: DocumentTheme
  /** Id du template actif (calculé par le parent via findActivePresetId) */
  activePresetId: string | null
  /** Callback appelé au clic sur une card */
  onApply: (preset: ThemePreset) => void
}

export default function ThemeTemplateGallery({
  currentTheme: _currentTheme,
  activePresetId,
  onApply,
}: Props) {
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="font-syne text-sm font-bold text-navy">
          Choisis un style prédéfini
        </h4>
        <p className="text-[11px] italic text-slate-500 font-manrope">
          Clique pour appliquer · tu peux toujours personnaliser après
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Styles prédéfinis pour les documents"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {THEME_PRESETS.map((preset) => {
          const isActive = preset.id === activePresetId
          const isDefault = preset.id === 'nexartis-defaut'
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`Appliquer le style ${preset.nom}`}
              onClick={() => onApply(preset)}
              className={`group relative flex flex-col overflow-hidden rounded-lg border-2 bg-white text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2 ${
                isActive
                  ? 'border-orange ring-2 ring-orange/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Mini preview : bandeau coloré + bande accent en biais */}
              <div className="relative h-14 w-full overflow-hidden">
                {/* Zone DROITE (variante bandeauHautDroite) = fond principal,
                    c'est la grande zone "DEVIS" du vrai document. */}
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: preset.theme.bandeauHautDroite }}
                />
                {/* Zone GAUCHE (bandeauHaut, foncee) en trapeze, cote logo/emetteur */}
                <div
                  className="absolute inset-y-0 left-0 w-[62%]"
                  style={{
                    backgroundColor: preset.theme.bandeauHaut,
                    clipPath: 'polygon(0 0, 100% 0, 74% 100%, 0 100%)',
                  }}
                />
                {/* Barre accent (doree) en biais, a la separation des 2 zones */}
                <div
                  className="absolute inset-y-0 left-[55%] w-1.5"
                  style={{
                    backgroundColor: preset.theme.accent,
                    transform: 'skewX(-20deg)',
                  }}
                />
                {/* Mini "carte" blanche pour rappeler la carte Émetteur */}
                <div className="absolute bottom-1 left-1.5 h-3.5 w-9 rounded-sm bg-white/95 shadow-sm" />
                {/* Mini badge "DEVIS" */}
                <div className="absolute right-2.5 top-1.5 z-10 text-[7px] font-bold uppercase tracking-wider text-white opacity-90">
                  Devis
                </div>

                {/* Checkmark si actif */}
                {isActive && (
                  <div className="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-orange shadow">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}

                {/* Badge "Reset" sur Nexartis par défaut */}
                {isDefault && !isActive && (
                  <div className="absolute left-1 top-1 z-20 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-700 shadow">
                    Reset
                  </div>
                )}
              </div>

              {/* Nom + 2 pastilles couleur */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <span
                  className={`flex-1 truncate text-[11px] font-medium font-manrope ${
                    isActive ? 'text-navy' : 'text-slate-700'
                  }`}
                  title={preset.nom}
                >
                  {preset.nom}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <span
                    className="h-3 w-3 rounded-full border border-slate-200"
                    style={{ backgroundColor: preset.theme.bandeauHaut }}
                    aria-hidden="true"
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-slate-200"
                    style={{ backgroundColor: preset.theme.bandeauHautDroite }}
                    aria-hidden="true"
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-slate-200"
                    style={{ backgroundColor: preset.theme.accent }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
