/**
 * Helper de concaténation de classes Tailwind.
 *
 * Volontairement minimaliste : ni `clsx` ni `tailwind-merge` ne sont
 * installés dans le projet (cf package.json). Cette fonction filtre
 * juste les `falsy` (false, null, undefined, '') puis joint avec un espace.
 *
 * Si plus tard on installe `clsx`/`tailwind-merge`, on pourra remplacer
 * cette implé sans toucher aux appelants.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ')
}
