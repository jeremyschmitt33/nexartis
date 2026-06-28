/**
 * Types de contenu des pages d'un rapport d'intervention (modele V3).
 * Pages : "Photos" (titre + 1 a 4 photos, chacune avec sa legende + rotation),
 * "Texte libre", "Constatations", "Page de fin". (Plus d'Avant/Apres : la page
 * Photos couvre ce cas.)
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

export type PageType = 'photos' | 'texte' | 'constat' | 'fin'
export const PAGE_TYPES: PageType[] = ['photos', 'texte', 'constat', 'fin']

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  photos: 'Photos',
  texte: 'Texte libre',
  constat: 'Constatations',
  fin: 'Page de fin',
}

export const MAX_PHOTOS_PAR_PAGE = 4

export interface PhotoRef {
  photoId?: string | null
  localId?: string | null
  legende?: string
  /** Rotation appliquee a l'affichage / au PDF : 0, 90, 180, 270. */
  rotation?: number
  /** Disposition dans le PDF : 'below' (texte dessous) ou 'side' (texte a cote). */
  layout?: 'below' | 'side'
}

export interface PhotosContent { titre: string; photos: PhotoRef[] }
export interface TexteContent { titre: string; texte: string }
export interface ConstatContent { items: string[] }
export interface FinContent { controles: string[]; observations: string[]; conclusion: string; titreControles?: string; titreObservations?: string; titreConclusion?: string }

export type PageContent = PhotosContent | TexteContent | ConstatContent | FinContent

export interface RapportPageData {
  id: string
  type: PageType
  contenu: PageContent
}

export function createDefaultContent(type: PageType): PageContent {
  switch (type) {
    case 'photos': return { titre: '', photos: [{}] }
    case 'texte': return { titre: '', texte: '' }
    case 'constat': return { items: [''] }
    case 'fin': return { controles: [], observations: [], conclusion: '', titreControles: 'Contrôles finaux', titreObservations: 'Observations', titreConclusion: 'Conclusion' }
  }
}

export function photoRefsOf(type: PageType, contenu: PageContent): PhotoRef[] {
  if (type === 'photos') return (contenu as PhotosContent).photos ?? []
  return []
}

/** Compatibilite : convertit les anciens types (photo1 / photo2 / avap / poste). */
export function normalizePage(p: { id: string; type: string; contenu: Record<string, unknown> }): RapportPageData {
  const c = (p.contenu ?? {}) as Record<string, unknown>
  if (p.type === 'photo1') {
    const photo = (c.photo as PhotoRef) || {}
    return { id: p.id, type: 'photos', contenu: { titre: '', photos: [photo] } }
  }
  if (p.type === 'photo2') {
    return { id: p.id, type: 'photos', contenu: { titre: '', photos: (c.photos as PhotoRef[]) || [{}] } }
  }
  if (p.type === 'avap') {
    const avant = { ...((c.avant as PhotoRef) || {}), legende: 'Avant' }
    const apres = { ...((c.apres as PhotoRef) || {}), legende: 'Apres' }
    return { id: p.id, type: 'photos', contenu: { titre: 'Avant / Apres', photos: [avant, apres] } }
  }
  if (p.type === 'poste') {
    return { id: p.id, type: 'texte', contenu: { titre: (c.titre as string) || '', texte: (c.texte as string) || '' } }
  }
  const known = (PAGE_TYPES as string[]).includes(p.type)
  const type = (known ? p.type : 'texte') as PageType
  const contenu = (c && Object.keys(c).length) ? (c as unknown as PageContent) : createDefaultContent(type)
  return { id: p.id, type, contenu }
}
