// lib/voice/fallback-extraction.ts — V3.1 Vague C
// Post-processing serveur : si Gemini a rate la civilite ou l'objet
// malgre les regles du prompt, on extrait directement depuis la
// transcription brute (champ raw_transcription).
//
// C'est un filet de securite robuste : meme si le modele varie, ces
// fallbacks deterministes garantissent la coherence du resultat.

type Civilite = 'Monsieur' | 'Madame' | 'Mademoiselle' | 'Société'

const CIVILITE_PATTERNS: Array<{ regex: RegExp; value: Civilite }> = [
  // Formes pleines (case insensitive)
  { regex: /\b(monsieur|m\s*\.|mr\.?)\s+[A-ZÀ-ÿ]/i, value: 'Monsieur' },
  { regex: /\b(madame|mme\.?)\s+[A-ZÀ-ÿ]/i, value: 'Madame' },
  { regex: /\b(mademoiselle|mlle\.?)\s+[A-ZÀ-ÿ]/i, value: 'Mademoiselle' },
  { regex: /\b(société|societe|sarl|sas|sasu|sci|eurl|sa)\s+/i, value: 'Société' },
]

/**
 * Extrait la civilite depuis une transcription brute si elle commence
 * par un mot-cle de civilite. Renvoie null si rien de detecte.
 */
export function extractCiviliteFromTranscription(raw: string | null | undefined): Civilite | null {
  if (!raw || typeof raw !== 'string') return null
  // On regarde les 200 premiers caracteres pour eviter les faux positifs
  // dans le corps de la dictee (ex: "monsieur" dans une expression metier).
  const sample = raw.slice(0, 300)
  for (const { regex, value } of CIVILITE_PATTERNS) {
    if (regex.test(sample)) return value
  }
  return null
}

// ---------------------------------------------------------------
// Extraction de l'objet du devis / facture depuis la transcription
// ---------------------------------------------------------------

// Liste de patterns. Chaque pattern capture l'objet dans le groupe 1.
// Ordre : du plus specifique au plus generique.
const OBJET_PATTERNS: RegExp[] = [
  // Le chantier est/etait/sera/c'est X (X est tout jusqu'a la prochaine ponctuation forte)
  /le chantier (?:est|était|etait|sera|c'est|c'était|cetait) (?:un[e]?\s+|le\s+|la\s+|des\s+)?([^.,;!?\n]{4,80})/i,
  // Le chantier porte/concerne X
  /le chantier (?:porte sur|concerne) (?:un[e]?\s+|le\s+|la\s+|des\s+)?([^.,;!?\n]{4,80})/i,
  // Un chantier de X / chantier de X
  /\b(?:un\s+)?chantier de ([^.,;!?\n]{4,80})/i,
  // Objet X / objet du devis X / objet du chantier X / objet de la facture X
  /\bobjet (?:du devis |du chantier |de la facture )?:?\s+(?:un[e]?\s+|le\s+|la\s+|des\s+)?([^.,;!?\n]{4,80})/i,
  // L'objet c'est X / l'objet est X
  /l'objet (?:c'est|est) (?:un[e]?\s+|le\s+|la\s+|des\s+)?([^.,;!?\n]{4,80})/i,
  // C'est pour un X / c'est pour une X / c'est pour des X / c'est pour faire X
  /c'est pour (?:un[e]?\s+|le\s+|la\s+|des\s+|faire\s+(?:un[e]?\s+|le\s+|la\s+)?|realiser\s+(?:un[e]?\s+|le\s+|la\s+)?|réaliser\s+(?:un[e]?\s+|le\s+|la\s+)?)([^.,;!?\n]{4,80})/i,
  // Il s'agit d'un X / il s'agit de X
  /il s'agit (?:d'un[e]?|de) (?:un[e]?\s+|le\s+|la\s+|des\s+)?([^.,;!?\n]{4,80})/i,
  // Prestation X / prestation de service X
  /\bprestation (?:de service )?:?\s+([^.,;!?\n]{4,80})/i,
  // Travaux de X / intervention de X
  /\b(?:travaux|intervention) (?:de|d'|pour) (?:un[e]?\s+|le\s+|la\s+|des\s+)?([^.,;!?\n]{4,80})/i,
]

// Nettoyage : on coupe avant les marqueurs d'enumeration ("j'aurai", "et",
// "ensuite") qui annoncent la liste des prestations apres l'objet.
const CUT_MARKERS = [
  /\s+j['']aurai\b/i,
  /\s+j['']ai\s+/i,
  /\s+il y a\b/i,
  /\s+il faut\b/i,
  /\s+ensuite\b/i,
  /\s+puis\b/i,
  /\s+et puis\b/i,
  /\s+egalement\b/i,
  /\s+également\b/i,
  /\s+pour finir\b/i,
  /\s+premièrement\b/i,
  /\s+premierement\b/i,
  /\s+a\s+\d/i, // "a 50 euros" / "a 60"
  /\s+à\s+\d/i,
]

function cleanObjet(raw: string): string {
  let s = raw.trim()
  for (const marker of CUT_MARKERS) {
    const m = s.match(marker)
    if (m && m.index !== undefined) {
      s = s.slice(0, m.index).trim()
    }
  }
  // Capitalise la 1ere lettre
  if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1)
  // Coupe a 200 chars max
  return s.slice(0, 200).trim().replace(/[.,;!?]+$/, '').trim()
}

/**
 * Extrait l'objet depuis une transcription brute si l'artisan utilise
 * une formule reconnue. Renvoie null si aucun pattern ne matche.
 */
export function extractObjetFromTranscription(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  for (const pattern of OBJET_PATTERNS) {
    const match = raw.match(pattern)
    if (match && match[1]) {
      const cleaned = cleanObjet(match[1])
      if (cleaned.length >= 4) return cleaned
    }
  }
  return null
}
