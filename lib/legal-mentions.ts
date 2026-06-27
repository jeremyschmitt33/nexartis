/**
 * lib/legal-mentions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Source UNIQUE de vérité texte pour les mentions légales françaises affichées
 * sur les DEVIS et FACTURES Nexartis.
 *
 * Consommée par :
 *   - HTML dashboard devis  → app/dashboard/devis/[id]/page.tsx via <LegalMentionsBlock>
 *   - HTML dashboard facture → app/dashboard/factures/[id]/page.tsx via <LegalMentionsBlock>
 *   - HTML signer client     → app/signer/[token]/page.tsx via <LegalMentionsBlock> (V2.4b)
 *   - PDF jsPDF              → lib/pdf.ts (réimporte les constantes TVA depuis ce module)
 *
 * Références légales :
 *   - Code de commerce L441-3, L441-9, L441-10, D441-5 (mentions devis/facture, pénalités)
 *   - Code de la consommation L221-18 (rétractation B2C)
 *   - CGI art. 293 B (franchise TVA), art. 257, art. 283-2 nonies (auto-liquidation BTP)
 *   - Code des assurances (décennale obligatoire BTP)
 *
 * V2.4a — Étape 1 : extraction depuis lib/helpers.ts (champsLegauxManquants,
 * CHAMPS_LEGAUX_DEVIS) et lib/pdf.ts (TVA_MENTION_*). Les 2 dashboards (devis +
 * facture) consomment ce module via les composants <LegalMentionsBlock> et
 * <ProfilIncompletBanner>.
 *
 * ⚠️  Ne pas faire diverger les 4 rendus : toute modification de texte ici se
 *     répercute automatiquement sur HTML dashboard devis/facture + PDF.
 *     La page /signer/[token] et lib/pdf.ts seront câblées sur ce module en
 *     V2.4b/c.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Représentation minimale d'une ligne de prestation, utilisée pour détecter les
 * taux de TVA présents dans un devis/facture. Compatible avec :
 *   - DevisLigne (app/dashboard/devis/[id]/page.tsx)
 *   - FactureLigne (app/dashboard/factures/[id]/page.tsx)
 *   - Ligne (lib/pdf.ts)
 */
export type LegalLigne = {
  taux_tva?: number | null
  type?: string | null
  designation?: string | null
}

/**
 * Vue minimale de l'entreprise nécessaire à la génération des mentions légales.
 * Toutes les colonnes optionnelles sont mappées sur celles de la table
 * `entreprises` (cf. EntrepriseRecord dans lib/hooks.tsx + migrations Supabase).
 */
export type LegalEntreprise = {
  nom?: string | null
  siret?: string | null
  forme_juridique?: string | null
  capital_social?: string | null
  rcs_rm?: string | null
  tva_intracommunautaire?: string | null
  franchise_tva?: boolean | null
  qualification_pro?: string | null
  // Décennale : colonnes historiques (assurance_nom / decennale_numero /
  // assurance_zone) + colonnes éventuelles (decennale_assureur / decennale_zone)
  // mentionnées dans le brief. On lit les deux pour rétrocompatibilité.
  assurance_nom?: string | null
  assurance_zone?: string | null
  decennale_numero?: string | null
  decennale_assureur?: string | null
  decennale_zone?: string | null
  // Médiateur : ancien champ libre (legacy) + 4 sous-champs nommés depuis le
  // 28/05/2026 (mediateur_nom, mediateur_adresse, mediateur_code_postal,
  // mediateur_ville).
  mediateur?: string | null
  mediateur_nom?: string | null
  mediateur_adresse?: string | null
  mediateur_code_postal?: string | null
  mediateur_ville?: string | null
  // Mentions personnalisées libres (textarea Paramètres).
  mentions_legales_custom?: string | null
  // Adresse & coordonnées (pour la bannière "profil incomplet")
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  // Tolère les colonnes supplémentaires (ex: code_naf, telephone, etc.)
  [key: string]: unknown
}

