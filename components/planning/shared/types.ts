// ===================================================================
// Types partagés Planning — Vague 3 (29/05/2026)
// ===================================================================
// Ce fichier centralise les types utilisés par les vues du planning
// (matrice Société + agenda Solo). Aucun import circulaire avec
// app/dashboard/planning/page.tsx.
// ===================================================================

/** Record opaque renvoyé par les hooks Supabase. */
export type R = Record<string, unknown>

/** Mode de vue principal du planning. */
export type PlanningViewMode = 'agenda' | 'matrix'

/** Densité d'affichage des cases. */
export type PlanningDensity = 'compact' | 'confort'

/** Type de créneau d'une intervention. */
export type Creneau = 'matin' | 'apres_midi' | 'journee' | 'creneau'

/** Filtre actif (toolbar). */
export type FilterType = 'all' | 'client' | 'chantier' | 'conflict'

/** Liaison intervenant ↔ intervention (table jonction).
 *  V2.3b (30/05/2026) — Étendu pour stocker la date/heure PAR assignation.
 *  Les colonnes start_date/end_date/start_time/end_time/slot sont en BDD
 *  NULLABLE pour rétrocompat ; côté front on les remonte en `?: string`.
 *  Lecture : `assignment.startDate ?? intervention.date_debut` (fallback parent).
 */
export type InterventionIntervenant = {
  id: string                  // intervenant_id
  assignmentId?: string       // id de la ligne intervention_intervenants
  startDate?: string          // ISO YYYY-MM-DD
  endDate?: string            // ISO YYYY-MM-DD
  startTime?: string          // HH:MM
  endTime?: string            // HH:MM
  slot?: Creneau              // matin | apres_midi | journee | creneau
}

/** Élément de la palette de couleurs pour un intervenant. */
export type PaletteEntry = {
  key: string
  bg: string
  border: string
  text: string
  badge: string
  hex: string
}

/** Jour utilisé par les vues semaine. */
export type WeekDay = {
  label: string
  date: Date
  dateStr: string
  isToday: boolean
  isWeekend: boolean
}
