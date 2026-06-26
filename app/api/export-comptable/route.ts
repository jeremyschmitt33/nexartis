/**
 * Export comptable CSV — devis & factures
 *
 * POST /api/export-comptable
 *
 * Body :
 *   {
 *     type: 'factures' | 'devis',
 *     dateDebut?: string (YYYY-MM-DD),
 *     dateFin?:   string (YYYY-MM-DD),
 *     format:     'csv-simple' | 'fec'
 *   }
 *
 * Réponse :
 *   text/csv (UTF-8 + BOM) — Content-Disposition: attachment
 *
 * Sécurité :
 *   - Auth Supabase obligatoire (getAuthenticatedUser)
 *   - Rate limit : 5 exports / minute / IP
 *   - RLS stricte : filtre user_id = user.id sur toutes les requêtes
 *
 * Format CSV simple (Excel français compatible) :
 *   Date;Numéro;Type;Client;SIRET;Adresse;Objet;Montant HT;Taux TVA;Montant TVA;Montant TTC;Statut;Date paiement
 *
 * Format FEC : non implémenté (réservé pour V2, voir TODO en bas de fichier).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser,
  getClientIp,
  checkRateLimit,
  rateLimitError,
  secureError,
  unauthorizedError,
} from '@/lib/api-security'
import { buildCsvAchats, type AchatRow, type FournisseurLite } from '@/lib/export/csv-achats'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type ExportType = 'factures' | 'devis' | 'achats'
type ExportFormat = 'csv-simple' | 'fec'

interface ExportBody {
  type: ExportType
  dateDebut?: string
  dateFin?: string
  format: ExportFormat
  // V3.1 — P5 : si true, on décompose les factures multi-taux en une ligne CSV
  // par taux de TVA (pour la compta). Sinon, on garde l'agrégation actuelle
  // mais on remplace le taux moyen pondéré par "Multi-taux" quand >1 taux trouvé.
  detail?: boolean
}

interface ClientLite {
  id: string
  civilite: string | null
  nom: string | null
  prenom: string | null
  raison_sociale: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  siret: string | null
  type: string | null
}

interface DocumentRow {
  id: string
  numero: string | null
  date_emission: string | null
  created_at: string | null
  date_paiement?: string | null
  date_validite?: string | null
  objet: string | null
  client_id: string | null
  client_nom: string | null
  notes_client: string | null
  montant_ht: number | null
  montant_tva: number | null
  montant_ttc: number | null
  statut: string | null
}

// ────────────────────────────────────────────────────────────
// Helpers CSV
// ────────────────────────────────────────────────────────────

const BOM = '﻿'
const SEP = ';'
const EOL = '\r\n'

/**
 * Échappe une valeur pour CSV :
 * - si elle contient ;, ", \n, \r → on entoure de guillemets et on double les "
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str === '') return ''
  const needsQuoting = /[;"\r\n]/.test(str)
  if (!needsQuoting) return str
  return '"' + str.replace(/"/g, '""') + '"'
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(SEP)
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  // On accepte aussi bien YYYY-MM-DD que ISO 8601 complet
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0,00'
  // Excel français attend la virgule décimale
  return Number(n).toFixed(2).replace('.', ',')
}

/**
 * Calcule un taux TVA moyen pondéré à partir de HT/TVA.
 * Si HT = 0 → vide (cas franchise art. 293 B / sans TVA).
 */
function computeTauxTva(ht: number | null | undefined, tva: number | null | undefined): string {
  const h = Number(ht ?? 0)
  const t = Number(tva ?? 0)
  if (h <= 0) return ''
  if (t <= 0) return '0%'
  const taux = (t / h) * 100
  // Arrondi au demi-pour-cent (5%, 10%, 20%) pour rester lisible
  const rounded = Math.round(taux * 10) / 10
  return `${String(rounded).replace('.', ',')}%`
}

// ────────────────────────────────────────────────────────────
// Reconstruction de l'identité client (parité avec download-facture)
// ────────────────────────────────────────────────────────────

interface ClientResolved {
  nom: string
  adresse: string
  siret: string
}

