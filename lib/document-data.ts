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
  baseline: string
  adresseLine1: string
  adresseLine2: string
  siret?: string
  tvaIntra?: string
  tel?: string
  email?: string
  iban?: string
  bic?: string
  logoUrl?: string
  assurance?: string
  rcs?: string
  ape?: string
  formeJuridique?: string
  mediateurNom?: string
  mediateurAdresse?: string
  mediateurCp?: string
  mediateurVille?: string
  isAutoEntrepreneur: boolean
}

export interface DocumentClient {
  nom: string
  adresseLine1: string
  adresseLine2: string
  tel?: string
  email?: string
  siret?: string
}

export interface DocumentLeaf {
  n: string
  designation: string
  qte: number
  unite: string
  pu: number
  tva: number
}

export interface DocumentSub {
  n: string
  designation: string
  items: DocumentLeaf[]
  total: number
}

export interface DocumentGroup {
  n: string
  designation: string
  subs: DocumentSub[]
  total: number
}

export interface DocumentTvaLine {
  taux: number
  base: number
  montant: number
}

export interface DocumentTotals {
  sousTotalHt: number
  tvaLignes: DocumentTvaLine[]
  totalTva: number
  totalTtc: number
  acomptePct: number
  acompteMontant: number
  resteDu: number
}

export interface DocumentMeta {
  numero: string
  dateEmission: string
  dateRight: string
  dateRightLabel: string
  objet: string
  chantierAdresse: string
  conditionsPaiement?: string
  penalitesCustom?: string
  // V3.0b.1 — Gestion des dechets (AGEC) sur le devis
  dechets?: {
    nature?: string
    responsable?: string
    tri?: string
    collecteNom?: string
    collecteType?: string
  }
}

export interface DocumentData {
  docType: DocumentType
  artisan: DocumentArtisan
  client: DocumentClient
  meta: DocumentMeta
  groups: DocumentGroup[]
  totals: DocumentTotals
  isForfait: boolean
  // V3.0b.1 — type de client : 'pro' si SIRET present, sinon 'particulier'.
  clientType: 'pro' | 'particulier'
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
  type?: string | null
  niveau?: number | null
  numero?: string | null
  parent_id?: string | null
}

export interface RawDevis {
  numero: string
  date_emission?: string | null
  date_validite?: string | null
  objet?: string | null
  acompte_pourcent?: number | null
  conditions_paiement?: string | null
  // V3.0b.1 — Gestion des dechets (AGEC)
  dechets_nature?: string | null
  dechets_responsable?: string | null
  dechets_tri?: string | null
  dechets_collecte_nom?: string | null
  dechets_collecte_type?: string | null
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
// Helpers de formatage
// ---------------------------------------------------------------------------

export function eur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function tauxLabel(t: number): string {
  if (t === 0) return '—'
  const txt = t % 1 === 0 ? t.toString() : t.toString().replace('.', ',')
  return txt + ' %'
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR')
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Construction de l'arbre hierarchique
// ---------------------------------------------------------------------------

export function buildHierarchy(lignes: RawLigne[]): { groups: DocumentGroup[]; isForfait: boolean } {
  const cleanLignes = [...lignes]
    .filter(l => l.type !== 'saut_page' && l.type !== 'commentaire')
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))

  const hasHierarchy = cleanLignes.some(l => (l.type && l.type !== 'prestation') || (l.niveau && l.niveau < 3) || l.numero)

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
  const adresseLine1 = (ent.adresse ?? '').trim()
  const adresseLine2 = [(ent.code_postal ?? '').trim(), (ent.ville ?? '').trim()].filter(Boolean).join(' ')

  const assuranceParts: string[] = []
  if (ent.assurance_nom) assuranceParts.push(ent.assurance_nom)
  if (ent.decennale_numero) assuranceParts.push(`Garantie décennale n° ${ent.decennale_numero}`)
  if (ent.assurance_zone) assuranceParts.push(`Zone : ${ent.assurance_zone}`)
  const assurance = assuranceParts.length > 0 ? assuranceParts.join(' — ') : undefined

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
  const parts = [fallbackClient.adresse, [fallbackClient.code_postal, fallbackClient.ville].filter(Boolean).join(' ')].filter(Boolean)
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Builders publics
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

  const dechets = opts.doc.dechets_nature || opts.doc.dechets_responsable ||
                  opts.doc.dechets_tri || opts.doc.dechets_collecte_nom
    ? {
        nature: opts.doc.dechets_nature ?? undefined,
        responsable: opts.doc.dechets_responsable ?? undefined,
        tri: opts.doc.dechets_tri ?? undefined,
        collecteNom: opts.doc.dechets_collecte_nom ?? undefined,
        collecteType: opts.doc.dechets_collecte_type ?? undefined,
      }
    : undefined

  const meta: DocumentMeta = {
    numero: opts.doc.numero,
    dateEmission: fmtDate(opts.doc.date_emission),
    dateRight: fmtDate(opts.doc.date_validite),
    dateRightLabel: "Valable jusqu'au",
    objet: opts.doc.objet ?? '',
    chantierAdresse: buildChantierAdresse(opts.chantier, opts.client),
    conditionsPaiement: opts.doc.conditions_paiement ?? undefined,
    dechets,
  }

  const clientType: 'pro' | 'particulier' = (client.siret && client.siret.trim()) ? 'pro' : 'particulier'

  return { docType: 'devis', artisan, client, meta, groups, totals, isForfait, clientType }
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

  const clientType: 'pro' | 'particulier' = (client.siret && client.siret.trim()) ? 'pro' : 'particulier'

  return { docType: 'facture', artisan, client, meta, groups, totals, isForfait, clientType }
}
