// lib/export/ics-planning.ts
// -------------------------------------------------------------------
// Export .ics (iCalendar RFC 5545) du planning : importable dans Google
// Agenda / Apple Calendrier / Outlook.
// Points critiques gères :
//  - UID stable (= id DB) => une re-import met a jour au lieu de dupliquer.
//  - Journee entiere : DTEND = lendemain (date de fin EXCLUSIVE en iCal).
//  - Heures locales + TZID=Europe/Paris (pas de VTIMEZONE, source de bugs).
//  - Echappement RFC (\\ ; , \n) + pliage des lignes > 75 octets.
// -------------------------------------------------------------------

import {
  type PlanningExportData,
  type PlanningExportRow,
  typeLabel,
  sortRows,
} from './planning-export'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'

function pad2(n: number): string { return n < 10 ? '0' + n : String(n) }

// Horodatage UTC courant : YYYYMMDDTHHMMSSZ
function dtStamp(): string {
  const d = new Date()
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

// YYYY-MM-DD -> YYYYMMDD
function icsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

// (YYYY-MM-DD, "HH:mm[:ss]") -> YYYYMMDDTHHMMSS (heure locale)
function icsDateTime(isoDate: string, hhmm: string): string {
  const t = hhmm.replace(/:/g, '')
  const t6 = (t + '000000').slice(0, 6)
  return `${icsDate(isoDate)}T${t6}`
}

// Ajoute n jours a une date YYYY-MM-DD (pour le DTEND all-day exclusif).
function addDaysIso(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

// +1h sur une heure "HH:mm" (fallback quand pas d'heure de fin).
function plusOneHour(hhmm: string): string {
  const parts = hhmm.split(':')
  let h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  h = (h + 1) % 24
  return `${pad2(h)}:${pad2(m)}`
}

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Pliage RFC 5545 : lignes <= 75 octets, continuation prefixee d'une espace.
function fold(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  chunks.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    chunks.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length > 0) chunks.push(' ' + rest)
  return chunks.join('\r\n')
}

function statusFor(statut?: string | null): string {
  if (statut === 'annule') return 'CANCELLED'
  if (statut === 'reporte') return 'TENTATIVE'
  return 'CONFIRMED'
}

function vevent(r: PlanningExportRow): string[] {
  const uid = `intervention-${r.id}@nexartis.fr`
  const summaryParts = [typeLabel(r.type_intervention), r.client || ''].filter(Boolean)
  const summary = r.titre || summaryParts.join(' – ') || 'Intervention'

  const lines: string[] = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${dtStamp()}`]

  if (r.heure_debut) {
    const endDate = r.date_fin || r.date_debut
    const endTime = r.heure_fin || plusOneHour(r.heure_debut.slice(0, 5))
    lines.push(`DTSTART;TZID=Europe/Paris:${icsDateTime(r.date_debut, r.heure_debut)}`)
    lines.push(`DTEND;TZID=Europe/Paris:${icsDateTime(endDate, endTime)}`)
  } else {
    // Journee entiere : DTEND exclusif => lendemain de la date de fin.
    const end = addDaysIso(r.date_fin || r.date_debut, 1)
    lines.push(`DTSTART;VALUE=DATE:${icsDate(r.date_debut)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(end)}`)
  }

  lines.push(`SUMMARY:${esc(summary)}`)
  if (r.adresse) lines.push(`LOCATION:${esc(r.adresse)}`)
  const descParts = [
    r.intervenants ? `Intervenant(s): ${r.intervenants}` : '',
    r.chantier ? `Chantier: ${r.chantier}` : '',
    r.notes || '',
  ].filter(Boolean)
  if (descParts.length > 0) lines.push(`DESCRIPTION:${esc(descParts.join('\n'))}`)
  lines.push(`STATUS:${statusFor(r.statut)}`)
  lines.push('END:VEVENT')
  return lines
}

export function buildPlanningIcs(data: PlanningExportData): string {
  const out: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexartis//Planning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const r of sortRows(data.rows) as PlanningExportRow[]) {
    for (const line of vevent(r)) out.push(fold(line))
  }
  out.push('END:VCALENDAR')
  return out.join('\r\n') + '\r\n'
}

export function downloadPlanningIcs(data: PlanningExportData): PdfDownloadResult {
  const ics = buildPlanningIcs(data)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const today = new Date().toISOString().slice(0, 10)
  return downloadPdfBlob(blob, `planning-${today}.ics`)
}
