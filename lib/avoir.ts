// =====================================================================
// lib/avoir.ts - Creation d'une facture d'AVOIR (Push 1)
// =====================================================================
// Un avoir est une facture (factures.type = 'avoir') creee DEPUIS une
// facture deja emise. Decisions de design verrouillees (cf. brief) :
//   - Montants stockes et affiches en POSITIF (le signe negatif n'apparait
//     que dans les agregats de CA = Somme factures - Somme avoirs).
//   - Ventilation TVA PAR TAUX : le pourcentage s'applique a CHAQUE base de
//     TVA de la facture d'origine, pas au TTC global. Pour garantir une
//     ventilation exacte dans les 4 rendus (qui regroupent par taux a partir
//     des lignes), on cree UNE LIGNE descriptive PAR TAUX present a l'origine.
//   - Le numero AV-AAAA-NNNN est genere par le trigger SQL set_facture_numero
//     (on NE fournit PAS numero).
//
// Garde-fous :
//   - Refus si l'origine est elle-meme un avoir (pas d'avoir sur avoir).
//   - Refus si l'origine n'est pas emise (brouillon interdit).
//   - Plafond : (montant demande + avoirs deja emis sur cette facture) ne peut
//     pas depasser le montant TTC de l'origine.
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export type AvoirUnite = 'pct' | 'eur'

// On arrondit au centime pour eviter les flottants disgracieux (0.30000000004).
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// =====================================================================
// V2 SUIVI REMBOURSEMENT — SOURCE UNIQUE du calcul "montant a rembourser".
// =====================================================================
// Utilisee a 4 endroits (creation d'avoir, page detail, accueil, liste) pour
// garantir EXACTEMENT le meme chiffre partout. Ne jamais redupliquer ce calcul.
//
// Idee : quand un client a deja paye sa facture et qu'on emet un avoir, on lui
// doit le trop-percu. Au niveau de la facture d'ORIGINE :
//   trop-percu (pool) = max(0, montant_paye + total des avoirs emis - TTC origine)
// Exemples (TTC origine = 1000) :
//   paye 1000, avoir 480           -> pool = max(0, 1000+480-1000) = 480 (tout du)
//   paye    0, avoir 480           -> pool = max(0,    0+480-1000) = 0   (rien : l'avoir reduit juste le solde du)
//   paye  600, avoir 480           -> pool = max(0,  600+480-1000) = 80  (seul le trop-percu est du)
// Pour UN avoir donne, on n'affiche jamais plus que son propre montant TTC :
//   a rembourser pour cet avoir = min(montant TTC de l'avoir, pool)
// NB : dans le cas rare [paiement partiel ET plusieurs avoirs], la somme des
//   "a rembourser" affiches par avoir peut depasser le pool reel (chaque avoir
//   est plafonne a son propre TTC, pas a une part du pool). On accepte ce leger
//   sur-affichage (jamais de sous-estimation = on ne cache jamais une dette).
export function poolRemboursementOrigine(
  montantPaye: number,
  totalAvoirsTtc: number,
  origineTtc: number,
): number {
  return round2(Math.max(0, round2(montantPaye) + round2(totalAvoirsTtc) - round2(origineTtc)))
}