/**
 * Vue minimale du client. `client_type` = 'professionnel' déclenche l'indemnité
 * forfaitaire 40 € (D441-5 C. com.) ; sinon (particulier) on affiche la mention
 * de rétractation L221-18.
 */
export type LegalClient = {
  siret?: string | null
  client_type?: string | null
  type?: string | null // legacy : ancienne colonne (clients.type)
}

/**
 * Contexte complet passé aux façades getLegalMentionsDevis/Facture. Tous les
 * champs sont optionnels sauf `kind` et `entreprise`.
 */
export type LegalContext = {
  kind: 'devis' | 'facture'
  entreprise: LegalEntreprise | null | undefined
  client?: LegalClient | null
  /**
   * Type de client effectif. Si non passé, on déduit automatiquement :
   *   - SIRET présent sur le client → 'pro'
   *   - sinon                       → 'particulier'
   */
  clientType?: 'particulier' | 'pro'
  lignes?: LegalLigne[] | null
  /**
   * Type de facture (uniquement pour kind = 'facture'). Pas d'incidence sur le
   * texte des mentions pour V2.4a, mais réservé pour V2.4b/c (ex: avoir → pas
   * de pénalités de retard).
   */
  factureType?: 'standard' | 'avoir' | 'acompte' | 'situation'
  /**
   * Sous-traitance BTP → mention d'autoliquidation TVA (art. 283-2 nonies CGI).
   */
  hasSousTraitanceBTP?: boolean
}

/**
 * Mention légale finalisée prête à être rendue. `key` sert de React key,
 * `text` est le texte à afficher, `italique` un hint d'affichage, `niveau`
 * une info éditoriale pour V2.4d (couleur/poids dans le composant si besoin).
 */
