'use client'

// ---------------------------------------------------------------------------
// Catalogue de prestations pre-remplies par metier.
// L'artisan choisit son metier, parcourt/recherche, coche, et ajoute les
// prestations a SON catalogue (table prestations). Le prix reste a 0 : il met
// le sien ensuite (l'autocompletion memorise). Donnees statiques, zero DB seed.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { Library, Search, Check, Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (slug || loading) return
    const m = matchMetierSlug((entreprise as { metier?: string } | null | undefined)?.metier)
    setSlug(m ?? CATALOGUE_METIERS[0].slug)
  }, [loading, entreprise, slug])

  const metier = CATALOGUE_METIERS.find((m) => m.slug === slug) ?? null

  const filtered = useMemo(() => {
    if (!metier) return []
    const q = norm(query.trim())
    const items = q ? metier.items.filter((it) => norm(it.designation).includes(q)) : metier.items
    return items
  }, [metier, query])

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogueItem[]>()
    for (const it of filtered) {
      const arr = map.get(it.categorie) ?? []
      arr.push(it)
      map.set(it.categorie, arr)
    }
    return CAT_ORDER.filter((c) => map.has(c)).map((c) => ({ cat: c, items: map.get(c)! }))
  }, [filtered])

  function changeMetier(s: string) {
    setSlug(s)
    setSelected(new Set())
    setQuery('')
    setMsg(null)
  }

  function toggle(designation: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(designation)) next.delete(designation)
      else next.add(designation)
      return next
    })
    setMsg(null)
  }

  function toggleAllFiltered() {
    const allOn = filtered.length > 0 && filtered.every((it) => selected.has(it.designation))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const it of filtered) {
        if (allOn) next.delete(it.designation)
        else next.add(it.designation)
      }
      return next
    })
  }

  async function addSelected() {
    if (!metier || selected.size === 0) return
    setBusy(true)
    setMsg(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setMsg({ ok: false, text: 'Tu dois être connecté.' })
        return
      }
      const { data: existing } = await supabase.from('prestations').select('designation')
      const existingSet = new Set((existing ?? []).map((r) => norm(String(r.designation))))
      const toAdd = metier.items.filter(
        (it) => selected.has(it.designation) && !existingSet.has(norm(it.designation)),
      )
      if (toAdd.length === 0) {
        setMsg({ ok: true, text: 'Ces prestations sont déjà dans ton catalogue.' })
        setSelected(new Set())
        return
      }
      const rows = toAdd.map((it) => ({
        user_id: user.id,
        designation: it.designation,
        unite: it.unite,
        prix_unitaire_ht: 0,
        taux_tva: it.tva,
        categorie: it.categorie,
      }))
      const { error } = await supabase.from('prestations').insert(rows)
      if (error) {
        setMsg({ ok: false, text: "Erreur lors de l'ajout. Réessaie." })
        return
      }
      const skipped = selected.size - toAdd.length
      setMsg({
        ok: true,
        text: `${toAdd.length} prestation(s) ajoutée(s) a ton catalogue${skipped > 0 ? ` (${skipped} déjà presente(s))` : ''}.`,
      })
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  const allFilteredOn = filtered.length > 0 && filtered.every((it) => selected.has(it.designation))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-hanken text-2xl font-bold text-navy flex items-center gap-2">
          <Library className="text-orange" size={24} />
          Catalogue de prestations
        </h1>
        <p className="text-sm text-navy/65 mt-1 max-w-xl">
          Des prestations prêtes par métier. Coche celles qui te concernent, ajoute-les a ton
          catalogue, puis mets tes prix.
        </p>
      </div>

      {/* Controles */}
      <div className="rounded-2xl bg-white border-2 border-navy/15 p-3 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="block sm:w-72">
            <span className="block text-[13px] font-semibold text-navy/70 mb-1.5">Métier</span>
            <select
              value={slug ?? ''}
              onChange={(e) => changeMetier(e.target.value)}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={toggleAllFiltered}
            className="text-sm font-medium text-navy/70 hover:text-navy underline-offset-2 hover:underline"
          >
            {allFilteredOn ? 'Tout décocher' : 'Tout cocher'}
          </button>
          <button
            onClick={addSelected}
            disabled={selected.size === 0 || busy}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-orange text-white text-sm font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Ajouter a mes prestations{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

        {msg && (
          <div
            className={
              msg.ok
                ? 'text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2'
                : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2'
            }
          >
            {msg.text}
          </div>
        )}
      </div>

      {/* Liste */}
      {!metier ? (
        <div className="text-sm text-navy/50 py-10 text-center">Chargement...</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-navy/55 mb-2 px-1">
                {CAT_LABELS[cat] ?? cat}
              </h2>
              <div className="rounded-2xl bg-white border-2 border-navy/15 overflow-hidden">
                {items.map((it) => {
                  const on = selected.has(it.designation)
                  return (
                    <button
                      key={it.designation}
                      onClick={() => toggle(it.designation)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left border-b border-navy/8 last:border-0 hover:bg-cream/40 transition"
                    >
                      <span
                        className={
                          'flex items-center justify-center w-6 h-6 rounded-md border-2 shrink-0 ' +
                          (on ? 'bg-orange border-orange text-white' : 'border-navy/25 text-transparent')
                        }
                      >
                        <Check size={14} />
                      </span>
                      <span className="flex-1 text-sm text-navy">{it.designation}</span>
                      <span className="font-spline-mono text-xs text-navy/55 shrink-0">{it.unite}</span>
                      <span className="font-spline-mono text-xs font-semibold text-orange shrink-0 w-12 text-right">
                        {it.tva % 1 ? it.tva.toString().replace('.', ',') : it.tva}%
                      </span>
                    </button>
                  )
                })}
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
