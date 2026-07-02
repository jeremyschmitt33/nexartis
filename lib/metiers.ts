// ============================================================================
// lib/metiers.ts
// ----------------------------------------------------------------------------
// Source UNIQUE pour la gestion des metiers de l'artisan.
//
// Historique : le metier etait un simple champ TEXTE LIBRE (entreprises.metier).
// Probleme : une faute de frappe ("serurier") cassait le gating (ex : la carte
// "Contrat d'ouverture de porte" reservee aux serruriers n'apparaissait plus).
//
// Solution : une LISTE PREDEFINIE multi-choix (entreprises.metiers = jsonb array
// de slugs) + le champ libre conserve (entreprises.metier) pour un metier hors
// liste ou une precision. Le gating passe TOUJOURS par hasMetier() ci-dessous
// pour rester coherent partout (pas de "includes('serrur')" duplique et fragile).
// ============================================================================

export interface MetierOption {
  slug: string
  label: string
}

// Liste alignee sur NORMES_METIERS (lib/normes-metiers.ts) + pages metier SEO.
export const METIERS_PREDEFINIS: MetierOption[] = [
  { slug: 'electricien', label: 'Électricien' },
  { slug: 'plombier', label: 'Plombier' },
  { slug: 'chauffagiste', label: 'Chauffagiste' },
  { slug: 'couvreur', label: 'Couvreur' },
  { slug: 'macon', label: 'Maçon' },
  { slug: 'menuisier', label: 'Menuisier' },
  { slug: 'plaquiste', label: 'Plaquiste' },
  { slug: 'peintre', label: 'Peintre' },
  { slug: 'carreleur', label: 'Carreleur' },
  { slug: 'serrurier', label: 'Serrurier' },
  { slug: 'vitrier', label: 'Vitrier' },
  { slug: 'paysagiste', label: 'Paysagiste' },
]

// Racines pour la retro-compatibilite avec l'ancien champ texte libre.
const RACINES_TEXTE_LIBRE: Record<string, string> = {
  electricien: 'electric',
  plombier: 'plomb',
  chauffagiste: 'chauffag',
  couvreur: 'couvreu',
  macon: 'macon',
  menuisier: 'menuis',
  plaquiste: 'plaquist',
  peintre: 'peintr',
  carreleur: 'carrel',
  serrurier: 'serrur',
  vitrier: 'vitr',
  paysagiste: 'paysag',
}

// Minuscule + suppression des accents FR courants (caracteres imprimables,
// pas de marques combinantes : sur pour le build).
function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûüù]/g, 'u')
    .replace(/ç/g, 'c')
}

// Type large : l'objet entreprise n'a pas toujours 'metiers' type dans EntrepriseRecord.
type EntrepriseLike = Record<string, unknown> | null | undefined

// Retourne la liste des slugs de metiers selectionnes (colonne jsonb metiers).
export function entrepriseMetiers(ent: EntrepriseLike): string[] {
  const raw = ent?.['metiers']
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x)).filter(Boolean)
  }
  return []
}

// VRAI si l'entreprise exerce le metier `slug`.
// 1) via la liste predefinie (metiers jsonb) — fiable, pas de faute de frappe.
// 2) sinon retro-compat : l'ancien champ texte libre `metier` contient la racine.
export function hasMetier(ent: EntrepriseLike, slug: string): boolean {
  if (entrepriseMetiers(ent).includes(slug)) return true
  const racine = RACINES_TEXTE_LIBRE[slug] ?? slug
  return norm(ent?.['metier']).includes(racine)
}

// Libelle d'affichage : metiers predefinis joins + eventuel champ libre.
export function metiersLabel(ent: EntrepriseLike): string {
  const slugs = entrepriseMetiers(ent)
  const labels = slugs
    .map((s) => METIERS_PREDEFINIS.find((m) => m.slug === s)?.label)
    .filter(Boolean) as string[]
  const libre = String(ent?.['metier'] ?? '').trim()
  if (libre && !labels.some((l) => norm(l) === norm(libre))) labels.push(libre)
  return labels.join(' · ')
}
