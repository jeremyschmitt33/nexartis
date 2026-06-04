/**
 * Route API : theme de couleurs des documents (devis & factures).
 *
 * Endpoints :
 *  - GET   : retourne les 6 couleurs actuelles de l utilisateur
 *            (fallback aux defauts Nexartis si non configure).
 *  - PATCH : met a jour partiellement 1 a 6 couleurs.
 *            Chaque couleur est validee au format hex #RRGGBB.
 *
 * Securite :
 *  - Auth obligatoire via getAuthenticatedUser (cookies session Supabase).
 *  - Rate-limit :
 *      GET   : 60 req/min/user (page Parametres peut recharger souvent)
 *      PATCH : 30 req/min/user (debounce cote UI a 500ms)
 *  - Validation hex stricte cote serveur (regex ^#[0-9A-Fa-f]{6}$).
 *  - Filtre user_id = auth.uid() applique cote DB (RLS) ET cote requete.
 *  - Pas de fuite d erreur DB brute dans la reponse.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAuthenticatedUser,
  checkRateLimit,
  secureJson,
  secureError,
  rateLimitError,
  unauthorizedError,
} from '@/lib/api-security'
import {
  isValidHex,
  DEFAULT_DOCUMENT_THEME,
  type DocumentTheme,
} from '@/lib/document-theme'

// Mapping cle interne <-> nom de colonne DB.
// Sert a la fois a iterer les champs et a contraindre les cles autorisees
// dans le body PATCH (tout autre champ est ignore).
const FIELD_MAP: Record<keyof DocumentTheme, string> = {
  bandeauHaut: 'doc_color_bandeau_haut',
  accent: 'doc_color_accent',
  cadreEmetteur: 'doc_color_cadre_emetteur',
  cadreAdresse: 'doc_color_cadre_adresse',
  netPayer: 'doc_color_net_payer',
  footer: 'doc_color_footer',
}

const DB_COLUMNS = Object.values(FIELD_MAP).join(', ')

// ============================================================
// GET — retourne le theme courant de l utilisateur
// ============================================================

export async function GET(_req: NextRequest) {
  try {
    // 1. Auth obligatoire
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 2. Rate limit (60 req/min/user)
    if (!checkRateLimit(`doc-theme-get:${user.id}`, 60, 60 * 1000)) {
      return rateLimitError()
    }

    // 3. Lecture des 6 colonnes de l entreprise de l utilisateur
    const supabase = createClient()
    const { data, error } = await supabase
      .from('entreprises')
      .select(DB_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[document-theme GET] Supabase error:', error)
      return secureError('Erreur de lecture du theme', 500)
    }

    // 4. Construction de la reponse avec fallback aux defauts pour chaque
    //    couleur manquante (entreprise inexistante OU colonne null).
    const row = (data as Record<string, string | null> | null) ?? null
    const theme: DocumentTheme = {
      bandeauHaut:
        row?.doc_color_bandeau_haut || DEFAULT_DOCUMENT_THEME.bandeauHaut,
      accent:
        row?.doc_color_accent || DEFAULT_DOCUMENT_THEME.accent,
      cadreEmetteur:
        row?.doc_color_cadre_emetteur || DEFAULT_DOCUMENT_THEME.cadreEmetteur,
      cadreAdresse:
        row?.doc_color_cadre_adresse || DEFAULT_DOCUMENT_THEME.cadreAdresse,
      netPayer:
        row?.doc_color_net_payer || DEFAULT_DOCUMENT_THEME.netPayer,
      footer:
        row?.doc_color_footer || DEFAULT_DOCUMENT_THEME.footer,
    }

    return secureJson(theme)
  } catch (err) {
    console.error('[document-theme GET] Unexpected error:', err)
    return secureError('Erreur serveur', 500)
  }
}

// ============================================================
// PATCH — met a jour partiellement 1 a 6 couleurs
// ============================================================

export async function PATCH(req: NextRequest) {
  try {
    // 1. Auth obligatoire
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 2. Rate limit (30 req/min/user, debounce UI a 500ms)
    if (!checkRateLimit(`doc-theme-patch:${user.id}`, 30, 60 * 1000)) {
      return rateLimitError()
    }

    // 3. Lecture du body JSON
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return secureError('Donnees invalides')
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return secureError('Donnees invalides')
    }

    // 4. Validation + construction du patch DB
    const input = body as Record<string, unknown>
    const updates: Record<string, string> = {}

    for (const entry of Object.entries(FIELD_MAP)) {
      const themeKey = entry[0] as string
      const dbCol = entry[1] as string
      const val = input[themeKey]
      if (val === undefined) continue
      if (typeof val !== 'string' || !isValidHex(val)) {
        return secureError(
          `Couleur invalide pour ${themeKey} (format attendu : #RRGGBB)`,
          400,
        )
      }
      // Normalisation en minuscules pour coherence DB
      updates[dbCol] = val.toLowerCase()
    }

    if (Object.keys(updates).length === 0) {
      return secureError('Aucune couleur a mettre a jour', 400)
    }

    // 5. UPDATE filtre par user_id (defense en profondeur en plus de la RLS)
    const supabase = createClient()
    const { error } = await supabase
      .from('entreprises')
      .update(updates)
      .eq('user_id', user.id)

    if (error) {
      console.error('[document-theme PATCH] Supabase error:', error)
      return secureError('Erreur de mise a jour du theme', 500)
    }

    return secureJson({ ok: true, updated: Object.keys(updates).length })
  } catch (err) {
    console.error('[document-theme PATCH] Unexpected error:', err)
    return secureError('Erreur serveur', 500)
  }
}
