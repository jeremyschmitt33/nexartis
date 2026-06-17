// ─────────────────────────────────────────────────────────────────────────────
// prestations-memo.ts — Auto-mémorisation + suggestions des prestations
// ─────────────────────────────────────────────────────────────────────────────
// Helper UNIQUE partagé par les 4 points de saisie (devis nouveau/modifier,
// facture nouveau/modifier) + LineSheet (mobile). Centralise la logique pour
// éviter toute divergence entre les rendus (risque connu du projet).
//
//   • buildSuggestions / filterSuggestions  → l'autocomplétion (lecture)
//   • memorizePrestations                   → la mémorisation (écriture, RPC)
//
// Comportement mémorisation (validé par Jeremy) :
//   - On mémorise chaque ligne PRESTATION (type 'line'), désignation non vide
//     (<=120 car.), prix > 0.
//   - Clé d'unicité = (désignation normalisée + prix) → on garde toutes les
//     variantes de prix d'une même désignation (ex : "ouverture de porte"
//     à 20/30/40 €). On n'écrase JAMAIS un prix de référence.
//   - Best-effort : si l'appel échoue (réseau coupé sur chantier), on log et on
//     ignore. Le devis/facture est déjà enregistré : la mémo ne bloque rien.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/client'

export interface PrestationSuggestion {
  id: string
  designation: string
  prix_unitaire_ht: number
  unite: string
  taux_tva: number
  usage_count: number
}

// Forme minimale d'une ligne de devis/facture côté front (compatible LineItem / SheetLine)
export interface MemoLine {
  designation: string
  unit: string
  priceHT: number
  tva?: number
  type: 'line' | 'section' | 'subsection' | 'text'
}

// Normalisation identique à la fonction SQL nx_norm_designation (minuscule + sans accents + trim)
export function normalizeDesignation(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// Lignes d'un enregistrement Supabase `prestations` → suggestions triées (plus utilisées en tête)
export function buildSuggestions(rows: unknown[]): PrestationSuggestion[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map(r => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id ?? ''),
        designation: String(row.designation ?? ''),
        prix_unitaire_ht: Number(row.prix_unitaire_ht ?? 0),
        unite: String(row.unite ?? 'U'),
        taux_tva: Number(row.taux_tva ?? 0),
        usage_count: Number(row.usage_count ?? 0),
      }
    })
    .filter(s => s.designation.trim() !== '')
    .sort((a, b) => b.usage_count - a.usage_count || a.designation.localeCompare(b.designation, 'fr'))
}

// Filtre live (≥ minChars) : "commence par" avant "contient", puis par fréquence d'usage
export function filterSuggestions(
  suggestions: PrestationSuggestion[],
  query: string,
  max = 8,
  minChars = 2,
): PrestationSuggestion[] {
  const q = normalizeDesignation(query)
  if (q.length < minChars) return []
  const starts: PrestationSuggestion[] = []
  const contains: PrestationSuggestion[] = []
  for (const s of suggestions) {
    const k = normalizeDesignation(s.designation)
    if (k.startsWith(q)) starts.push(s)
    else if (k.includes(q)) contains.push(s)
  }
  const byUsage = (a: PrestationSuggestion, b: PrestationSuggestion) => b.usage_count - a.usage_count
  return [...starts.sort(byUsage), ...contains.sort(byUsage)].slice(0, max)
}

// Mémorisation best-effort. NE LÈVE JAMAIS d'erreur (ne doit jamais bloquer un save).
export async function memorizePrestations(lines: MemoLine[]): Promise<void> {
  try {
    if (!Array.isArray(lines) || lines.length === 0) return
    const payload = lines
      .filter(l =>
        l &&
        l.type === 'line' &&
        typeof l.designation === 'string' &&
        l.designation.trim() !== '' &&
        l.designation.trim().length <= 120 &&
        Number(l.priceHT) > 0,
      )
      .map(l => ({
        type: 'line',
        designation: l.designation.trim(),
        prix_unitaire_ht: Number(l.priceHT),
        unite: (l.unit && String(l.unit).trim()) || 'U',
        taux_tva: Number(l.tva ?? 0),
      }))

    if (payload.length === 0) return

    const supabase = createClient()
    const { error } = await supabase.rpc('upsert_prestations_from_lignes', { p_lignes: payload })
    if (error) {
      // Log non bloquant — la mémo a échoué mais le devis/facture est déjà sauvé.
      console.error('[memorizePrestations] échec mémorisation prestations:', error.message)
    }
  } catch (e) {
    console.error('[memorizePrestations] exception non bloquante:', e)
  }
}