function resolveClient(doc: DocumentRow, clientsById: Map<string, ClientLite>): ClientResolved {
  // PRIORITÉ 1 : snapshot figé sur le document (parité HTML)
  if (doc.notes_client) {
    const parts = String(doc.notes_client).split(' | ')
    const nom = parts[0] || doc.client_nom || ''
    const adresse = parts.length > 1 ? parts.slice(1).join(' | ') : ''
    let siret = ''
    if (doc.client_id) {
      const c = clientsById.get(doc.client_id)
      if (c?.siret) siret = c.siret
    }
    return { nom, adresse, siret }
  }

  // PRIORITÉ 2 : table clients
  if (doc.client_id) {
    const c = clientsById.get(doc.client_id)
    if (c) {
      const nomComplet =
        c.raison_sociale ||
        `${c.civilite || ''} ${c.prenom || ''} ${c.nom || ''}`.replace(/\s+/g, ' ').trim()
      const adresseParts = [c.adresse, `${c.code_postal || ''} ${c.ville || ''}`.trim()].filter(
        (p) => p && p.trim(),
      )
      return {
        nom: nomComplet || doc.client_nom || '',
        adresse: adresseParts.join(' | '),
        siret: c.siret || '',
      }
    }
  }

  // PRIORITÉ 3 : fallback sur le champ direct
  return { nom: doc.client_nom || '', adresse: '', siret: '' }
}

// ────────────────────────────────────────────────────────────
// Mapping des statuts (lisible humain)
// ────────────────────────────────────────────────────────────

const STATUS_FACTURE: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  envoyée: 'Envoyée',
  payee: 'Encaissée',
  payée: 'Encaissée',
  partielle: 'Partielle',
  en_attente: 'En attente',
  en_retard: 'En retard',
  archivee: 'Archivée',
  archivée: 'Archivée',
}

const STATUS_DEVIS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  finalise: 'Envoyé',
  signe: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
  facture: 'Facturé',
}

function humanStatus(type: ExportType, statut: string | null | undefined): string {
  if (!statut) return ''
  const map = type === 'factures' ? STATUS_FACTURE : STATUS_DEVIS
  return map[statut] || statut
}

// ────────────────────────────────────────────────────────────
// Génération CSV simple
// ────────────────────────────────────────────────────────────

// V3.1 — P5 : aggrégation par taux à partir des lignes facture
interface LigneAggregat { taux: number; ht: number; tva: number }

