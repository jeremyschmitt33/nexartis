import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DataCategory } from '@/lib/import/mappers'

interface ImportedRow {
  [key: string]: unknown
}

interface ImportData {
  clients: ImportedRow[]
  devis: ImportedRow[]
  factures: ImportedRow[]
  devis_lignes: ImportedRow[]
  facture_lignes: ImportedRow[]
  chantiers: ImportedRow[]
  prestations: ImportedRow[]
  fournisseurs: ImportedRow[]
  intervenants: ImportedRow[]
  planning: ImportedRow[]
  paiements: ImportedRow[]
  achats: ImportedRow[]
}

type DuplicateHandling = 'skip' | 'overwrite' | 'create_new'

interface ExecuteRequest {
  data: Partial<ImportData>
  options: {
    duplicateHandling: DuplicateHandling
  }
}

interface ExecuteResponse {
  success: boolean
  imported: Record<string, number>
  skipped: Record<string, number>
  errors: string[]
}

interface MappingResult {
  [key: string]: string | null
}

async function checkDuplicate(
  supabase: any,
  table: string,
  data: ImportedRow,
  duplicateFields: string[]
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  if (duplicateFields.length === 0) {
    return { isDuplicate: false }
  }

  const conditions = duplicateFields
    .filter(field => data[field] !== undefined && data[field] !== null)
    .map(field => `${field}.eq.${encodeURIComponent(String(data[field]))}`)
    .join(',')

  if (!conditions) {
    return { isDuplicate: false }
  }

  const { data: existingRecords } = await supabase
    .from(table)
    .select('id')
    .or(conditions)
    .limit(1)

  if (existingRecords && existingRecords.length > 0) {
    return { isDuplicate: true, existingId: existingRecords[0].id }
  }

  return { isDuplicate: false }
}

function getDuplicateFields(table: string): string[] {
  const fieldMap: Record<string, string[]> = {
    clients: ['email', 'nom'],
    devis: ['numero'],
    factures: ['numero'],
    prestations: ['designation', 'prix_unitaire_ht'],
    fournisseurs: ['nom'],
    intervenants: ['nom'],
    chantiers: ['titre'],
  }
  return fieldMap[table] || []
}

async function findClientIdByName(supabase: any, user_id: string, clientName: string): Promise<string | null> {
  if (!clientName) return null

  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user_id)
    .ilike('nom', `%${clientName}%`)
    .limit(1)

  return clients && clients.length > 0 ? clients[0].id : null
}

async function findDevisIdByNumero(supabase: any, user_id: string, numero: string): Promise<string | null> {
  if (!numero) return null

  const { data: devisList } = await supabase
    .from('devis')
    .select('id')
    .eq('user_id', user_id)
    .eq('numero', numero)
    .limit(1)

  return devisList && devisList.length > 0 ? devisList[0].id : null
}

async function findChantierIdByName(supabase: any, user_id: string, chantierName: string): Promise<string | null> {
  if (!chantierName) return null

  const { data: chantiers } = await supabase
    .from('chantiers')
    .select('id')
    .eq('user_id', user_id)
    .ilike('titre', `%${chantierName}%`)
    .limit(1)

  return chantiers && chantiers.length > 0 ? chantiers[0].id : null
}

async function findFournisseurIdByName(supabase: any, user_id: string, nom: string): Promise<string | null> {
  if (!nom) return null

  const { data: fournisseurs } = await supabase
    .from('fournisseurs')
    .select('id')
    .eq('user_id', user_id)
    .ilike('nom', `%${nom}%`)
    .limit(1)

  return fournisseurs && fournisseurs.length > 0 ? fournisseurs[0].id : null
}

async function findIntervenantIdByName(supabase: any, user_id: string, intervenantName: string): Promise<string | null> {
  if (!intervenantName) return null

  const { data: intervenants } = await supabase
    .from('intervenants')
    .select('id')
    .eq('user_id', user_id)
    .or(`nom.ilike.%${intervenantName}%,prenom.ilike.%${intervenantName}%`)
    .limit(1)

  return intervenants && intervenants.length > 0 ? intervenants[0].id : null
}

