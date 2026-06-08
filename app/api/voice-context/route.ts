// app/api/voice-context/route.ts — V3.1 Vague C
// Renvoie le contexte metier de l'artisan connecte pour amorcer Gemini :
//   - Les 50 dernieres prestations qu'il a creees (titre + unite + prix moyen)
//   - Le metier declare de son entreprise (forme juridique, secteur)
// Ce contexte est injecte dans le prompt comme exemples concrets ancres dans
// son metier, ce qui ameliore drastiquement la detection vocale.

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

export const runtime = 'nodejs'
export const maxDuration = 10

interface PrestationRow {
  titre: string
  unite: string | null
  prix_unitaire: number | null
}

interface EntrepriseRow {
  metier: string | null
  forme_juridique: string | null
}

export interface VoiceContextResponse {
  metier: string | null
  prestations: Array<{ titre: string; unite: string | null; prix: number | null }>
}

export async function GET(req: NextRequest) {
  try {
    // Filets de securite
    const ip = getClientIp(req)
    if (!checkRateLimit(`voice-context:ip:${ip}`, 30, 60_000)) {
      return rateLimitError()
    }

    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // Client serveur Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
        },
      },
    )

    // Recupere les 50 dernieres prestations
    // D7 (2026-06-08) : ajout explicite de .eq('user_id', user.id) en defense
    // en profondeur. La RLS Supabase filtre deja, mais ce double filtrage
    // garantit qu'aucune fuite ne sera possible meme si la RLS etait
    // accidentellement desactivee ou bypassee.
    const { data: prestations } = await supabase
      .from('prestations')
      .select('titre, unite, prix_unitaire')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)

    // Recupere l'entreprise de l'artisan pour deviner son metier
    const { data: entreprises } = await supabase
      .from('entreprises')
      .select('metier, forme_juridique')
      .eq('user_id', user.id)
      .limit(1)

    const entreprise = (entreprises?.[0] as EntrepriseRow | undefined) ?? null
    const presta = (prestations as PrestationRow[] | null) ?? []

    const response: VoiceContextResponse = {
      metier: entreprise?.metier ?? null,
      prestations: presta.map(p => ({
        titre: p.titre,
        unite: p.unite,
        prix: p.prix_unitaire,
      })),
    }

    return secureJson(response)
  } catch (err) {
    console.error('[voice-context] Erreur:', err)
    return secureError('Erreur de chargement du contexte', 500)
  }
}
