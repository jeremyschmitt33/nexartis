'use client'

// ---------------------------------------------------------------------------
// DocumentThemePicker
//
// Section "Apparence des devis & factures" : mockup WYSIWYG + liste des 6
// zones de couleur. Persiste les choix de l'utilisateur via l'API
// /api/parametres/document-theme (GET au mount, PATCH au changement debouncé).
//
// Architecture :
//   - DocumentMockup (aperçu cliquable)
//   - ColorZoneRow x6 (panneau de droite)
//   - bouton global "Réinitialiser toutes les couleurs"
//   - toast de confirmation/erreur (auto-close 2s)
//
// Aucune dépendance externe : color picker = <input type="color"> natif.
// Pas de localStorage : la persistence est uniquement DB.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_DOCUMENT_THEME,
  isValidHex,
} from '@/lib/document-theme'
import type { DocumentTheme } from '@/lib/document-theme'
import DocumentMockup from './DocumentMockup'
import type { ThemeZone } from './DocumentMockup'
import ColorZoneRow from './ColorZoneRow'
import type { ZoneMeta } from './ColorZoneRow'

// Ordre d'affichage : top→bottom du document (cohérence WYSIWYG avec le mockup)
const ZONES: ZoneMeta[] = [
  {
    id: 'bandeauHaut',
    label: "Bandeau d'en-tête",
    description: 'Le grand bandeau coloré en haut du devis qui contient le titre DEVIS, le numéro et la date.',
    defaultColor: DEFAULT_DOCUMENT_THEME.bandeauHaut,
  },
  {
    id: 'accent',
    label: "Couleur d'accent",
    description: "Les touches d'accent : diagonale en haut à droite, badge du numéro, trait sur la carte Émetteur.",
    defaultColor: DEFAULT_DOCUMENT_THEME.accent,
  },
  {
    id: 'cadreEmetteur',
    label: 'Carte Émetteur',
    description: "Le bloc qui affiche tes informations d'entreprise (nom, adresse, SIRET).",
    defaultColor: DEFAULT_DOCUMENT_THEME.cadreEmetteur,
  },
  {
    id: 'cadreAdresse',
    label: 'Carte Adressé à',
    description: 'Le bloc qui affiche les informations du client (nom, adresse, téléphone).',
    defaultColor: DEFAULT_DOCUMENT_THEME.cadreAdresse,
  },
  {
    id: 'netPayer',
    label: 'Encadré Net à payer',
    description: 'Le bloc qui met en avant le montant total à payer (TTC).',
    defaultColor: DEFAULT_DOCUMENT_THEME.netPayer,
  },
  {
    id: 'footer',
    label: 'Bandeau de pied',
    description: 'Le bandeau en bas du devis avec tes coordonnées (mentions légales, RCS, APE).',
    defaultColor: DEFAULT_DOCUMENT_THEME.footer,
  },
]

type ToastKind = 'success' | 'error' | null

interface ToastState {
  kind: ToastKind
  message: string
}

const DEBOUNCE_MS = 500
const TOAST_DURATION_MS = 2000

