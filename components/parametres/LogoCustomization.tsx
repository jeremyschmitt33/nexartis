'use client'
// components/parametres/LogoCustomization.tsx — V3.1
// Section "Personnalisation du logo" dans Apparence.
// Permet a l'artisan de configurer : style d'incrustation + taille logo + taille nom.
// Preview live a cote des controles.

import { useState, useEffect, useCallback } from 'react'
import { useEntreprise } from '@/lib/hooks'
import {
  DEFAULT_LOGO_CONFIG,
  LOGO_STYLE_LABELS,
  LOGO_STYLE_DESCRIPTIONS,
  logoConfigFromEntreprise,
  type LogoConfig,
  type LogoStyle,
} from '@/lib/logo-config'
import { createClient } from '@/lib/supabase/client'
import { Image as ImageIcon, Check, Loader2, RotateCcw } from 'lucide-react'

const STYLES: LogoStyle[] = ['carte-classique', 'carte-minimaliste', 'sans-carte']

export default function LogoCustomization() {
  const { entreprise } = useEntreprise()
  const initialConfig = logoConfigFromEntreprise(entreprise)
  const [config, setConfig] = useState<LogoConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Resync si l'entreprise est rechargée
  useEffect(() => {
    if (entreprise) setConfig(logoConfigFromEntreprise(entreprise))
  }, [entreprise])

  const logoUrl = (entreprise as { logo_url?: string } | null)?.logo_url
  const nomEntreprise = (entreprise as { nom_entreprise?: string } | null)?.nom_entreprise || 'Mon Entreprise'
  const metier = (entreprise as { metier?: string } | null)?.metier || 'Artisan'

  // Auto-save apres 600ms d'inactivite
  const saveConfig = useCallback(async (newConfig: LogoConfig) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('entreprises')
        .update({
          doc_logo_style: newConfig.style,
          doc_logo_size: newConfig.logoSize,
          doc_nom_size: newConfig.nomSize,
        })
        .eq('user_id', user.id)
      if (!error) {
        setSavedAt(Date.now())
      }
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    if (JSON.stringify(config) === JSON.stringify(initialConfig)) return
    const t = setTimeout(() => saveConfig(config), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const reset = () => setConfig(DEFAULT_LOGO_CONFIG)

  // === Calcul du preview en fonction de la config ===
  const previewCardBase = config.style === 'carte-minimaliste' ? 70 : 100
  const previewCardSize = Math.round((previewCardBase * config.logoSize) / 100)
  const previewNomSize = Math.round((26 * config.nomSize) / 100)
  const previewCardBg = config.style === 'sans-carte' ? 'transparent' : '#ffffff'
  const previewCardShadow = config.style === 'sans-carte' ? 'none' : config.style === 'carte-minimaliste' ? '0 1px 3px rgba(0,0,0,.12)' : '0 2px 8px rgba(0,0,0,.18)'
  const previewCardPadding = config.style === 'sans-carte' ? 0 : config.style === 'carte-minimaliste' ? 4 : 6
  const previewCardRadius = config.style === 'carte-minimaliste' ? 12 : 20

  return (
    <div className="rounded-xl border-2 border-navy/15 bg-slate-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <ImageIcon className="text-navy shrink-0 mt-0.5" size={22} aria-hidden />
          <div>
            <h3 className="font-syne font-bold text-base text-navy">Personnalisation du logo</h3>
            <p className="text-sm font-manrope text-navy/70 mt-1">
              Choisis comment ton logo apparait sur tes devis et factures. Les changements sont sauvegardes automatiquement.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-navy/50" />}
          {!saving && savedAt && <Check size={16} className="text-green-600" />}
          <button
            type="button"
            onClick={reset}
            className="text-xs font-manrope text-navy/60 underline hover:text-navy inline-flex items-center gap-1"
          >
            <RotateCcw size={12} aria-hidden />
            Reinitialiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* === COLONNE GAUCHE : controles === */}
        <div className="space-y-5">
          {/* Selecteur de style */}
          <div>
            <label className="block text-sm font-manrope font-semibold text-navy mb-2">
              Style d&apos;incrustation
            </label>
            <div className="space-y-2">
              {STYLES.map((s) => (
                <label
                  key={s}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    config.style === s
                      ? 'border-orange bg-orange/5 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="logo-style"
                    value={s}
                    checked={config.style === s}
                    onChange={() => setConfig({ ...config, style: s })}
                    className="mt-0.5 accent-orange"
                  />
                  <div>
                    <p className="font-syne font-bold text-sm text-navy">{LOGO_STYLE_LABELS[s]}</p>
                    <p className="text-xs font-manrope text-navy/60 mt-0.5">{LOGO_STYLE_DESCRIPTIONS[s]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Slider taille logo */}
          <div>
            <label className="flex items-center justify-between text-sm font-manrope font-semibold text-navy mb-2">
              <span>Taille du logo</span>
              <span className="text-xs font-manrope text-navy/60 tabular-nums">{config.logoSize}%</span>
            </label>
            <input
              type="range"
              min={60}
              max={200}
              step={5}
              value={config.logoSize}
              onChange={(e) => setConfig({ ...config, logoSize: parseInt(e.target.value) })}
              className="w-full accent-orange"
              aria-label="Taille du logo en pourcentage"
            />
            <div className="flex justify-between text-[10px] font-manrope text-navy/40 mt-1">
              <span>60% (petit)</span>
              <span>100% (standard)</span>
              <span>200% (geant)</span>
            </div>
          </div>

          {/* Slider taille nom entreprise */}
          <div>
            <label className="flex items-center justify-between text-sm font-manrope font-semibold text-navy mb-2">
              <span>Taille du nom d&apos;entreprise</span>
              <span className="text-xs font-manrope text-navy/60 tabular-nums">{config.nomSize}%</span>
            </label>
            <input
              type="range"
              min={60}
              max={200}
              step={5}
              value={config.nomSize}
              onChange={(e) => setConfig({ ...config, nomSize: parseInt(e.target.value) })}
              className="w-full accent-orange"
              aria-label="Taille du nom de l'entreprise en pourcentage"
            />
            <div className="flex justify-between text-[10px] font-manrope text-navy/40 mt-1">
              <span>60% (compact)</span>
              <span>100% (standard)</span>
              <span>200% (geant)</span>
            </div>
          </div>
        </div>

        {/* === COLONNE DROITE : preview live === */}
        <div>
          <p className="text-xs font-manrope font-semibold text-navy/60 uppercase tracking-wide mb-2">Apercu en direct</p>
          <div className="rounded-xl overflow-hidden border-2 border-gray-200">
            <div
              className="relative overflow-hidden"
              style={{
                background: '#15233b',
                padding: '28px 20px 50px',
                minHeight: '140px',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: '#3856a8',
                  clipPath: 'polygon(54% 0, 100% 0, 100% 100%, 46% 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: '#dd9138',
                  clipPath: 'polygon(50% 0, 54% 0, 46% 100%, 42% 100%)',
                }}
              />
              <div className="relative z-10 flex items-center gap-4">
                <div
                  style={{
                    width: `${previewCardSize}px`,
                    height: `${previewCardSize}px`,
                    background: previewCardBg,
                    borderRadius: `${previewCardRadius}px`,
                    padding: `${previewCardPadding}px`,
                    boxShadow: previewCardShadow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div className="text-navy text-xs font-bold">LOGO</div>
                  )}
                </div>
                <div>
                  <p
                    className="font-syne font-extrabold text-white leading-tight"
                    style={{ fontSize: `${previewNomSize}px` }}
                  >
                    {nomEntreprise}
                  </p>
                  <p className="text-white/70 text-xs mt-1">{metier}</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] font-manrope text-navy/50 italic mt-2 text-center">
            Cet apercu utilise les couleurs &laquo; Bleu nuit / Ambre &raquo;. Tes vraies couleurs s&apos;appliqueront sur les vrais documents.
          </p>
        </div>
      </div>
    </div>
  )
}
