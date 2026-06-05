// lib/voice/gemini-call.ts — V3.1 Helper d'appel Gemini resilient
// Encapsule l'appel a Gemini 2.5 Flash avec :
//   - Retry sur erreurs transitoires (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, 500)
//   - Fallback automatique sur gemini-2.0-flash si gemini-2.5-flash refuse 2 fois
//   - Timing total contraint pour rester sous les 10s de Vercel Hobby
//
// Pourquoi 2 modeles :
//   - gemini-2.5-flash : meilleure qualite mais sujet aux pics de demande Google
//   - gemini-2.0-flash : moins precis sur l'extraction mais beaucoup plus stable
//   - En cas de surcharge, mieux vaut une reponse correcte que pas de reponse

import { GoogleGenAI } from '@google/genai'

// V3.1 Vague C : on bascule en 2.0 par defaut (plus stable, moins de 503 Google)
// 2.5 reste en fallback pour les cas qui requierent plus de finesse.
export const PRIMARY_MODEL = 'gemini-2.0-flash'
export const FALLBACK_MODEL = 'gemini-2.5-flash'

interface GeminiCallInput {
  apiKey: string
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
  responseSchema: object
  temperature?: number
  maxOutputTokens?: number
  /** Tag pour les logs serveur, ex 'voice-command' ou 'voice-devis-v2' */
  logTag?: string
}

interface GeminiCallResult {
  text: string
  modelUsed: string
  totalLatencyMs: number
  attempts: number
}

/**
 * Detecte les erreurs Gemini transitoires qui meritent un retry/fallback.
 * Codes vises :
 *   - 503 UNAVAILABLE : surcharge temporaire ("high demand")
 *   - 429 RESOURCE_EXHAUSTED : quota par minute depasse
 *   - 500 INTERNAL : erreur Google ponctuelle
 */
function isRetriable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  // ApiError du SDK Google : { status: number, message: string }
  // ou erreur fetch avec response.status
  const e = err as { status?: number; code?: number; message?: string }
  const code = e.status ?? e.code
  if (code === 503 || code === 429 || code === 500) return true
  // Match le message au cas ou le code n'est pas remonte
  const msg = (e.message || '').toLowerCase()
  return msg.includes('unavailable')
    || msg.includes('high demand')
    || msg.includes('resource_exhausted')
    || msg.includes('rate limit')
}

/**
 * Appelle Gemini avec strategie de resilience :
 *   1. Tentative gemini-2.5-flash
 *   2. Si erreur retriable : nouvelle tentative gemini-2.5-flash apres 250ms
 *   3. Si encore en erreur : bascule sur gemini-2.0-flash (1 tentative)
 *
 * Total max ~8s pour rester sous les 10s Vercel Hobby (3s + 0.25s + 3s + marge).
 */
export async function callGeminiResilient(input: GeminiCallInput): Promise<GeminiCallResult> {
  const { apiKey, parts, responseSchema, temperature = 0.1, maxOutputTokens = 2048, logTag = 'gemini' } = input
  const ai = new GoogleGenAI({ apiKey })

  const config = {
    responseMimeType: 'application/json',
    responseSchema,
    temperature,
    maxOutputTokens,
  }

  const t0 = Date.now()
  let attempts = 0
  let lastErr: unknown = null

  // Plan d'attaque : 3 tentatives sur modele primaire avec backoff,
  // puis 2 sur fallback. Couvre les pics de surcharge Google.
  // Total max ~6s (3 * 250 + 3 * 1500ms model latency) — reste sous Vercel 60s.
  const attemptPlan: Array<{ model: string; delayMs: number }> = [
    { model: PRIMARY_MODEL,  delayMs: 0 },
    { model: PRIMARY_MODEL,  delayMs: 300 },
    { model: PRIMARY_MODEL,  delayMs: 800 },
    { model: FALLBACK_MODEL, delayMs: 0 },
    { model: FALLBACK_MODEL, delayMs: 500 },
  ]

  for (const step of attemptPlan) {
    if (step.delayMs > 0) {
      await new Promise(r => setTimeout(r, step.delayMs))
    }
    attempts++
    try {
      const response = await ai.models.generateContent({
        model: step.model,
        contents: [{ role: 'user', parts }],
        config,
      })
      const text = response.text ?? ''
      const totalLatencyMs = Date.now() - t0
      console.log(`[${logTag}] Gemini OK model=${step.model} attempts=${attempts} latency=${totalLatencyMs}ms`)
      return { text, modelUsed: step.model, totalLatencyMs, attempts }
    } catch (err) {
      lastErr = err
      const retriable = isRetriable(err)
      console.warn(`[${logTag}] Gemini fail model=${step.model} attempt=${attempts} retriable=${retriable}`)
      if (!retriable) {
        // Erreur non transitoire (4xx mauvais schema, 401 cle invalide...) : on abandonne tout de suite
        throw err
      }
      // Sinon on enchaine sur la prochaine etape du plan
    }
  }

  // Toutes les tentatives ont echoue
  console.error(`[${logTag}] Gemini exhausted toutes tentatives apres ${attempts} essais`)
  throw lastErr
}