function aggregateByTaux(lignes: Array<{ taux_tva: number | null; quantite: number | null; prix_unitaire_ht: number | null; type: string | null }>): LigneAggregat[] {
  const map = new Map<number, LigneAggregat>()
  for (const l of lignes) {
    // On ne prend que les lignes de prestation (pas section/sous-section/commentaire).
    if (l.type && l.type !== 'prestation') continue
    const taux = Number(l.taux_tva ?? 0)
    const ht = Number(l.quantite ?? 0) * Number(l.prix_unitaire_ht ?? 0)
    if (ht === 0) continue
    const existing = map.get(taux)
    if (existing) {
      existing.ht += ht
      existing.tva += ht * (taux / 100)
    } else {
      map.set(taux, { taux, ht, tva: ht * (taux / 100) })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.taux - b.taux)
}

function buildCsvSimple(
  type: ExportType,
  docs: DocumentRow[],
  clientsById: Map<string, ClientLite>,
  // V3.1 — P5 : map doc.id → aggrégat par taux (uniquement renseigné pour les factures).
  // Permet de détecter le multi-taux et, si detail=true, de décomposer en N lignes.
  taxAggregateByDocId: Map<string, LigneAggregat[]>,
  detail: boolean,
): string {
  const headers = [
    'Date',
    'Numéro',
    'Type',
    'Client',
    'SIRET',
    'Adresse',
    'Objet',
    'Montant HT',
    'Taux TVA',
    'Montant TVA',
    'Montant TTC',
    'Statut',
    'Date paiement',
  ]

  const lines: string[] = [csvRow(headers)]
  const typeLabel = type === 'factures' ? 'Facture' : 'Devis'

  for (const doc of docs) {
    const client = resolveClient(doc, clientsById)
    const date = formatDateFr(doc.date_emission || doc.created_at)
    const datePaiement = type === 'factures' ? formatDateFr(doc.date_paiement) : ''
    const aggregate = taxAggregateByDocId.get(doc.id) || []

    // ── Cas multi-taux ── : >1 taux distinct sur les lignes prestation.
    if (aggregate.length > 1) {
      if (detail) {
        // Mode "détaillé" : on émet UNE ligne CSV par taux.
        for (const agg of aggregate) {
          const ratioHt = doc.montant_ht && doc.montant_ht > 0 ? agg.ht / doc.montant_ht : 0
          const ttcPart = ratioHt > 0 ? Number(doc.montant_ttc ?? 0) * ratioHt : agg.ht + agg.tva
          lines.push(
            csvRow([
              date,
              doc.numero || '',
              typeLabel,
              client.nom,
              client.siret,
              client.adresse,
              doc.objet || '',
              formatMoney(agg.ht),
              agg.taux <= 0 ? '0%' : `${String(agg.taux).replace('.', ',')}%`,
              formatMoney(agg.tva),
              formatMoney(ttcPart),
              humanStatus(type, doc.statut),
              datePaiement,
            ]),
          )
        }
        continue
      }
      // Mode "simple" multi-taux : on n'inscrit pas un taux moyen pondéré
      // (trompeur), on indique "Multi-taux" et on liste les taux à part dans
      // la colonne Taux TVA pour que l'expert-comptable voie l'éclat.
      const tauxList = aggregate.map(a => a.taux <= 0 ? '0%' : `${String(a.taux).replace('.', ',')}%`).join(' + ')
      lines.push(
        csvRow([
          date,
          doc.numero || '',
          typeLabel,
          client.nom,
          client.siret,
          client.adresse,
          doc.objet || '',
          formatMoney(doc.montant_ht),
          `Multi-taux (${tauxList})`,
          formatMoney(doc.montant_tva),
          formatMoney(doc.montant_ttc),
          humanStatus(type, doc.statut),
          datePaiement,
        ]),
      )
      continue
    }

    // ── Cas mono-taux ── : on garde le comportement legacy (taux moyen pondéré).
    lines.push(
      csvRow([
        date,
        doc.numero || '',
        typeLabel,
        client.nom,
        client.siret,
        client.adresse,
        doc.objet || '',
        formatMoney(doc.montant_ht),
        computeTauxTva(doc.montant_ht, doc.montant_tva),
        formatMoney(doc.montant_tva),
        formatMoney(doc.montant_ttc),
        humanStatus(type, doc.statut),
        datePaiement,
      ]),
    )
  }

  return BOM + lines.join(EOL) + EOL
}

// ────────────────────────────────────────────────────────────
// Validation du body
// ────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseBody(raw: unknown): ExportBody | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Body invalide' }
  const b = raw as Record<string, unknown>

  const type = b.type
  if (type !== 'factures' && type !== 'devis' && type !== 'achats') {
    return { error: 'Type invalide (attendu : "factures", "devis" ou "achats")' }
  }

  const format = b.format
  if (format !== 'csv-simple' && format !== 'fec') {
    return { error: 'Format invalide (attendu : "csv-simple" ou "fec")' }
  }

  const dateDebut = b.dateDebut
  if (dateDebut !== undefined && dateDebut !== null && dateDebut !== '') {
    if (typeof dateDebut !== 'string' || !DATE_RE.test(dateDebut)) {
      return { error: 'dateDebut invalide (format attendu : YYYY-MM-DD)' }
    }
  }

  const dateFin = b.dateFin
  if (dateFin !== undefined && dateFin !== null && dateFin !== '') {
    if (typeof dateFin !== 'string' || !DATE_RE.test(dateFin)) {
      return { error: 'dateFin invalide (format attendu : YYYY-MM-DD)' }
    }
  }

  // V3.1 — P5 : option "detail" pour décomposer multi-taux
  const detail = b.detail === true

  return {
    type,
    format,
    dateDebut: typeof dateDebut === 'string' && dateDebut !== '' ? dateDebut : undefined,
    dateFin: typeof dateFin === 'string' && dateFin !== '' ? dateFin : undefined,
    detail,
  }
}

