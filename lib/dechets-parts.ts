// lib/dechets-parts.ts
// -------------------------------------------------------------------
// Source UNIQUE de la mention "Gestion des déchets (AGEC)" du devis.
// Utilisé par les 4 rendus (dashboard HTML, page /signer, PDF download,
// PDF e-mail) pour garantir un texte STRICTEMENT identique partout.
//
// Loi AGEC (décret 2020-1817) — mentions à conserver : nature + catégorie,
// quantité, modalités/tri, point de collecte (nom + adresse + type), coût.
// -------------------------------------------------------------------

export interface DechetsInput {
  nature?: string | null
  quantite?: string | null
  responsable?: string | null
  tri?: string | null
  collecteNom?: string | null
  collecteAdresse?: string | null
  collecteType?: string | null
  cout?: number | null
  // true = le coût est ajouté comme ligne du devis → on ne le répète PAS ici.
  coutInclus?: boolean | null
}

// Format monétaire simple et sûr côté serveur (pas de dépendance à l'ICU).
// Ex : 180 -> "180 €" ; 180.5 -> "180,50 €".
function formatEuro(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')
  return `${s} €`
}

// Le bloc déchets doit-il être affiché ? (garde-fou identique HTML + PDF)
export function hasDechets(d?: DechetsInput | null): boolean {
  return Boolean(d && (d.nature || d.collecteNom))
}

// Assemble les parties de la mention AGEC dans un ordre FIXE, en ignorant les
// champs vides (aucun label orphelin, aucun séparateur en trop).
export function buildDechetsParts(d?: DechetsInput | null): string[] {
  if (!d) return []
  const cout = typeof d.cout === 'number' && d.cout > 0 && !d.coutInclus
    ? `Coût estimé d'évacuation : ${formatEuro(d.cout)} (non inclus au devis)`
    : null
  const collecte = d.collecteNom
    ? `Collecte : ${d.collecteNom}${d.collecteAdresse ? `, ${d.collecteAdresse}` : ''}${d.collecteType ? ` (${d.collecteType})` : ''}`
    : null
  return [
    d.nature ? `Nature : ${d.nature}` : null,
    d.quantite ? `Quantité estimée : ${d.quantite}` : null,
    d.responsable ? `Enlèvement : ${d.responsable}` : null,
    d.tri ? `Tri : ${d.tri}` : null,
    collecte,
    cout,
  ].filter((p): p is string => Boolean(p))
}

// Chaîne prête à afficher (séparateur point médian entouré d'espaces =
// points de coupure propres pour le wrapping HTML et le splitTextToSize PDF).
export function buildDechetsText(d?: DechetsInput | null): string {
  return buildDechetsParts(d).join('   ·   ')
}
