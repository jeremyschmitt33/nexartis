// ============================================================================
// lib/document-data.ts
// ----------------------------------------------------------------------------
// V3.0b.2 — Source UNIQUE de donnees pour les 4 rendus devis/facture.
// ============================================================================

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
  // V3.0b.2 — Signature / tampon artisan (base64) pour affichage cadre signature
  signatureBase64?: string
  tamponBase64?: string
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

export type LigneStatut = 'ferme' | 'facultatif' | 'option'

export interface DocumentLeaf {
  n: string
  designation: string
  qte: number
  unite: string
  pu: number
  tva: number
  // Statut d'inclusion (devis) : ferme par défaut. facultatif/option n'existent que côté devis.
  statut?: LigneStatut
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
  // V2 imputation — Deductions de REGLEMENT affichees sous le Total TTC (le TTC
  // et la TVA restent PLEINS). Canal generique partage par les 3 rendus pour
  // eviter toute divergence (ex. avoir d'un autre dossier impute en paiement).
  deductions?: { label: string; montant: number }[]
  // Net reel a payer apres deductions (= totalTtc - somme deductions). Si absent,
  // le rendu utilise totalTtc (comportement inchange).
  netAPayer?: number
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
  dechets?: {
    nature?: string
    responsable?: string
    tri?: string
    collecteNom?: string
    collecteType?: string
  }
  // V3.0c.18 — Métadonnées factures de situation
  // Permettent à DocumentRender d'afficher le titre "FACTURE DE SITUATION #N"
  // et le bandeau récapitulatif d'avancement.
  situation?: {
    numero: number
    pourcentage: number
    devisRef?: string
    devisDate?: string // déjà formatée fr-FR
    montantPrecedentHt?: number
    montantPrecedentTtc?: number
    resteAFacturerHt?: number
    resteAFacturerTtc?: number
  }
  // 2026-06-10 — Autoliquidation BTP (art. 283-2 nonies CGI).
  // Si true : forcer la TVA a 0% partout + afficher la mention obligatoire en pied de doc.
  // Quand undefined / false → rendu standard inchange (backward-compat).
  autoliquidationBtp?: boolean
  // V-AVOIR — Facture d'avoir. Si present, DocumentRender affiche le titre
  // "AVOIR", le libelle "NET A CREDITER", la reference d'origine, et MASQUE
  // l'echeance + la zone de signature.
  avoir?: {
    factureOrigineNumero?: string
    factureOrigineDate?: string // deja formatee fr-FR
    pourcentage?: number
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
  clientType: 'pro' | 'particulier'
  // Devis : postes "Option +" proposés en plus, NON comptés dans le total principal.
  options?: DocumentLeaf[]
  optionsTotals?: { ht: number; ttc: number }
  // Devis signé : postes proposés mais NON retenus par le client (annexe, hors total).
  nonRetenues?: DocumentLeaf[]
}

// ---------------------------------------------------------------------------
// Raw input (DB shape)
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
  optionnel?: boolean | null
  inclus_par_defaut?: boolean | null
  retenu_par_client?: boolean | null
}

export interface RawDevis {
  numero: string
  date_emission?: string | null
  date_validite?: string | null
  objet?: string | null
  acompte_pourcent?: number | null
  conditions_paiement?: string | null
  dechets_nature?: string | null
  dechets_responsable?: string | null
  dechets_tri?: string | null
  dechets_collecte_nom?: string | null
  dechets_collecte_type?: string | null
  // Gestion des déchets optionnelle : si false, le bloc déchets n'est pas affiché.
  afficher_dechets?: boolean | null
  // 2026-06-10 — Autoliquidation TVA BTP (sous-traitance). Optionnel + nullable
  // pour gerer le cas ou la migration SQL n'a pas encore ete executee.
  autoliquidation_btp?: boolean | null
}

