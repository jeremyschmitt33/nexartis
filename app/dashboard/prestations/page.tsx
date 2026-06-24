'use client'

// ---------------------------------------------------------------------------
// Page « Prestations » unifiee.
// Fusionne les anciennes pages /dashboard/bibliotheque (CRUD perso) et
// /dashboard/catalogue (catalogue par metier) via un selecteur de mode.
//
//   - Mode « Mes prestations » : CRUD complet (table `prestations`).
//   - Mode « Catalogue »       : consultation par metier + bouton « + Ajouter »
//     qui ouvre le modal de creation de « Mes prestations » pre-rempli.
//
// Shell leger : etat `mode` + selecteur, delegue le contenu aux deux composants
// components/prestations/MesPrestations et CatalogueBrowse.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import { BookOpen, Library } from 'lucide-react'
import type { CatalogueItem } from '@/lib/catalogue'
import MesPrestations, { type MesPrestationsHandle } from '@/components/prestations/MesPrestations'
import CatalogueBrowse from '@/components/prestations/CatalogueBrowse'

type Mode = 'mine' | 'catalogue'

// Le catalogue stocke la categorie en minuscule (fournitures / main_oeuvre /
// ouvrages / deplacements). La table `prestations` (et donc le modal de creation)
// attend la valeur capitalisee francaise. On mappe ici pour pre-remplir
// correctement la categorie dans le modal.
type CategorieModal = 'Fournitures' | "Main d'œuvre" | 'Ouvrages' | 'Déplacements'

const CATEGORIE_CATALOGUE_TO_MODAL: Record<string, CategorieModal> = {
  fournitures: 'Fournitures',
  main_oeuvre: "Main d'œuvre",
  ouvrages: 'Ouvrages',
  deplacements: 'Déplacements',
}

export default function PrestationsPage() {
  const [mode, setMode] = useState<Mode>('mine')
  const mesPrestationsRef = useRef<MesPrestationsHandle>(null)

  // « + Ajouter » depuis le catalogue : on ouvre le modal de creation de
  // « Mes prestations » pre-rempli (prix laisse vide a l'artisan), puis on
  // bascule sur l'onglet « Mes prestations » pour qu'il voie le modal.
  const handleAddFromCatalogue = (item: CatalogueItem) => {
    setMode('mine')
    // Le composant MesPrestations est monte dans les deux modes (cf. plus bas),
    // donc la ref est disponible immediatement.
    mesPrestationsRef.current?.openCreateModal({
      designation: item.designation,
      unite: item.unite,
      taux_tva: item.tva,
      categorie: CATEGORIE_CATALOGUE_TO_MODAL[item.categorie] ?? 'Fournitures',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header de page */}
      <div>
        <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
          Prestations
        </h1>
        <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
          Tes prestations enregistrées et le catalogue prêt à l&apos;emploi par métier
        </p>
      </div>

      {/* Selecteur de mode */}
      <div
        role="tablist"
        aria-label="Affichage des prestations"
        className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200"
      >
        <button
          role="tab"
          aria-selected={mode === 'mine'}
          onClick={() => setMode('mine')}
          className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-hanken font-bold transition-colors ${
            mode === 'mine'
              ? 'bg-white text-[#0f1a3a] shadow-sm'
              : 'text-gray-500 hover:text-[#0f1a3a]'
          }`}
        >
          <BookOpen size={15} />
          Mes prestations
        </button>
        <button
          role="tab"
          aria-selected={mode === 'catalogue'}
          onClick={() => setMode('catalogue')}
          className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-hanken font-bold transition-colors ${
            mode === 'catalogue'
              ? 'bg-white text-[#0f1a3a] shadow-sm'
              : 'text-gray-500 hover:text-[#0f1a3a]'
          }`}
        >
          <Library size={15} />
          Catalogue
        </button>
      </div>

      {/* Contenu.
          MesPrestations reste TOUJOURS monte (juste masque en mode catalogue)
          pour que la ref imperative soit disponible quand on ajoute depuis le
          catalogue, et pour ne pas perdre son etat (recherche, filtre). */}
      <div className={mode === 'mine' ? '' : 'hidden'}>
        <MesPrestations ref={mesPrestationsRef} />
      </div>
      {mode === 'catalogue' && (
        <CatalogueBrowse onAdd={handleAddFromCatalogue} />
      )}
    </div>
  )
}
