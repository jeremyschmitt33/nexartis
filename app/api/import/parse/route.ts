import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import {
  SourceType,
  DataCategory,
  SOURCE_CONFIGS,
  detectCategory,
  detectSource,
} from '@/lib/import/mappers'
import { preprocessObatComptable } from '@/lib/import/obat-comptable'
import { checkRateLimit, rateLimitError } from '@/lib/api-security'

// Note (P10 audit securite) : xlsx (SheetJS sur npm) bloque sur deux CVE
// (Prototype Pollution + ReDoS) et a quitte npm officiel. Nous utilisons
// desormais exceljs, alternative npm maintenue activement.

interface ParsedRow {
  [key: string]: unknown
}

interface CategoryPreview {
  count: number
  data: ParsedRow[]
  columns: string[]
}

interface ParseResponse {
  preview: Record<DataCategory, CategoryPreview>
  source: SourceType
  warnings: string[]
}

async function parseCSVFile(file: File, _fileName: string): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  let text = await file.text()

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const rows = (result.data || []) as ParsedRow[]
  let headers = result.meta?.fields || Object.keys(rows[0] || {})

  if (!headers || headers.length === 0) {
    headers = Object.keys(rows[0] || {})
  }

  headers = headers.filter(h => h && h.trim() !== '')

  return { headers, rows }
}

