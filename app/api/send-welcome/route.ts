import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'
import {
  getClientIp, checkRateLimit, isValidEmail,
  secureJson, secureError, rateLimitError,
} from '@/lib/api-security'

export async function POST(req: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting strict (3 par minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`send-welcome:${ip}`, 3, 60_000)) {
      return rateLimitError()
    }

    const { email, name, internal_secret } = await req.json()

    // ✅ SÉCURITÉ : Vérifier le secret interne (cette route est appelée par le register)
    // Si INTERNAL_API_SECRET n'est pas définie, bloquer par défaut (pas de bypass silencieux)
    const expectedSecret = process.env.INTERNAL_API_SECRET
    if (!expectedSecret || internal_secret !== expectedSecret) {
      return secureError('Accès refusé', 403)
    }

    if (!email || !name) {
      return secureError('Email et nom requis')
    }

    // ✅ SÉCURITÉ : Valider l'email
    if (!isValidEmail(email)) return secureError('Email invalide')

    // ✅ SÉCURITÉ : Limiter la longueur du nom
    if (name.length > 200) return secureError('Nom trop long')

    await sendWelcomeEmail({ email, name })

    return secureJson({ success: true })
  } catch (error) {
    console.error('Welcome email error:', error)
    return secureError('Erreur serveur', 500)
  }
}