export interface RawFacture {
  numero: string
  date_emission?: string | null
  date_echeance?: string | null
  objet?: string | null
  conditions_paiement?: string | null
  penalites_retard?: string | null
  // V3.0c.18 — Facture de situation : exposés à buildFactureDocument pour
  // alimenter meta.situation (et permettre l'affichage du bandeau d'avancement).
  type?: string | null
  // V-AVOIR — reference de la facture d'origine (pour le rendu de l'avoir).
  facture_origine_numero?: string | null
  facture_origine_date?: string | null
  // V2 imputation — avoir d'un autre dossier impute EN reglement de CETTE facture.
  avoir_impute_numero?: string | null
  avoir_impute_montant?: number | null
  numero_situation?: number | null
  pourcentage_situation?: number | null
  devis_ref?: string | null
  devis_date?: string | null
  montant_situation_precedent_ht?: number | null
  montant_situation_precedent_ttc?: number | null
  reste_a_facturer_ht?: number | null
  reste_a_facturer_ttc?: number | null
  // 2026-06-10 — Autoliquidation TVA BTP (sous-traitance). Optionnel + nullable
  // pour gerer le cas ou la migration SQL n'a pas encore ete executee.
  autoliquidation_btp?: boolean | null
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
  // V3.0b.2 — Signature / tampon en base64 (uploades par l'artisan dans Parametres)
  signature_base64?: string | null
  tampon_base64?: string | null
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
// Helpers
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
// Hierarchie
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

// Statut d'inclusion déduit des colonnes DB (optionnel + inclus_par_defaut).
function statutFromRaw(l: RawLigne): LigneStatut {
  if (!l.optionnel) return 'ferme'
  return l.inclus_par_defaut === false ? 'option' : 'facultatif'
}

function leafFromRaw(l: RawLigne, numero: string): DocumentLeaf {
  return {
    n: numero,
    designation: l.designation ?? '',
    qte: Number(l.quantite ?? 0),
    unite: (l.unite ?? '').toString(),
    pu: Number(l.prix_unitaire_ht ?? 0),
    tva: Number(l.taux_tva ?? 0),
    statut: statutFromRaw(l),
  }
}

// Totaux du bloc "Options +" (HT + TTC), calculés à part du total principal.
function computeOptionsTotals(items: DocumentLeaf[], forceTva0: boolean): { ht: number; ttc: number } {
  let ht = 0
  let tva = 0
  for (const it of items) {
    const t = it.qte * it.pu
    ht += t
    if (!forceTva0) tva += t * ((it.tva || 0) / 100)
  }
  return { ht, ttc: ht + tva }
}

// ---------------------------------------------------------------------------
// Totaux
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
// Builders
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
    signatureBase64: ent.signature_base64 ?? undefined,
    tamponBase64: ent.tampon_base64 ?? undefined,
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

// 2026-06-10 — Quand autoliquidation_btp = true, on force tous les taux TVA
// a 0 dans la hierarchie (parite PDF + HTML + signature). Le calcul des totaux
// (computeTotals) ignorera alors automatiquement la TVA (taux 0 = aucune ligne TVA).
function applyAutoliquidationOnGroups(groups: DocumentGroup[]): DocumentGroup[] {
  return groups.map(g => ({
    ...g,
    subs: g.subs.map(s => ({
      ...s,
      items: s.items.map(it => ({ ...it, tva: 0 })),
    })),
  }))
}

export function buildDevisDocument(opts: {
  doc: RawDevis
  lignes: RawLigne[]
  client: RawClient
  entreprise: RawEntreprise
  chantier?: RawChantier | null
}): DocumentData {
  const artisan = buildArtisan(opts.entreprise)
  const client = buildClient(opts.client)
  // Deux modes :
  //  • NON signé : "Option +" sorties dans un bloc séparé, "facultatifs" comptés (pastilles).
  //  • SIGNÉ (retenu_par_client renseigné) : on affiche le PÉRIMÈTRE ACCEPTÉ (lignes retenues,
  //    devenues "fermes") + une annexe des postes proposés mais NON retenus par le client.
  const isSigned = opts.lignes.some(l => l.retenu_par_client !== null && l.retenu_par_client !== undefined)
  const isOption = (l: RawLigne) => !!l.optionnel && l.inclus_par_defaut === false
  const mainLignes = isSigned
    ? opts.lignes.filter(l => l.retenu_par_client !== false).map(l => ({ ...l, optionnel: false }))
    : opts.lignes.filter(l => !isOption(l))
  const optionLignes = isSigned ? [] : opts.lignes.filter(isOption)
  const nonRetenuesLignes = isSigned
    ? opts.lignes.filter(l => l.retenu_par_client === false && (l.type ?? 'prestation') === 'prestation')
    : []
  const built = buildHierarchy(mainLignes)
  const isAutoliq = opts.doc.autoliquidation_btp === true
  const groups = isAutoliq ? applyAutoliquidationOnGroups(built.groups) : built.groups
  const isForfait = built.isForfait
  const totals = computeTotals(groups, opts.doc.acompte_pourcent ?? 0)
  const options: DocumentLeaf[] = optionLignes.map((l, i) => {
    const leaf = leafFromRaw(l, String(i + 1))
    return isAutoliq ? { ...leaf, tva: 0 } : leaf
  })
  const optionsTotals = options.length ? computeOptionsTotals(options, isAutoliq) : undefined
  const nonRetenues: DocumentLeaf[] = nonRetenuesLignes.map((l, i) => leafFromRaw({ ...l, optionnel: false }, String(i + 1)))

  const dechets = (opts.doc.afficher_dechets !== false) &&
                  (opts.doc.dechets_nature || opts.doc.dechets_responsable ||
                  opts.doc.dechets_tri || opts.doc.dechets_collecte_nom)
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
    autoliquidationBtp: isAutoliq,
  }

