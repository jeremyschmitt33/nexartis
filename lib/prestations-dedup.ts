// ---------------------------------------------------------------------------
// Detection de prestations qui se ressemblent (fautes de frappe, pluriel...).
// Sert a (1) l'autocompletion tolerante aux fautes, (2) l'encart « doublons »
// dans Mes prestations, (3) l'alerte dashboard.
//
// Regle : on ne fusionne JAMAIS automatiquement. On SIGNALE des candidats, et
// c'est l'artisan qui decide (deux libelles proches peuvent etre differents :
// « pose de prise simple » vs « pose de prise etanche »).
// ---------------------------------------------------------------------------

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Minuscule, sans accents, espaces normalises. */
export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distance de Levenshtein avec coupure (renvoie max+1 des qu'on depasse). */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  if (Math.abs(al - bl) > max) return max + 1
  let prev = new Array(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j
  for (let i = 1; i <= al; i++) {
    const cur = new Array(bl + 1)
    cur[0] = i
    let rowMin = i
    const ai = a.charCodeAt(i - 1)
    for (let j = 1; j <= bl; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[bl]
}

/** Seuil de distance tolere selon la longueur du libelle. */
function maxDistFor(len: number): number {
  if (len <= 8) return 1
  if (len <= 16) return 2
  return 3
}

/**
 * Deux libelles "se ressemblent" : proches mais PAS identiques.
 * Identiques (meme texte) = variantes de prix legitimes -> non signale.
 */
export function areSimilar(a: string, b: string): boolean {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (na === nb) return false
  const len = Math.max(na.length, nb.length)
  if (len < 4) return false
  const maxD = maxDistFor(len)
  const d = levenshtein(na, nb, maxD)
  return d >= 1 && d <= maxD
}

/** Match flou pour l'autocompletion (tolere une faute de frappe). q >= 4 conseille. */
export function fuzzyMatch(query: string, candidate: string): boolean {
  const q = normalizeText(query)
  const k = normalizeText(candidate)
  if (q.length < 4) return false
  const len = Math.max(q.length, k.length)
  const maxD = len <= 8 ? 1 : 2
  if (levenshtein(q, k, maxD) <= maxD) return true
  for (const w of k.split(' ')) {
    if (w.length >= 4 && levenshtein(q, w, 1) <= 1) return true
  }
  return false
}

export interface DedupItem {
  id: string
  designation: string
}

/**
 * Regroupe les prestations qui se ressemblent. Renvoie uniquement les groupes
 * d'au moins 2 elements (les candidats a verifier). Glouton, O(n^2) borne — la
 * liste perso d'un artisan reste petite.
 */
export function findDuplicateGroups<T extends DedupItem>(items: T[]): T[][] {
  const groups: T[][] = []
  const used = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    if (used.has(items[i].id)) continue
    const group: T[] = [items[i]]
    for (let j = i + 1; j < items.length; j++) {
      if (used.has(items[j].id)) continue
      if (areSimilar(items[i].designation, items[j].designation)) {
        group.push(items[j])
        used.add(items[j].id)
      }
    }
    if (group.length > 1) {
      used.add(items[i].id)
      groups.push(group)
    }
  }
  return groups
}

/** Nombre de prestations impliquees dans au moins un groupe de ressemblance. */
export function countDuplicates<T extends DedupItem>(items: T[]): number {
  return findDuplicateGroups(items).reduce((n, g) => n + g.length, 0)
}
