'use client'
// components/voice/VoiceCommandModal.tsx — V3.1
// Modal universel orchestrant le pipeline complet :
//   idle -> recording (avec waveform) -> processing -> result | error
// Reutilisable depuis n'importe ou via VoiceProvider.

import React, { useEffect, useRef, useState } from 'react'
import { X, Mic, MicOff, Keyboard } from 'lucide-react'
import { useVoiceCommand } from '@/hooks/voice/useVoiceCommand'
import { useAudioLevel } from '@/hooks/voice/useAudioLevel'
import VoiceWaveform from './VoiceWaveform'
import VoiceErrorCard from './VoiceErrorCard'
import VoiceResultScreen from './VoiceResultScreen'
import { VOICE_MAX_RECORDING_SEC, VOICE_WARN_RECORDING_SEC } from '@/lib/voice/types'

interface VoiceCommandModalProps {
  open: boolean
  onClose: () => void
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoiceCommandModal({ open, onClose }: VoiceCommandModalProps) {
  const vc = useVoiceCommand()
  const levels = useAudioLevel(vc.stream, { bars: 5 })
  const [textMode, setTextMode] = useState(false)
  const [textInput, setTextInput] = useState('')
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Reset complet a la fermeture
  useEffect(() => {
    if (!open) {
      vc.reset()
      setTextMode(false)
      setTextInput('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Focus trap : focus initial sur le bouton close
  useEffect(() => {
    if (open && closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
  }, [open])

  // Echap pour fermer (sauf si en cours d'enregistrement, pour eviter perte audio par accident)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && vc.step !== 'recording' && vc.step !== 'processing') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, vc.step, onClose])

  if (!open) return null

  const isWarn = vc.elapsedSec >= VOICE_WARN_RECORDING_SEC
  const isMax = vc.elapsedSec >= VOICE_MAX_RECORDING_SEC

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/80 backdrop-blur-md p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-5 sm:p-6 border-b border-gray-100">
          <div>
            <h3 id="voice-modal-title" className="font-syne font-bold text-xl text-navy">
              Commande vocale
            </h3>
            <p className="text-xs font-manrope text-gray-500 mt-1">
              Dis ce que tu veux faire : un devis, une facture, un rendez-vous.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={vc.step === 'recording' || vc.step === 'processing'}
            className="p-2 -m-2 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Fermer la commande vocale"
          >
            <X size={22} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          {!vc.isSupported ? (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-manrope text-red-700">
                Ton navigateur ne supporte pas l&apos;enregistrement audio. Mets-le a jour ou utilise Chrome / Safari recent.
              </p>
            </div>
          ) : textMode ? (
            // ===== Mode texte (fallback si micro KO) =====
            <div className="space-y-4" aria-live="polite">
              <p className="text-sm font-manrope text-navy">
                Tape ta commande comme si tu la disais a voix haute :
              </p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder='Exemple : "Fais-moi un devis pour M. Dupont, pose de 30 m2 de carrelage a 50 euros le metre carre, acompte 30 pour cent"'
                rows={5}
                maxLength={4000}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-sm font-manrope outline-none focus:border-sky focus:ring-2 focus:ring-sky/20 transition-all bg-white resize-none"
                aria-label="Texte de la commande vocale"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => vc.submitText(textInput)}
                  disabled={textInput.trim().length < 3 || vc.step === 'processing'}
                  className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-orange hover:bg-orange-hover disabled:bg-gray-300 text-white font-manrope font-bold text-sm transition-all active:scale-95"
                >
                  {vc.step === 'processing' ? 'Analyse...' : 'Analyser'}
                </button>
                <button
                  type="button"
                  onClick={() => setTextMode(false)}
                  className="px-4 py-3 min-h-[48px] rounded-xl bg-white border-2 border-navy/20 text-navy font-manrope font-semibold text-sm transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : vc.step === 'error' ? (
            <VoiceErrorCard
              message={vc.errorMessage || 'Erreur inconnue'}
              onRetry={() => { vc.reset() }}
              onSwitchToText={() => { vc.reset(); setTextMode(true) }}
              showTextFallback
            />
          ) : vc.step === 'result' && vc.result ? (
            <VoiceResultScreen
              result={vc.result}
              onRetry={() => vc.reset()}
              onClose={onClose}
            />
          ) : (
            // ===== Mode normal : idle / recording / processing =====
            <div className="space-y-5" aria-live="polite">
              {/* Bouton micro central */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={vc.step === 'recording' ? vc.stopRecording : vc.startRecording}
                  disabled={vc.step === 'processing'}
                  aria-label={vc.step === 'recording' ? "Arreter l'enregistrement" : "Demarrer l'enregistrement"}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    vc.step === 'recording'
                      ? 'bg-red-500 shadow-[0_0_0_10px_rgba(239,68,68,0.18)] animate-pulse'
                      : vc.step === 'processing'
                        ? 'bg-gray-300 cursor-wait'
                        : 'bg-gradient-to-br from-orange to-orange-hover shadow-[0_10px_24px_-6px_rgba(232,122,42,0.5)] hover:scale-105'
                  }`}
                >
                  {vc.step === 'recording' ? (
                    <MicOff size={36} className="text-white" aria-hidden />
                  ) : vc.step === 'processing' ? (
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                  ) : (
                    <Mic size={36} className="text-white" aria-hidden />
                  )}
                </button>

                {/* Timer + indication */}
                <div className="mt-4 text-center min-h-[56px]">
                  {vc.step === 'recording' && (
                    <>
                      <p
                        className={`font-hanken font-bold text-2xl tabular-nums ${
                          isMax ? 'text-red-600' : isWarn ? 'text-orange' : 'text-red-500'
                        }`}
                        aria-live="polite"
                      >
                        {formatTime(vc.elapsedSec)}
                        <span className="text-sm font-manrope text-navy/50"> / {VOICE_MAX_RECORDING_SEC}s</span>
                      </p>
                      <p className="text-xs font-manrope text-gray-500 mt-0.5">
                        {isWarn ? 'Bientot la limite, conclus !' : 'Parle, touche le micro pour stopper'}
                      </p>
                    </>
                  )}
                  {vc.step === 'processing' && (
                    <p className="text-sm font-manrope text-navy">L&apos;IA analyse ta dictee...</p>
                  )}
                  {vc.step === 'idle' && (
                    <p className="text-sm font-manrope text-gray-500">Touche le micro pour commencer</p>
                  )}
                </div>
              </div>

              {/* Waveform */}
              {vc.step === 'recording' && (
                <VoiceWaveform levels={levels} mode="recording" />
              )}

              {/* Conseils */}
              {vc.step === 'idle' && (
                <div className="bg-sky/10 border border-sky/30 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-xs font-manrope font-bold text-navy uppercase tracking-wide">Tu peux dire :</p>
                  <ul className="text-xs font-manrope text-navy/80 leading-relaxed space-y-1">
                    <li>&laquo; Fais-moi un devis pour M. Dupont, pose de 30 m2 de carrelage a 50 euros le metre carre &raquo;</li>
                    <li>&laquo; Facture le devis 2026-042 pour Mme Martin, acompte 30% &raquo;</li>
                    <li>&laquo; Ajoute un rdv mardi 14h chez Bernard pour un devis terrasse &raquo;</li>
                  </ul>
                  <p className="text-[11px] font-manrope text-navy/50 pt-1 border-t border-sky/20">
                    Limite : 20 secondes max par dictee (offre gratuite).
                  </p>
                </div>
              )}

              {/* Fallback texte (toujours accessible depuis idle) */}
              {vc.step === 'idle' && (
                <button
                  type="button"
                  onClick={() => setTextMode(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-manrope text-navy/60 hover:text-navy transition-colors"
                >
                  <Keyboard size={14} aria-hidden />
                  Pas de micro ? Tape ta commande
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