export default function DocumentThemePicker() {
  const [theme, setTheme] = useState<DocumentTheme>(DEFAULT_DOCUMENT_THEME)
  const [isLoading, setIsLoading] = useState(true)
  const [activeZone, setActiveZone] = useState<ThemeZone | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast] = useState<ToastState>({ kind: null, message: '' })

  // Refs pour le debounce : un timer par zone + le payload accumulé
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = useRef<Partial<DocumentTheme>>({})

  // ---- Toast helpers ----
  const showToast = useCallback((kind: Exclude<ToastKind, null>, message: string) => {
    setToast({ kind, message })
    setTimeout(() => setToast({ kind: null, message: '' }), TOAST_DURATION_MS)
  }, [])

  // ---- Fetch initial ----
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/parametres/document-theme', { method: 'GET' })
        if (!res.ok) throw new Error('http')
        const data = (await res.json()) as Partial<DocumentTheme>
        if (cancelled) return
        // Merge avec defaults — sécurité si l'API renvoie un champ manquant
        setTheme({
          bandeauHaut: isValidHex(data.bandeauHaut ?? '')
            ? (data.bandeauHaut as string)
            : DEFAULT_DOCUMENT_THEME.bandeauHaut,
          accent: isValidHex(data.accent ?? '')
            ? (data.accent as string)
            : DEFAULT_DOCUMENT_THEME.accent,
          cadreEmetteur: isValidHex(data.cadreEmetteur ?? '')
            ? (data.cadreEmetteur as string)
            : DEFAULT_DOCUMENT_THEME.cadreEmetteur,
          cadreAdresse: isValidHex(data.cadreAdresse ?? '')
            ? (data.cadreAdresse as string)
            : DEFAULT_DOCUMENT_THEME.cadreAdresse,
          netPayer: isValidHex(data.netPayer ?? '')
            ? (data.netPayer as string)
            : DEFAULT_DOCUMENT_THEME.netPayer,
          footer: isValidHex(data.footer ?? '')
            ? (data.footer as string)
            : DEFAULT_DOCUMENT_THEME.footer,
        })
      } catch {
        // Fallback silencieux aux defaults : l'utilisateur peut quand même
        // configurer son thème, le PATCH créera la ligne au premier changement.
        if (!cancelled) setTheme(DEFAULT_DOCUMENT_THEME)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- PATCH debounced ----
  const flushPatch = useCallback(async () => {
    const payload = pendingPatch.current
    pendingPatch.current = {}
    if (Object.keys(payload).length === 0) return
    try {
      const res = await fetch('/api/parametres/document-theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('http')
      showToast('success', 'Apparence enregistrée')
    } catch {
      showToast('error', 'Échec de sauvegarde, réessaie')
    }
  }, [showToast])

  const schedulePatch = useCallback(
    (zone: keyof DocumentTheme, value: string) => {
      pendingPatch.current[zone] = value
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        void flushPatch()
      }, DEBOUNCE_MS)
    },
    [flushPatch],
  )

  // ---- Handlers ----
  const handleZoneChange = (zone: ThemeZone, hex: string) => {
    if (!isValidHex(hex)) return
    setTheme((prev) => ({ ...prev, [zone]: hex }))
    schedulePatch(zone, hex)
  }

  const handleZoneClick = (zone: ThemeZone) => {
    setActiveZone(zone)
  }

  const handleResetZone = (zone: ThemeZone) => {
    handleZoneChange(zone, DEFAULT_DOCUMENT_THEME[zone])
  }

  const handleResetAll = async () => {
    setTheme(DEFAULT_DOCUMENT_THEME)
    // Annule tout patch en cours et envoie un patch unique avec tous les defaults
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    pendingPatch.current = {}
    setConfirmReset(false)
    try {
      const res = await fetch('/api/parametres/document-theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_DOCUMENT_THEME),
      })
      if (!res.ok) throw new Error('http')
      showToast('success', 'Couleurs réinitialisées')
    } catch {
      showToast('error', 'Échec de réinitialisation')
    }
  }

  // Cleanup timer au démontage (évite memory leak / fetch orphelin)
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // ---- Rendu skeleton pendant le fetch initial ----
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <div className="h-5 w-72 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-96 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid gap-5 md:grid-cols-[60%_40%]">
          <div className="h-[380px] animate-pulse rounded-xl bg-slate-100" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* En-tête */}
      <div className="mb-4">
        <h3 className="font-syne text-base font-bold text-navy">
          Apparence des devis &amp; factures
        </h3>
        <p className="mt-1 text-xs text-slate-500 font-manrope">
          Personnalise les 6 zones de couleur de tes documents. Le contraste du
          texte est calculé automatiquement pour rester lisible. Tes
          modifications sont enregistrées en temps réel.
        </p>
      </div>

      {/* Layout responsive : 2 colonnes desktop, empilé mobile */}
      <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Colonne gauche — mockup */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
          <DocumentMockup
            theme={theme}
            activeZone={activeZone}
            onZoneClick={handleZoneClick}
          />
        </div>

        {/* Colonne droite — liste des zones */}
        <div className="space-y-2">
          {ZONES.map((zone) => (
            <ColorZoneRow
              key={zone.id}
              zone={zone}
              value={theme[zone.id]}
              isActive={activeZone === zone.id}
              onChange={(hex) => handleZoneChange(zone.id, hex)}
              onActivate={() => setActiveZone(zone.id)}
              onReset={() => handleResetZone(zone.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer : bouton réinitialiser global */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-[11px] italic text-slate-400 font-manrope">
          Les changements s&apos;appliquent à tous tes nouveaux documents.
        </p>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-xs font-medium text-slate-500 underline-offset-2 transition-colors hover:text-orange hover:underline focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-1 rounded"
          >
            Réinitialiser toutes les couleurs
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-manrope">Confirmer ?</span>
            <button
              type="button"
              onClick={handleResetAll}
              className="rounded-md bg-orange px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-hover focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-1"
            >
              Oui, réinitialiser
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-1"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast.kind && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-opacity ${
            toast.kind === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.kind === 'success' ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  )
}
