/**
 * Helpers de recherche pour la page Aide & Tutoriels.
 *
 * - normalize  : minuscule + suppression des accents (recherche
 *                insensible à la casse ET aux accents).
 * - extractText : aplatit un React.ReactNode (JSX) en texte brut,
 *                 pour pouvoir chercher dans le CONTENU des réponses
 *                 et pas seulement dans leur titre.
 * - sectionMatchesQuery : true si la requête matche le titre, le
 *                 sous-titre ou le contenu d'une fiche Q&A.
 */

import { isValidElement, type ReactNode } from 'react'

/** Minuscule + suppression des accents/diacritiques. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Extrait récursivement tout le texte d'un ReactNode.
 * Gère : string, number, tableaux, et éléments React (via props.children).
 * Ignore : null, undefined, booléens, fonctions.
 */
export function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }

  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)

  if (Array.isArray(node)) {
    return node.map(extractText).join(' ')
  }

  if (isValidElement(node)) {
    const children = (node.props as { children?: ReactNode })?.children
    return extractText(children)
  }

  return ''
}

/**
 * Vrai si la requête (déjà saisie par l'utilisateur) matche le titre,
 * le sous-titre ou le contenu de la fiche. Recherche tolérante aux
 * accents et à la casse. Une requête vide matche toujours.
 */
export function sectionMatchesQuery(
  section: { title: string; subtitle?: string; content: ReactNode },
  query: string,
): boolean {
  const q = normalize(query.trim())
  if (!q) return true

  const haystack = normalize(
    `${section.title} ${section.subtitle ?? ''} ${extractText(section.content)}`,
  )

  return haystack.includes(q)
}
