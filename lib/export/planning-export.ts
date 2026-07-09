// lib/export/planning-export.ts
// -------------------------------------------------------------------
// Socle partage des exports du planning (PDF / CSV / ICS).
// Type de ligne normalise construit par la page planning a partir de ses
// donnees deja en memoire, + helpers de libelles communs.
// -------------------------------------------------------------------

export type PlanningPeriodType = 'week' | 'month' | 'year'

export interface PlanningExportRow {
  id: string
  date_debut: string          // YYYY-MM-DD (obligatoire)
  date_fin?: string | null    // YYYY-MM-DD (fin de plage, si multi-jours)
  heure_debut?: string | null // HH:mm ou HH:mm:ss
  heure_fin?: string | null
  creneau?: string | null     // matin | apres_midi | journee | creneau
  titre?: string | null
  type_intervention?: string | null
  statut?: string | null
  client?: string | null
  chantier?: string | null
  adresse?: string | null
  intervenants?: string | null // "Durand, Martin"
  notes?: string | null
}

export interface PlanningExportData {
  rows: PlanningExportRow[]
  periodType: PlanningPeriodType
  periodeLabel: string // ex "Juillet 2026" / "Semaine du 14 au 20 juil. 2026" / "Année 2026"
}

const STATUT_LABEL: Record<string, string> = {
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
  reporte: 'Reporté',
}
export function statutLabel(s?: string | null): string {
  return s ? STATUT_LABEL[s] || s : ''
}

const TYPE_LABEL: Record<string, string> = {
  visite_courtoisie: 'Visite de courtoisie',
  premier_rdv: 'Premier RDV',
  metre: 'Métré',
  devis_sur_site: 'Devis sur site',
  controle_qualite: 'Contrôle qualité',
  depannage: 'Dépannage',
  entretien: 'Entretien',
  autre: 'Autre',
}
export function typeLabel(t?: string | null): string {
  return t ? TYPE_LABEL[t] || t : ''
}

// Horaire lisible : "08:00-12:00", sinon libelle de creneau.
export function horaireLabel(r: PlanningExportRow): string {
  const hd = r.heure_debut ? r.heure_debut.slice(0, 5) : ''
  const hf = r.heure_fin ? r.heure_fin.slice(0, 5) : ''
  if (hd && hf) return `${hd}-${hf}`
  if (hd) return hd
  switch (r.creneau) {
    case 'matin': return 'Matin'
    case 'apres_midi': return 'Après-midi'
    case 'journee': return 'Journée'
    default: return ''
  }
}

// "lun. 14/07" (pour le PDF).
export function dateFrShort(isoDate?: string | null): string {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// Tri chronologique (date puis heure de debut).
export function sortRows(rows: PlanningExportRow[]): PlanningExportRow[] {
  return rows.slice().sort((a, b) => {
    const da = a.date_debut || ''
    const db = b.date_debut || ''
    if (da !== db) return da < db ? -1 : 1
    const ha = a.heure_debut || ''
    const hb = b.heure_debut || ''
    return ha < hb ? -1 : ha > hb ? 1 : 0
  })
}
