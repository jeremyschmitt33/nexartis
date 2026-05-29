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

/** Rôle d'un intervenant lié à une intervention. */
export type InterventionRole = 'referent' | 'equipier'

/** Liaison intervenant ↔ intervention (table jonction). */
export type InterventionIntervenant = {
  id: string
  role: InterventionRole
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
