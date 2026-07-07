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
 *
 * Push 4 — garde `save_seq` anti-écriture en retard (miroir de useAutosave) :
 * le corps porte saveSeq (Date.now() capturé à l'envoi), l'UPDATE écrit
 * `save_seq: saveSeq` sous filtre `.lt('save_seq', saveSeq)`. Une ancienne
 * version n'écrase JAMAIS une plus récente, quel que soit l'ordre d'arrivée
 * des deux canaux. 0 ligne touchée (plan introuvable OU écriture plus récente
 * déjà en base) → 204 quand même : version LA PLUS SIMPLE retenue, assumée —
 * sendBeacon ne lit jamais la réponse, et distinguer les deux cas exigerait
 * un SELECT préalable (course TOCTOU en prime) pour un statut sans lecteur.
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

/** Symbole plausible ? (m2, audit 3a) position [x,y] finie + type string. */
function estSymboleValide(s: unknown): boolean {
  if (typeof s !== 'object' || s === null) return false
  const x = s as Record<string, unknown>
  return typeof x.type === 'string' && x.type.length > 0 && estPointValide(x.position)
}

/** Clôture plausible ? id string + polyligne d'au moins 2 points finis. */
function estClotureValide(c: unknown): boolean {
  if (typeof c !== 'object' || c === null) return false
  const x = c as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    Array.isArray(x.points) &&
    x.points.length >= 2 &&
    x.points.every(estPointValide)
  )
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

/** États d'avancement acceptés (mode Avancement, Push 7). */
const ETATS_AVANCEMENT = new Set(['a_faire', 'en_cours', 'termine', 'receptionne'])

/**
 * Durcissement m2 (audit 3a) : REJET DOUX des symboles/clôtures invalides.
 * Une entrée corrompue (position non finie, type manquant) est FILTRÉE au
 * lieu de faire échouer toute la sauvegarde de dernier souffle en 400 —
 * perdre une pose de symbole vaut mieux que perdre tout le plan.
 * Push 7 : une valeur d'avancement inconnue est effacée sur la pièce (rejet
 * doux) sans jeter la pièce ni le plan.
 * Retourne un nouvel objet (ne mute pas l'entrée).
 */
function nettoyerSymbolesEtClotures(data: PlanData): PlanData {
  return {
    ...data,
    levels: data.levels.map((n) => ({
      ...n,
      rooms: Array.isArray(n.rooms)
        ? n.rooms.map((r) => {
            const av = (r as Record<string, unknown>).avancement
            // Valeur d'avancement inconnue → effacée (undefined = clé omise au JSON).
            return av !== undefined && !ETATS_AVANCEMENT.has(av as string)
              ? { ...r, avancement: undefined }
              : r
          })
        : n.rooms,
      symbols: Array.isArray(n.symbols) ? n.symbols.filter(estSymboleValide) : [],
      clotures: Array.isArray(n.clotures) ? n.clotures.filter(estClotureValide) : [],
    })),
  }
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
  const brutData = corps.data
  if (!estPlanDataValide(brutData)) {
    return secureError('Données du plan invalides')
  }
  // Push 4 — saveSeq : number fini exigé, sinon 0. Avec 0, `.lt('save_seq', 0)`
  // ne matche jamais (save_seq >= 0 en base) : un beacon inordonnable
  // (client obsolète, corps trafiqué) ne peut PAS écraser un état plus récent.
  const saveSeqBrut = corps.saveSeq
  const saveSeq = typeof saveSeqBrut === 'number' && Number.isFinite(saveSeqBrut) ? saveSeqBrut : 0
  // m2 : symboles/clôtures invalides filtrés (rejet doux, jamais de 400 ici).
  const planData = nettoyerSymbolesEtClotures(brutData)

  let computed: Record<string, unknown>
  try {
    computed = calculerComputedServeur(planData)
  } catch {
    return secureError('Données du plan invalides')
  }

  // UPDATE via le client serveur (cookies) : la RLS s'applique déjà,
  // le filtre user_id explicite est la ceinture-bretelles.
  // Push 4 — plus de .select('id') ni de 404 : 0 ligne touchée = best-effort
  // 204 (cf. en-tête — le filtre save_seq rend le comptage ambigu et
  // sendBeacon ne consomme pas la réponse).
  const { error } = await supabase
    .from('plans')
    .update({
      name,
      data: planData,
      computed,
      updated_at: new Date().toISOString(),
      save_seq: saveSeq,
    })
    .eq('id', planId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .lt('save_seq', saveSeq)

  if (error) {
    console.error('[plan] beacon-save : update échoué')
    return secureError('Sauvegarde impossible', 500)
  }

  return new Response(null, {
    status: 204,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
