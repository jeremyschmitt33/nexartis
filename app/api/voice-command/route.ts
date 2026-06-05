// app/api/voice-command/route.ts — V3.1 Commande vocale universelle
// Route API qui detecte l'intent (devis / facture / planning / unknown) depuis un
// audio enregistre par l'artisan, puis renvoie un payload JSON structure.
//
// Pipeline (8 etapes) :
//   1. Filet IP anti-bot (rate-limit IP)
//   2. Auth utilisateur connecte
//   3. Rate-limit utilisateur (10/min)
//   4. Verification cle Gemini en env
//   5. Parse multipart, recupere l'audio
//   6. Validation MIME + taille audio (max 15 MB, ~18-20s de dictee)
//   7. Appel Gemini 2.5 Flash multimodal (audio + prompt universel)
//   8. Validation Zod stricte avec mode tolerant V1, projection vers payload typed
//
// CONTRAINTE VERCEL HOBBY : maxDuration = 10 secondes.
// L'enregistrement est limite cote client a 18s pour laisser ~2s a Gemini.

import { NextRequest } from 'next/server'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import {
  voiceCommandRawSchema,
  geminiCommandResponseSchema,
  projectVoiceCommand,
} from '@/lib/voice/schema'
import { buildVoiceCommandSystemPrompt, type VoiceArtisanContext } from '@/lib/voice/prompt'
import { callGeminiResilient } from '@/lib/voice/gemini-call'
import { extractCiviliteFromTranscription, extractObjetFromTranscription } from '@/lib/voice/fallback-extraction'
import type { VoiceCommandSuccessResponse } from '@/lib/voice/types'

// Multipart binaire = runtime Node obligatoire (pas Edge)
export const runtime = 'nodejs'
// Vercel Hobby coupe a 10s. On reste prudent ici.
export const maxDuration = 60

