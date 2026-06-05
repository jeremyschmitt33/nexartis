// lib/voice/schema.ts — V3.1 Commande vocale universelle
// Schema Zod strict pour la reponse Gemini Flash apres extraction d'une commande vocale
// universelle (devis / facture / planning). Structure FLAT cote Gemini (compatible
// responseSchema sans anyOf), puis discriminated union Zod cote serveur pour rejeter
// les hallucinations et les melanges d'intent.
//
// Pourquoi schema flat plutot que anyOf :
// - L'API Gemini ne supporte pas encore correctement les schemas discriminated/anyOf
//   en mode responseSchema (juin 2026, bug connu cote google-genai).
// - Solution : on demande un seul objet plat a Gemini, avec un champ `intent` qui
//   indique le type, et on laisse Zod cote serveur valider la coherence.

import { z } from 'zod'
import {
  VOICE_INTENT_CONFIDENCE_THRESHOLD,
  type VoiceIntent,
  type FactureType,
  type PlanningEventType,
} from './types'

// Re-export pour les autres modules
export { VOICE_INTENT_CONFIDENCE_THRESHOLD }

// ---------------------------------------------------------------
// Constantes de validation (regex FR + enums metier)
// ---------------------------------------------------------------

const TVA_RATES = [0, 2.1, 5.5, 8.5, 10, 20] as const
const FACTURE_TYPES: FactureType[] = ['standard', 'acompte', 'situation', 'avoir']
const PLANNING_EVENT_TYPES: PlanningEventType[] = ['rdv', 'intervention', 'livraison']
const INTENTS: VoiceIntent[] = ['devis', 'facture', 'planning', 'unknown']

const codePostalRegex = /^\d{5}$/
const telephoneRegex = /^(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}$/

// ---------------------------------------------------------------
// Sous-schemas communs
// ---------------------------------------------------------------

const ligneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.coerce.number().min(0.01).max(100_000),
  unite: z.string().min(1).max(20),
  prix_unitaire: z.coerce.number().min(0).max(1_000_000),
})

const clientFieldsSchema = {
  client_civilite: z.enum(['Monsieur', 'Madame', 'Mademoiselle', 'Société']).nullable().optional(),
  client_prenom: z.string().max(100).nullable().optional(),
  client_nom: z.string().max(200).nullable().optional(),
  client_adresse: z.string().max(300).nullable().optional(),
  client_code_postal: z.string().regex(codePostalRegex).nullable().optional(),
  client_ville: z.string().max(100).nullable().optional(),
  client_telephone: z.string().regex(telephoneRegex).nullable().optional(),
  client_email: z.string().email().max(200).nullable().optional(),
}

const tvaSchema = z
  .union([z.coerce.number(), z.null()])
  .refine(v => v === null || (TVA_RATES as readonly number[]).includes(v), {
    message: `tva_taux doit etre une des valeurs ${TVA_RATES.join(', ')} ou null`,
  })
  .nullable()
  .optional()

// ---------------------------------------------------------------
// 1) Schema RETROCOMPAT (utilise toujours par /api/voice-devis-v2)
// ---------------------------------------------------------------

export const voiceDevisResponseSchema = z.object({
  ...clientFieldsSchema,
  chantier: z.string().max(500).nullable().optional(),
  lignes: z.array(ligneSchema).max(50).default([]),
  tva_taux: tvaSchema,
  conditions_paiement: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  dechets_nature: z.string().max(500).nullable().optional(),
  date_travaux: z.string().max(50).nullable().optional(),
  duree: z.string().max(50).nullable().optional(),
  acompte_pourcentage: z.coerce.number().min(0).max(100).nullable().optional(),
})

export type VoiceDevisResponse = z.infer<typeof voiceDevisResponseSchema>

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
    tva_taux: { type: 'number', nullable: true, description: 'Taux TVA FR (0 franchise/auto-entrepreneur, 5.5 ou 10 reduit renovation, 20 normal, 2.1 ou 8.5 Corse)' },
    conditions_paiement: { type: 'string', nullable: true },
    notes: { type: 'string', nullable: true },
    dechets_nature: { type: 'string', nullable: true, description: 'Nature des dechets BTP a evacuer (AGEC)' },
    date_travaux: { type: 'string', nullable: true, description: 'Date de debut des travaux au format JJ/MM/AAAA si mentionnee' },
    duree: { type: 'string', nullable: true, description: 'Duree estimee des travaux' },
    acompte_pourcentage: { type: 'number', nullable: true, description: 'Pourcentage d acompte demande (0-100)' },
  },
  required: ['lignes'],
}

// ---------------------------------------------------------------
// 2) NOUVEAU schema universel pour /api/voice-command
// ---------------------------------------------------------------

export const voiceCommandRawSchema = z.object({
  intent: z.enum(['devis', 'facture', 'planning', 'unknown']),
  confidence: z.coerce.number().min(0).max(1),
  ...clientFieldsSchema,
  chantier: z.string().max(500).nullable().optional(),
  lignes: z.array(ligneSchema).max(50).default([]),
  tva_taux: tvaSchema,
  conditions_paiement: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  dechets_nature: z.string().max(500).nullable().optional(),
  date_travaux: z.string().max(50).nullable().optional(),
  duree: z.string().max(50).nullable().optional(),
  acompte_pourcentage: z.coerce.number().min(0).max(100).nullable().optional(),
  facture_type: z.enum(['standard', 'acompte', 'situation', 'avoir']).nullable().optional(),
  devis_ref: z.string().max(100).nullable().optional(),
  date_facture: z.string().max(50).nullable().optional(),
  date_echeance: z.string().max(50).nullable().optional(),
  numero_situation: z.coerce.number().int().min(1).max(100).nullable().optional(),
  pourcentage_situation: z.coerce.number().min(0).max(100).nullable().optional(),
  evenement_type: z.enum(['rdv', 'intervention', 'livraison']).nullable().optional(),
  titre: z.string().max(200).nullable().optional(),
  date_debut: z.string().max(50).nullable().optional(),
  date_fin: z.string().max(50).nullable().optional(),
})

