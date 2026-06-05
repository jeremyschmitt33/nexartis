'use client'
// components/voice/VoiceResultScreen.tsx — V3.1
// Ecran de validation post-detection. Affiche :
//   - Le badge "Intent detectee" (devis, facture, planning) ou les 3 chips si unknown
//   - Un recap des champs principaux extraits
//   - Bouton "Ouvrir" qui redirige vers la bonne page pre-remplie
//   - Bouton "Recommencer" qui revient en idle
//
// Couleurs par intent (validees Phase 2) :
//   - devis    = gold (premium, valeur)
//   - facture  = orange (action engagee)
//   - planning = sky (temps, calendrier)

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Receipt, Calendar, HelpCircle, ArrowRight, RotateCcw } from 'lucide-react'
import type { VoiceCommandSuccessResponse, VoiceIntent } from '@/lib/voice/types'
import { VOICE_INTENT_CONFIDENCE_THRESHOLD } from '@/lib/voice/schema'
import { buildVoiceRedirectUrl, getIntentLabel } from '@/lib/voice/routeIntent'

interface VoiceResultScreenProps {
  result: VoiceCommandSuccessResponse
  onRetry: () => void
  onClose: () => void
}

const INTENT_VISUAL: Record<VoiceIntent, { icon: React.ElementType; bg: string; border: string; text: string; iconColor: string; label: string }> = {
  devis: {
    icon: FileText,
    bg: 'bg-gold/15',
    border: 'border-gold/40',
    text: 'text-navy',
    iconColor: 'text-gold',
    label: 'Devis',
  },
  facture: {
    icon: Receipt,
    bg: 'bg-orange/10',
    border: 'border-orange/40',
    text: 'text-navy',
    iconColor: 'text-orange',
    label: 'Facture',
  },
  planning: {
    icon: Calendar,
    bg: 'bg-sky/15',
    border: 'border-sky/40',
    text: 'text-navy',
    iconColor: 'text-sky',
    label: 'Planning',
  },
  unknown: {
    icon: HelpCircle,
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-700',
    iconColor: 'text-gray-500',
    label: 'Action non determinee',
  },
}

function summarizePayload(intent: VoiceIntent, payload: unknown): Array<{ label: string; value: string }> {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as Record<string, unknown>
  const items: Array<{ label: string; value: string }> = []

  // Champs communs
  const clientName = [p.client_civilite, p.client_prenom, p.client_nom].filter(Boolean).join(' ')
  if (clientName) items.push({ label: 'Client', value: clientName })
  if (p.client_ville) items.push({ label: 'Ville', value: String(p.client_ville) })
  if (p.client_telephone) items.push({ label: 'Telephone', value: String(p.client_telephone) })

  if (intent === 'devis' || intent === 'facture') {
    const lignes = Array.isArray(p.lignes) ? p.lignes : []
    if (lignes.length > 0) {
      items.push({ label: 'Prestations', value: `${lignes.length} ligne${lignes.length > 1 ? 's' : ''}` })
    }
    if (p.acompte_pourcentage) items.push({ label: 'Acompte', value: `${p.acompte_pourcentage}%` })
    if (p.tva_taux !== null && p.tva_taux !== undefined) items.push({ label: 'TVA', value: `${p.tva_taux}%` })
  }

  if (intent === 'facture') {
    if (p.facture_type) items.push({ label: 'Type', value: String(p.facture_type) })
    if (p.devis_ref) items.push({ label: 'Devis ref', value: String(p.devis_ref) })
  }

  if (intent === 'planning') {
    if (p.titre) items.push({ label: 'Titre', value: String(p.titre) })
    if (p.date_debut) items.push({ label: 'Date', value: String(p.date_debut) })
    if (p.evenement_type) items.push({ label: 'Type', value: String(p.evenement_type) })
  }

  return items
}

export default function VoiceResultScreen({ result, onRetry, onClose }: VoiceResultScreenProps) {
  const router = useRouter()
  const [forcedIntent, setForcedIntent] = useState<VoiceIntent | null>(null)

  const activeIntent: VoiceIntent = forcedIntent || result.intent
  const lowConfidence = result.confidence < VOICE_INTENT_CONFIDENCE_THRESHOLD
  const needsManualPick = activeIntent === 'unknown' || (lowConfidence && !forcedIntent)
  const visual = INTENT_VISUAL[activeIntent]
  const Icon = visual.icon

  const summary = summarizePayload(activeIntent, result.payload)

  const handleOpen = () => {
    const url = buildVoiceRedirectUrl(activeIntent, result.payload)
    if (!url) {
      // Pas de route pour 'unknown' : on demande de choisir
      return
    }
    onClose()
    router.push(url)
  }

  return (
    <div className="space-y-4">
      {/* Badge intent (ou selection manuelle si unknown / low confidence) */}
      {needsManualPick ? (
        <div>
          <p className="text-sm font-manrope text-navy mb-3">
            {activeIntent === 'unknown'
              ? "Je n'ai pas pu deviner ce que tu voulais. Choisis :"
              : "Pas tres sur de l'intent. Confirme ou corrige :"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['devis', 'facture', 'planning'] as const).map((i) => {
              const v = INTENT_VISUAL[i]
              const IconI = v.icon
              const isActive = forcedIntent === i || (!forcedIntent && result.intent === i && !lowConfidence)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setForcedIntent(i)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                    isActive
                      ? `${v.bg} ${v.border}`
                      : 'bg-white border-gray-200 hover:border-navy/30'
                  }`}
                  aria-pressed={isActive}
                >
                  <IconI size={24} className={isActive ? v.iconColor : 'text-gray-400'} aria-hidden />
                  <span className={`text-xs font-manrope font-semibold ${isActive ? v.text : 'text-gray-600'}`}>{v.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className={`flex items-center gap-3 ${visual.bg} ${visual.border} border-2 rounded-xl p-3`}>
          <Icon size={28} className={visual.iconColor} aria-hidden />
          <div className="flex-1">
            <p className={`font-syne font-bold ${visual.text}`}>{getIntentLabel(activeIntent)}</p>
            <p className="text-xs font-manrope text-navy/60">Confiance : {Math.round(result.confidence * 100)}%</p>
          </div>
          <button
            type="button"
            onClick={() => setForcedIntent('unknown')}
            className="text-xs font-manrope text-navy/60 underline hover:text-navy"
          >
            Modifier
          </button>
        </div>
      )}

      {/* Recap des donnees extraites */}
      {summary.length > 0 && (
        <div className="bg-cream/40 border border-cream rounded-xl p-3">
          <p className="text-xs font-manrope font-bold text-navy/70 mb-2 uppercase tracking-wide">Donnees detectees</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm font-manrope">
            {summary.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-2">
                <dt className="text-navy/60">{item.label}</dt>
                <dd className="text-navy font-semibold text-right truncate">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={activeIntent === 'unknown'}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-orange hover:bg-orange-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-manrope font-bold text-sm transition-all active:scale-95"
        >
          Ouvrir et completer
          <ArrowRight size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-white border-2 border-navy/20 hover:border-navy/40 text-navy font-manrope font-semibold text-sm transition-all active:scale-95"
        >
          <RotateCcw size={16} aria-hidden />
          Recommencer
        </button>
      </div>
    </div>
  )
}
