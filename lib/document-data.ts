// ============================================================================
// lib/document-data.ts
// ----------------------------------------------------------------------------
// Source UNIQUE de donnees pour les 4 rendus devis/facture (V3.0b+c).
//
// Consommateurs :
//   - app/dashboard/devis/[id]/page.tsx       (HTML artisan)
//   - app/dashboard/factures/[id]/page.tsx    (HTML artisan)
//   - app/signer/[token]/page.tsx             (HTML client final)
//   - lib/pdf.ts                              (PDF jsPDF)
//
// Tout passe par buildDocumentData() pour garantir que les 4 rendus affichent
// strictement les memes montants, la meme hierarchie et les memes mentions.
// ============================================================================

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export type DocumentType = 'devis' | 'facture'

export interface DocumentArtisan {
  nom: string
  baseline: string         // metier (ex. "Installation & renovation electrique")
  adresseLine1: string     // numero + rue
  adresseLine2: string     // CP + ville
  siret?: string
  tvaIntra?: string
  tel?: string
  email?: string
  iban?: string
  bic?: string
  logoUrl?: string         // url Supabase storage du logo upload, ou null
  // Mentions legales
  assurance?: string       // "AXA - Garantie decennale n° POL XXX 2024 - Zone : France"
  rcs?: string             // "RCS Bordeaux 123 456 789" ou "RM Bordeaux ..."
  ape?: string             // "APE 4321A"
  formeJuridique?: string
  mediateurNom?: string
  mediateurAdresse?: string
  mediateurCp?: string
  mediateurVille?: string
  isAutoEntrepreneur: boolean
}

export interface DocumentClient {
  nom: string              // "M. Eric Ror" / "SARL Toto"
  adresseLine1: string
  adresseLine2: string     // CP + ville
  tel?: string
  email?: string
  siret?: string           // si client pro
}

export interface DocumentLeaf {
  n: string                // "1.1.1"
  designation: string
  qte: number
  unite: string
  pu: number
  tva: number              // 5.5 / 10 / 20 / 0
}

export interface DocumentSub {
  n: string                // "1.1"
  designation: string
  items: DocumentLeaf[]
  total: number            // sous-total HT
}

export interface DocumentGroup {
  n: string                // "1"
  designation: string
  subs: DocumentSub[]
  total: number            // total HT du groupe
}

export interface DocumentTvaLine {
  taux: number             // 5.5 / 10 / 20
  base: number             // base HT
  montant: number          // base * taux/100
}

export interface DocumentTotals {
  sousTotalHt: number
  tvaLignes: DocumentTvaLine[]
  totalTva: number
  totalTtc: number
  acomptePct: number       // 0 si pas d'acompte (facture, ou devis sans acompte)
  acompteMontant: number   // ttc * pct / 100
  resteDu: number          // ttc - acompte (pour le devis : reste a la livraison)
}

export interface DocumentMeta {
  numero: string           // "D-2026-32742" / "F-2026-06490"
  dateEmission: string     // "01/06/2026" deja formatte fr-FR
  dateRight: string        // "01/07/2026" (validite si devis, echeance si facture)
  dateRightLabel: string   // "Valable jusqu'au" / "Echeance"
  objet: string
  chantierAdresse: string  // adresse chantier complete sur une ligne
  // Conditions affichees dans le recap (colonne gauche)
  conditionsPaiement?: string
  // Penalites custom artisan (facture uniquement)
  penalitesCustom?: string
}

export interface DocumentData {
  docType: DocumentType
  artisan: DocumentArtisan
  client: DocumentClient
  meta: DocumentMeta
  groups: DocumentGroup[]
  totals: DocumentTotals
  // Forfait : si toutes les lignes sont reduites a un seul total sans detail
  isForfait: boolean
}

// ---------------------------------------------------------------------------
// Shape des donnees brutes (entree, alignee sur la DB Nexartis)
// ---------------------------------------------------------------------------

export interface RawLigne {
  id?: string
  designation: string
  quantite?: number | null
  unite?: string | null
  prix_unitaire_ht?: number | null
  taux_tva?: number | null
  ordre?: number | null
  type?: string | null      // 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page'
  niveau?: number | null    // 1 | 2 | 3
  numero?: string | null    // "1", "1.1", "1.1.1"
  parent_id?: string | null
}

export interface RawDevis {
  numero: string
  date_emission?: string | null
  date_validite?: string | null
  objet?: string | null
  acompte_pourcent?: number | null
  conditions_paiement?: string | null
}

export interface RawFacture {
  numero: string
  date_emission?: string | null
  date_echeance?: string | null
  objet?: string | null
  conditions_paiement?: string | null
  penalites_retard?: string | null
}

