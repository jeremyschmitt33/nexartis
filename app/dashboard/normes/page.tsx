'use client'

// ============================================================================
// Onglet "Normes par métier" — outil interne de référence.
// Données : lib/normes-metiers.ts (recherche multi-agents + challenger,
// vérifiées contre sources officielles AFNOR/Legifrance/CSTB le 2026-06-29).
// ============================================================================

import { useMemo, useState } from 'react'
import { Search, ShieldCheck, AlertTriangle, ExternalLink, Info } from 'lucide-react'
import { NORMES_METIERS, NORMES_MAJ, type MetierNormes, type NormeFiche } from '@/lib/normes-metiers'

function matchNorme(n: NormeFiche, q: string): boolean {
  const hay = [n.reference, n.intitule, n.sapplique, n.neufVsReno, n.version, n.note, ...(n.pointsCles || []), ...(n.chiffres || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function ConfianceBadge({ c }: { c: 'haute' | 'moyenne' }) {
  const ok = c === 'haute'
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-hanken font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
      title={ok ? 'Source officielle vérifiée' : 'À recouper avec le texte officiel'}
    >
      {ok ? 'Vérifié' : 'À vérifier'}
    </span>
  )
}

function NormeCard({ n }: { n: NormeFiche }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-syne font-bold text-[#0f1a3a] text-[15px] leading-tight">{n.reference}</h3>
          <p className="font-hanken text-[13px] text-gray-600 mt-0.5">{n.intitule}</p>
        </div>
        <ConfianceBadge c={n.confiance} />
      </div>

      <p className="mt-3 text-[13px] font-hanken text-[#1a2d5a]"><span className="font-semibold">S’applique à :</span> {n.sapplique}</p>

      {n.pointsCles?.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {n.pointsCles.map((p, i) => (
            <li key={i} className="flex gap-2 text-[13px] font-hanken text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#ff7a1a] flex-shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {n.chiffres && n.chiffres.length > 0 && (
        <div className="mt-3 rounded-lg bg-[#f0ede4]/60 border border-[#e4e7ee] p-3">
          <p className="text-[10.5px] font-hanken font-bold uppercase tracking-wide text-[#6b7384] mb-1.5">Chiffres &amp; seuils</p>
          <ul className="space-y-1">
            {n.chiffres.map((c, i) => (
              <li key={i} className="text-[12.5px] font-hanken text-[#0f1a3a] font-spline-mono">{c}</li>
            ))}
          </ul>
        </div>
      )}

      {n.neufVsReno && (
        <p className="mt-3 text-[12.5px] font-hanken text-gray-600"><span className="font-semibold text-[#0f1a3a]">Neuf vs rénovation :</span> {n.neufVsReno}</p>
      )}

      {n.note && (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] font-hanken text-amber-800">{n.note}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-gray-100">
        {n.version && <p className="text-[11.5px] font-hanken text-gray-500">{n.version}</p>}
        {n.source && (
          <a href={n.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-hanken font-semibold text-[#2f6fb0] hover:underline">
            Source <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}

function MetierBlock({ m }: { m: MetierNormes }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {m.normes.map((n, i) => (
          <NormeCard key={i} n={n} />
        ))}
      </div>

      {m.transverses?.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#0f1a3a]/10 bg-[#0f1a3a] p-4 sm:p-5">
          <p className="font-syne font-bold text-white text-[14px] mb-2.5">Obligations transverses (assurances, garanties, certifications)</p>
          <ul className="space-y-1.5">
            {m.transverses.map((t, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] font-hanken text-sky-100">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#5ab4e0] flex-shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function NormesPage() {
  const [selected, setSelected] = useState<string>(NORMES_METIERS[0]?.slug ?? '')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  // Résultats de recherche transverse (tous métiers)
  const searchResults = useMemo(() => {
    if (!q) return null
    return NORMES_METIERS
      .map(m => ({ ...m, normes: m.normes.filter(n => matchNorme(n, q)) }))
      .filter(m => m.normes.length > 0 || m.nom.toLowerCase().includes(q))
  }, [q])

  const current = NORMES_METIERS.find(m => m.slug === selected) ?? NORMES_METIERS[0]

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-5 py-5 sm:py-7">
      {/* En-tête */}
      <div className="flex items-start gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-[#0f1a3a] grid place-items-center flex-shrink-0">
          <ShieldCheck size={20} className="text-[#5ab4e0]" />
        </div>
        <div>
          <h1 className="font-syne font-extrabold text-[#0f1a3a] text-xl sm:text-2xl">Normes par métier</h1>
          <p className="font-hanken text-[13px] text-gray-500">Référentiel des normes &amp; DTU clés — mis à jour le {NORMES_MAJ}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2.5 rounded-xl bg-[#eef6fc] border border-[#5ab4e0]/40 p-3.5 mb-5">
        <Info size={16} className="text-[#2f6fb0] flex-shrink-0 mt-0.5" />
        <p className="text-[12.5px] font-hanken text-[#1a2d5a] leading-relaxed">
          Informations fournies <strong>à titre indicatif</strong> pour vous faire gagner du temps. Avant tout usage contractuel,
          recoupez avec les textes officiels (AFNOR/CSTB pour les DTU et normes NF, Legifrance pour la réglementation).
          Les fiches marquées <span className="font-semibold text-amber-700">« À vérifier »</span> contiennent un point de détail à confirmer.
        </p>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une norme, un DTU, un mot-clé (ex : garde-corps, NF C 15-100, étanchéité)…"
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-[14px] font-hanken outline-none focus:border-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/15 transition-all"
        />
      </div>

      {q ? (
        // ---- Mode recherche ----
        <div>
          <p className="text-[13px] font-hanken text-gray-500 mb-3">
            {searchResults && searchResults.length > 0
              ? `Résultats pour « ${query} »`
              : `Aucun résultat pour « ${query} ».`}
          </p>
          <div className="space-y-7">
            {searchResults?.map(m => (
              <div key={m.slug}>
                <h2 className="font-syne font-bold text-[#0f1a3a] text-lg mb-3">{m.nom}</h2>
                {m.normes.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {m.normes.map((n, i) => <NormeCard key={i} n={n} />)}
                  </div>
                ) : (
                  <button onClick={() => { setQuery(''); setSelected(m.slug) }} className="text-[13px] font-hanken text-[#2f6fb0] hover:underline">
                    Voir toutes les normes de ce métier →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ---- Mode navigation par métier ----
        <div>
          {/* Sélecteur de métier */}
          <div className="flex flex-wrap gap-2 mb-5">
            {NORMES_METIERS.map(m => {
              const active = m.slug === current?.slug
              return (
                <button
                  key={m.slug}
                  onClick={() => setSelected(m.slug)}
                  className={`px-3.5 py-2 rounded-full text-[13px] font-hanken font-semibold transition-colors ${
                    active ? 'bg-[#0f1a3a] text-white' : 'bg-white border border-gray-200 text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fff5ec]'
                  }`}
                >
                  {m.nom}
                </button>
              )
            })}
          </div>

          {current && (
            <>
              <p className="font-hanken text-[13.5px] text-gray-500 mb-4">{current.resume}</p>
              <MetierBlock m={current} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
