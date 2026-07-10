// lib/planning-absences.ts
// -------------------------------------------------------------------
// Helpers pour les indisponibilites (conges / maladie / vacances...) du
// planning. Logique de dates PURE (aucune dependance React), testable et
// reutilisable dans la page planning.
// -------------------------------------------------------------------

export interface Indispo {
  id: string
  intervenant_id?: string | null
  nom_libre?: string | null
  date_debut: string // YYYY-MM-DD
  date_fin: string    // YYYY-MM-DD
  demi_journee?: string | null // 'matin' | 'apres_midi' | null (= journee entiere)
  type?: string | null
  motif?: string | null
}

function d10(s: string | null | undefined): string {
  return (s || '').slice(0, 10)
}

// Une absence couvre-t-elle ce jour (YYYY-MM-DD) ?
export function indispoCoversDay(a: { date_debut: string; date_fin: string }, dayIso: string): boolean {
  const day = d10(dayIso)
  const deb = d10(a.date_debut)
  const fin = d10(a.date_fin) || deb
  return !!day && deb <= day && day <= fin
}

// Les absences (parmi la liste) qui couvrent ce jour.
export function absencesForDay<T extends { date_debut: string; date_fin: string }>(list: T[], dayIso: string): T[] {
  return list.filter(a => indispoCoversDay(a, dayIso))
}

// Chevauchement d'une absence avec une plage [startIso, endIso].
export function indispoOverlapsRange(a: { date_debut: string; date_fin: string }, startIso: string, endIso: string): boolean {
  const s = d10(a.date_debut)
  const e = d10(a.date_fin) || s
  return s <= d10(endIso) && d10(startIso) <= e
}

// L'absence entre-t-elle REELLEMENT en conflit avec le creneau de l'intervention ?
// Une absence "matin" ne bloque pas une intervention l'apres-midi (et inversement).
// Toute absence journee entiere (demi_journee null), ou tout creneau d'intervention
// journee/personnalise, reste un conflit potentiel (par prudence on avertit).
// - demiJournee : 'matin' | 'apres_midi' | null  (cote absence)
// - creneau     : 'journee' | 'matin' | 'apres_midi' | 'creneau'  (cote intervention)
export function absenceConflictsWithCreneau(
  demiJournee?: string | null,
  creneau?: string | null,
): boolean {
  if (demiJournee === 'matin' && creneau === 'apres_midi') return false
  if (demiJournee === 'apres_midi' && creneau === 'matin') return false
  return true
}

// Types d'absence (pour le formulaire) + metadonnees d'affichage (couleur/hachures).
export const ABSENCE_TYPES: { value: string; label: string }[] = [
  { value: 'conge', label: 'Congé' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'vacances', label: 'Vacances' },
  { value: 'formation', label: 'Formation' },
  { value: 'autre', label: 'Autre' },
]

export const ABSENCE_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  conge: { label: 'Congé', color: '#475569', bg: '#e2e8f0' },
  maladie: { label: 'Maladie', color: '#b91c1c', bg: '#fee2e2' },
  vacances: { label: 'Vacances', color: '#7c3aed', bg: '#ede9fe' },
  formation: { label: 'Formation', color: '#0369a1', bg: '#e0f2fe' },
  ferie: { label: 'Férié', color: '#64748b', bg: '#f1f5f9' },
  autre: { label: 'Absence', color: '#475569', bg: '#e2e8f0' },
}

export function absenceTypeMeta(type?: string | null): { label: string; color: string; bg: string } {
  return (type && ABSENCE_TYPE_META[type]) || ABSENCE_TYPE_META.autre
}

// Libelle demi-journee lisible.
export function demiJourneeLabel(dj?: string | null): string {
  if (dj === 'matin') return ' (matin)'
  if (dj === 'apres_midi') return ' (après-midi)'
  return ''
}

// Format court JJ/MM pour l'affichage (ex. "2026-07-12" -> "12/07").
export function frShortDate(iso?: string | null): string {
  const p = d10(iso).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : (iso || '')
}

// Libelle de plage de dates lisible : "le 12/07" si 1 jour, sinon "12/07 → 15/07".
export function absenceRangeLabel(a: { date_debut: string; date_fin: string }): string {
  const deb = d10(a.date_debut)
  const fin = d10(a.date_fin) || deb
  return deb === fin ? `le ${frShortDate(deb)}` : `${frShortDate(deb)} → ${frShortDate(fin)}`
}
