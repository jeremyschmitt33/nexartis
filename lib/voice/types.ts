// lib/voice/types.ts — V3.1 Commande vocale universelle
// Types TypeScript partages entre la route API et les composants React.
// Centralise les noms d'intent et la forme des payloads pour eviter les
// divergences entre serveur et client.

/**
 * Intent detecte par Gemini. 'unknown' = pas assez de confiance pour trancher,
 * on demandera a l'artisan de choisir manuellement parmi devis/facture/planning.
 */
export type VoiceIntent = 'devis' | 'facture' | 'planning' | 'unknown'

/**
 * Types de facture supportes par Nexartis (extrait de app/dashboard/factures/nouveau).
 * 'standard' = facture normale, 'acompte' = facture d'acompte avant chantier,
 * 'situation' = facture intermediaire pendant chantier, 'avoir' = remboursement.
 */
export type FactureType = 'standard' | 'acompte' | 'situation' | 'avoir'

/**
 * Types d'evenement planning. RDV = rendez-vous client, intervention = sur chantier,
 * livraison = reception materiaux/materiel.
 */
export type PlanningEventType = 'rdv' | 'intervention' | 'livraison'

// ---------------------------------------------------------------
// Ligne de prestation (commune devis + facture)
// ---------------------------------------------------------------

export interface VoiceLigne {
  designation: string
  quantite: number
  unite: string
  prix_unitaire: number
}

// ---------------------------------------------------------------
// Payload devis (reprend la structure historique voice-devis-v2)
// ---------------------------------------------------------------

export interface VoiceDevisPayload {
  client_civilite?: 'Monsieur' | 'Madame' | 'Mademoiselle' | 'Société' | null
  client_prenom?: string | null
  client_nom?: string | null
  client_adresse?: string | null
  client_code_postal?: string | null
  client_ville?: string | null
  client_telephone?: string | null
  client_email?: string | null
  chantier?: string | null
  lignes: VoiceLigne[]
  tva_taux?: number | null
  conditions_paiement?: string | null
  notes?: string | null
  dechets_nature?: string | null
  date_travaux?: string | null
  duree?: string | null
  acompte_pourcentage?: number | null
}

// ---------------------------------------------------------------
// Payload facture = devis + 4 champs specifiques
// ---------------------------------------------------------------

export interface VoiceFacturePayload extends VoiceDevisPayload {
  facture_type?: FactureType | null
  devis_ref?: string | null
  date_facture?: string | null
  date_echeance?: string | null
  numero_situation?: number | null
  pourcentage_situation?: number | null
}

// ---------------------------------------------------------------
// Payload planning (structure plus simple)
// ---------------------------------------------------------------

export interface VoicePlanningPayload {
  evenement_type?: PlanningEventType | null
  titre: string
  date_debut: string | null
  date_fin?: string | null
  duree?: string | null
  client_nom?: string | null
  client_telephone?: string | null
  chantier_adresse?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------
// Reponse complete de l'API /api/voice-command
// ---------------------------------------------------------------

export interface VoiceCommandSuccessResponse {
  intent: VoiceIntent
  confidence: number // 0..1
  payload: VoiceDevisPayload | VoiceFacturePayload | VoicePlanningPayload | null
  _warnings?: string[] // champs Zod en mode tolerant V1
}

export interface VoiceCommandErrorResponse {
  error: string
}

export type VoiceCommandResponse = VoiceCommandSuccessResponse | VoiceCommandErrorResponse

/**
 * Seuil minimal de confiance pour rediriger automatiquement.
 * En dessous, on affiche les 3 chips a l'artisan pour qu'il choisisse manuellement.
 */
export const VOICE_INTENT_CONFIDENCE_THRESHOLD = 0.7

/**
 * Duree maximale d'enregistrement audio cote client (en secondes).
 * Vercel Hobby coupe l'API a 10s : on garde une marge.
 * Audio webm/opus 32kbps de 18s = ~75 KB upload + 6-8s Gemini = ~9s total.
 */
export const VOICE_MAX_RECORDING_SEC = 45

/**
 * Avertissement visuel a partir de cette duree (orange).
 */
export const VOICE_WARN_RECORDING_SEC = 42