/**
 * Normalise une valeur de cellule ExcelJS en chaine nette.
 * Gere les types riches (Date, formule, hyperlien, rich text).
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date) {
    // Format ISO court (YYYY-MM-DD), equivalent a ce que xlsx renvoyait
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    // Formule : { formula, result }
    if ('result' in v) return cellToString(v.result)
    // Hyperlien : { text, hyperlink }
    if ('text' in v) return String(v.text).trim()
    // Rich text : { richText: [{ text }, ...] }
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>)
        .map(rt => rt.text || '')
        .join('')
        .trim()
    }
    // Error cell : { error: '#REF!' } -> on traite comme vide
    if ('error' in v) return ''
  }
  return String(value).trim()
}

async function parseExcelFile(file: File, _fileName: string): Promise<{ sheet: string; headers: string[]; rows: ParsedRow[] }[]> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheets: { sheet: string; headers: string[]; rows: ParsedRow[] }[] = []

  workbook.eachSheet((worksheet) => {
    // Construire la matrice brute (equivalent sheet_to_json { header: 1 })
    const matrix: string[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[]
      // ExcelJS commence a l'index 1 (index 0 = null), on shift
      const cleaned = values.slice(1).map(cellToString)
      matrix.push(cleaned)
    })

    if (matrix.length === 0) return

    const headers = matrix[0]
      .map(h => (h || '').toString().trim())
      .filter(h => h !== '')

    const rows: ParsedRow[] = matrix.slice(1).map(row => {
      const obj: ParsedRow = {}
      headers.forEach((header, index) => {
        const value = row[index]
        obj[header] = value === '' || value === undefined ? '' : value
      })
      return obj
    })

    if (rows.length > 0) {
      sheets.push({ sheet: worksheet.name, headers, rows })
    }
  })

  return sheets
}

function applyColumnMapping(
  rows: ParsedRow[],
  headers: string[],
  categoryConfig: any,
  _source: SourceType
): ParsedRow[] {
  return rows.map(row => {
    const mapped: ParsedRow = {}

    for (const mapping of categoryConfig.columnMappings) {
      const sourceColumns = mapping.sourceColumn.split('|').map((c: string) => c.trim())
      let value: unknown = null

      // On privilegie une correspondance EXACTE de l'en-tete avant de se
      // rabattre sur une correspondance partielle (sous-chaine). Sans ca,
      // "Nom" attrapait par erreur la colonne "Prenom" ("prenom".includes("nom")).
      const matchedHeader =
        headers.find(h =>
          sourceColumns.some((sc: string) => h.toLowerCase().trim() === sc.toLowerCase())
        ) ||
        headers.find(h =>
          sourceColumns.some((sc: string) => h.toLowerCase().includes(sc.toLowerCase()))
        )

      if (matchedHeader && row[matchedHeader] !== undefined && row[matchedHeader] !== '') {
        value = row[matchedHeader]
        if (mapping.transform) {
          value = mapping.transform(String(value))
        }
      }

      if (value !== null && value !== undefined && value !== '') {
        mapped[mapping.targetField] = value
      }
    }

    return mapped
  })
}

// Recupere la valeur brute de la 1re colonne du fichier dont l'en-tete
// correspond (exact d'abord, puis sous-chaine) a l'un des noms proposes.
function pickRawValue(row: ParsedRow, headers: string[], names: string[]): string {
  const lower = names.map(n => n.toLowerCase())
  const h =
    headers.find(hd => lower.some(n => hd.toLowerCase().trim() === n)) ||
    headers.find(hd => lower.some(n => hd.toLowerCase().includes(n)))
  if (!h) return ''
  const v = row[h]
  return v == null ? '' : String(v).trim()
}

// Prestations : la base n'a pas de champ "commentaire"/"description" ni "code".
// Pour ne rien perdre, on replie ces infos dans la designation (elles restent
// ainsi visibles, notamment sur les devis).
function enrichPrestations(mapped: ParsedRow[], rawRows: ParsedRow[], headers: string[]): void {
  mapped.forEach((mr, i) => {
    const raw = rawRows[i] || {}
    const commentaire = pickRawValue(raw, headers, ['commentaire', 'commentaires', 'description', 'détail', 'detail', 'note', 'notes', 'remarque', 'observation', 'observations'])
    const code = pickRawValue(raw, headers, ['code', 'référence', 'reference', 'réf', 'ref', 'code article', 'code produit'])
    let desig = mr.designation ? String(mr.designation).trim() : ''
    if (!desig) desig = commentaire || code
    if (commentaire && desig && !desig.toLowerCase().includes(commentaire.toLowerCase())) {
      desig = `${desig} — ${commentaire}`
    }
    if (code) desig = `${desig} (réf. ${code})`
    if (desig) mr.designation = desig
  })
}

// Clients : la base n'a pas de colonne "pays" ni "n° TVA intracommunautaire".
// On les conserve dans les notes internes pour ne rien perdre.
function enrichClients(mapped: ParsedRow[], rawRows: ParsedRow[], headers: string[]): void {
  mapped.forEach((mr, i) => {
    const raw = rawRows[i] || {}
    const pays = pickRawValue(raw, headers, ['pays', 'country'])
    const tva = pickRawValue(raw, headers, ['num. tva', 'n° tva', 'numéro tva', 'numero tva', 'tva intra', 'tva intracommunautaire', 'numéro de tva intracommunautaire', 'vat', 'vat number'])
    const extra: string[] = []
    if (tva) extra.push(`N° TVA : ${tva}`)
    if (pays && pays.toLowerCase() !== 'france') extra.push(`Pays : ${pays}`)
    if (extra.length > 0) {
      const base = mr.notes_internes ? String(mr.notes_internes).trim() : ''
      mr.notes_internes = base ? `${base} — ${extra.join(' — ')}` : extra.join(' — ')
    }
  })
}

function generateWarnings(preview: Record<DataCategory, CategoryPreview>): string[] {
  const warnings: string[] = []

  if (preview.clients && preview.clients.count > 0) {
    const missingEmail = preview.clients.data.filter(c => !c.email).length
    if (missingEmail > 0) {
      warnings.push(`${missingEmail} client${missingEmail > 1 ? 's' : ''} sans email`)
    }
  }

  if (preview.devis && preview.devis.count > 0) {
    const missingDate = preview.devis.data.filter(d => !d.date_emission).length
    if (missingDate > 0) {
      warnings.push(`${missingDate} devis sans date`)
    }
    const missingClient = preview.devis.data.filter(d => !d.client_name && !d.client_id).length
    if (missingClient > 0) {
      warnings.push(`${missingClient} devis sans client`)
    }
  }

  if (preview.factures && preview.factures.count > 0) {
    const missingDate = preview.factures.data.filter(f => !f.date_emission).length
    if (missingDate > 0) {
      warnings.push(`${missingDate} facture${missingDate > 1 ? 's' : ''} sans date`)
    }
    const missingClient = preview.factures.data.filter(f => !f.client_name && !f.client_id).length
    if (missingClient > 0) {
      warnings.push(`${missingClient} facture${missingClient > 1 ? 's' : ''} sans client`)
    }
  }

  if (preview.chantiers && preview.chantiers.count > 0) {
    const missingClient = preview.chantiers.data.filter(c => !c.client_name && !c.client_id).length
    if (missingClient > 0) {
      warnings.push(`${missingClient} chantier${missingClient > 1 ? 's' : ''} sans client`)
    }
  }

  return warnings
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
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // ✅ SÉCURITÉ (R1-013) : rate-limit (10 parsings / 60s par utilisateur)
    // pour empecher le DoS partiel par envois en boucle de fichiers 10 MB.
    if (!checkRateLimit(`import-parse:${user.id}`, 10, 60_000)) {
      return rateLimitError()
    }

    const formData = await req.formData()
    const source = (formData.get('source') as string) || 'excel'
    const filesArray = formData.getAll('files') as File[]

    if (!filesArray || filesArray.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // ✅ SÉCURITÉ : Limite de taille (10 MB max par fichier, zip bomb protection)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    for (const file of filesArray) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `Fichier trop volumineux (max 10 MB). Taille reçue : ${Math.round(file.size / 1024 / 1024)} MB` }, { status: 413 })
      }
    }

    if (!(['obat', 'obat_comptable', 'tolteck', 'batappli', 'henrri', 'excel'].includes(source))) {
      return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
    }

    const sourceConfig = SOURCE_CONFIGS[source as SourceType]
    const preview: Record<DataCategory, CategoryPreview> = {} as Record<DataCategory, CategoryPreview>

    for (const category of Object.keys(sourceConfig.categories) as DataCategory[]) {
      preview[category] = { count: 0, data: [], columns: [] }
    }

    let detectedSource = source as SourceType

    for (const file of filesArray) {
      const fileName = file.name.toLowerCase()

      let parsedSheets: { sheet: string; headers: string[]; rows: ParsedRow[] }[] = []

      if (fileName.endsWith('.csv')) {
        const { headers, rows } = await parseCSVFile(file, fileName)
        detectedSource = detectSource(headers)
        parsedSheets = [{ sheet: file.name, headers, rows }]
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        parsedSheets = await parseExcelFile(file, fileName)
        if (parsedSheets.length > 0) {
          detectedSource = detectSource(parsedSheets[0].headers)
        }
      } else {
        continue
      }

      const config = SOURCE_CONFIGS[detectedSource]

      // ═══════════════════════════════════════════════════════════
      // BRANCHE SPECIALE : format comptable OBAT
      // ═══════════════════════════════════════════════════════════
      // Chaque devis ou facture y est eclate sur N lignes du CSV
      // (une par taux de TVA + une ligne client). On groupe par
      // "Reference de la piece justificative" et on reconstitue
      // des pieces completes via preprocessObatComptable().
      if (detectedSource === 'obat_comptable') {
        for (const sheet of parsedSheets) {
          const result = preprocessObatComptable(sheet.rows as unknown as Record<string, unknown>[])

          // ─── DEVIS ───
          if (result.devis.length > 0) {
            const devisData = result.devis.map(d => ({
              numero: d.numero,
              date_emission: d.date_emission,
              client_name: d.client_name,
              chantier_name: d.chantier_titre,
              objet: d.chantier_titre || undefined,
              statut: d.statut,
              montant_ht: d.montant_ht,
              montant_tva: d.montant_tva,
              montant_ttc: d.montant_ttc,
            }))
            if (!preview.devis.columns || preview.devis.columns.length === 0) {
              preview.devis.columns = ['numero', 'date_emission', 'client_name', 'chantier_name', 'statut', 'montant_ht', 'montant_ttc']
            }
            preview.devis.count += devisData.length
            preview.devis.data.push(...devisData)
          }

          // ─── DEVIS_LIGNES (extraites des doc.lignes) ───
          // NOTE : on n'envoie PAS montant_ht car cette colonne est
          // GENERATED ALWAYS en base (calculée auto = quantite × prix_unitaire_ht).
          const allDevisLignes: ParsedRow[] = []
          for (const d of result.devis) {
            for (const l of d.lignes) {
              allDevisLignes.push({
                devis_numero: d.numero,
                ordre: l.ordre,
                designation: l.designation,
                quantite: l.quantite,
                prix_unitaire_ht: l.prix_unitaire_ht,
                taux_tva: l.taux_tva,
              })
            }
          }
          if (allDevisLignes.length > 0) {
            if (!preview.devis_lignes.columns || preview.devis_lignes.columns.length === 0) {
              preview.devis_lignes.columns = ['devis_numero', 'ordre', 'designation', 'taux_tva', 'montant_ht']
            }
            preview.devis_lignes.count += allDevisLignes.length
            preview.devis_lignes.data.push(...allDevisLignes)
          }

          // ─── FACTURES ───
          // Mapping du type OBAT vers les valeurs internes Nexartis.
          // La table 'factures' a une CHECK constraint qui n'accepte que :
          // 'standard' | 'acompte' | 'situation' | 'avoir'.
          const mapFactureType = (typeDoc: string): string => {
            const t = (typeDoc || '').toLowerCase().trim()
            if (t.includes('acompte')) return 'acompte'
            if (t.includes('avoir')) return 'avoir'
            if (t.includes('situation')) return 'situation' // couvre "Situation" + "Situation détaillée"
            return 'standard' // Finale + tout le reste
          }
          if (result.factures.length > 0) {
            const facturesData = result.factures.map(f => ({
              numero: f.numero,
              date_emission: f.date_emission,
              client_name: f.client_name,
              chantier_name: f.chantier_titre,
              type: mapFactureType(f.type_doc),
              statut: f.statut,
              montant_ht: f.montant_ht,
              montant_tva: f.montant_tva,
              montant_ttc: f.montant_ttc,
            }))
            if (!preview.factures.columns || preview.factures.columns.length === 0) {
              preview.factures.columns = ['numero', 'date_emission', 'client_name', 'type', 'statut', 'montant_ht', 'montant_ttc']
            }
            preview.factures.count += facturesData.length
            preview.factures.data.push(...facturesData)
          }

          // ─── FACTURE_LIGNES ───
          // Idem : pas de montant_ht (colonne GENERATED ALWAYS en base).
          const allFactureLignes: ParsedRow[] = []
          for (const f of result.factures) {
            for (const l of f.lignes) {
              allFactureLignes.push({
                facture_numero: f.numero,
                ordre: l.ordre,
                designation: l.designation,
                quantite: l.quantite,
                prix_unitaire_ht: l.prix_unitaire_ht,
                taux_tva: l.taux_tva,
              })
            }
          }
          if (allFactureLignes.length > 0) {
            if (!preview.facture_lignes.columns || preview.facture_lignes.columns.length === 0) {
              preview.facture_lignes.columns = ['facture_numero', 'ordre', 'designation', 'taux_tva', 'montant_ht']
            }
            preview.facture_lignes.count += allFactureLignes.length
            preview.facture_lignes.data.push(...allFactureLignes)
          }

          // ─── CLIENTS DEDUITS ───
          if (result.clients.length > 0) {
            const clientsData = result.clients.map(c => ({ nom: c.nom }))
            if (!preview.clients.columns || preview.clients.columns.length === 0) {
              preview.clients.columns = ['nom']
            }
            preview.clients.count += clientsData.length
            preview.clients.data.push(...clientsData)
          }

          // ─── CHANTIERS DEDUITS ───
          if (result.chantiers.length > 0) {
            const chantiersData = result.chantiers.map(c => ({
              titre: c.titre,
              client_name: c.client_name,
            }))
            if (!preview.chantiers.columns || preview.chantiers.columns.length === 0) {
              preview.chantiers.columns = ['titre', 'client_name']
            }
            preview.chantiers.count += chantiersData.length
            preview.chantiers.data.push(...chantiersData)
          }
        }
        continue // saute le pipeline standard ci-dessous
      }

      // ═══════════════════════════════════════════════════════════
      // Pipeline STANDARD (autres formats)
      // ═══════════════════════════════════════════════════════════
      for (const sheet of parsedSheets) {
        const category = detectCategory(sheet.headers, detectedSource)

        if (!category) {
          continue
        }

        const categoryConfig = config.categories[category]
        if (!categoryConfig) {
          continue
        }

        const mappedRows = applyColumnMapping(sheet.rows, sheet.headers, categoryConfig, detectedSource)

        // Conservation "zero perte" : certaines colonnes (commentaire, code,
        // pays, n° TVA...) n'ont pas de champ dedie en base. On les replie dans
        // un champ texte proche pour ne rien perdre a l'import.
        if (category === 'prestations') {
          enrichPrestations(mappedRows, sheet.rows, sheet.headers)
        } else if (category === 'clients') {
          enrichClients(mappedRows, sheet.rows, sheet.headers)
        }

        if (!preview[category].columns || preview[category].columns.length === 0) {
          preview[category].columns = sheet.headers
        }

        // ⚠ On conserve TOUTES les lignes : l'import final (execute) lit
        // preview.data comme source de verite. L'ancien code tronquait a 5
        // lignes (slice(0, 5 - ...)), ce qui plafonnait tout import Excel/CSV a
        // 5 enregistrements. L'aperçu visuel se limite de lui-meme cote UI.
        preview[category].count += mappedRows.length
        preview[category].data = preview[category].data.concat(mappedRows)
      }
    }

    const warnings = generateWarnings(preview)

    return NextResponse.json({
      preview,
      source: detectedSource,
      warnings,
    } as ParseResponse)
  } catch (error) {
    console.error('Parse import error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Erreur lors du parsing' },
      { status: 500 }
    )
  }
}
