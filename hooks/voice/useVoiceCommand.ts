'use client'
// hooks/voice/useVoiceCommand.ts — V3.1
// Hook qui orchestre le pipeline complet :
//   1. Enregistrement audio (useMediaRecorder)
//   2. Envoi a /api/voice-command
//   3. Reception du resultat (intent + payload + confidence)
//   4. State machine : idle -> recording -> processing -> result | error
//
// Gere aussi le fallback texte (utilisateur tape au lieu de parler).

import { useCallback, useState } from 'react'
import { useMediaRecorder } from './useMediaRecorder'
import type { VoiceCommandSuccessResponse } from '@/lib/voice/types'
import { VOICE_MAX_RECORDING_SEC } from '@/lib/voice/types'

export type VoiceCommandStep = 'idle' | 'recording' | 'processing' | 'result' | 'error'

export interface UseVoiceCommandReturn {
  step: VoiceCommandStep
  elapsedSec: number
  stream: MediaStream | null
  result: VoiceCommandSuccessResponse | null
  errorMessage: string | null
  /** true si le navigateur supporte MediaRecorder + getUserMedia */
  isSupported: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  submitText: (text: string) => Promise<void>
  reset: () => void
}

// Cache module : on ne refetch pas le contexte a chaque dictee, on garde 10 minutes
let cachedContext: string | null = null
let cachedAt = 0
const CONTEXT_TTL_MS = 10 * 60 * 1000

async function fetchVoiceContext(): Promise<string | null> {
  const now = Date.now()
  if (cachedContext && (now - cachedAt) < CONTEXT_TTL_MS) {
    return cachedContext
  }
  try {
    const res = await fetch('/api/voice-context', { method: 'GET' })
    if (!res.ok) return null
    const json = await res.json()
    const serialized = JSON.stringify(json)
    cachedContext = serialized
    cachedAt = now
    return serialized
  } catch {
    return null
  }
}

async function postToVoiceCommand(form: FormData): Promise<VoiceCommandSuccessResponse> {
  const res = await fetch('/api/voice-command', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let msg = `Erreur serveur (${res.status})`
    try {
      const errJson = await res.json()
      if (errJson?.error) msg = errJson.error
    } catch { /* pas de JSON */ }
    throw new Error(msg)
  }
  return (await res.json()) as VoiceCommandSuccessResponse
}

export function useVoiceCommand(): UseVoiceCommandReturn {
  const [step, setStep] = useState<VoiceCommandStep>('idle')
  const [result, setResult] = useState<VoiceCommandSuccessResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const processBlob = useCallback(async (blob: Blob) => {
    setStep('processing')
    setErrorMessage(null)
    try {
      const form = new FormData()
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      form.append('audio', blob, `commande-vocale.${ext}`)
      // V3.1 Vague C : inject context metier (50 prestations + metier)
      const context = await fetchVoiceContext()
      if (context) form.append('context', context)
      const data = await postToVoiceCommand(form)
      setResult(data)
      setStep('result')
    } catch (err) {
      const e = err as Error
      setErrorMessage(e.message || 'Erreur reseau. Reessaie.')
      setStep('error')
    }
  }, [])

  const recorder = useMediaRecorder({
    maxDurationSec: VOICE_MAX_RECORDING_SEC,
    onStop: (blob) => { processBlob(blob) },
  })

  const startRecording = useCallback(async () => {
    setResult(null)
    setErrorMessage(null)
    setStep('recording')
    await recorder.start()
    // Si recorder.start a echoue, on bascule en error
    // (recorder.state passera a 'error', recupere via useEffect ci-dessous)
  }, [recorder])

  const stopRecording = useCallback(() => {
    recorder.stop()
    // L'envoi a l'API se fait dans recorder.onStop -> processBlob
  }, [recorder])

  const submitText = useCallback(async (text: string) => {
    if (text.trim().length < 3) {
      setErrorMessage('Texte trop court (min 3 caracteres)')
      setStep('error')
      return
    }
    setStep('processing')
    setErrorMessage(null)
    try {
      const form = new FormData()
      form.append('text', text.trim())
      const context = await fetchVoiceContext()
      if (context) form.append('context', context)
      const data = await postToVoiceCommand(form)
      setResult(data)
      setStep('result')
    } catch (err) {
      const e = err as Error
      setErrorMessage(e.message || 'Erreur reseau. Reessaie.')
      setStep('error')
    }
  }, [])

  const reset = useCallback(() => {
    recorder.reset()
    setStep('idle')
    setResult(null)
    setErrorMessage(null)
  }, [recorder])

  // Si le recorder est en erreur, on remonte
  if (recorder.state === 'error' && step !== 'error') {
    setErrorMessage(recorder.errorMessage)
    setStep('error')
  }

  return {
    step,
    elapsedSec: recorder.elapsedSec,
    stream: recorder.stream,
    result,
    errorMessage,
    isSupported: recorder.isSupported,
    startRecording,
    stopRecording,
    submitText,
    reset,
  }
}