export type VoiceCommandRaw = z.infer<typeof voiceCommandRawSchema>

// JSON Schema FLAT envoye a Gemini
export const geminiCommandResponseSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: INTENTS,
      description: 'Type de commande detectee. unknown si confiance faible.',
    },
    confidence: {
      type: 'number',
      description: 'Niveau de confiance de la detection d intent, entre 0 et 1.',
    },
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
    tva_taux: { type: 'number', nullable: true, description: 'Taux TVA FR (0 franchise, 5.5 ou 10 renovation, 20 normal)' },
    conditions_paiement: { type: 'string', nullable: true },
    notes: { type: 'string', nullable: true },
    dechets_nature: { type: 'string', nullable: true, description: 'Nature dechets BTP (AGEC)' },
    date_travaux: { type: 'string', nullable: true, description: 'Date debut travaux JJ/MM/AAAA' },
    duree: { type: 'string', nullable: true },
    acompte_pourcentage: { type: 'number', nullable: true, description: '0-100' },
    facture_type: { type: 'string', enum: FACTURE_TYPES, nullable: true, description: 'standard/acompte/situation/avoir' },
    devis_ref: { type: 'string', nullable: true, description: 'Reference du devis associe, ex DEV-2026-001' },
    date_facture: { type: 'string', nullable: true, description: 'Date d emission JJ/MM/AAAA' },
    date_echeance: { type: 'string', nullable: true, description: 'Date d echeance JJ/MM/AAAA' },
    numero_situation: { type: 'number', nullable: true, description: 'Numero de situation 1, 2, 3...' },
    pourcentage_situation: { type: 'number', nullable: true, description: 'Pourcentage cumule de la situation, 0-100' },
    evenement_type: { type: 'string', enum: PLANNING_EVENT_TYPES, nullable: true, description: 'rdv/intervention/livraison' },
    titre: { type: 'string', nullable: true, description: 'Titre court de l evenement' },
    date_debut: { type: 'string', nullable: true, description: 'Date debut, ex 2026-06-08T14:00 ou JJ/MM/AAAA HH:MM' },
    date_fin: { type: 'string', nullable: true, description: 'Date fin si mentionnee' },
  },
  required: ['intent', 'confidence', 'lignes'],
}

// ---------------------------------------------------------------
// 3) Projection RAW -> payload selon l'intent
// ---------------------------------------------------------------

export interface ProjectedResult {
  intent: VoiceIntent
  confidence: number
  payload: unknown
}

export function projectVoiceCommand(raw: VoiceCommandRaw): ProjectedResult {
  const common = {
    client_civilite: raw.client_civilite ?? null,
    client_prenom: raw.client_prenom ?? null,
    client_nom: raw.client_nom ?? null,
    client_adresse: raw.client_adresse ?? null,
    client_code_postal: raw.client_code_postal ?? null,
    client_ville: raw.client_ville ?? null,
    client_telephone: raw.client_telephone ?? null,
    client_email: raw.client_email ?? null,
    chantier: raw.chantier ?? null,
  }

  if (raw.intent === 'devis') {
    return {
      intent: 'devis',
      confidence: raw.confidence,
      payload: {
        ...common,
        lignes: raw.lignes ?? [],
        tva_taux: raw.tva_taux ?? null,
        conditions_paiement: raw.conditions_paiement ?? null,
        notes: raw.notes ?? null,
        dechets_nature: raw.dechets_nature ?? null,
        date_travaux: raw.date_travaux ?? null,
        duree: raw.duree ?? null,
        acompte_pourcentage: raw.acompte_pourcentage ?? null,
      },
    }
  }

  if (raw.intent === 'facture') {
    return {
      intent: 'facture',
      confidence: raw.confidence,
      payload: {
        ...common,
        lignes: raw.lignes ?? [],
        tva_taux: raw.tva_taux ?? null,
        conditions_paiement: raw.conditions_paiement ?? null,
        notes: raw.notes ?? null,
        dechets_nature: raw.dechets_nature ?? null,
        date_travaux: raw.date_travaux ?? null,
        duree: raw.duree ?? null,
        acompte_pourcentage: raw.acompte_pourcentage ?? null,
        facture_type: raw.facture_type ?? 'standard',
        devis_ref: raw.devis_ref ?? null,
        date_facture: raw.date_facture ?? null,
        date_echeance: raw.date_echeance ?? null,
        numero_situation: raw.numero_situation ?? null,
        pourcentage_situation: raw.pourcentage_situation ?? null,
      },
    }
  }

  if (raw.intent === 'planning') {
    return {
      intent: 'planning',
      confidence: raw.confidence,
      payload: {
        evenement_type: raw.evenement_type ?? 'rdv',
        titre: raw.titre ?? '',
        date_debut: raw.date_debut ?? null,
        date_fin: raw.date_fin ?? null,
        duree: raw.duree ?? null,
        client_nom: raw.client_nom ?? null,
        client_telephone: raw.client_telephone ?? null,
        chantier_adresse: raw.chantier ?? raw.client_adresse ?? null,
        notes: raw.notes ?? null,
      },
    }
  }

  return {
    intent: 'unknown',
    confidence: raw.confidence,
    payload: null,
  }
}
