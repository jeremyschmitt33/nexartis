'use client'

// ---------------------------------------------------------------------------
// Catalogue de prestations pre-remplies par metier (CONSULTATION).
// Ces prestations apparaissent automatiquement comme SUGGESTIONS quand l'artisan
// redige un devis/facture. Quand il en choisit une et met son prix, elle est
// memorisee dans son catalogue perso (a l'enregistrement du document).
// Donnees statiques : aucune base de donnees, aucune ecriture ici.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { Library, Search, Info } from 'lucide-react'
import { useEntreprise } from '@/lib/hooks'
import { CATALOGUE_METIERS, matchMetierSlug, type CatalogueItem } from '@/lib/catalogue'

const CAT_LABELS: Record<string, string> = {
  ouvrages: 'Ouvrages (fourniture et pose)',
  main_oeuvre: "Main d'œuvre",
  fournitures: 'Fournitures',
  deplacements: 'Déplacements',
}
const CAT_ORDER = ['ouvrages', 'main_oeuvre', 'fournitures', 'deplacements']

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
}

export default function CataloguePage() {
  const { entreprise, loading } = useEntreprise()
  const [slug, setSlug] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (slug || loading) return
    const m = matchMetierSlug((entreprise as { metier?: string } | null | undefined)?.metier)
    setSlug(m ?? CATALOGUE_METIERS[0].slug)
  }, [loading, entreprise, slug])

  const metier = CATALOGUE_METIERS.find((m) => m.slug === slug) ?? null

  const grouped = useMemo(() => {
    if (!metier) return []
    const q = norm(query.trim())
    const items = q ? metier.items.filter((it) => norm(it.designation).includes(q)) : metier.items
    const map = new Map<string, CatalogueItem[]>()
    for (const it of items) {
      const arr = map.get(it.categorie) ?? []
      arr.push(it)
      map.set(it.categorie, arr)
    }
    return CAT_ORDER.filter((c) => map.has(c)).map((c) => ({ cat: c, items: map.get(c)! }))
  }, [metier, query])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-hanken text-2xl font-bold text-navy flex items-center gap-2">
          <Library className="text-orange" size={24} />
          Catalogue de prestations
        </h1>
        <p className="text-sm text-navy/65 mt-1 max-w-2xl">
          Des prestations prêtes par métier. Elles apparaissent automatiquement comme suggestions
          quand tu rédiges un devis : choisis-en une, mets ton prix, et elle est enregistrée dans
          ton catalogue.
        </p>
      </div>

      <p className="flex gap-2 text-sm text-navy/70 bg-sky/10 border border-sky/30 rounded-xl px-3 py-2.5">
        <Info size={16} className="text-sky shrink-0 mt-0.5" />
        <span>
          Cette page est une vitrine : rien n&apos;est ajouté tant que tu n&apos;utilises pas une
          prestation dans un devis avec ton prix.
        </span>
      </p>

      {/* Controles */}
      <div className="rounded-2xl bg-white border-2 border-navy/15 p-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="block sm:w-72">
            <span className="block text-[13px] font-semibold text-navy/70 mb-1.5">Métier</span>
            <select
              value={slug ?? ''}
              onChange={(e) => {
                setSlug(e.target.value)
                setQuery('')
              }}
              className="w-full h-11 px-3 rounded-xl border-2 border-navy/15 bg-white text-navy outline-none focus:border-orange focus:ring-4 focus:ring-orange/15"
            >
              {CATALOGUE_METIERS.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.label} ({m.items.length})
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1">
            <span className="block text-[13px] font-semibold text-navy/70 mb-1.5">Rechercher</span>
            <div className="flex items-center h-11 px-3 rounded-xl border-2 border-navy/15 bg-white focus-within:border-orange focus-within:ring-4 focus-within:ring-orange/15">
              <Search size={16} className="text-navy/40 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer les prestations..."
                className="w-full px-2 bg-transparent outline-none text-navy"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Liste */}
      {!metier ? (
        <div className="text-sm text-navy/50 py-10 text-center">Chargement...</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-navy/55 mb-2 px-1">
                {CAT_LABELS[cat] ?? cat} · {items.length}
              </h2>
              <div className="rounded-2xl bg-white border-2 border-navy/15 overflow-hidden">
                {items.map((it) => (
                  <div
                    key={it.designation}
                    className="flex items-center gap-3 px-3 py-3 border-b border-navy/8 last:border-0"
                  >
                    <span className="flex-1 text-sm text-navy">{it.designation}</span>
                    <span className="font-spline-mono text-xs text-navy/55 shrink-0">{it.unite}</span>
                    <span className="font-spline-mono text-xs font-semibold text-orange shrink-0 w-12 text-right">
                      {it.tva % 1 ? it.tva.toString().replace('.', ',') : it.tva}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="text-sm text-navy/50 py-10 text-center">Aucune prestation ne correspond.</div>
          )}
        </div>
      )}
    </div>
  )
}
