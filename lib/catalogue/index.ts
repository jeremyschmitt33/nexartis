// ---------------------------------------------------------------------------
// Index du catalogue de prestations par metier.
// Assemble les 15 fichiers metier + metadonnees (slug, libelle, mots-cles).
// ---------------------------------------------------------------------------

import type { CatalogueItem } from './types'
import { electricien } from './electricien'
import { plombier } from './plombier'
import { chauffagiste } from './chauffagiste'
import { macon } from './macon'
import { carreleur } from './carreleur'
import { plaquiste } from './plaquiste'
import { terrassier } from './terrassier'
import { peintre } from './peintre'
import { menuisier } from './menuisier'
import { vitrier } from './vitrier'
import { serrurier } from './serrurier'
import { couvreur } from './couvreur'
import { charpentier } from './charpentier'
import { paysagiste } from './paysagiste'
import { general } from './general'

export type { CatalogueItem } from './types'

export interface MetierDef {
  slug: string
  label: string
  /** Mots-cles (minuscule, sans accent) pour rattacher le metier libre de l'artisan. */
  keywords: string[]
  items: CatalogueItem[]
}

export const CATALOGUE_METIERS: MetierDef[] = [
  { slug: 'electricien', label: 'Électricien', keywords: ['electricien', 'electricite'], items: electricien },
  { slug: 'plombier', label: 'Plombier', keywords: ['plombier', 'plomberie', 'sanitaire'], items: plombier },
  { slug: 'chauffagiste', label: 'Chauffagiste', keywords: ['chauffagiste', 'chauffage', 'thermique'], items: chauffagiste },
  { slug: 'macon', label: 'Maçon', keywords: ['macon', 'maconnerie', 'gros oeuvre'], items: macon },
  { slug: 'carreleur', label: 'Carreleur', keywords: ['carreleur', 'carrelage'], items: carreleur },
  { slug: 'plaquiste', label: 'Plaquiste / Plâtrier', keywords: ['plaquiste', 'platrier', 'platrerie', 'placo'], items: plaquiste },
  { slug: 'peintre', label: 'Peintre', keywords: ['peintre', 'peinture'], items: peintre },
  { slug: 'menuisier', label: 'Menuisier', keywords: ['menuisier', 'menuiserie'], items: menuisier },
  { slug: 'couvreur', label: 'Couvreur', keywords: ['couvreur', 'couverture', 'toiture'], items: couvreur },
  { slug: 'charpentier', label: 'Charpentier', keywords: ['charpentier', 'charpente', 'ossature bois'], items: charpentier },
  { slug: 'serrurier', label: 'Serrurier / Métallier', keywords: ['serrurier', 'serrurerie', 'metallier', 'metallerie'], items: serrurier },
  { slug: 'vitrier', label: 'Vitrier / Miroitier', keywords: ['vitrier', 'vitrerie', 'miroitier'], items: vitrier },
  { slug: 'terrassier', label: 'Terrassier / VRD', keywords: ['terrassier', 'terrassement', 'vrd'], items: terrassier },
  { slug: 'paysagiste', label: 'Paysagiste', keywords: ['paysagiste', 'paysage', 'jardin', 'espaces verts'], items: paysagiste },
  { slug: 'general', label: 'Prestations communes', keywords: [], items: general },
]

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '')
}

/** Rattache le metier libre de l'artisan a un slug du catalogue (ou null). */
export function matchMetierSlug(metier?: string | null): string | null {
  if (!metier) return null
  const m = normalize(metier)
  for (const def of CATALOGUE_METIERS) {
    if (def.keywords.some((k) => m.includes(k))) return def.slug
  }
  return null
}

/** Nombre total de prestations du catalogue. */
export const CATALOGUE_TOTAL = CATALOGUE_METIERS.reduce((n, m) => n + m.items.length, 0)