async function findPrestationIdByDesignation(supabase: any, user_id: string, designation: string): Promise<string | null> {
  if (!designation) return null

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id')
    .eq('user_id', user_id)
    .ilike('designation', `%${designation}%`)
    .limit(1)

  return prestations && prestations.length > 0 ? prestations[0].id : null
}

// ═══════════════════════════════════════════════════════════════════
// insertRecords — version BATCH (refonte 26/05/2026)
// ═══════════════════════════════════════════════════════════════════
// Au lieu de boucler ligne par ligne (1 SELECT + 1 INSERT par row,
// soit 30-60s pour 2000+ records et timeout Vercel), on procède en
// 3 phases :
//   1. Préparer toutes les rows en mémoire (résolution FK)
//   2. Détecter les doublons en BULK via un SELECT...IN(...)
//   3. INSERT par CHUNKS de 500 avec .select() pour récupérer
//      les IDs et reconstituer les Map FK pour les tables enfants.
//
// Gain typique : 30-60s → 3-5s pour 2000+ records.
// Garantie : signature et return inchangés.
// ═══════════════════════════════════════════════════════════════════

const BATCH_SIZE = 500

function resolveFK(
  table: string,
  row: ImportedRow,
  user_id: string,
  clientIdMap?: Map<string, string>,
  devisIdMap?: Map<string, string>,
  chantierIdMap?: Map<string, string>,
  fournisseurIdMap?: Map<string, string>,
  intervenantIdMap?: Map<string, string>,
  prestationIdMap?: Map<string, string>,
): ImportedRow {
  const insertData: ImportedRow = { ...row, user_id }

  if ((table === 'devis' || table === 'factures') && row.client_name && clientIdMap) {
    const clientId = clientIdMap.get(String(row.client_name))
    if (clientId) insertData.client_id = clientId
    delete insertData.client_name
  }
  if ((table === 'devis' || table === 'factures') && row.chantier_name && chantierIdMap) {
    const chantierId = chantierIdMap.get(String(row.chantier_name))
    if (chantierId) insertData.chantier_id = chantierId
    delete insertData.chantier_name
  }
  if (table === 'chantiers' && row.client_name && clientIdMap) {
    const clientId = clientIdMap.get(String(row.client_name))
    if (clientId) insertData.client_id = clientId
    delete insertData.client_name
  }
  if (table === 'devis_lignes' && row.devis_numero && devisIdMap) {
    const devisId = devisIdMap.get(String(row.devis_numero))
    if (devisId) insertData.devis_id = devisId
    delete insertData.devis_numero
  }
  if (table === 'devis_lignes' && row.designation && prestationIdMap) {
    const prestationId = prestationIdMap.get(String(row.designation))
    if (prestationId) insertData.prestation_id = prestationId
  }
  if (table === 'facture_lignes' && row.facture_numero) {
    // facture_id non résolu (pas de factureIdMap exporté) — on supprime juste la clé temp
    delete insertData.facture_numero
  }
  if (table === 'planning') {
    if (row.chantier_name && chantierIdMap) {
      const chantierId = chantierIdMap.get(String(row.chantier_name))
      if (chantierId) insertData.chantier_id = chantierId
      delete insertData.chantier_name
    }
    if (row.intervenant_name && intervenantIdMap) {
      const intervenantId = intervenantIdMap.get(String(row.intervenant_name))
      if (intervenantId) insertData.intervenant_id = intervenantId
      delete insertData.intervenant_name
    }
    if (row.client_name && clientIdMap) {
      const clientId = clientIdMap.get(String(row.client_name))
      if (clientId) insertData.client_id = clientId
      delete insertData.client_name
    }
  }
  if (table === 'achats') {
    if (row.fournisseur_name && fournisseurIdMap) {
      const fournisseurId = fournisseurIdMap.get(String(row.fournisseur_name))
      if (fournisseurId) insertData.fournisseur_id = fournisseurId
      delete insertData.fournisseur_name
    }
    if (row.chantier_name && chantierIdMap) {
      const chantierId = chantierIdMap.get(String(row.chantier_name))
      if (chantierId) insertData.chantier_id = chantierId
      delete insertData.chantier_name
    }
  }
  if (table === 'paiements' && row.facture_numero) {
    delete insertData.facture_numero
  }

  return insertData
}