export type LegalMention = {
  key: string
  text: string
  italique?: boolean
  niveau: 'obligatoire' | 'recommande' | 'conditionnel'
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes TVA — DÉPLACÉES depuis lib/pdf.ts (V2.4a)
// ─────────────────────────────────────────────────────────────────────────────
//
// Note : lib/pdf.ts continue de les utiliser via un import depuis ce module
// (cf. V2.4a). On garde les textes EXACTEMENT identiques pour ne pas casser le
// PDF déjà émis chez les artisans.

export const TVA_MENTION_10 =
  'Je certifie, en qualité de preneur de la prestation, que les travaux réalisés concernent des locaux à usage d\'habitation achevés depuis plus de deux ans, qu\'ils n\'ont pas eu pour effet, sur une période de deux ans au plus, de concourir à la production d\'un immeuble neuf au sens du 2° du 2 du I de l\'article 257 du CGI, ni d\'entraîner une augmentation de la surface de plancher des locaux existants supérieure à 10 %, et, le cas échéant, qu\'ils ont la nature de travaux de rénovation.'

export const TVA_MENTION_5_5 =
  'Je certifie que les travaux réalisés concernent des locaux à usage d\'habitation achevés depuis plus de deux ans et constituent des travaux de rénovation ou d\'amélioration de la qualité énergétique au sens de l\'article 18 bis de l\'annexe IV du CGI (isolation thermique, systèmes de chauffage performants, énergies renouvelables).'

export const TVA_MENTION_AE =
  'TVA non applicable, article 293 B du Code Général des Impôts.'

/**
 * Mention "auto-liquidation TVA" pour sous-traitance BTP.
 * Art. 283-2 nonies CGI : le sous-traitant ne facture pas la TVA, le donneur
 * d'ordre l'acquitte directement.
 */
export const TVA_MENTION_AUTOLIQUIDATION =
  'Autoliquidation de la TVA par le preneur — art. 283-2 nonies du CGI (sous-traitance BTP).'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers texte unitaires
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtre interne : ne garder que les lignes "prestation" (exclure section,
 * sous_section, commentaire, saut_page). Tolère les designations historiques
 * "--- section ---" sans type.
 */
function isPrestationLegal(l: LegalLigne): boolean {
  const t = (l.type || '').toString()
  if (t === 'section' || t === 'sous_section' || t === 'commentaire' || t === 'saut_page') return false
  // Cas legacy : ancien format de section "--- foo ---" sans type
  if (!t && typeof l.designation === 'string' && l.designation.trim().startsWith('---')) return false
  return true
}

/**
 * Retourne les mentions TVA à afficher selon les taux présents dans les lignes
 * prestation.
 *
 * Règles (alignées sur lib/pdf.ts getTvaMentions, V15) :
 *   - Au moins 1 prestation ET toutes en taux 0 → mention 293 B (AE)
 *   - Sinon, on ajoute TVA_MENTION_10 si un taux 10 est présent
 *           et TVA_MENTION_5_5 si un taux 5.5 est présent
 *   - Pas de mention pour TVA 20% (taux normal)
 */
export function getTvaMentions(lignes: LegalLigne[] | null | undefined): string[] {
  const list = (lignes ?? []).filter(isPrestationLegal)
  if (list.length === 0) return []
  const allZero = list.every((l) => (l.taux_tva ?? 20) === 0)
  if (allZero) return [TVA_MENTION_AE]
  const taux = new Set(list.map((l) => l.taux_tva ?? 20))
  const out: string[] = []
  if (taux.has(10)) out.push(TVA_MENTION_10)
  if (taux.has(5.5)) out.push(TVA_MENTION_5_5)
  return out
}

/**
 * Mention "Franchise TVA — art. 293 B CGI".
 *
 * V15 — Ne PAS utiliser pour conditionner l'affichage sur les devis/factures :
 * la mention 293 B doit être basée sur les taux SAISIS (cf. getTvaMentions),
 * pour qu'un AE qui dépasse le seuil de franchise en cours d'année puisse
 * facturer avec TVA et voir la mention disparaître automatiquement.
 *
 * Ce helper est conservé pour des cas exceptionnels (ex: page Paramètres,
 * sandbox) mais n'est PAS appelé par getLegalMentionsDevis/Facture.
 */
export function getMentionFranchise(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  if (entreprise.franchise_tva === true) return TVA_MENTION_AE
  const fj = (entreprise.forme_juridique || '').toString().toLowerCase().trim()
  if (fj.includes('micro') || fj === 'ei' || fj.includes('entreprise individuelle') || fj.includes('auto')) {
    return TVA_MENTION_AE
  }
  return null
}

/**
 * Mention d'autoliquidation TVA sous-traitance BTP (art. 283-2 nonies CGI).
 */
export function getMentionAutoLiquidation(hasSousTraitance: boolean | undefined): string | null {
  return hasSousTraitance === true ? TVA_MENTION_AUTOLIQUIDATION : null
}

/**
 * Détermine le type effectif du client : si `clientType` est passé explicitement
 * on le respecte ; sinon on déduit (SIRET présent → pro). Par défaut, on
 * considère un particulier (cas le plus fréquent en BTP résidentiel).
 */
function resolveClientType(client: LegalClient | null | undefined, override?: 'particulier' | 'pro'): 'particulier' | 'pro' {
  if (override) return override
  if (!client) return 'particulier'
  // Si la colonne `client_type` ou `type` est explicite, on l'utilise
  const explicit = (client.client_type || client.type || '').toString().toLowerCase()
  if (explicit === 'professionnel' || explicit === 'pro' || explicit === 'entreprise') return 'pro'
  if (explicit === 'particulier') return 'particulier'
  // Heuristique : SIRET → pro
  if (client.siret && String(client.siret).trim() !== '') return 'pro'
  return 'particulier'
}

/**
 * Mention de rétractation 14 jours (art. L221-18 C. conso.).
 * Uniquement pour les clients particuliers (B2C). Pas applicable B2B.
 */
export function getRetractationText(_entreprise: LegalEntreprise | null | undefined, clientType?: 'particulier' | 'pro'): string | null {
  if (clientType === 'pro') return null
  return 'Rétractation 14 jours pour travaux hors établissement (art. L221-18 C. conso.).'
}

/**
 * Mention pénalités de retard (L441-10 C. com.).
 * Texte court parité PDF/HTML.
 */
export function getPenalitesText(_clientType?: 'particulier' | 'pro'): string {
  return 'Pénalités de retard : 3x le taux d\'intérêt légal en vigueur (art. L.441-10 C. com.).'
}

/**
 * Indemnité forfaitaire 40 € pour recouvrement (D441-5 C. com.).
 * UNIQUEMENT pour clients professionnels (B2B). Pas applicable B2C.
 */
export function getIndemniteForfaitaireText(clientType?: 'particulier' | 'pro'): string | null {
  if (clientType !== 'pro') return null
  return 'Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D.441-5 C. com.).'
}

/**
 * Mention "Pas d'escompte pour règlement anticipé" (L441-10 C. com.).
 */
export function getEscompteText(): string {
  return 'Pas d\'escompte pour paiement anticipé.'
}

/**
 * Mention décennale (Code des assurances). Format :
 *   "Assurance décennale : <assureur> — n° <numéro> — Zone : <zone>"
 *
 * Lit prioritairement les colonnes historiques (assurance_nom, decennale_numero,
 * assurance_zone) puis fallback sur decennale_assureur / decennale_zone si
 * présentes. Retourne null si rien à afficher.
 */
export function getDecennaleText(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  const assureur = (entreprise.assurance_nom || entreprise.decennale_assureur || '').toString().trim()
  const numero = (entreprise.decennale_numero || '').toString().trim()
  const zone = (entreprise.assurance_zone || entreprise.decennale_zone || '').toString().trim()
  if (!assureur && !numero && !zone) return null
  const parts: string[] = []
  parts.push(`Assurance décennale : ${assureur}`.trim())
  if (numero) parts.push(`n° ${numero}`)
  if (zone) parts.push(`Zone : ${zone}`)
  return parts.join(' — ')
}

/**
 * Mention forme juridique + capital. Quatre formats :
 *   - "SARL au capital de 10 000 €" (sociétés)
 *   - "<nom> — Entrepreneur individuel (Micro-entreprise)"
 *   - "<nom> — Entrepreneur individuel (EI)"
 *   - null si aucune info
 */
export function getFormeJuridiqueText(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  const fj = (entreprise.forme_juridique || '').toString().trim()
  if (!fj) return null
  const nom = (entreprise.nom || '').toString().trim()
  if (fj === 'EI') return nom ? `${nom} — Entrepreneur individuel (EI)` : 'Entrepreneur individuel (EI)'
  if (fj === 'Micro-entreprise' || fj.toLowerCase() === 'micro') {
    return nom ? `${nom} — Entrepreneur individuel (Micro-entreprise)` : 'Entrepreneur individuel (Micro-entreprise)'
  }
  // Sociétés avec capital social affiché si renseigné
  if (['EURL', 'SARL', 'SAS', 'SASU', 'SA'].includes(fj)) {
    const capital = (entreprise.capital_social || '').toString().trim()
    if (capital) return `${fj} au capital de ${capital}`
    return fj
  }
  return fj
}

/**
 * Mention RCS / RM (immatriculation au registre). Affiché tel quel.
 */
export function getRcsRmText(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  const v = (entreprise.rcs_rm || '').toString().trim()
  return v || null
}

/**
 * Mention médiateur de la consommation (art. L.616-1 C. conso. — obligatoire B2C).
 *
 * Logique :
 *   1) Si les 4 sous-champs structurés sont renseignés (au moins le nom) →
 *      format multi-lignes "Médiateur : <nom>, <adresse>, <CP> <ville>".
 *   2) Sinon, fallback sur le champ libre `mediateur` (legacy).
 *   3) Sinon, null.
 */
export function getMediateurText(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  const nom = (entreprise.mediateur_nom || '').toString().trim()
  if (nom) {
    const adresse = (entreprise.mediateur_adresse || '').toString().trim()
    const cp = (entreprise.mediateur_code_postal || '').toString().trim()
    const ville = (entreprise.mediateur_ville || '').toString().trim()
    const cpVille = [cp, ville].filter(Boolean).join(' ').trim()
    const tail = [adresse, cpVille].filter(Boolean).join(', ')
    return tail ? `Médiateur : ${nom}, ${tail}` : `Médiateur : ${nom}`
  }
  // Legacy : ancien champ libre
  const legacy = (entreprise.mediateur || '').toString().trim()
  return legacy ? `Médiateur : ${legacy}` : null
}

/**
 * Mention de qualification professionnelle (Qualibat, Qualifelec, RGE, etc.).
 */
export function getQualificationProText(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  const v = (entreprise.qualification_pro || '').toString().trim()
  return v ? `Qualification : ${v}` : null
}

/**
 * Mentions personnalisées libres (textarea Paramètres).
 */
export function getMentionsCustomText(entreprise: LegalEntreprise | null | undefined): string | null {
  if (!entreprise) return null
  const v = (entreprise.mentions_legales_custom || '').toString().trim()
  return v || null
}

/**
 * Mention "Devis gratuit et sans engagement" — À PRÉPARER pour V2.4c/d.
 * Pas encore de colonne DB dédiée, retourne null pour le moment.
 */
export function getMentionDevisGratuit(_entreprise: LegalEntreprise | null | undefined): string | null {
  // TODO V2.4c : ajouter colonne `devis_gratuit_text` ou flag dans la BDD
  return null
}

/**
 * Mention "émise conformément aux articles L441-3 et suivants du Code de
 * commerce". Présente sur les factures (parité PDF lib/pdf.ts).
 */
export function getMentionL441_3(): string {
  return 'Facture émise conformément aux articles L441-3 et suivants du Code de commerce.'
}

// ─────────────────────────────────────────────────────────────────────────────
// Façade DEVIS — liste ordonnée des mentions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste ORDONNÉE des mentions à afficher en bas d'un devis.
 *
 * Ordre (parité PDF + HTML dashboard) :
 *   1. Décennale
 *   2. Mentions TVA (293 B / 10% / 5.5%) selon taux des lignes
 *   3. Autoliquidation TVA si sous-traitance BTP
 *   4. Forme juridique (SARL au capital de... / EI / Micro)
 *   5. RCS / RM
 *   6. Qualification professionnelle
 *   7. Médiateur (B2C uniquement)
 *   8. Rétractation L221-18 (B2C uniquement)
 *   9. Mentions personnalisées libres
 */
export function getLegalMentionsDevis(ctx: LegalContext): LegalMention[] {
  const { entreprise, client, clientType, lignes, hasSousTraitanceBTP } = ctx
  const ct = resolveClientType(client, clientType)
  const out: LegalMention[] = []

  // 1. Décennale (obligatoire BTP)
  const dec = getDecennaleText(entreprise)
  if (dec) out.push({ key: 'decennale', text: dec, niveau: 'obligatoire' })

  // 2. Mentions TVA selon taux saisis
  for (const m of getTvaMentions(lignes)) {
    out.push({
      key: m === TVA_MENTION_AE ? 'tva-ae' : m === TVA_MENTION_10 ? 'tva-10' : 'tva-55',
      text: m,
      italique: m !== TVA_MENTION_AE,
      niveau: 'obligatoire',
    })
  }

  // 3. Autoliquidation BTP
  const ali = getMentionAutoLiquidation(hasSousTraitanceBTP)
  if (ali) out.push({ key: 'autoliq', text: ali, niveau: 'obligatoire' })

  // 4. Forme juridique + capital
  const fj = getFormeJuridiqueText(entreprise)
  if (fj) out.push({ key: 'forme-juridique', text: fj, niveau: 'obligatoire' })

  // 5. RCS/RM
  const rcs = getRcsRmText(entreprise)
  if (rcs) out.push({ key: 'rcs-rm', text: rcs, niveau: 'obligatoire' })

  // 6. Qualification pro
  const qp = getQualificationProText(entreprise)
  if (qp) out.push({ key: 'qualif', text: qp, niveau: 'recommande' })

  // 7. Médiateur (B2C)
  if (ct === 'particulier') {
    const med = getMediateurText(entreprise)
    if (med) out.push({ key: 'mediateur', text: med, niveau: 'obligatoire' })
  }

  // 8. Rétractation L221-18 (B2C)
  const retr = getRetractationText(entreprise, ct)
  if (retr) out.push({ key: 'retractation', text: retr, niveau: 'obligatoire' })

  // 9. Mentions personnalisées
  const custom = getMentionsCustomText(entreprise)
  if (custom) out.push({ key: 'custom', text: custom, niveau: 'recommande' })

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Façade FACTURE — liste ordonnée des mentions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste ORDONNÉE des mentions à afficher en bas d'une facture.
 *
 * Ordre (parité PDF + HTML dashboard) :
 *   1. Décennale
 *   2. Mentions TVA (293 B / 10% / 5.5%) selon taux des lignes
 *   3. Autoliquidation TVA si sous-traitance BTP
 *   4. Forme juridique (SARL au capital de... / EI / Micro)
 *   5. RCS / RM
 *   6. Qualification professionnelle
 *   7. Médiateur (B2C uniquement)
 *   8. Pénalités de retard L441-10
 *   9. Indemnité forfaitaire 40 € (B2B uniquement)
 *  10. Pas d'escompte pour paiement anticipé
 *  11. Mention L441-3 (conformité Code de commerce)
 *  12. Mentions personnalisées libres
 *
 * Note : pas de rétractation L221-18 sur facture (déjà actée sur le devis).
 */
export function getLegalMentionsFacture(ctx: LegalContext): LegalMention[] {
  const { entreprise, client, clientType, lignes, hasSousTraitanceBTP, factureType } = ctx
  const ct = resolveClientType(client, clientType)
  // V-AVOIR : un avoir n'est pas une creance. On RETIRE penalites de retard,
  // indemnite forfaitaire 40 EUR et escompte (sans objet pour un avoir).
  const estAvoir = factureType === 'avoir'
  const out: LegalMention[] = []

  // 1. Décennale
  const dec = getDecennaleText(entreprise)
  if (dec) out.push({ key: 'decennale', text: dec, niveau: 'obligatoire' })

  // 2. Mentions TVA
  for (const m of getTvaMentions(lignes)) {
    out.push({
      key: m === TVA_MENTION_AE ? 'tva-ae' : m === TVA_MENTION_10 ? 'tva-10' : 'tva-55',
      text: m,
      italique: m !== TVA_MENTION_AE,
      niveau: 'obligatoire',
    })
  }

  // 3. Autoliquidation BTP
  const ali = getMentionAutoLiquidation(hasSousTraitanceBTP)
  if (ali) out.push({ key: 'autoliq', text: ali, niveau: 'obligatoire' })

  // 4. Forme juridique
  const fj = getFormeJuridiqueText(entreprise)
  if (fj) out.push({ key: 'forme-juridique', text: fj, niveau: 'obligatoire' })

  // 5. RCS/RM
  const rcs = getRcsRmText(entreprise)
  if (rcs) out.push({ key: 'rcs-rm', text: rcs, niveau: 'obligatoire' })

  // 6. Qualification pro
  const qp = getQualificationProText(entreprise)
  if (qp) out.push({ key: 'qualif', text: qp, niveau: 'recommande' })

  // 7. Médiateur (B2C)
  if (ct === 'particulier') {
    const med = getMediateurText(entreprise)
    if (med) out.push({ key: 'mediateur', text: med, niveau: 'obligatoire' })
  }

  // 8. Pénalités de retard (L441-10) — retirees pour un avoir.
  if (!estAvoir) {
    out.push({ key: 'penalites', text: getPenalitesText(ct), niveau: 'obligatoire' })

    // 9. Indemnité forfaitaire 40 € (B2B)
    const ind = getIndemniteForfaitaireText(ct)
    if (ind) out.push({ key: 'indemnite-40', text: ind, niveau: 'obligatoire' })

    // 10. Pas d'escompte
    out.push({ key: 'escompte', text: getEscompteText(), niveau: 'obligatoire' })
  }

  // 11. Mention L441-3 (italique, parité PDF)
  out.push({ key: 'l441-3', text: getMentionL441_3(), italique: true, niveau: 'obligatoire' })

  // 12. Mentions personnalisées
  const custom = getMentionsCustomText(entreprise)
  if (custom) out.push({ key: 'custom', text: custom, niveau: 'recommande' })

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers existants déplacés depuis lib/helpers.ts (V2.4a)
// ─────────────────────────────────────────────────────────────────────────────
//
// CHAMPS_LEGAUX_DEVIS et champsLegauxManquants étaient dans lib/helpers.ts.
// On les déplace ici pour centraliser TOUTE la logique mentions légales, et on
// les re-exporte depuis lib/helpers.ts pour ne pas casser les imports existants
// (app/dashboard/devis/page.tsx les importe depuis @/lib/helpers).
//
// Sources légales : Code de commerce art. L441-9 (mentions obligatoires devis),
// CGI art. 242 nonies A (mentions obligatoires facture).

/**
 * Champs LEGAUX obligatoires sur le profil entreprise pour qu'un devis/facture
 * soit conforme. Si l'un d'eux manque, le PDF/HTML est juridiquement non
 * conforme (impossible d'identifier l'entreprise).
 *
 * Note : la signature `{ champ, label }` est CONSERVÉE (et non `{ key, label }`
 * comme suggéré dans le brief) pour rétrocompatibilité avec
 * app/dashboard/devis/page.tsx (champsManquants) et lib/helpers.ts.
 */
export const CHAMPS_LEGAUX_DEVIS: { champ: string; label: string }[] = [
  { champ: 'nom', label: 'Raison sociale' },
  { champ: 'siret', label: 'SIRET' },
  { champ: 'forme_juridique', label: 'Forme juridique' },
  { champ: 'adresse', label: 'Adresse' },
  { champ: 'code_postal', label: 'Code postal' },
  { champ: 'ville', label: 'Ville' },
]

/**
 * Retourne la liste des CHAMPS LÉGAUX MANQUANTS sur le profil entreprise.
 * Si la liste est vide → profil conforme.
 *
 * Utilisé pour :
 *   - Badge "Devis incomplet" dans la liste des devis (dashboard)
 *   - Bannière "Mentions légales incomplètes" en haut des dashboards devis/facture
 *   - Bannière jaune en haut du PDF du devis (lib/pdf.ts)
 */
export function champsLegauxManquants(
  entreprise: Record<string, unknown> | null | undefined
): string[] {
  if (!entreprise) return CHAMPS_LEGAUX_DEVIS.map((c) => c.label)
  return CHAMPS_LEGAUX_DEVIS
    .filter((c) => {
      const val = entreprise[c.champ]
      return !val || String(val).trim() === ''
    })
    .map((c) => c.label)
}

/**
 * Renvoie true si le profil entreprise est INCOMPLET au sens légal.
 */
export function isProfilLegalIncomplet(
  entreprise: Record<string, unknown> | null | undefined
): boolean {
  return champsLegauxManquants(entreprise).length > 0
}
