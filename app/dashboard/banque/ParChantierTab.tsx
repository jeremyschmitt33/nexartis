'use client'

// ============================================================================
// ParChantierTab — la rentabilité par chantier (Lot 2b)
// ----------------------------------------------------------------------------
// Un seul chemin de rentabilité (décision jeremy n°3) :
//   Rapporté = ce qui a été facturé sur le chantier (factures non supprimées,
//   avoirs déduits, dédupliquées par devis — même logique que la page
//   chantier détail pour ne JAMAIS afficher deux chiffres différents).
//   Dépensé  = les achats rattachés au chantier (deleted_at IS NULL).
// La phrase d'honnêteté : si des dépenses ne sont rattachées à aucun
// chantier, le chiffre est optimiste — on le dit.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { euros } from './commun'
import { Loader2 } from 'lucide-react'

type Tri = 'plus_rentables' | 'moins_rentables' | 'recents'

interface LigneChantier {
  id: string
  nom: string
  statut: string | null
  clientNom: string | null
  createdAt: string
  facture: number
  depense: number
  prevuDevis: number
  net: number
  achats: AchatChantier[]
}

interface AchatChantier {
  id: string
  libelle: string
  montant: number
  date: string | null
}

type R = Record<string, unknown>

export default function ParChantierTab({ onOuvrirTri }: { onOuvrirTri: () => void }) {
  const supabase = useMemo(() => createClient(), [])

  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [lignes, setLignes] = useState<LigneChantier[]>([])
  const [nbSansChantier, setNbSansChantier] = useState(0)
  const [nbATrier, setNbATrier] = useState(0)
  const [tri, setTri] = useState<Tri>('plus_rentables')
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    async function charger() {
      setChargement(true)
      setErreur(null)
      try {
        const [resChantiers, resClients, resFactures, resAchats, resFournisseurs, resATrier] =
          await Promise.all([
            supabase.from('chantiers').select('id, titre, statut, client_id, created_at'),
            supabase.from('clients').select('id, nom, prenom'),
            supabase
              .from('factures')
              .select('id, chantier_id, devis_id, type, montant_ttc, date_emission, created_at')
              .is('deleted_at', null),
            supabase
              .from('achats')
              .select(
                'id, chantier_id, montant_ttc, montant_ht, taux_tva, description, fournisseur_id, fournisseur_libre, date_achat',
              )
              .is('deleted_at', null),
            supabase.from('fournisseurs').select('id, nom'),
            supabase
              .from('banque_mouvements')
              .select('id', { count: 'exact', head: true })
              .eq('statut_pointage', 'a_pointer')
              .is('deleted_at', null),
          ])
        if (annule) return
        if (resChantiers.error) throw resChantiers.error
        if (resFactures.error) throw resFactures.error
        if (resAchats.error) throw resAchats.error

        const clients = new Map<string, string>()
        for (const c of (resClients.data ?? []) as R[]) {
          const nom = `${(c.prenom as string) ?? ''} ${(c.nom as string) ?? ''}`.trim()
          if (nom) clients.set(c.id as string, nom)
        }
        const fournisseurs = new Map<string, string>()
        for (const f of (resFournisseurs.data ?? []) as R[]) {
          fournisseurs.set(f.id as string, (f.nom as string) ?? '')
        }

        // ── Devis liés (pour « Prévu au devis ») — requête séparée légère ──
        const { data: devisData } = await supabase
          .from('devis')
          .select('id, chantier_id, montant_ttc')
          .is('deleted_at', null)
        const prevuParChantier = new Map<string, number>()
        for (const d of (devisData ?? []) as R[]) {
          const cId = d.chantier_id as string | null
          if (!cId) continue
          prevuParChantier.set(cId, (prevuParChantier.get(cId) ?? 0) + Number(d.montant_ttc ?? 0))
        }

        // ── Facturé par chantier (avoirs déduits + dédup par devis, même
        //    logique que la page chantier détail) ──
        const factureParChantier = new Map<string, number>()
        const parChantierFactures = new Map<string, R[]>()
        for (const f of (resFactures.data ?? []) as R[]) {
          const cId = f.chantier_id as string | null
          if (!cId) continue
          const liste = parChantierFactures.get(cId)
          if (liste) liste.push(f)
          else parChantierFactures.set(cId, [f])
        }
        for (const [cId, listeFactures] of Array.from(parChantierFactures.entries())) {
          let avoirs = 0
          const parDevis = new Map<string, R>()
          const sansDevis: R[] = []
          for (const f of listeFactures) {
            if ((f.type as string | null) === 'avoir') {
              avoirs += Number(f.montant_ttc ?? 0)
              continue
            }
            const devisId = f.devis_id as string | null
            if (!devisId) {
              sansDevis.push(f)
              continue
            }
            const existante = parDevis.get(devisId)
            const fDate = String(f.date_emission ?? f.created_at ?? '')
            const eDate = existante ? String(existante.date_emission ?? existante.created_at ?? '') : ''
            if (!existante || fDate > eDate) parDevis.set(devisId, f)
          }
          const total =
            [...Array.from(parDevis.values()), ...sansDevis].reduce(
              (s, f) => s + Number(f.montant_ttc ?? 0),
              0,
            ) - avoirs
          factureParChantier.set(cId, Math.round(total * 100) / 100)
        }

        // ── Dépensé par chantier + dépenses non rattachées ──
        const achatsParChantier = new Map<string, AchatChantier[]>()
        let sansChantier = 0
        for (const a of (resAchats.data ?? []) as R[]) {
          const cId = a.chantier_id as string | null
          const montantHt = Number(a.montant_ht ?? 0)
          const taux = Number(a.taux_tva ?? 20)
          const montant = Number(a.montant_ttc ?? montantHt * (1 + taux / 100))
          if (!cId) {
            sansChantier++
            continue
          }
          const libelle =
            (a.description as string | null) ||
            (a.fournisseur_libre as string | null) ||
            fournisseurs.get((a.fournisseur_id as string) ?? '') ||
            'Achat'
          const liste = achatsParChantier.get(cId) ?? []
          liste.push({
            id: a.id as string,
            libelle,
            montant: Math.round(montant * 100) / 100,
            date: (a.date_achat as string | null) ?? null,
          })
          achatsParChantier.set(cId, liste)
        }

        // ── Assemblage : uniquement les chantiers avec de l'activité ──
        const resultat: LigneChantier[] = []
        for (const c of (resChantiers.data ?? []) as R[]) {
          const id = c.id as string
          const facture = factureParChantier.get(id) ?? 0
          const achatsListe = (achatsParChantier.get(id) ?? []).sort((a, b) => b.montant - a.montant)
          const depense = Math.round(achatsListe.reduce((s, a) => s + a.montant, 0) * 100) / 100
          if (facture === 0 && depense === 0) continue
          resultat.push({
            id,
            nom: ((c.titre as string) || 'Chantier') as string,
            statut: (c.statut as string | null) ?? null,
            clientNom: clients.get((c.client_id as string) ?? '') ?? null,
            createdAt: String(c.created_at ?? ''),
            facture,
            depense,
            prevuDevis: Math.round((prevuParChantier.get(id) ?? 0) * 100) / 100,
            net: Math.round((facture - depense) * 100) / 100,
            achats: achatsListe,
          })
        }

        setLignes(resultat)
        setNbSansChantier(sansChantier)
        setNbATrier(resATrier.count ?? 0)
      } catch (e) {
        console.error('Chargement de la rentabilité par chantier impossible', e)
        if (!annule) setErreur('Impossible de calculer la rentabilité. Rechargez la page.')
      } finally {
        if (!annule) setChargement(false)
      }
    }
    void charger()
    return () => {
      annule = true
    }
  }, [supabase])

  const lignesTriees = useMemo(() => {
    const copie = [...lignes]
    if (tri === 'plus_rentables') copie.sort((a, b) => b.net - a.net)
    else if (tri === 'moins_rentables') copie.sort((a, b) => a.net - b.net)
    else copie.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return copie
  }, [lignes, tri])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400" role="status" aria-live="polite">
        <Loader2 size={22} className="animate-spin mr-2" aria-hidden="true" />
        <span className="text-sm font-semibold">Calcul de la rentabilité…</span>
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-800" role="alert">
        {erreur}
      </div>
    )
  }

  // ── État vide ──
  if (lignes.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center pt-12 pb-10">
        <div
          className="w-16 h-16 rounded-2xl bg-sky/15 text-navy flex items-center justify-center mx-auto mb-5 text-3xl"
          aria-hidden="true"
        >
          🏠
        </div>
        <h2 className="font-syne font-bold text-xl sm:text-2xl text-navy mb-3">
          Est-ce que vos chantiers vous rapportent&nbsp;?
        </h2>
        <p className="text-gray-600 mb-6">
          Ajoutez une dépense et rattachez-la à un chantier&nbsp;: on vous dira s’il vous rapporte de
          l’argent.
        </p>
        <Link
          href="/dashboard/achats?new=1"
          className="inline-flex items-center h-12 px-6 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold transition"
        >
          Ajouter ma première dépense
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Comment on calcule + phrase d'honnêteté */}
      <div className="flex items-start gap-2 bg-white border border-navy/[0.08] rounded-xl px-4 py-3 mb-4 text-[12.5px] text-navy/80 shadow-sm">
        <span className="mt-px" aria-hidden="true">ℹ️</span>
        <div>
          <p>
            <strong>Comment on calcule&nbsp;?</strong> Rapporté = ce que vous avez facturé sur ce chantier.
            Dépensé = les dépenses que vous y avez rattachées. Si vous n’avez pas tout rattaché, le chiffre
            est optimiste.
          </p>
          {(nbSansChantier > 0 || nbATrier > 0) && (
            <p className="mt-1.5 text-orange font-semibold">
              {nbSansChantier > 0 && (
                <>
                  {nbSansChantier} dépense{nbSansChantier > 1 ? 's ne sont rattachées' : ' n’est rattachée'} à
                  aucun chantier.{' '}
                </>
              )}
              {nbATrier > 0 && (
                <>
                  {nbATrier} opération{nbATrier > 1 ? 's' : ''} bancaire{nbATrier > 1 ? 's' : ''} reste
                  {nbATrier > 1 ? 'nt' : ''} à trier.{' '}
                  <button onClick={onOuvrirTri} className="underline underline-offset-2 font-bold">
                    Les trier
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Tri */}
      <div className="flex items-center gap-1.5 flex-wrap mb-5" role="group" aria-label="Trier les chantiers">
        {(
          [
            { id: 'plus_rentables', label: 'Les plus rentables' },
            { id: 'moins_rentables', label: 'Les moins rentables' },
            { id: 'recents', label: 'Récents' },
          ] as { id: Tri; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTri(t.id)}
            aria-pressed={tri === t.id}
            className={`h-8 px-3 rounded-full border-[1.5px] text-[12.5px] font-semibold transition ${
              tri === t.id
                ? 'bg-navy border-navy text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-sky'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cartes */}
      <div className="space-y-4">
        {lignesTriees.map((c) => {
          const max = Math.max(c.facture, c.depense, 1)
          const enPerte = c.net < 0
          const statutLabel =
            c.statut === 'livre' || c.statut === 'cloture'
              ? 'Terminé'
              : c.statut === 'archive'
                ? 'Archivé'
                : 'En cours'
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Link
                  href={`/dashboard/chantiers/${c.id}`}
                  className="font-syne font-bold text-[16px] text-navy hover:underline underline-offset-2"
                >
                  {c.nom}
                </Link>
                {c.clientNom && (
                  <span className="inline-flex items-center px-2 py-px rounded-full bg-sky/15 text-navy text-[11px] font-semibold">
                    {c.clientNom}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-px rounded-full text-[11px] font-semibold ${
                    statutLabel === 'En cours' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {statutLabel}
                </span>
                <span
                  className={`ml-auto font-syne font-bold text-[15px] tabular-nums ${
                    enPerte ? 'text-red-700/80' : 'text-green-700'
                  }`}
                >
                  {enPerte ? `− ${euros(Math.abs(c.net))}` : `+ ${euros(c.net)}`}
                </span>
              </div>

              {/* Barres Facturé / Dépensé */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-16 text-gray-500 flex-shrink-0">Facturé</span>
                  <div
                    className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden"
                    role="img"
                    aria-label={`Facturé : ${euros(c.facture)}`}
                  >
                    <div
                      className="h-full rounded-full bg-green-600"
                      style={{ width: `${Math.round((c.facture / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right flex-shrink-0 tabular-nums">{euros(c.facture)}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-16 text-gray-500 flex-shrink-0">Dépensé</span>
                  <div
                    className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden"
                    role="img"
                    aria-label={`Dépensé : ${euros(c.depense)}`}
                  >
                    <div
                      className="h-full rounded-full bg-orange"
                      style={{ width: `${Math.round((c.depense / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right flex-shrink-0 tabular-nums">{euros(c.depense)}</span>
                </div>
              </div>

              {/* Verdict */}
              {enPerte ? (
                <p className="text-[13.5px] font-bold text-red-700/80 mb-1">
                  Ce chantier vous a coûté {euros(Math.abs(c.net))} de plus que ce qu’il a rapporté.{' '}
                  <button
                    onClick={() => setDetailOuvert(detailOuvert === c.id ? null : c.id)}
                    aria-expanded={detailOuvert === c.id}
                    className="underline underline-offset-2 font-bold"
                  >
                    Voir pourquoi
                  </button>
                </p>
              ) : (
                <p className="text-[13.5px] font-bold text-green-700 mb-1">
                  Ce chantier vous a rapporté {euros(c.net)}
                  {c.depense > 0 && (
                    <>
                      {' '}
                      <button
                        onClick={() => setDetailOuvert(detailOuvert === c.id ? null : c.id)}
                        aria-expanded={detailOuvert === c.id}
                        className="underline underline-offset-2 font-bold text-[12px] text-gray-500"
                      >
                        {detailOuvert === c.id ? 'Masquer le détail' : 'Voir le détail'}
                      </button>
                    </>
                  )}
                </p>
              )}

              {/* Sous-ligne devis */}
              <p className="text-[12px] text-gray-500">
                {c.prevuDevis > 0 ? (
                  <>
                    Prévu au devis&nbsp;: {euros(c.prevuDevis)}
                    {c.facture < c.prevuDevis ? (
                      <> · Reste à facturer&nbsp;: {euros(Math.round((c.prevuDevis - c.facture) * 100) / 100)}</>
                    ) : (
                      <> · Conforme au devis ✓</>
                    )}
                  </>
                ) : (
                  <>Aucun devis lié à ce chantier</>
                )}
              </p>

              {/* Détail des dépenses (des plus grosses aux plus petites) */}
              {detailOuvert === c.id && (
                <div className="mt-3 rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {c.achats.length === 0 ? (
                    <p className="px-4 py-3 text-[12.5px] text-gray-500">
                      Aucune dépense rattachée à ce chantier.
                    </p>
                  ) : (
                    c.achats.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                        <span className="text-gray-400 tabular-nums w-16 flex-shrink-0">
                          {a.date ? a.date.split('-').reverse().slice(0, 2).join('/') : '—'}
                        </span>
                        <span className="flex-1 truncate text-navy">{a.libelle}</span>
                        <span className="text-navy tabular-nums">− {euros(a.montant)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