// ────────────────────────────────────────────────────────────
// Handler POST
// ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limit : 5 exports / minute / IP
    const ip = getClientIp(req)
    if (!checkRateLimit(`export-comptable:${ip}`, 5, 60_000)) {
      return rateLimitError()
    }

    // Auth obligatoire
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // Parsing + validation
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return secureError('Body JSON invalide')
    }

    const parsed = parseBody(rawBody)
    if ('error' in parsed) return secureError(parsed.error)
    const { type, format, dateDebut, dateFin, detail } = parsed

    // Format FEC : non implémenté pour l'instant — la structure switch est en
    // place pour le brancher facilement dans une session ultérieure.
    if (format === 'fec') {
      return secureError(
        'Format FEC non disponible pour cette version. Utilisez "csv-simple" en attendant.',
        501,
      )
    }

    // Client Supabase admin (la sécurité repose sur le filtre user_id en dur)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // ── Cas ACHATS (depenses fournisseurs) : flux distinct, pas de client/numero.
    if (type === 'achats') {
      let aQuery = supabase
        .from('achats')
        .select('id, date_achat, description, montant_ht, taux_tva, montant_ttc, fournisseur_id, chantier_id, notes')
        .eq('user_id', user.id)
        .order('date_achat', { ascending: true })
      if (dateDebut) aQuery = aQuery.gte('date_achat', dateDebut)
      if (dateFin) aQuery = aQuery.lte('date_achat', dateFin)

      const { data: achatsRaw, error: achatsErr } = await aQuery
      if (achatsErr) {
        console.error('[export-comptable] erreur lecture achats:', achatsErr.message)
        return secureError('Erreur lors de la lecture des achats', 500)
      }
      const achats = (achatsRaw || []) as unknown as AchatRow[]

      const { data: fournRaw } = await supabase
        .from('fournisseurs').select('id, nom, siret').eq('user_id', user.id)
      const fournisseursById = new Map<string, FournisseurLite>()
      for (const f of (fournRaw || []) as Array<{ id: string; nom: string | null; siret: string | null }>) {
        fournisseursById.set(f.id, { nom: f.nom, siret: f.siret })
      }

      const { data: chRaw } = await supabase
        .from('chantiers').select('id, titre').eq('user_id', user.id)
      const chantiersById = new Map<string, string>()
      for (const c of (chRaw || []) as Array<{ id: string; titre: string | null }>) {
        chantiersById.set(c.id, c.titre || '')
      }

      const csvAchats = buildCsvAchats(achats, fournisseursById, chantiersById)
      const todayAchats = new Date().toISOString().slice(0, 10)
      return new NextResponse(csvAchats, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="export-achats-${todayAchats}.csv"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // 1) Documents : on construit la requête en filtrant strictement par user
    //    et en respectant la fenêtre de dates (sur date_emission).
    const baseSelect =
      type === 'factures'
        ? 'id, numero, date_emission, created_at, date_paiement, objet, client_id, client_nom, notes_client, montant_ht, montant_tva, montant_ttc, statut'
        : 'id, numero, date_emission, created_at, date_validite, objet, client_id, client_nom, notes_client, montant_ht, montant_tva, montant_ttc, statut'

    let query = supabase
      .from(type)
      .select(baseSelect)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('date_emission', { ascending: true })

    if (dateDebut) query = query.gte('date_emission', dateDebut)
    if (dateFin) query = query.lte('date_emission', dateFin)

    const { data: docsRaw, error: docsErr } = await query
    if (docsErr) {
      console.error('[export-comptable] erreur lecture documents:', docsErr.message)
      return secureError('Erreur lors de la lecture des données', 500)
    }

    const docs = (docsRaw || []) as unknown as DocumentRow[]

    // 2) Clients (un seul round-trip — index sur user_id côté DB)
    const { data: clientsRaw, error: clientsErr } = await supabase
      .from('clients')
      .select('id, civilite, nom, prenom, raison_sociale, adresse, code_postal, ville, siret, type')
      .eq('user_id', user.id)

    if (clientsErr) {
      console.error('[export-comptable] erreur lecture clients:', clientsErr.message)
      return secureError('Erreur lors de la lecture des clients', 500)
    }

    const clientsById = new Map<string, ClientLite>()
    for (const c of (clientsRaw || []) as ClientLite[]) {
      clientsById.set(c.id, c)
    }

    // 3) V3.1 — P5 : aggrégat TVA par document (uniquement pour `factures`).
    //    On lit toutes les lignes des factures dans la fenêtre, on regroupe par
    //    facture_id + taux_tva, et on construit un Map pour buildCsvSimple.
    //    Devis : non concerné (pas d'export comptable par défaut côté devis).
    const taxAggregateByDocId = new Map<string, LigneAggregat[]>()
    if (type === 'factures' && docs.length > 0) {
      const factureIds = docs.map(d => d.id)
      const { data: lignesRaw, error: lignesErr } = await supabase
        .from('facture_lignes')
        .select('facture_id, taux_tva, quantite, prix_unitaire_ht, type')
        .in('facture_id', factureIds)

      if (lignesErr) {
        // Non bloquant : si on n'arrive pas à lire les lignes, on retombe sur le
        // comportement legacy (taux moyen pondéré via computeTauxTva).
        console.error('[export-comptable] lecture lignes facture impossible:', lignesErr.message)
      } else {
        const lignesByFacture = new Map<string, Array<{ taux_tva: number | null; quantite: number | null; prix_unitaire_ht: number | null; type: string | null }>>()
        for (const l of (lignesRaw || []) as Array<{ facture_id: string; taux_tva: number | null; quantite: number | null; prix_unitaire_ht: number | null; type: string | null }>) {
          if (!lignesByFacture.has(l.facture_id)) lignesByFacture.set(l.facture_id, [])
          lignesByFacture.get(l.facture_id)!.push({
            taux_tva: l.taux_tva,
            quantite: l.quantite,
            prix_unitaire_ht: l.prix_unitaire_ht,
            type: l.type,
          })
        }
        lignesByFacture.forEach((lignes, factureId) => {
          const agg = aggregateByTaux(lignes)
          if (agg.length > 0) taxAggregateByDocId.set(factureId, agg)
        })
      }
    }

    // 4) Génération CSV (switch préparé pour FEC)
    let csv = ''
    let filenamePrefix = ''
    switch (format) {
      case 'csv-simple':
        csv = buildCsvSimple(type, docs, clientsById, taxAggregateByDocId, detail === true)
        filenamePrefix = `export-${type}${detail === true ? '-detaille' : ''}`
        break
      // case 'fec':
      //   csv = buildFec(type, docs, clientsById)
      //   filenamePrefix = `FEC-${type}`
      //   break
    }

    const today = new Date().toISOString().slice(0, 10)
    const filename = `${filenamePrefix}-${today}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[export-comptable] erreur inattendue:', (error as Error).message)
    return secureError('Erreur serveur', 500)
  }
}

// ────────────────────────────────────────────────────────────
// TODO — Format FEC (Fichier des Écritures Comptables, art. A47 A-1 LPF)
//
// 18 colonnes obligatoires séparées par pipe | :
//   JournalCode | JournalLib | EcritureNum | EcritureDate | CompteNum |
//   CompteLib | CompAuxNum | CompAuxLib | PieceRef | PieceDate | EcritureLib |
//   Debit | Credit | EcritureLet | DateLet | ValidDate | Montantdevise | Idevise
//
// Règles :
//   - Chaque facture = 1 écriture composée de 2 à N lignes (HT + TVA + total)
//   - JournalCode = "VTE" (ventes)
//   - CompteNum = 411000 (clients) / 707000 (ventes) / 44571x (TVA collectée)
//   - PieceDate = date d'émission, format AAAAMMJJ
//   - Montants : virgule décimale, 2 décimales, jamais négatifs (utiliser
//     l'autre colonne Débit/Crédit)
//   - Encodage : UTF-8 avec BOM ou Windows-1252 (préférer UTF-8 BOM moderne)
//
// Estimation : +1 jour (logique d'écriture comptable + tests sur sage/quadra).
// ────────────────────────────────────────────────────────────
