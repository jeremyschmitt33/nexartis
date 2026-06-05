'use client'
// hooks/voice/useAudioLevel.ts — V3.1
// Hook qui transforme un MediaStream en niveaux audio echantillonnes pour
// alimenter une visualisation type waveform.
//
// Technique : Web Audio API AnalyserNode (gratuit, 0 KB de bundle, 60fps natif,
// supporte par tous les navigateurs modernes y compris iOS Safari).

import { useEffect, useRef, useState } from 'react'

export interface UseAudioLevelOptions {
  /** Nombre de barres affichees dans la waveform (par defaut 5) */
  bars?: number
  /** Reactivite du suivi (0 = nouveau echantillon immediat, 0.9 = lissage fort) */
  smoothing?: number
}

/**
 * Renvoie un tableau de N valeurs entre 0 et 1 representant les niveaux audio
 * actuels (mis a jour ~60 fois par seconde via requestAnimationFrame).
 *
 * Quand stream est null, renvoie un tableau de 0 (etat repos).
 */
export function useAudioLevel(
  stream: MediaStream | null,
  options: UseAudioLevelOptions = {},
): number[] {
  const { bars = 5, smoothing = 0.8 } = options
  const [levels, setLevels] = useState<number[]>(() => Array(bars).fill(0))

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    if (!stream) {
      // Cleanup et reset levels a 0
      setLevels(Array(bars).fill(0))
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (sourceRef.current) sourceRef.current.disconnect()
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => { /* ignore */ })
      }
      audioCtxRef.current = null
      analyserRef.current = null
      sourceRef.current = null
      return
    }

    try {
      // AudioContext doit etre cree apres un user gesture (qui s'est deja produit
      // au click du bouton micro, donc OK ici).
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtxClass()
      audioCtxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256 // 128 echantillons frequence
      analyser.smoothingTimeConstant = smoothing
      analyserRef.current = analyser

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceRef.current = source

      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        if (!analyserRef.current || !dataArrayRef.current) return
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as unknown as Uint8Array<ArrayBuffer>)

        // Repartit les frequences en N barres en moyennant des groupes
        const groupSize = Math.floor(dataArrayRef.current.length / bars)
        const newLevels: number[] = []
        for (let i = 0; i < bars; i++) {
          let sum = 0
          for (let j = 0; j < groupSize; j++) {
            sum += dataArrayRef.current[i * groupSize + j]
          }
          // Normalise 0..255 vers 0..1 et applique une legere amplification
          // pour que la voix normale remplisse bien la barre.
          newLevels.push(Math.min(1, (sum / groupSize / 255) * 1.5))
        }
        setLevels(newLevels)
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (err) {
      console.warn('[useAudioLevel] AudioContext failed:', err)
      setLevels(Array(bars).fill(0))
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (sourceRef.current) {
        try { sourceRef.current.disconnect() } catch { /* ignore */ }
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => { /* ignore */ })
      }
    }
  }, [stream, bars, smoothing])

  return levels
}
