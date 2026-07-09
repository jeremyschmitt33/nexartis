// lib/holidays-fr.ts
// -------------------------------------------------------------------
// Jours feries francais (metropole), calcules pour n'importe quelle annee.
// Feries mobiles bases sur Paques (algorithme de Meeus/Butcher).
// Alsace-Moselle en option (Vendredi Saint + 26/12).
// Aucune dependance externe. Utilise par le planning (affichage + exports).
// -------------------------------------------------------------------

export interface JourFerie {
  date: string // YYYY-MM-DD
  nom: string
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

// Dimanche de Paques pour une annee donnee (algorithme de Meeus/Jones/Butcher).
function paques(year: number): { m: number; d: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const dd = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - dd - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * mm + 114) / 31) // 3 = mars, 4 = avril
  const day = ((h + l - 7 * mm + 114) % 31) + 1
  return { m: month, d: day }
}

function addDaysIso(y: number, m: number, d: number, delta: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function joursFeriesFR(year: number, alsaceMoselle = false): JourFerie[] {
  const p = paques(year)
  const list: JourFerie[] = [
    { date: iso(year, 1, 1), nom: "Jour de l'An" },
    { date: iso(year, 5, 1), nom: 'Fête du Travail' },
    { date: iso(year, 5, 8), nom: 'Victoire 1945' },
    { date: iso(year, 7, 14), nom: 'Fête nationale' },
    { date: iso(year, 8, 15), nom: 'Assomption' },
    { date: iso(year, 11, 1), nom: 'Toussaint' },
    { date: iso(year, 11, 11), nom: 'Armistice 1918' },
    { date: iso(year, 12, 25), nom: 'Noël' },
    { date: addDaysIso(year, p.m, p.d, 1), nom: 'Lundi de Pâques' },
    { date: addDaysIso(year, p.m, p.d, 39), nom: 'Ascension' },
    { date: addDaysIso(year, p.m, p.d, 50), nom: 'Lundi de Pentecôte' },
  ]
  if (alsaceMoselle) {
    list.push({ date: addDaysIso(year, p.m, p.d, -2), nom: 'Vendredi Saint' })
    list.push({ date: iso(year, 12, 26), nom: 'Saint-Étienne' })
  }
  return list
}

// Map { 'YYYY-MM-DD' -> nom du ferie } couvrant les annees demandees.
export function feriesMap(years: number[], alsaceMoselle = false): Record<string, string> {
  const map: Record<string, string> = {}
  for (const y of years) {
    for (const f of joursFeriesFR(y, alsaceMoselle)) {
      map[f.date] = f.nom
    }
  }
  return map
}
