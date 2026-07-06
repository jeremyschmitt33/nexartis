/**
 * Module Plan 2D — Images du plan dans le devis (Push 5, 06/07/2026)
 *
 * SOURCE UNIQUE pour les 4 rendus du devis (HTML dashboard, PDF download,
 * PDF email, page publique /signer/[token]) : la MÊME image PNG, générée UNE
 * fois à l'injection (lib/plan/export.ts) et stockée en data URL base64 dans
 * `plans.export_images` (pattern identique au logo entreprise), est relue ici
 * par les 4 chemins => parité par construction.
 *
 * Fichier PUR : zéro dépendance React/DOM, importable côté client (dashboard,
 * /signer) ET côté serveur (routes download-devis, send-devis, public/devis).
 * Aucune fonction ne lève : en cas d'erreur on retourne [] (un devis sans
 * plan ou avec une image illisible ne doit JAMAIS casser un rendu).
 */

/** Entrée stockée dans `plans.export_images` (JSONB, une par niveau injecté). */
export interface ImagePlanExport {
  niveauId: string
  /** Nom du niveau au moment de la génération (ex. « RDC »). */
  nom: string
  /** PNG en data URL base64 (comme entreprises.logo_url). */
  dataUrl: string
  genereLe?: string
}

/** Image prête à afficher dans un rendu de devis (HTML ou PDF). */
export interface PlanImageDevis {
  /** Ex. « Plan cuisine — RDC » (nom du plan + nom du niveau). */
  titre: string
  dataUrl: string
}

/** Mention affichée sous l'image dans les 4 rendus (jamais « conforme »). */
export const MENTION_PLAN_INDICATIF =
  "Plan indicatif — cotes dans-œuvre saisies par l'artisan, non contractuel."

/** Garde-fou : nombre maximal d'images de plan affichées sur un devis. */
export const MAX_IMAGES_PLAN_DEVIS = 4

/** Référence plan extraite des lignes d'un devis (source_plan). */
interface RefsPlan {
  niveauIds: Set<string>
  /** true si au moins une ligne du plan n'a pas de niveauId (lignes pré-Push 5). */
  sansNiveau: boolean
}

/**
 * Regroupe les `source_plan` des lignes par plan : quels niveaux de quels
 * plans ont réellement injecté des métrés dans CE devis. Tolérant : accepte
 * des lignes brutes (JSONB Supabase) et ignore tout ce qui est invalide.
 */
export function collecterRefsPlan(
  lignes: ReadonlyArray<Record<string, unknown> | null | undefined>
): Map<string, RefsPlan> {
  const refs = new Map<string, RefsPlan>()
  for (const ligne of lignes ?? []) {
    if (!ligne || typeof ligne !== 'object') continue
    const sp = (ligne as Record<string, unknown>).source_plan
    if (!sp || typeof sp !== 'object') continue
    const planId = (sp as Record<string, unknown>).planId
    if (typeof planId !== 'string' || !planId) continue
    let ref = refs.get(planId)
    if (!ref) {
      ref = { niveauIds: new Set<string>(), sansNiveau: false }
      refs.set(planId, ref)
    }
    const niveauId = (sp as Record<string, unknown>).niveauId
    if (typeof niveauId === 'string' && niveauId) ref.niveauIds.add(niveauId)
    else ref.sansNiveau = true
  }
  return refs
}

/** Une entrée d'export valide et affichable (data URL image). */
function estImageValide(brut: unknown): brut is ImagePlanExport {
  if (!brut || typeof brut !== 'object') return false
  const e = brut as Record<string, unknown>
  return (
    typeof e.dataUrl === 'string' &&
    e.dataUrl.startsWith('data:image/') &&
    typeof e.niveauId === 'string'
  )
}

/**
 * Client Supabase minimal (structurel) : accepte indifféremment le client
 * navigateur (@/lib/supabase/client) et le client service-role serveur
 * (@supabase/supabase-js) — même pattern souple que logoConfigFromEntreprise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientPlansMinimal = { from: (table: string) => any }

/**
 * Charge les images de plan à afficher sur un devis, à partir de ses lignes
 * (colonne source_plan). Utilisée par les 4 rendus :
 *   1. HTML dashboard  (app/dashboard/devis/[id]/page.tsx)
 *   2. PDF download    (app/api/download-devis/route.ts)
 *   3. PDF email       (app/api/send-devis/route.ts)
 *   4. Page publique   (app/api/public/devis/[token]/route.ts -> /signer)
 *
 * Filtrage : seules les images des NIVEAUX dont des métrés sont dans le devis
 * sont retournées (fallback : toutes les images du plan pour les lignes
 * antérieures au Push 5, sans niveauId). Ne lève jamais : [] en cas d'échec.
 */
export async function chargerImagesPlansDevis(
  supabase: ClientPlansMinimal,
  lignes: ReadonlyArray<Record<string, unknown> | null | undefined>
): Promise<PlanImageDevis[]> {
  try {
    const refs = collecterRefsPlan(lignes)
    if (refs.size === 0) return []
    const ids = Array.from(refs.keys())
    const { data, error } = await supabase
      .from('plans')
      .select('id, name, export_images')
      .in('id', ids)
      .is('deleted_at', null)
    if (error || !Array.isArray(data)) return []

    const out: PlanImageDevis[] = []
    for (const row of data as Array<Record<string, unknown>>) {
      const planId = typeof row.id === 'string' ? row.id : String(row.id ?? '')
      const ref = refs.get(planId)
      if (!ref) continue
      const nomPlan = typeof row.name === 'string' ? row.name : ''
      const images = Array.isArray(row.export_images) ? row.export_images : []
      for (const brut of images) {
        if (!estImageValide(brut)) continue
        // Ne garder que les niveaux réellement injectés dans CE devis
        // (sauf lignes legacy sans niveauId : on garde tout le plan).
        if (!ref.sansNiveau && !ref.niveauIds.has(brut.niveauId)) continue
        const titre = [nomPlan, typeof brut.nom === 'string' ? brut.nom : '']
          .filter(Boolean)
          .join(' — ')
        out.push({ titre, dataUrl: brut.dataUrl })
        if (out.length >= MAX_IMAGES_PLAN_DEVIS) return out
      }
    }
    return out
  } catch {
    // Best-effort absolu : jamais d'erreur remontée aux rendus.
    return []
  }
}
