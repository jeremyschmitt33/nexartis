// lib/voice/schema.ts — V3.0e Vague 1
// Schema Zod strict pour la reponse de Gemini Flash apres extraction d'un devis vocal.
// L'IA peut halluciner ou produire un JSON malforme : ce schema bloque tout ce qui
// ne respecte pas la structure attendue, avec coercion automatique des types simples.

import { z } from 'zod'

// Tauxs TVA valides en France (2026) : franchise (0), reduit (5.5, 10), normal (20),
// Corse (2.1, 8.5). Les autres valeurs sont des hallucinations et sont rejetees.
const TVA_RATES = [0, 2.1, 5.5, 8.5, 10, 20] as const

const ligneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.coerce.number().min(0.01).max(100_000),
  unite: z.string().min(1).max(20),
  prix_unitaire: z.coerce.number().min(0).max(1_000_000),
})

// Le regex CP francais : 5 chiffres, premier chiffre 0-9 (gere DOM-TOM 97x/98x)
const codePostalRegex = /^\d{5}$/
// Telephone FR : 10 chiffres avec ou sans separateurs (espaces, points, tirets)
const telephoneRegex = /^(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}$/

export const voiceDevisResponseSchema = z.object({
  client_civilite: z.enum(['Monsieur', 'Madame', 'Mademoiselle', 'Société']).nullable().optional(),
  client_prenom: z.string().max(100).nullable().optional(),
  client_nom: z.string().max(200).nullable().optional(),
  client_adresse: z.string().max(300).nullable().optional(),
  client_code_postal: z.string().regex(codePostalRegex).nullable().optional(),
  client_ville: z.string().max(100).nullable().optional(),
  client_telephone: z.string().regex(telephoneRegex).nullable().optional(),
  client_email: z.string().email().max(200).nullable().optional(),
  chantier: z.string().max(500).nullable().optional(),
  lignes: z.array(ligneSchema).max(50).default([]),
  tva_taux: z
    .union([z.coerce.number(), z.null()])
    .refine(v => v === null || (TVA_RATES as readonly number[]).includes(v), {
      message: `tva_taux doit etre une des valeurs ${TVA_RATES.join(', ')} ou null`,
    })
    .nullable()
    .optional(),
  conditions_paiement: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  dechets_nature: z.string().max(500).nullable().optional(),
  date_travaux: z.string().max(50).nullable().optional(),
  duree: z.string().max(50).nullable().optional(),
  acompte_pourcentage: z.coerce.number().min(0).max(100).nullable().optional(),
})

export type VoiceDevisResponse = z.infer<typeof voiceDevisResponseSchema>

// Schema JSON exposable a Gemini (responseSchema parameter) — converti depuis Zod
// au format JSON Schema Draft 7 attendu par l'API Google.
// Note : on garde ce schema parallele a Zod parce que le SDK Google ne genere pas
// automatiquement le JSON Schema depuis Zod. Si tu modifies un champ, modifie LES DEUX.
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    client_civilite: { type: 'string', enum: ['Monsieur', 'Madame', 'Mademoiselle', 'Société'], nullable: true },
    client_prenom: { type: 'string', nullable: true },
    client_nom: { type: 'string', nullable: true },
    client_adresse: { type: 'string', nullable: true },
    client_code_postal: { type: 'string', nullable: true, description: 'Code postal francais 5 chiffres' },
    client_ville: { type: 'string', nullable: true },
    client_telephone: { type: 'string', nullable: true, description: 'Telephone FR au format 0X XX XX XX XX' },
    client_email: { type: 'string', nullable: true },
    chantier: { type: 'string', nullable: true, description: 'Adresse du chantier si differente du client' },
    lignes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          designation: { type: 'string', description: 'Libelle de la prestation BTP' },
          quantite: { type: 'number', description: 'Quantite numerique' },
          unite: { type: 'string', description: 'Unite : m, m2, m3, ml, U, h, j, forfait' },
          prix_unitaire: { type: 'number', description: 'Prix unitaire HT en euros' },
        },
        required: ['designation', 'quantite', 'unite', 'prix_unitaire'],
      },
    },
    tva_taux: { type: 'number', enum: TVA_RATES as unknown as number[], nullable: true, description: 'Taux TVA FR' },
    conditions_paiement: { type: 'string', nullable: true },
    notes: { type: 'string', nullable: true },
    dechets_nature: { type: 'string', nullable: true, description: 'Nature des dechets BTP a evacuer (AGEC)' },
    date_travaux: { type: 'string', nullable: true, description: 'Date de debut des travaux au format JJ/MM/AAAA si mentionnee' },
    duree: { type: 'string', nullable: true, description: 'Duree estimee des travaux' },
    acompte_pourcentage: { type: 'number', nullable: true, description: 'Pourcentage d acompte demande (0-100)' },
  },
  required: ['lignes'],
}
