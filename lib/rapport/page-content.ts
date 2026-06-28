/**
 * Types de contenu des pages d'un rapport d'intervention (contrat partage
 * entre l'editeur, la sauvegarde et le generateur PDF).
 *
 * Les photos sont referencees par leur id serveur (photoId) une fois envoyees,
 * et par un id local (localId) tant que l'upload est en cours.
 */

export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
}

export type PageType = 'constat' | 'poste' | 'photo1' | 'photo2' | 'avap' | 'fin'

export const PAGE_TYPES: PageType[] = ['constat', 'poste', 'photo1', 'photo2', 'avap', 'fin']

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  constat: 'Constatations',
  poste: 'Poste (titre + texte)',
  photo1: 'Photo + légende',
  photo2: '2 photos (en grand)',
  avap: 'Avant / Après + mesure',
  fin: 'Page de fin',
}

export interface PhotoRef {
  /** id serveur (apres confirmation upload). */
  photoId?: string | null
  /** id local (pendant l'upload, avant confirmation). */
  localId?: string | null
  legende?: string
}

export interface ConstatContent { items: string[] }
export interface PosteContent { titre: string; texte: string }
export interface Photo1Content { photo: PhotoRef }
export interface Photo2Content { photos: PhotoRef[] }
export interface Mesure { label: string; avant: string; apres: string; unite: string }
export interface AvapContent { avant: PhotoRef; apres: PhotoRef; mesure: Mesure }
export interface FinContent { controles: string[]; observations: string[]; conclusion: string }

export type PageContent =
  | ConstatContent | PosteContent | Photo1Content | Photo2Content | AvapContent | FinContent

export interface RapportPageData {
  id: string
  type: PageType
  contenu: PageContent
}

/** Contenu vide par defaut selon le type (pour l'ajout d'une page). */
export function createDefaultContent(type: PageType): PageContent {
  switch (type) {
    case 'constat': return { items: [''] }
    case 'poste': return { titre: '', texte: '' }
    case 'photo1': return { photo: { legende: '' } }
    case 'photo2': return { photos: [{ legende: '' }, { legende: '' }] }
    case 'avap': return { avant: {}, apres: {}, mesure: { label: '', avant: '', apres: '', unite: '' } }
    case 'fin': return { controles: [''], observations: [''], conclusion: '' }
  }
}

/** Tous les PhotoRef d'une page (pour collecter les photos a embarquer au PDF). */
export function photoRefsOf(type: PageType, contenu: PageContent): PhotoRef[] {
  if (type === 'photo1') return [(contenu as Photo1Content).photo].filter(Boolean)
  if (type === 'photo2') return (contenu as Photo2Content).photos ?? []
  if (type === 'avap') { const c = contenu as AvapContent; return [c.avant, c.apres].filter(Boolean) }
  return []
}
