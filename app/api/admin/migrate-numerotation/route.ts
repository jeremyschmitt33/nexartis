import { createClient } from '@supabase/supabase-js'
import { getAdminUser, secureJson, secureError, forbiddenError } from '@/lib/api-security'
import { computeHierarchicalNumbers, type LigneNumerotable } from '@/lib/numerotation'

interface LigneRow {
  id: string
  type?: string | null
  numero?: string | null
}

/**
 * POST /api/admin/migrate-numerotation
 * Recalcule le champ `numero` pour toutes les lignes de tous les devis
 * et factures existants. A lancer une seule fois apres deploiement.
 * Reserve aux admins.
 */
export async function POST() {
  const admin = await getAdminUser()
  if (!admin) return forbiddenError()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    let devisCount = 0
    let factureCount = 0
    let lignesUpdated = 0

    const renumber = async (table: 'devis' | 'factures', linesTable: 'devis_lignes' | 'facture_lignes', fkCol: 'devis_id' | 'facture_id') => {
      const { data: docs, error } = await supabase.from(table).select('id')
      if (error) throw new Error(`Erreur lecture ${table}: ${error.message}`)
      let docsCount = 0
      let updated = 0

      for (const doc of (docs ?? []) as Array<{ id: string }>) {
        const { data: lignes } = await supabase
          .from(linesTable)
          .select('id, type, numero')
          .eq(fkCol, doc.id)
          .order('ordre', { ascending: true })

        const rows = (lignes ?? []) as LigneRow[]
        if (rows.length === 0) continue

        const input: LigneNumerotable[] = rows.map(r => ({
          type: (r.type ?? undefined) as LigneNumerotable['type'],
          numero: r.numero ?? undefined,
        }))
        const numbered = computeHierarchicalNumbers(input)

        for (let i = 0; i < rows.length; i++) {
          await supabase
            .from(linesTable)
            .update({ numero: numbered[i].numero || null })
            .eq('id', rows[i].id)
          updated++
        }
        docsCount++
      }
      return { docsCount, updated }
    }

    const devisRes = await renumber('devis', 'devis_lignes', 'devis_id')
    devisCount = devisRes.docsCount
    lignesUpdated += devisRes.updated

    const facRes = await renumber('factures', 'facture_lignes', 'facture_id')
    factureCount = facRes.docsCount
    lignesUpdated += facRes.updated

    return secureJson({
      success: true,
      devisCount,
      factureCount,
      lignesUpdated,
      message: `Migration OK : ${devisCount} devis et ${factureCount} factures, ${lignesUpdated} lignes renumerotees.`,
    })
  } catch (e) {
    console.error('Migration error:', e)
    // Ne pas exposer e.message dans la reponse (convention securite du projet).
    return secureError('Erreur lors de la migration', 500)
  }
}
