// app/api/certifications/ocr/route.ts — Vague 3a Certifications & assurances
//
// Route OCR : recoit une attestation (PDF ou image), l'envoie a Gemini en
// multimodal direct (document -> JSON), valide la reponse via Zod et renvoie
// les champs lus au client.
//
// IMPORTANT : cette route NE FAIT QUE LIRE. Aucune ecriture en base.
// L'enregistrement se fait cote client APRES validation humaine (l'artisan
// verifie/corrige les champs lus avant de cliquer "Enregistrer").
//
// Pipeline :
//   1. Securite : rate-limit IP + auth user + rate-limit user
//   2. Recupere le fichier du form-data, valide MIME + taille
//   3. Encode en base64 inline
//   4. Appelle callGeminiResilient (retry + fallback) avec responseSchema plat
//   5. Parse JSON -> Zod tolerant -> { ok, data, _warnings? }

import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { callGeminiResilient } from '@/lib/voice/gemini-call'

// Runtime Node (multipart binaire) ; l'appel Gemini peut durer plusieurs sec.
export const runtime = 'nodejs'
export const maxDuration = 60

// Limites de securite
const MAX_BYTES = 10 * 1024 * 1024 // 10 Mo
const ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

// Schema plat demande a Gemini (format SDK : type/enum/nullable).
const ocrResponseSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['decennale', 'rc_pro', 'vigilance_urssaf', 'rge', 'qualibat', 'qualifelec', 'habilitation', 'autre'],
      nullable: true,
      description: 'Type de document parmi la liste. decennale=assurance decennale, rc_pro=responsabilite civile pro, vigilance_urssaf=attestation de vigilance URSSAF, rge=certification RGE, qualibat, qualifelec, habilitation=habilitation electrique, autre sinon.',
    },
    intitule: { type: 'string', nullable: true, description: "Intitule lisible du document (ex: Assurance decennale, Certification RGE QualiPV)." },
    organisme: { type: 'string', nullable: true, description: "Organisme emetteur / assureur (ex: AXA, URSSAF, Qualit'EnR)." },
    numero: { type: 'string', nullable: true, description: 'Numero de contrat, police ou certificat.' },
    date_obtention: { type: 'string', nullable: true, description: "Date d'emission / d'obtention au format YYYY-MM-DD, sinon null." },
    date_expiration: { type: 'string', nullable: true, description: "Date d'expiration / fin de validite au format YYYY-MM-DD, sinon null." },
    date_audit: { type: 'string', nullable: true, description: "Date limite d'audit intermediaire (RGE uniquement) au format YYYY-MM-DD, sinon null." },
    confiance: { type: 'number', nullable: true, description: 'Niveau de confiance global de 0 a 1.' },
  },
  required: [],
}

const OCR_PROMPT = `Tu es un assistant qui lit des attestations d'assurance et certifications d'artisans du batiment francais (assurance decennale, RC pro, attestation de vigilance URSSAF, certification RGE, Qualibat, Qualifelec, habilitation electrique...).

Analyse le document fourni et extrais UNIQUEMENT les informations reellement presentes. Ne devine rien, ne complete pas. Si une information est absente ou illisible, mets null.

Regles :
- type : choisis le type le plus probable dans la liste imposee.
- intitule : un libelle court et clair.
- organisme : l'assureur ou l'organisme certificateur.
- numero : numero de contrat, de police ou de certificat.
- date_obtention et date_expiration : convertis TOUTE date au format YYYY-MM-DD. Les dates francaises sont en JJ/MM/AAAA. La date d'expiration est la fin de validite / fin de garantie.
- date_audit : seulement pour un RGE, la date limite d'audit intermediaire si elle figure, sinon null.
- confiance : ta confiance globale entre 0 et 1.

Reponds STRICTEMENT au format JSON demande.`

// Validation Zod tolerante : on accepte null, on borne les longueurs, on
// verifie le format des dates (sinon on les neutralise via warning plutot que
// de bloquer l'artisan).
const dateLike = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
const ocrZod = z.object({
  type: z.enum(['decennale', 'rc_pro', 'vigilance_urssaf', 'rge', 'qualibat', 'qualifelec', 'habilitation', 'autre']).nullable().optional(),
  intitule: z.string().max(200).nullable().optional(),
  organisme: z.string().max(200).nullable().optional(),
  numero: z.string().max(120).nullable().optional(),
  date_obtention: dateLike,
  date_expiration: dateLike,
  date_audit: dateLike,
  confiance: z.coerce.number().min(0).max(1).nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Filet IP anti-bot
    const ip = getClientIp(req)
    if (!checkRateLimit(`certif-ocr:ip:${ip}`, 30, 60_000)) return rateLimitError()

    // 2. Auth obligatoire
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 3. Rate-limit user : OCR couteux, on limite a 15/min
    if (!checkRateLimit(`certif-ocr:user:${user.id}`, 15, 60_000)) return rateLimitError()

    // 4. Cle API Gemini
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[certif-ocr] GEMINI_API_KEY manquante')
      return secureError('Configuration serveur invalide', 500)
    }

    // 5. Parser le multipart
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return secureError('Corps de requete invalide (multipart/form-data attendu)')
    }

    const file = formData.get('file')
    if (!(file instanceof Blob)) {
      return secureError('Champ fichier manquant ou invalide')
    }

    // 6. MIME (on compare le type de base, sans parametres ;charset...)
    const mimeType = (file.type || 'application/octet-stream').split(';')[0]
    if (ACCEPTED_MIME.indexOf(mimeType) === -1) {
      return secureError(`Type de fichier non supporte (${mimeType}). PDF ou image uniquement.`)
    }

    // 7. Taille
    if (file.size === 0) return secureError('Fichier vide')
    if (file.size > MAX_BYTES) return secureError('Fichier trop volumineux (10 Mo maximum)', 413)

    // 8. base64 inline
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // 9. Appel Gemini resilient (retry + fallback)
    let rawText = ''
    try {
      const result = await callGeminiResilient({
        apiKey,
        parts: [
          { text: OCR_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
        responseSchema: ocrResponseSchema,
        temperature: 0.1,
        maxOutputTokens: 1024,
        logTag: 'certif-ocr',
      })
      rawText = result.text
      console.log(`[certif-ocr] OK model=${result.modelUsed} attempts=${result.attempts} latency=${result.totalLatencyMs}ms size=${file.size}`)
    } catch (geminiErr) {
      const e = geminiErr as { status?: number; message?: string }
      const code = e.status ?? 502
      if (code === 503 || code === 429) {
        return secureError('Le service de lecture est temporairement surcharge. Reessayez dans 30 secondes.', 503)
      }
      console.error('[certif-ocr] Gemini error:', e.message)
      return secureError('Erreur de communication avec le service de lecture', 502)
    }

    if (!rawText.trim()) return secureError('Reponse de lecture vide', 502)

    // 10. Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      console.error('[certif-ocr] JSON parse error. Raw:', rawText.slice(0, 400))
      return secureError('Lecture malformee, reessayez', 502)
    }

    // 11. Zod tolerant : en cas d'echec on renvoie quand meme ce qui a ete lu.
    const validation = ocrZod.safeParse(parsed)
    if (!validation.success) {
      const obj = (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {}
      return secureJson({
        ok: true,
        data: obj,
        _warnings: validation.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`),
      })
    }

    return secureJson({ ok: true, data: validation.data })
  } catch (error) {
    console.error('[certif-ocr] Erreur:', error)
    return secureError('Erreur de traitement du document', 500)
  }
}
