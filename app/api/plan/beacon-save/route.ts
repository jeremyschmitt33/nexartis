import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkRateLimit,
  getClientIp,
  isValidUUID,
  rateLimitError,
  secureError,
  unauthorizedError,
} from '@/lib/api-security'
import type { Ouverture, Piece, PlanData } from '@/lib/plan/types'
import {
  surfaceCreeeProjetM2,
  surfaceExterieureM2,
  surfaceHabitableM2,
} from '@/lib/plan/metrics'

/**
 * POST /api/plan/beacon-save — Sauvegarde « dernier souffle » du plan 2D.
 *
 * Cible de `navigator.sendBeacon` déclenché au pagehide/visibilitychange
 * de l'éditeur (components/plan/useAutosave.ts). Route MÊME ORIGINE exprès :
 * un PATCH REST direct vers Supabase (cross-origin + header Authorization)
 * déclenche un prévol OPTIONS que le navigateur n'a jamais le temps de
 * compléter au déchargement de la page → la sauvegarde ne partait JAMAIS.
 * Ici : pas de CORS, cookies de session inclus automatiquement.
 *
 * Sécurité : auth getUser() via cookies (client Supabase serveur), rate
 * limit IP, validation stricte du corps, `computed` RECALCULÉ côté serveur
 * (jamais accepté du client), UPDATE filtré user_id + RLS (ceinture-bretelles).
 * Réponse 204 sans corps (sendBeacon ne lit pas la réponse).
 */

export const dynamic = 'force-dynamic'

/** Taille max du corps brut (le beacon client se limite déjà à ~60 Ko). */
const TAILLE_MAX_OCTETS = 200_000
const NOM_MAX = 200

/** Un point [x, y] en mm avec des nombres finis ? */
function estPointValide(p: unknown): boolean {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  )
}

function estOuvertureValide(o: unknown): o is Ouverture {
  if (typeof o !== 'object' || o === null) return false
  const x = o as Record<string, unknown>
  return (
    Number.isFinite(x.width) &&
    Number.isFinite(x.height) &&
    Number.isFinite(x.sillHeight) &&
    typeof x.type === 'string'
  )
}

function estPieceValide(p: unknown): p is Piece {
  if (typeof p !== 'object' || p === null) return false
  const x = p as Record<string, unknown>
  if (typeof x.id !== 'string' || typeof x.name !== 'string') return false
  if (x.cat !== 'int' && x.cat !== 'ext') return false
  if (x.layer !== 'existant' && x.layer !== 'projet') return false
  if (!Number.isFinite(x.height)) return false
  if (x.deductionSolM2 !== undefined && !Number.isFinite(x.deductionSolM2)) return false
  if (!Array.isArray(x.vertices) || !x.vertices.every(estPointValide)) return false
  if (!Array.isArray(x.openings) || !x.openings.every(estOuvertureValide)) return false
  return true
}

/**
 * Validation structurelle stricte de PlanData : suffisante pour garantir
 * que les fonctions de métré (pures) produisent des nombres finis.
 */
function estPlanDataValide(data: unknown): data is PlanData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (d.schemaVersion !== 1 || d.unit !== 'mm') return false
  if (!Array.isArray(d.levels)) return false
  for (const niveau of d.levels) {
    if (typeof niveau !== 'object' || niveau === null) return false
    const n = niveau as Record<string, unknown>
    if (typeof n.id !== 'string' || typeof n.name !== 'string') return false
    if (!Array.isArray(n.rooms) || !n.rooms.every(estPieceValide)) return false
  }
  return true
}

/**
 * Métrés dénormalisés pour plans.computed — MÊME forme que le
 * `calculerComputed` client (useAutosave), recalculé ici car on ne fait
 * jamais confiance à un computed envoyé par le client.
 */
function calculerComputedServeur(data: PlanData): Record<string, unknown> {
  const toutes = data.levels.flatMap((n) => n.rooms)
  return {
    habitableM2: surfaceHabitableM2(toutes),
    exterieureM2: surfaceExterieureM2(toutes),
    creeeProjetM2: surfaceCreeeProjetM2(toutes),
    niveaux: data.levels.map((n) => ({
      id: n.id,
      name: n.name,
      habitableM2: surfaceHabitableM2(n.rooms),
      pieces: n.rooms.length,
    })),
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`plan-beacon:${ip}`, 60, 60_000)) return rateLimitError()

  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return unauthorizedError()

  let brut: string
  try {
    brut = await req.text()
  } catch {
    return secureError('Requête invalide')
  }
  if (brut.length > TAILLE_MAX_OCTETS) return secureError('Plan trop volumineux')

  let corps: Record<string, unknown>
  try {
    const parse = JSON.parse(brut) as unknown
    if (typeof parse !== 'object' || parse === null || Array.isArray(parse)) {
      return secureError('Requête invalide')
    }
    corps = parse as Record<string, unknown>
  } catch {
    return secureError('Requête invalide')
  }

  const planId = corps.planId
  if (typeof planId !== 'string' || !isValidUUID(planId)) {
    return secureError('Identifiant de plan invalide')
  }
  const name = corps.name
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > NOM_MAX) {
    return secureError('Nom de plan invalide')
  }
  const planData = corps.data
  if (!estPlanDataValide(planData)) {
    return secureError('Données du plan invalides')
  }

  let computed: Record<string, unknown>
  try {
    computed = calculerComputedServeur(planData)
  } catch {
    return secureError('Données du plan invalides')
  }

  // UPDATE via le client serveur (cookies) : la RLS s'applique déjà,
  // le filtre user_id explicite est la ceinture-bretelles.
  const { data: lignes, error } = await supabase
    .from('plans')
    .update({
      name,
      data: planData,
      computed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    console.error('[plan] beacon-save : update échoué')
    return secureError('Sauvegarde impossible', 500)
  }
  if (!lignes || lignes.length === 0) {
    return secureError('Plan introuvable', 404)
  }

  return new Response(null, {
    status: 204,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