export interface RawClient {
  civilite?: string | null
  nom?: string | null
  prenom?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  siret?: string | null
  client_type?: string | null
}

export interface RawEntreprise {
  nom?: string | null
  metier?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  siret?: string | null
  tva_intracommunautaire?: string | null
  telephone?: string | null
  email?: string | null
  iban?: string | null
  bic?: string | null
  logo_url?: string | null
  assurance_nom?: string | null
  decennale_numero?: string | null
  assurance_zone?: string | null
  rcs_rm?: string | null
  code_naf?: string | null
  forme_juridique?: string | null
  mediateur?: string | null
  mediateur_nom?: string | null
  mediateur_adresse?: string | null
  mediateur_code_postal?: string | null
  mediateur_ville?: string | null
  auto_entrepreneur?: boolean | null
  franchise_tva?: boolean | null
}

export interface RawChantier {
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  nom?: string | null
}

// ---------------------------------------------------------------------------
// Helpers de formatage (utilises par HTML + PDF)
// ---------------------------------------------------------------------------

/** Formate un nombre en euro fr-FR avec 2 decimales. Ex: 1234.5 -> "1 234,50 €". */
export function eur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

/** Formate un taux TVA fr-FR avec virgule + espace insecable. Ex: 5.5 -> "5,5 %". */
export function tauxLabel(t: number): string {
  if (t === 0) return '—'
  const txt = t % 1 === 0 ? t.toString() : t.toString().replace('.', ',')
  return txt + ' %'
}

/** Convertit une ISO date "2026-06-01" ou Date en "01/06/2026". Vide si null/undefined. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR')
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Construction de l'arbre hierarchique a partir des lignes flat
// ---------------------------------------------------------------------------

/**
 * Transforme un tableau de lignes flat (DB) en arbre groupe/sous-section/prestation.
 *
 * Regles :
 *  - Si aucune ligne n'a de type/niveau/numero : toutes les lignes sont des
 *    prestations niveau 3, regroupees sous un faux groupe sans nom (mode "forfait
 *    ou liste simple").
 *  - Sinon : on regroupe selon le niveau (1 = group, 2 = sub, 3 = item).
 *  - Les commentaires et sauts de page sont ignores pour le rendu V3.0b+c
 *    (ils peuvent etre reintroduits dans une version ulterieure).
 */
export function buildHierarchy(lignes: RawLigne[]): { groups: DocumentGroup[]; isForfait: boolean } {
  const cleanLignes = [...lignes]
    .filter(l => l.type !== 'saut_page' && l.type !== 'commentaire')
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))

  const hasHierarchy = cleanLignes.some(l => (l.type && l.type !== 'prestation') || (l.niveau && l.niveau < 3) || l.numero)

  // -------- Cas 1 : pas de hierarchie -> un seul groupe implicite --------
  if (!hasHierarchy) {
    const items: DocumentLeaf[] = cleanLignes.map((l, i) => leafFromRaw(l, String(i + 1)))
    if (items.length === 0) {
      return { groups: [], isForfait: false }
    }
    const subTotal = items.reduce((s, it) => s + it.qte * it.pu, 0)
    return {
      groups: [
        {
          n: '',
          designation: '',
          subs: [
            {
              n: '',
              designation: '',
              items,
              total: subTotal,
            },
          ],
          total: subTotal,
        },
      ],
      isForfait: items.length === 1,
    }
  }

  // -------- Cas 2 : hierarchie --------
  const groups: DocumentGroup[] = []
  let currentGroup: DocumentGroup | null = null
  let currentSub: DocumentSub | null = null
  let groupCounter = 0
  let subCounter = 0
  let itemCounter = 0

  for (const l of cleanLignes) {
    const niveau = (l.niveau ?? (l.type === 'section' ? 1 : l.type === 'sous_section' ? 2 : 3))

    if (niveau === 1) {
      groupCounter += 1
      subCounter = 0
      itemCounter = 0
      currentGroup = {
        n: l.numero ?? String(groupCounter),
        designation: l.designation ?? '',
        subs: [],
        total: 0,
      }
      currentSub = null
      groups.push(currentGroup)
    } else if (niveau === 2) {
      if (!currentGroup) {
        // sub orpheline -> creer un groupe implicite
        groupCounter += 1
        subCounter = 0
        itemCounter = 0
        currentGroup = { n: String(groupCounter), designation: '', subs: [], total: 0 }
        groups.push(currentGroup)
      }
      subCounter += 1
      itemCounter = 0
      currentSub = {
        n: l.numero ?? `${currentGroup.n}.${subCounter}`,
        designation: l.designation ?? '',
        items: [],
        total: 0,
      }
      currentGroup.subs.push(currentSub)
    } else {
      // niveau 3 ou prestation
      if (!currentGroup) {
        groupCounter += 1
        subCounter = 0
        itemCounter = 0
        currentGroup = { n: String(groupCounter), designation: '', subs: [], total: 0 }
        groups.push(currentGroup)
      }
      if (!currentSub) {
        subCounter += 1
        itemCounter = 0
        currentSub = {
          n: `${currentGroup.n}.${subCounter}`,
          designation: '',
          items: [],
          total: 0,
        }
        currentGroup.subs.push(currentSub)
      }
      itemCounter += 1
      const numero = l.numero ?? `${currentSub.n}.${itemCounter}`
      currentSub.items.push(leafFromRaw(l, numero))
    }
  }

  // calcul des totaux remontants
  for (const g of groups) {
    g.total = 0
    for (const s of g.subs) {
      s.total = s.items.reduce((sum, it) => sum + it.qte * it.pu, 0)
      g.total += s.total
    }
  }

  return { groups, isForfait: false }
}