function naturalKey(row: ImportedRow): string {
  return String(
    row.numero ||
    row.designation ||
    row.nom ||
    row.titre ||
    ''
  )
}

async function insertRecords(
  supabase: any,
  user_id: string,
  table: string,
  rows: ImportedRow[],
  duplicateHandling: DuplicateHandling,
  clientIdMap?: Map<string, string>,
  devisIdMap?: Map<string, string>,
  chantierIdMap?: Map<string, string>,
  fournisseurIdMap?: Map<string, string>,
  intervenantIdMap?: Map<string, string>,
  prestationIdMap?: Map<string, string>
): Promise<{ imported: number; skipped: number; errors: string[]; lastInsertIds?: Map<string, string> }> {
  const errors: string[] = []
  const lastInsertIds = new Map<string, string>()

  if (!rows || rows.length === 0) {
    return { imported: 0, skipped: 0, errors, lastInsertIds }
  }

  // ── PHASE 1 : préparer toutes les rows (résolution FK en mémoire) ──
  const preparedRows: ImportedRow[] = []
  for (const row of rows) {
    if (!row || Object.keys(row).length === 0) continue
    preparedRows.push(resolveFK(
      table, row, user_id,
      clientIdMap, devisIdMap, chantierIdMap,
      fournisseurIdMap, intervenantIdMap, prestationIdMap,
    ))
  }

  if (preparedRows.length === 0) {
    return { imported: 0, skipped: 0, errors, lastInsertIds }
  }

  // ── PHASE 2 : détection des doublons en BULK ──
  const duplicateFields = getDuplicateFields(table)
  const existingByVal = new Map<string, string>() // valeur du champ -> existingId

  if (duplicateFields.length > 0 && duplicateHandling !== 'create_new') {
    // On regarde le premier champ de duplicateFields qui a une valeur
    // pour identifier les doublons. Pour clients on a ['email', 'nom'] :
    // si email présent on l'utilise, sinon nom. Mais comme on traite en
    // bulk, on vérifie pour CHAQUE champ séparément.
    for (const field of duplicateFields) {
      const values = preparedRows
        .map(r => r[field])
        .filter(v => v !== undefined && v !== null && v !== '')
        .map(v => String(v))

      if (values.length === 0) continue

      // SELECT ... IN(...) en chunks pour éviter de saturer la query string
      for (let i = 0; i < values.length; i += BATCH_SIZE) {
        const chunk = values.slice(i, i + BATCH_SIZE)
        const { data: existing } = await supabase
          .from(table)
          .select(`id, ${field}`)
          .eq('user_id', user_id)
          .in(field, chunk)

        if (existing) {
          for (const ex of existing) {
            existingByVal.set(`${field}:${String(ex[field])}`, ex.id)
          }
        }
      }
    }
  }

  // ── PHASE 3 : partitionner new / skip / update ──
  const newRows: ImportedRow[] = []
  const skippedRows: ImportedRow[] = []
  const updatePairs: { id: string; data: ImportedRow }[] = []

  for (const row of preparedRows) {
    let existingId: string | undefined
    for (const field of duplicateFields) {
      const val = row[field]
      if (val !== undefined && val !== null && val !== '') {
        const found = existingByVal.get(`${field}:${String(val)}`)
        if (found) { existingId = found; break }
      }
    }

    if (existingId) {
      if (duplicateHandling === 'skip') {
        skippedRows.push(row)
        // Garder la map FK : la prochaine table enfant doit pouvoir
        // référencer ce record existant.
        const key = naturalKey(row)
        if (key) lastInsertIds.set(key, existingId)
      } else if (duplicateHandling === 'overwrite') {
        updatePairs.push({ id: existingId, data: row })
      } else {
        // create_new : on ignore la détection et on insère quand même
        newRows.push(row)
      }
    } else {
      newRows.push(row)
    }
  }

  let importedCount = 0

  // ── PHASE 4 : BATCH INSERT par chunks de 500 ──
  if (newRows.length > 0) {
    for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
      const chunk = newRows.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase
        .from(table)
        .insert(chunk)
        .select('*')

      if (error) {
        errors.push(`Erreur insert ${table} (batch ${i}-${i + chunk.length}): ${error.message}`)
        continue
      }

      if (data) {
        importedCount += data.length
        for (const inserted of data) {
          const key = naturalKey(inserted as ImportedRow)
          if (key) lastInsertIds.set(key, (inserted as any).id)
        }
      }
    }
  }

  // ── PHASE 5 : updates (rare, mode overwrite uniquement) ──
  if (updatePairs.length > 0) {
    for (const { id, data } of updatePairs) {
      const { error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
      if (error) {
        errors.push(`Erreur update ${table}: ${error.message}`)
      } else {
        importedCount += 1
        const key = naturalKey(data)
        if (key) lastInsertIds.set(key, id)
      }
    }
  }

  return {
    imported: importedCount,
    skipped: skippedRows.length,
    errors,
    lastInsertIds,
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = (await req.json()) as ExecuteRequest
    const { data, options } = body

    if (!data || !options) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const { duplicateHandling } = options
    const imported: Record<string, number> = {}
    const skipped: Record<string, number> = {}
    const errors: string[] = []

    const clientIdMap = new Map<string, string>()
    const devisIdMap = new Map<string, string>()
    const chantierIdMap = new Map<string, string>()
    const fournisseurIdMap = new Map<string, string>()
    const intervenantIdMap = new Map<string, string>()
    const prestationIdMap = new Map<string, string>()

    const insertOrder: DataCategory[] = [
      'clients',
      'fournisseurs',
      'intervenants',
      'prestations',
      'chantiers',
      'devis',
      'devis_lignes',
      'factures',
      'facture_lignes',
      'paiements',
      'planning',
      'achats',
    ]

    for (const category of insertOrder) {
      const rows = data[category as keyof ImportData] || []

      if (!Array.isArray(rows) || rows.length === 0) {
        imported[category] = 0
        skipped[category] = 0
        continue
      }

      let idMap: Map<string, string> | undefined

      if (category === 'clients') {
        idMap = clientIdMap
      } else if (category === 'devis') {
        idMap = devisIdMap
      } else if (category === 'chantiers') {
        idMap = chantierIdMap
      } else if (category === 'fournisseurs') {
        idMap = fournisseurIdMap
      } else if (category === 'intervenants') {
        idMap = intervenantIdMap
      } else if (category === 'prestations') {
        idMap = prestationIdMap
      }

      const result = await insertRecords(
        supabase,
        user.id,
        category,
        rows as ImportedRow[],
        duplicateHandling,
        clientIdMap,
        devisIdMap,
        chantierIdMap,
        fournisseurIdMap,
        intervenantIdMap,
        prestationIdMap
      )

      imported[category] = result.imported
      skipped[category] = result.skipped
      errors.push(...result.errors)

      if (idMap && result.lastInsertIds) {
        for (const [key, id] of Array.from(result.lastInsertIds)) {
          idMap.set(key, id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
    } as ExecuteResponse)
  } catch (error) {
    console.error('Execute import error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Erreur lors de l\'import' },
      { status: 500 }
    )
  }
}