export function montantRemboursementAvoir(
  avoirTtc: number,
  montantPayeOrigine: number,
  totalAvoirsTtc: number,
  origineTtc: number,
): number {
  const pool = poolRemboursementOrigine(montantPayeOrigine, totalAvoirsTtc, origineTtc)
  return round2(Math.min(round2(Math.max(0, avoirTtc)), pool))
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface OrigineLigne {
  designation: string | null
  quantite: number | null
  prix_unitaire_ht: number | null
  montant_ht: number | null
  taux_tva: number | null
  type: string | null
}

export interface CreerAvoirResult {
  id: string
  numero: string | null
}

// ---------------------------------------------------------------------------
// Helpers PURS de ventilation (exportes pour que la modale previsualise le
// montant TTC FINAL identique a celui qui sera reellement emis).
// ---------------------------------------------------------------------------

export interface AvoirVentilEntry {
  taux: number
  baseHt: number
}

export interface AvoirTotaux {
  ht: number
  tva: number
  ttc: number
}

/** Regroupe les bases HT par taux depuis les lignes brutes de l'origine. */
export function baseParTauxDepuisLignes(lignes: OrigineLigne[]): Map<number, number> {
  const baseParTaux = new Map<number, number>()
  for (const l of lignes) {
    const t = l.type ?? null
    if (t === 'section' || t === 'sous_section' || t === 'commentaire' || t === 'saut_page') continue
    const taux = Number(l.taux_tva ?? 0)
    const ht =
      l.montant_ht != null && Number(l.montant_ht) !== 0
        ? Number(l.montant_ht)
        : Number(l.quantite ?? 0) * Number(l.prix_unitaire_ht ?? 0)
    baseParTaux.set(taux, round2((baseParTaux.get(taux) ?? 0) + ht))
  }
  return baseParTaux
}

/**
 * Construit la ventilation (entries) de l'avoir + ses totaux, EXACTEMENT comme
 * le stockage et computeTotals : pas de round2 par taux sur la TVA, round2 final.
 * Le TTC retourne est l'autorite (== montant_ttc stocke == affiche).
 */
export function ventilerAvoir(
  baseParTaux: Map<number, number>,
  montantTtcDemande: number,
  origineTtc: number,
  entete: { ht: number; tva: number },
): { entries: AvoirVentilEntry[]; totaux: AvoirTotaux } {
  const fraction = origineTtc > 0 ? montantTtcDemande / origineTtc : 0
  let entries: AvoirVentilEntry[] = []
  if (baseParTaux.size > 0) {
    entries = Array.from(baseParTaux.entries())
      .map(([taux, baseHt]) => ({ taux, baseHt: round2(baseHt * fraction) }))
      .filter((e) => e.baseHt > 0)
  }
  if (entries.length === 0) {
    const oHt = round2(entete.ht)
    const oTva = round2(entete.tva)
    let taux = 0
    if (oHt > 0 && oTva > 0) taux = Math.round((oTva / oHt) * 1000) / 10
    const baseHt = oHt > 0 ? round2(oHt * fraction) : round2(montantTtcDemande / (1 + taux / 100))
    entries = [{ taux, baseHt }]
  }
  let ht = 0
  let tvaRaw = 0
  for (const e of entries) {
    ht += e.baseHt
    tvaRaw += (e.baseHt * e.taux) / 100
  }
  ht = round2(ht)
  return { entries, totaux: { ht, tva: round2(tvaRaw), ttc: round2(ht + tvaRaw) } }
}

/**
 * Cree une facture d'avoir depuis une facture d'origine emise.
 * @param supabase  client Supabase navigateur (RLS = user_id auto).
 * @param origineId id de la facture d'origine.
 * @param montant   valeur saisie (pourcentage si unite='pct', euros TTC si unite='eur').
 * @param unite     'pct' (0-100) ou 'eur'.
 * @returns         id + numero (numero renseigne si le trigger l'a pose).
 * @throws          Error avec message clair en cas de garde-fou non respecte.
 */
export async function creerAvoir(
  supabase: SupabaseClient,
  origineId: string,
  montant: number,
  unite: AvoirUnite,
): Promise<CreerAvoirResult> {
  // 1) Charger la facture d'origine.
  const { data: origine, error: origErr } = await supabase
    .from('factures')
    .select(
      'id, type, statut, client_id, client_nom, client_email, client_adresse, client_telephone, chantier_id, numero, date_emission, montant_ht, montant_tva, montant_ttc, montant_paye',
    )
    .eq('id', origineId)
    .is('deleted_at', null)
    .maybeSingle()

  if (origErr) throw new Error(origErr.message)
  if (!origine) throw new Error("Facture d'origine introuvable.")

  const o = origine as Record<string, unknown>

  // 2) Garde-fous.
  if ((o.type as string | null) === 'avoir') {
    throw new Error("Impossible : on ne cree pas d'avoir sur un avoir.")
  }
  const statut = (o.statut as string | null) ?? ''
  if (statut === 'brouillon') {
    throw new Error("Cette facture est encore en brouillon : emettez-la d'abord avant de creer un avoir.")
  }
  if (statut === 'annulee') {
    throw new Error('Cette facture est annulee : aucun avoir possible.')
  }

  const origineTtc = round2(Number(o.montant_ttc ?? 0))
  if (origineTtc <= 0) {
    throw new Error("Le montant TTC de la facture d'origine est nul : aucun avoir possible.")
  }

  // Montant demande (TTC) selon l'unite de saisie.
  let montantTtcDemande: number
  let pourcentage: number
  if (unite === 'pct') {
    pourcentage = Math.max(0, Math.min(100, montant))
    montantTtcDemande = round2((origineTtc * pourcentage) / 100)
  } else {
    montantTtcDemande = round2(Math.max(0, montant))
    pourcentage = Math.round((montantTtcDemande / origineTtc) * 100)
  }
  if (montantTtcDemande <= 0) {
    throw new Error("Le montant de l'avoir doit etre superieur a 0.")
  }

  // Plafond : somme des avoirs deja emis sur cette facture.
  const { data: avoirsExistants, error: avErr } = await supabase
    .from('factures')
    .select('montant_ttc')
    .eq('facture_origine_id', origineId)
    .eq('type', 'avoir')
    .is('deleted_at', null)
  if (avErr) throw new Error(avErr.message)
  const dejaAvoirise = round2(
    (avoirsExistants ?? []).reduce((s: number, a: Record<string, unknown>) => s + Number(a.montant_ttc ?? 0), 0),
  )
  // Tolerance 1 centime pour les arrondis.
  if (montantTtcDemande + dejaAvoirise > origineTtc + 0.01) {
    const restant = round2(origineTtc - dejaAvoirise)
    throw new Error(
      dejaAvoirise > 0
        ? `Plafond depasse : ${fmtEur(dejaAvoirise)} d'avoirs deja emis sur cette facture. Il reste au maximum ${fmtEur(restant)} a crediter.`
        : `Le montant de l'avoir (${fmtEur(montantTtcDemande)}) ne peut pas depasser le total TTC de la facture (${fmtEur(origineTtc)}).`,
    )
  }

  // 3) Ventilation TVA par taux : lire les lignes d'origine, regrouper par taux.
  const { data: lignesRaw, error: ligErr } = await supabase
    .from('facture_lignes')
    .select('designation, quantite, prix_unitaire_ht, montant_ht, taux_tva, type')
    .eq('facture_id', origineId)
  if (ligErr) throw new Error(ligErr.message)

  const lignes = (lignesRaw ?? []) as OrigineLigne[]

  // Base HT par taux (on ignore sections / sous-sections / commentaires).
  const baseParTaux = baseParTauxDepuisLignes(lignes)

  // Ventilation + totaux : la VENTILATION par taux est l'autorite (source unique
  // partagee avec la modale). IMPORTANT cohérence centime : computeTotals
  // (lib/document-data.ts) calcule la TVA par taux SANS arrondir chaque montant
  // (montant = base * taux/100), puis totalTtc = Σ base + Σ montant. Nos lignes
  // d'avoir ont quantite=1 et prix_unitaire_ht=baseHt, donc computeTotals partira
  // EXACTEMENT de ces baseHt. ventilerAvoir reproduit ce calcul a l'identique
  // pour que montant_ttc stocke == totalTtc affiche, au centime pres.
  const { entries, totaux } = ventilerAvoir(baseParTaux, montantTtcDemande, origineTtc, {
    ht: Number(o.montant_ht ?? 0),
    tva: Number(o.montant_tva ?? 0),
  })
  const avoirHt = totaux.ht
  const avoirTva = totaux.tva
  // TTC de l'avoir = HT + TVA recalcules depuis la ventilation (autorite), PAS
  // la saisie brute. Garantit NET A CREDITER affiche == montant_ttc stocke.
  const avoirTtc = totaux.ttc

  // 4) INSERT facture d'avoir (numero AV genere par le trigger).
  const dateOrigineFr = fmtDateFr(o.date_emission as string | null)
  const today = new Date().toISOString().slice(0, 10)
  // V2 SUIVI REMBOURSEMENT — un avoir est "a rembourser" si le client a deja paye
  // PLUS que ce qu'il doit reellement une fois l'avoir applique. Regle au centime :
  //   montant a rembourser = max(0, montant_paye + total avoirs - TTC origine).
  // Avantages vs l'ancienne version (statut === 'payee' || 'Encaissee') :
  //   - robuste : ne depend plus de la chaine de statut (l'ancien 'Encaissee' sans
  //     accent ne matchait jamais ; seul 'payee' est stocke en base) ;
  //   - gere le paiement PARTIEL (un acompte superieur au net du genere un avoir
  //     a rembourser des la creation) ;
  //   - coherent avec le trigger SQL propagate_avoir_remboursement qui prend le
  //     relais si la facture d'origine est payee APRES la creation de l'avoir.
  const montantPayeOrigine = round2(Number(o.montant_paye ?? 0))
  const totalAvoirsApres = round2(dejaAvoirise + montantTtcDemande)
  const refundDu = poolRemboursementOrigine(montantPayeOrigine, totalAvoirsApres, origineTtc)
  const remboursementStatut = refundDu > 0.01 ? 'a_rembourser' : 'non_du'

  const insertPayload: Record<string, unknown> = {
    type: 'avoir',
    client_id: o.client_id ?? null,
    client_nom: o.client_nom ?? null,
    client_email: o.client_email ?? null,
    client_adresse: o.client_adresse ?? null,
    client_telephone: o.client_telephone ?? null,
    chantier_id: o.chantier_id ?? null,
    facture_origine_id: origineId,
    facture_origine_numero: (o.numero as string | null) ?? null,
    facture_origine_date: (o.date_emission as string | null) ?? null,
    date_emission: today,
    statut: 'brouillon',
    montant_ht: avoirHt,
    montant_tva: avoirTva,
    montant_ttc: avoirTtc,
    montant_paye: 0,
    remboursement_statut: remboursementStatut,
    // V-AVOIR : pas d'objet redondant. La reference d'origine est portee par
    // l'en-tete (sous le titre AVOIR) et par la designation de ligne. Un objet
    // "Avoir sur facture X" ferait doublon -> on laisse vide.
    objet: null,
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecte')
  insertPayload.user_id = user.id

  const { data: inserted, error: insErr } = await supabase
    .from('factures')
    .insert(insertPayload)
    .select('id, numero')
    .single()
  if (insErr) throw new Error(insErr.message)
  const newId = (inserted as Record<string, unknown>).id as string
  const newNumero = ((inserted as Record<string, unknown>).numero as string | null) ?? null

  // 5) INSERT lignes descriptives (une par taux pour une ventilation TVA exacte).
  const pourcentageLabel = unite === 'pct' ? pourcentage : Math.round((montantTtcDemande / origineTtc) * 100)
  const origineNum = (o.numero as string | null) ?? ''
  // Libelle pedagogique : total (100%) vs partiel.
  const estTotal = montantTtcDemande + dejaAvoirise >= origineTtc - 0.01 && dejaAvoirise <= 0.01
  const baseLabel = estTotal
    ? `Avoir sur la facture n° ${origineNum} du ${dateOrigineFr} — ${pourcentageLabel}% du montant total de ${fmtEur(origineTtc)} TTC`
    : `Avoir partiel de ${fmtEur(montantTtcDemande)} TTC sur la facture n° ${origineNum} du ${dateOrigineFr} (${pourcentageLabel}% du montant initial de ${fmtEur(origineTtc)} TTC)`

  const multiTaux = entries.length > 1
  const lignesAvoir = entries.map((e, idx) => {
    const designation = multiTaux ? `${baseLabel} — part TVA ${e.taux}%` : baseLabel
    return {
      // montant_ht est une colonne GENERATED ALWAYS (= quantite * prix_unitaire_ht),
      // donc EN LECTURE SEULE : on ne l'insere PAS (l'INSERT planterait). Elle se
      // calcule toute seule a partir de quantite=1 et prix_unitaire_ht=baseHt.
      facture_id: newId,
      designation,
      quantite: 1,
      unite: 'forfait',
      prix_unitaire_ht: e.baseHt,
      taux_tva: e.taux,
      ordre: idx,
      type: 'prestation',
    }
  })

  const { error: liErr } = await supabase.from('facture_lignes').insert(lignesAvoir)
  if (liErr) {
    // L'entete est creee mais les lignes ont echoue : on remonte l'erreur pour
    // que l'appelant informe l'utilisateur (l'avoir sera visible mais vide).
    throw new Error(`Avoir cree mais lignes non enregistrees : ${liErr.message}`)
  }

  return { id: newId, numero: newNumero }
}
