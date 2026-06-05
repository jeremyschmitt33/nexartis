'use client'
// hooks/voice/useMediaRecorder.ts — V3.1
// Hook reutilisable pour gerer l'enregistrement audio via l'API MediaRecorder.
// Encapsule toute la logique mime-type adaptatif (iOS Safari / Chrome / Firefox),
// cleanup propre du MediaStream, gestion d'erreurs detaillee.
//
// Pourquoi MediaRecorder et pas Web Speech API :
//   - Web Speech API ne fonctionne pas sur iOS Safari
//   - MediaRecorder est supporte partout depuis iOS 14.5
//   - L'audio est ensuite envoye au serveur qui fait transcription + extraction

import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'error'

export interface UseMediaRecorderOptions {
  /** Duree max enregistrement en secondes (par defaut 18s pour Vercel Hobby 10s API) */
  maxDurationSec?: number
  /** Bitrate audio en bps (par defaut 32000 = qualite voix tres correcte) */
  audioBitsPerSecond?: number
  /** Callback declenche quand l'enregistrement est stoppe (manuel ou auto) */
  onStop?: (blob: Blob) => void
}

export interface UseMediaRecorderReturn {
  state: RecorderState
  /** Duree ecoulee en secondes (mise a jour chaque seconde) */
  elapsedSec: number
  /** Blob audio disponible apres stop, null sinon */
  audioBlob: Blob | null
  /** Code d'erreur si state = 'error' (ex: 'NotAllowedError') */
  errorCode: string | null
  /** Message d'erreur en clair pour l'artisan */
  errorMessage: string | null
  /** Le MediaStream actif (pour useAudioLevel) */
  stream: MediaStream | null
  /** Verifie si MediaRecorder est supporte par le navigateur */
  isSupported: boolean
  start: () => Promise<void>
  stop: () => void
  reset: () => void
}

/**
 * Choisit le meilleur format audio supporte par le navigateur courant.
 * Ordre de preference : webm/opus (Chrome/Firefox), mp4/aac (Safari), ogg.
 */
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

function mapErrorToMessage(name: string, message: string): string {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return "Acces au micro refuse. Touche les 3 points en haut de Chrome puis Infos du site, Microphone, Autoriser, puis recharge la page."
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return "Aucun microphone detecte sur cet appareil."
    case 'NotReadableError':
    case 'TrackStartError':
      return "Le microphone est utilise par une autre application. Ferme les autres apps et reessaie."
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return "Ton micro ne supporte pas les reglages demandes. Recharge la page."
    case 'AbortError':
      return "Demarrage du micro interrompu. Reessaie."
    case 'SecurityError':
      return "Erreur de securite : assure-toi d'etre sur https://nexartis.fr (et pas http)."
    default:
      return `Erreur micro (${name || 'inconnue'}) : ${message || 'pas de detail'}`
  }
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const { maxDurationSec = 18, audioBitsPerSecond = 32_000, onStop } = options

  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const mimeTypeRef = useRef<string>('')

  const isSupported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch { /* deja stoppe */ }
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }, [stream])

  useEffect(() => {
    return () => cleanup()
    // cleanup uniquement au demontage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    cleanup()
    setState('idle')
    setElapsedSec(0)
    setAudioBlob(null)
    setErrorCode(null)
    setErrorMessage(null)
    chunksRef.current = []
  }, [cleanup])

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try { recorderRef.current.stop() } catch { /* ignore */ }
    }
    setState('stopped')
  }, [])

  const start = useCallback(async () => {
    setErrorCode(null)
    setErrorMessage(null)
    setAudioBlob(null)
    setElapsedSec(0)
    chunksRef.current = []

    try {
      // Contraintes en mode "ideal" (non strict) pour eviter OverconstrainedError
      // sur certains Chrome Android avant meme la demande de permission
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      })
      setStream(mediaStream)

      const mimeType = pickMimeType()
      mimeTypeRef.current = mimeType
      const recorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType, audioBitsPerSecond })
        : new MediaRecorder(mediaStream, { audioBitsPerSecond })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setAudioBlob(blob)
        // Stop des tracks pour eteindre l'indicateur micro du navigateur
        mediaStream.getTracks().forEach(t => t.stop())
        setStream(null)
        if (onStop) onStop(blob)
      }

      recorder.start(250) // chunks toutes les 250ms
      setState('recording')

      // Timer + auto-stop
      timerRef.current = setInterval(() => {
        setElapsedSec(prev => {
          const next = prev + 1
          if (next >= maxDurationSec) {
            stop()
            return maxDurationSec
          }
          return next
        })
      }, 1000)
    } catch (err) {
      const e = err as Error & { name?: string }
      console.error('[useMediaRecorder] error:', e.name, e.message)
      setErrorCode(e.name || 'UnknownError')
      setErrorMessage(mapErrorToMessage(e.name || '', e.message || ''))
      setState('error')
    }
  }, [audioBitsPerSecond, maxDurationSec, onStop, stop])

  return {
    state,
    elapsedSec,
    audioBlob,
    errorCode,
    errorMessage,
    stream,
    isSupported,
    start,
    stop,
    reset,
  }
}