// Limites de securite cote serveur (defense en profondeur)
const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // 15 MB (Gemini Flash supporte 20 MB inline)
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
    // ============================================================
    // 1. Filet IP anti-bot — protege avant meme l'auth Supabase
    // ============================================================
    const ip = getClientIp(req)
    if (!checkRateLimit(`voice-command:ip:${ip}`, 30, 60_000)) {
      return rateLimitError()
    }

    // ============================================================
    // 2. Auth obligatoire — seuls les artisans connectes
    // ============================================================
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // ============================================================
    // 3. Rate-limit user — 10 audios / minute pour eviter abus IA
    // ============================================================
    if (!checkRateLimit(`voice-command:user:${user.id}`, 10, 60_000)) {
      return rateLimitError()
    }

    // ============================================================
    // 4. Cle API Gemini cote serveur uniquement
    // ============================================================
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[voice-command] GEMINI_API_KEY manquante dans les variables d environnement')
      return secureError('Configuration serveur invalide', 500)
    }

    // ============================================================
    // 5. Parser le multipart pour extraire l'audio
    // ============================================================
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return secureError('Corps de requete invalide (multipart/form-data attendu)')
    }

    const audioFile = formData.get('audio')
    // Fallback texte : si le micro n'est pas dispo, l'artisan peut taper
    const textFallback = formData.get('text')
    // V3.1 Vague C : contexte metier de l'artisan injecte dans le prompt
    const contextRaw = formData.get('context')
    let context: VoiceArtisanContext | undefined
    if (typeof contextRaw === 'string' && contextRaw.length > 0 && contextRaw.length < 20_000) {
      try {
        context = JSON.parse(contextRaw)
      } catch {
        // contexte invalide : on continue sans, pas critique
      }
    }

    // ============================================================
    // 6a. Branche AUDIO (cas standard)
    // ============================================================
    let prompt = ''
    let audioPart: { inlineData: { mimeType: string; data: string } } | null = null

    if (audioFile instanceof Blob) {
      // Verifier le MIME
      const mimeType = audioFile.type || 'application/octet-stream'
      if (!ACCEPTED_MIME_TYPES.some(t => mimeType.startsWith(t.split('/')[0]))) {
        return secureError(`Type audio non supporte (${mimeType})`)
      }

      // Verifier la taille
      if (audioFile.size === 0) {
        return secureError('Fichier audio vide')
      }
      if (audioFile.size > MAX_AUDIO_BYTES) {
        return secureError(`Audio trop volumineux (max ${MAX_AUDIO_BYTES / 1024 / 1024} MB)`, 413)
      }

      const arrayBuffer = await audioFile.arrayBuffer()
      const base64Audio = Buffer.from(arrayBuffer).toString('base64')
      audioPart = {
        inlineData: {
          mimeType: mimeType.split(';')[0], // 'audio/webm' depuis 'audio/webm;codecs=opus'
          data: base64Audio,
        },
      }
    }
    // ============================================================
    // 6b. Branche TEXTE (fallback si micro indisponible)
    // ============================================================
    else if (typeof textFallback === 'string' && textFallback.trim()) {
      const cleaned = textFallback.trim().slice(0, 4000) // max 4000 char (~1 page de texte)
      if (cleaned.length < 3) {
        return secureError('Texte trop court')
      }
      prompt = `Voici la transcription textuelle de la dictee de l'artisan (le micro n'etait pas disponible). Analyse-la comme si c'etait un audio :\n\n"${cleaned}"`
    } else {
      return secureError('Champ audio ou texte requis')
    }

    // ============================================================
    // 7. Appel Gemini avec retry + fallback (gemini-2.5-flash -> gemini-2.0-flash)
    // ============================================================
    const systemPrompt = buildVoiceCommandSystemPrompt(new Date(), context)

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: systemPrompt },
    ]
    if (prompt) parts.push({ text: prompt })
    if (audioPart) parts.push(audioPart)

    let rawText = ''
    try {
      const result = await callGeminiResilient({
        apiKey,
        parts,
        responseSchema: geminiCommandResponseSchema,
        temperature: 0,
        maxOutputTokens: 4096,
        logTag: 'voice-command',
      })
      rawText = result.text
      console.log(
        `[voice-command] OK model=${result.modelUsed} attempts=${result.attempts} latency=${result.totalLatencyMs}ms mode=${audioPart ? 'audio' : 'text'} audio_size=${audioFile instanceof Blob ? audioFile.size : 0}`,
      )
    } catch (geminiErr) {
      const e = geminiErr as { status?: number; message?: string }
      const code = e.status ?? 502
      if (code === 503 || code === 429) {
        return secureError('Le service vocal est temporairement surcharge. Reessaie dans 30 secondes.', 503)
      }
      console.error('[voice-command] Gemini error:', e.message)
      return secureError('Erreur de communication avec l IA', 502)
    }

    if (!rawText.trim()) {
      return secureError('Reponse Gemini vide', 502)
    }

    // ============================================================
    // 8. Parser + valider la reponse
    // ============================================================
    let parsedRaw: unknown
    try {
      parsedRaw = JSON.parse(rawText)
    } catch {
      console.error('[voice-command] JSON parse error. Raw:', rawText.slice(0, 500))
      return secureError('Reponse IA malformee, reessayez', 502)
    }

    // Validation Zod stricte
    const validation = voiceCommandRawSchema.safeParse(parsedRaw)
    if (!validation.success) {
      console.error('[voice-command] Zod validation error:', validation.error.issues)
      // Mode tolerant V1 : si Gemini envoie un JSON presque valide, on tente quand
      // meme une projection partielle pour ne pas bloquer l'artisan.
      // Conditions minimales : intent + confidence + lignes presents et conformes.
      const issues = validation.error.issues
      const blockingIssues = issues.filter(i =>
        ['intent', 'confidence', 'lignes'].includes(String(i.path[0])),
      )
      if (blockingIssues.length > 0) {
        // Trop critique pour recuperer, on bloque.
        return secureError('Reponse IA non conforme, reessayez', 502)
      }
      // Sinon on coerce manuellement les champs core et on renvoie avec warnings.
      const raw = parsedRaw as Record<string, unknown>
      const fallback = {
        intent: raw.intent as 'devis' | 'facture' | 'planning' | 'unknown',
        confidence: Number(raw.confidence ?? 0),
        // Champs facultatifs en cas de mode tolerant : on les laisse undefined,
        // projectVoiceCommand mettra null par defaut.
      }
      const projected = projectVoiceCommand({
        ...(parsedRaw as Record<string, unknown>),
        ...fallback,
        lignes: Array.isArray(raw.lignes) ? raw.lignes : [],
      } as Parameters<typeof projectVoiceCommand>[0])
      const tolerantResponse = {
        ...projected,
        _warnings: issues.map(i => `${i.path.join('.')} : ${i.message}`),
      } as VoiceCommandSuccessResponse
      return secureJson(tolerantResponse)
    }

    // ============================================================
    // 8.5 Fallback serveur : si Gemini a rate civilite ou objet, on les
    // ré-extrait depuis raw_transcription (filet de securite robuste).
    // ============================================================
    const rawTrans = validation.data.raw_transcription
    if (rawTrans && rawTrans.length > 0) {
      if (!validation.data.client_civilite) {
        const civ = extractCiviliteFromTranscription(rawTrans)
        if (civ) {
          validation.data.client_civilite = civ
          console.log(`[voice-command] fallback civilite: ${civ}`)
        }
      }
      if (!validation.data.objet) {
        const obj = extractObjetFromTranscription(rawTrans)
        if (obj) {
          validation.data.objet = obj
          console.log(`[voice-command] fallback objet: ${obj}`)
        }
      }
    }

    // ============================================================
    // 9. Projection raw -> payload typed selon l'intent
    // ============================================================
    const projected = projectVoiceCommand(validation.data)
    const successResponse = projected as VoiceCommandSuccessResponse
    return secureJson(successResponse)
  } catch (error) {
    console.error('[voice-command] Erreur:', error)
    return secureError('Erreur de traitement vocal', 500)
  }
}
