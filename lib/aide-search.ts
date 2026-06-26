/**
 * Helpers de recherche pour la page Aide & Tutoriels.
 *
 * - normalize  : minuscule + suppression des accents (recherche
 *                insensible a la casse ET aux accents).
 * - extractText : aplatit un React.ReactNode (JSX) en texte brut,
 *                 pour pouvoir chercher dans le CONTENU des reponses
 *                 et pas seulement dans leur titre.
 * - sectionMatchesQuery : true si la requete matche le titre, le
 *                 sous-titre ou le contenu d'une fiche Q&A.
 */

import { isValidElement, type ReactNode } from 'react'

/**
 * Minuscule + suppression des accents/diacritiques.
 * Compatible ES5 : on decompose (NFD) puis on retire les marques
 * diacritiques combinantes (plage U+0300 a U+036F) via leur code,
 * sans regex unicode (pas de drapeau "u" ni de \p{...}).
 */
export function normalize(value: string): string {
  const decomposed = value.toLowerCase().normalize('NFD')
  let out = ''
  for (let i = 0; i < decomposed.length; i++) {
    const code = decomposed.charCodeAt(i)
    if (code >= 0x300 && code <= 0x36f) continue
    out += decomposed.charAt(i)
  }
  return out
}

/**
 * Extrait recursivement tout le texte d'un ReactNode.
 * Gere : string, number, tableaux, et elements React (via props.children).
 * Ignore : null, undefined, booleens, fonctions.
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
 * Vrai si la requete matche le titre, le sous-titre ou le contenu de
 * la fiche. Recherche tolerante aux accents et a la casse. Requete vide
 * matche toujours.
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
