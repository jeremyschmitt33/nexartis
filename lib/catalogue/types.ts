// ---------------------------------------------------------------------------
// Catalogue de prestations pre-remplies par metier (donnees statiques).
// L'artisan parcourt le catalogue de son metier et ajoute les prestations
// voulues a SON catalogue perso (table `prestations`). Aucun prix ici : il
// met le sien (l'autocompletion memorise ensuite ses prix).
//
// CONTRAINTES (alignees sur la table `prestations`) :
//  - unite : UNIQUEMENT une des 9 valeurs ci-dessous (CHECK en base).
//  - categorie : UNIQUEMENT une des 4 valeurs ci-dessous (CHECK en base).
//  - tva : 5.5 | 10 | 20  (10 = renovation logement >2 ans par defaut ;
//          20 = neuf / hors taux reduit ; 5.5 = renovation energetique).
// ---------------------------------------------------------------------------

export type Unite = 'U' | 'Fft' | 'm²' | 'ml' | 'h' | 'kg' | 'ens' | 'lot' | 'j'

export type CategoriePresta = 'fournitures' | 'main_oeuvre' | 'ouvrages' | 'deplacements'

export interface CatalogueItem {
  /** Libelle de la prestation, concis et professionnel (comme une ligne de devis). */
  designation: string
  unite: Unite
  /** 5.5 | 10 | 20 */
  tva: number
  categorie: CategoriePresta
}