  const clientType: 'pro' | 'particulier' = (client.siret && client.siret.trim()) ? 'pro' : 'particulier'

  return { docType: 'devis', artisan, client, meta, groups, totals, isForfait, clientType, options: options.length ? options : undefined, optionsTotals, nonRetenues: nonRetenues.length ? nonRetenues : undefined }
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
  const built = buildHierarchy(opts.lignes)
  const isAutoliq = opts.doc.autoliquidation_btp === true
  const groups = isAutoliq ? applyAutoliquidationOnGroups(built.groups) : built.groups
  const isForfait = built.isForfait
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
    autoliquidationBtp: isAutoliq,
  }

  // V3.0c.18 — Snapshot situation (uniquement si type === 'situation' ET
  // numero_situation présent — sinon backward-compat : pas de bandeau).
  if (opts.doc.type === 'situation' && opts.doc.numero_situation !== null && opts.doc.numero_situation !== undefined) {
    meta.situation = {
      numero: opts.doc.numero_situation,
      pourcentage: opts.doc.pourcentage_situation ?? 0,
      devisRef: opts.doc.devis_ref ?? undefined,
      devisDate: opts.doc.devis_date ? fmtDate(opts.doc.devis_date) : undefined,
      montantPrecedentHt: opts.doc.montant_situation_precedent_ht ?? undefined,
      montantPrecedentTtc: opts.doc.montant_situation_precedent_ttc ?? undefined,
      resteAFacturerHt: opts.doc.reste_a_facturer_ht ?? undefined,
      resteAFacturerTtc: opts.doc.reste_a_facturer_ttc ?? undefined,
    }
  }

  // V-AVOIR — Snapshot avoir (uniquement si type === 'avoir').
  if (opts.doc.type === 'avoir') {
    // Pourcentage = TTC avoir / TTC origine (si exploitable). Sinon non affiche.
    meta.avoir = {
      factureOrigineNumero: opts.doc.facture_origine_numero ?? undefined,
      factureOrigineDate: opts.doc.facture_origine_date ? fmtDate(opts.doc.facture_origine_date) : undefined,
    }
  }

  // V2 imputation — Si un avoir d'un autre dossier a ete impute EN reglement de
  // cette facture, on l'affiche comme DEDUCTION sous le Total TTC (le TTC + la TVA
  // restent PLEINS = CA juste). Canal partage -> rendu identique dans les 3 sorties.
  const avoirImpute = Number(opts.doc.avoir_impute_montant ?? 0)
  if (opts.doc.type !== 'avoir' && avoirImpute > 0.01) {
    const numAv = opts.doc.avoir_impute_numero ? ` ${opts.doc.avoir_impute_numero}` : ''
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
    totals.deductions = [{ label: `Avoir${numAv} imputé`, montant: r2(avoirImpute) }]
    totals.netAPayer = r2(Math.max(0, totals.totalTtc - avoirImpute))
  }

  const clientType: 'pro' | 'particulier' = (client.siret && client.siret.trim()) ? 'pro' : 'particulier'

  return { docType: 'facture', artisan, client, meta, groups, totals, isForfait, clientType }
}
