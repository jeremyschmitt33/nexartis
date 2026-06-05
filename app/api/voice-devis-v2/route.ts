// app/api/voice-devis-v2/route.ts — V3.0e Vague 1
// Nouvelle route vocale : recoit un audio (multipart/form-data), l'envoie a
// Gemini 2.5 Flash en multimodal direct (audio -> JSON), valide la reponse via
// Zod, et renvoie un JSON propre au client.
//
// Pipeline :
//   1. Securite : auth user + rate-limit IP/user + taille max
//   2. Recupere l'audio blob du form-data
//   3. Convertit en base64 inline pour le SDK Google
//   4. Appelle Gemini 2.5 Flash avec system prompt + audio + responseSchema
//   5. Parse la reponse texte -> JSON
//   6. Valide via Zod (rejette les hallucinations)
//   7. Renvoie le JSON valide

import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { voiceDevisResponseSchema, geminiResponseSchema } from '@/lib/voice/schema'
import { VOICE_DEVIS_SYSTEM_PROMPT } from '@/lib/voice/prompt'
import { callGeminiResilient } from '@/lib/voice/gemini-call'

// Cette route a besoin du runtime Node (pas Edge) pour traiter du multipart binaire.
export const runtime = 'nodejs'
// L'appel Gemini peut prendre 5-15 secondes pour un audio de 30 secondes.
export const maxDuration = 60

// Limites de securite
const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // 15 MB (Gemini Flash supporte 20 MB max inline)
const ACCEPTED_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
]

export async function POST(req: NextRequest) {
  try {
    // 1. Filet IP anti-bot
    const ip = getClientIp(req)
    if (!checkRateLimit(`voice-devis-v2:ip:${ip}`, 30, 60_000)) {
      return rateLimitError()
    }

    // 2. Auth obligatoire — seul un artisan connecte peut envoyer un audio
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 3. Rate-limit user — 10 audios / minute pour eviter les abus IA
    if (!checkRateLimit(`voice-devis-v2:user:${user.id}`, 10, 60_000)) {
      return rateLimitError()
    }

    // 4. Verifier la cle API Gemini est presente cote serveur
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[voice-devis-v2] GEMINI_API_KEY manquante dans les variables d environnement')
      return secureError('Configuration serveur invalide', 500)
    }

    // 5. Parser le multipart pour extraire le fichier audio
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return secureError('Corps de requete invalide (multipart/form-data attendu)')
    }

    const audioFile = formData.get('audio')
    if (!(audioFile instanceof Blob)) {
      return secureError('Champ audio manquant ou invalide')
    }

    // 6. Verifier le MIME type
    const mimeType = audioFile.type || 'application/octet-stream'
    if (!ACCEPTED_MIME_TYPES.some(t => mimeType.startsWith(t.split('/')[0]))) {
      return secureError(`Type audio non supporte (${mimeType})`)
    }

    // 7. Verifier la taille
    if (audioFile.size === 0) {
      return secureError('Fichier audio vide')
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return secureError(`Audio trop volumineux (max ${MAX_AUDIO_BYTES / 1024 / 1024} MB)`, 413)
    }

    // 8. Convertir le blob en base64 (necessaire pour l'inline data Gemini)
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')

    // 9. Appeler Gemini avec retry + fallback (resilience contre 503 UNAVAILABLE)
    let rawText = ''
    try {
      const result = await callGeminiResilient({
        apiKey,
        parts: [
          { text: VOICE_DEVIS_SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType: mimeType.split(';')[0],
              data: base64Audio,
            },
          },
        ],
        responseSchema: geminiResponseSchema,
        temperature: 0.1,
        maxOutputTokens: 2048,
        logTag: 'voice-devis-v2',
      })
      rawText = result.text
      console.log(`[voice-devis-v2] OK model=${result.modelUsed} attempts=${result.attempts} latency=${result.totalLatencyMs}ms audio_size=${audioFile.size}`)
    } catch (geminiErr) {
      const e = geminiErr as { status?: number; message?: string }
      const code = e.status ?? 502
      if (code === 503 || code === 429) {
        return secureError('Le service vocal est temporairement surcharge. Reessaie dans 30 secondes.', 503)
      }
      console.error('[voice-devis-v2] Gemini error:', e.message)
      return secureError('Erreur de communication avec l IA', 502)
    }

    if (!rawText.trim()) {
      return secureError('Reponse Gemini vide', 502)
    }

    // 10. Parser la reponse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      console.error('[voice-devis-v2] JSON parse error. Raw:', rawText.slice(0, 500))
      return secureError('Reponse IA malformee, reessayez', 502)
    }

    // 11. Valider via Zod (rejette les hallucinations type/format)
    const validation = voiceDevisResponseSchema.safeParse(parsed)
    if (!validation.success) {
      console.error('[voice-devis-v2] Zod validation error:', validation.error.issues)
      // Mode tolerant V1 : on renvoie quand meme le JSON brut nettoye
      // pour ne pas bloquer le user, en signalant les champs problematiques.
      return secureJson({
        ...(parsed as Record<string, unknown>),
        _warnings: validation.error.issues.map(i => `${i.path.join('.')} : ${i.message}`),
      })
    }

    // 12. Retour propre
    return secureJson(validation.data)
  } catch (error) {
    console.error('[voice-devis-v2] Erreur:', error)
    return secureError('Erreur de traitement vocal', 500)
  }
}