function leafFromRaw(l: RawLigne, numero: string): DocumentLeaf {
  return {
    n: numero,
    designation: l.designation ?? '',
    qte: Number(l.quantite ?? 0),
    unite: (l.unite ?? '').toString(),
    pu: Number(l.prix_unitaire_ht ?? 0),
    tva: Number(l.taux_tva ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Calcul des totaux
// ---------------------------------------------------------------------------

/**
 * Calcule les totaux a partir des groupes (deja hierarchises) + un pourcentage
 * d'acompte (0 = pas d'acompte).
 *
 * - sousTotalHt = somme de toutes les feuilles
 * - tvaLignes  = ventilation par taux (5.5, 10, 20...) avec base et montant
 * - totalTtc   = ht + tva
 * - acompte    = ttc * pct / 100
 * - resteDu    = ttc - acompte
 */
export function computeTotals(groups: DocumentGroup[], acomptePct: number): DocumentTotals {
  let sousTotalHt = 0
  const parTaux: Record<string, number> = {}

  for (const g of groups) {
    for (const s of g.subs) {
      for (const it of s.items) {
        const totalLigne = it.qte * it.pu
        sousTotalHt += totalLigne
        const key = String(it.tva)
        parTaux[key] = (parTaux[key] ?? 0) + totalLigne
      }
    }
  }

  const tvaLignes: DocumentTvaLine[] = Object.keys(parTaux)
    .map(k => Number(k))
    .sort((a, b) => a - b)
    .filter(taux => taux > 0)
    .map(taux => ({
      taux,
      base: parTaux[String(taux)],
      montant: parTaux[String(taux)] * (taux / 100),
    }))

  const totalTva = tvaLignes.reduce((s, l) => s + l.montant, 0)
  const totalTtc = sousTotalHt + totalTva
  const pct = Math.max(0, Math.min(100, acomptePct))
  const acompteMontant = (totalTtc * pct) / 100
  const resteDu = totalTtc - acompteMontant

  return {
    sousTotalHt,
    tvaLignes,
    totalTva,
    totalTtc,
    acomptePct: pct,
    acompteMontant,
    resteDu,
  }
}

// ---------------------------------------------------------------------------
// Construction des sous-objets artisan / client / meta
// ---------------------------------------------------------------------------

function buildArtisan(ent: RawEntreprise): DocumentArtisan {
  // Adresse en 2 lignes : "rue, num" + "CP ville"
  const adresseLine1 = (ent.adresse ?? '').trim()
  const adresseLine2 = [(ent.code_postal ?? '').trim(), (ent.ville ?? '').trim()].filter(Boolean).join(' ')

  // Assurance : on assemble "nom — Garantie decennale n° X — Zone : Y"
  const assuranceParts: string[] = []
  if (ent.assurance_nom) assuranceParts.push(ent.assurance_nom)
  if (ent.decennale_numero) assuranceParts.push(`Garantie décennale n° ${ent.decennale_numero}`)
  if (ent.assurance_zone) assuranceParts.push(`Zone : ${ent.assurance_zone}`)
  const assurance = assuranceParts.length > 0 ? assuranceParts.join(' — ') : undefined

  // Mediateur : si les 4 nouveaux champs sont remplis, on les concatene.
  // Sinon, fallback sur l'ancien champ libre `mediateur`.
  const medParts: string[] = []
  if (ent.mediateur_nom) medParts.push(ent.mediateur_nom)
  const medLoc = [ent.mediateur_adresse, [ent.mediateur_code_postal, ent.mediateur_ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  if (medLoc) medParts.push(medLoc)
  const mediateurFromFields = medParts.length > 0 ? medParts.join(' — ') : undefined

  return {
    nom: ent.nom ?? '',
    baseline: ent.metier ?? '',
    adresseLine1,
    adresseLine2,
    siret: ent.siret ?? undefined,
    tvaIntra: ent.tva_intracommunautaire ?? undefined,
    tel: ent.telephone ?? undefined,
    email: ent.email ?? undefined,
    iban: ent.iban ?? undefined,
    bic: ent.bic ?? undefined,
    logoUrl: ent.logo_url ?? undefined,
    assurance,
    rcs: ent.rcs_rm ?? undefined,
    ape: ent.code_naf ?? undefined,
    formeJuridique: ent.forme_juridique ?? undefined,
    mediateurNom: ent.mediateur_nom ?? undefined,
    mediateurAdresse: mediateurFromFields ?? ent.mediateur ?? undefined,
    mediateurCp: ent.mediateur_code_postal ?? undefined,
    mediateurVille: ent.mediateur_ville ?? undefined,
    isAutoEntrepreneur: Boolean(ent.auto_entrepreneur ?? ent.franchise_tva),
  }
}

function buildClient(cli: RawClient): DocumentClient {
  // "M. Eric Ror" / "Mme Dupont" / "SARL Toto" selon civilite + prenom + nom
  const civilite = (cli.civilite ?? '').trim()
  const prenom = (cli.prenom ?? '').trim()
  const nom = (cli.nom ?? '').trim()
  const nomComplet = [civilite, prenom, nom].filter(Boolean).join(' ')

  const adresseLine2 = [(cli.code_postal ?? '').trim(), (cli.ville ?? '').trim()].filter(Boolean).join(' ')

  return {
    nom: nomComplet,
    adresseLine1: (cli.adresse ?? '').trim(),
    adresseLine2,
    tel: cli.telephone ?? undefined,
    email: cli.email ?? undefined,
    siret: cli.siret ?? undefined,
  }
}

function buildChantierAdresse(chantier: RawChantier | null | undefined, fallbackClient: RawClient): string {
  if (chantier) {
    const parts = [chantier.adresse, [chantier.code_postal, chantier.ville].filter(Boolean).join(' ')].filter(Boolean)
    if (parts.length > 0) return parts.join(', ')
  }
  // fallback adresse client
  const parts = [fallbackClient.adresse, [fallbackClient.code_postal, fallbackClient.ville].filter(Boolean).join(' ')].filter(Boolean)
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Builders publics (un par type de doc)
// ---------------------------------------------------------------------------

export function buildDevisDocument(opts: {
  doc: RawDevis
  lignes: RawLigne[]
  client: RawClient
  entreprise: RawEntreprise
  chantier?: RawChantier | null
}): DocumentData {
  const artisan = buildArtisan(opts.entreprise)
  const client = buildClient(opts.client)
  const { groups, isForfait } = buildHierarchy(opts.lignes)
  const totals = computeTotals(groups, opts.doc.acompte_pourcent ?? 0)

  const meta: DocumentMeta = {
    numero: opts.doc.numero,
    dateEmission: fmtDate(opts.doc.date_emission),
    dateRight: fmtDate(opts.doc.date_validite),
    dateRightLabel: "Valable jusqu'au",
    objet: opts.doc.objet ?? '',
    chantierAdresse: buildChantierAdresse(opts.chantier, opts.client),
    conditionsPaiement: opts.doc.conditions_paiement ?? undefined,
  }

  return { docType: 'devis', artisan, client, meta, groups, totals, isForfait }
}

export function buildFactureDocument(opts: {
  doc: RawFacture
  lignes: RawLigne[]
  client: RawClient
  entreprise: RawEntreprise
  chantier?: RawChantier | null
}): DocumentData {
  const artisan = buildArtisan(opts.entreprise)
  const client = buildClient(opts.client)
  const { groups, isForfait } = buildHierarchy(opts.lignes)
  // facture : pas d'acompte (deja paye / pas applicable)
  const totals = computeTotals(groups, 0)

  const meta: DocumentMeta = {
    numero: opts.doc.numero,
    dateEmission: fmtDate(opts.doc.date_emission),
    dateRight: fmtDate(opts.doc.date_echeance),
    dateRightLabel: 'Échéance',
    objet: opts.doc.objet ?? '',
    chantierAdresse: buildChantierAdresse(opts.chantier, opts.client),
    conditionsPaiement: opts.doc.conditions_paiement ?? undefined,
    penalitesCustom: opts.doc.penalites_retard ?? undefined,
  }

  return { docType: 'facture', artisan, client, meta, groups, totals, isForfait }
}
