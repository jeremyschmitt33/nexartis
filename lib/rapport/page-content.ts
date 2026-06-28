/**
 * Types de contenu des pages d'un rapport d'intervention.
 * Modele V2 : page "Photos" unifiee (1 a 4 photos + 1 commentaire, mise en
 * page auto), Avant/Apres (empile), Texte libre, Constatations, Page de fin.
 * Photos referencees par id serveur (photoId) une fois envoyees, par id local
 * (localId) pendant l'upload.
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

export type PageType = 'photos' | 'avap' | 'texte' | 'constat' | 'fin'

export const PAGE_TYPES: PageType[] = ['photos', 'avap', 'texte', 'constat', 'fin']

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  photos: 'Photos',
  avap: 'Avant / Après',
  texte: 'Texte libre',
  constat: 'Constatations',
  fin: 'Page de fin',
}

export const MAX_PHOTOS_PAR_PAGE = 4

export interface PhotoRef {
  photoId?: string | null
  localId?: string | null
  legende?: string
}

export interface PhotosContent { photos: PhotoRef[]; commentaire: string }
export interface Mesure { label: string; avant: string; apres: string; unite: string }
export interface AvapContent { avant: PhotoRef; apres: PhotoRef; mesure: Mesure }
export interface TexteContent { titre: string; texte: string }
export interface ConstatContent { items: string[] }
export interface FinContent { controles: string[]; observations: string[]; conclusion: string }

export type PageContent = PhotosContent | AvapContent | TexteContent | ConstatContent | FinContent

export interface RapportPageData {
  id: string
  type: PageType
  contenu: PageContent
}

export function createDefaultContent(type: PageType): PageContent {
  switch (type) {
    case 'photos': return { photos: [{}], commentaire: '' }
    case 'avap': return { avant: {}, apres: {}, mesure: { label: '', avant: '', apres: '', unite: '' } }
    case 'texte': return { titre: '', texte: '' }
    case 'constat': return { items: [''] }
    case 'fin': return { controles: [''], observations: [''], conclusion: '' }
  }
}

/** Tous les PhotoRef d'une page (pour collecter les photos a embarquer au PDF). */
export function photoRefsOf(type: PageType, contenu: PageContent): PhotoRef[] {
  if (type === 'photos') return (contenu as PhotosContent).photos ?? []
  if (type === 'avap') { const c = contenu as AvapContent; return [c.avant, c.apres].filter(Boolean) }
  return []
}

/**
 * Compatibilite : convertit les anciens types de page (photo1 / photo2 / poste)
 * vers le nouveau modele, pour ne pas casser les rapports deja crees.
 */
export function normalizePage(p: { id: string; type: string; contenu: Record<string, unknown> }): RapportPageData {
  const c = (p.contenu ?? {}) as Record<string, unknown>
  if (p.type === 'photo1') {
    const photo = (c.photo as PhotoRef) || {}
    return { id: p.id, type: 'photos', contenu: { photos: [photo], commentaire: (photo.legende as string) || '' } }
  }
  if (p.type === 'photo2') {
    const photos = (c.photos as PhotoRef[]) || [{}]
    return { id: p.id, type: 'photos', contenu: { photos, commentaire: '' } }
  }
  if (p.type === 'poste') {
    return { id: p.id, type: 'texte', contenu: { titre: (c.titre as string) || '', texte: (c.texte as string) || '' } }
  }
  const known = (PAGE_TYPES as string[]).includes(p.type)
  const type = (known ? p.type : 'texte') as PageType
  const contenu = (c && Object.keys(c).length) ? (c as unknown as PageContent) : createDefaultContent(type)
  return { id: p.id, type, contenu }
}
