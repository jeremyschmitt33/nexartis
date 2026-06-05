-- =====================================================================
-- Migration : ajouter doc_color_bandeau_haut_droite sur la table entreprises
-- Date : 5 juin 2026 - V3.1
-- =====================================================================
-- Cette colonne permet de configurer une couleur SEPAREE pour la zone droite
-- du bandeau (cote DEVIS + numero + dates), distincte de la zone gauche
-- (cote logo + nom). Les 2 zones sont separees par la barre doree au milieu.
--
-- Si NULL (cas par defaut pour les anciennes entreprises) : le code utilise
-- automatiquement doc_color_bandeau_haut comme fallback, preservant le rendu
-- existant.
--
-- A EXECUTER UNE SEULE FOIS dans Supabase : SQL Editor > New query >
-- coller > Run. Idempotent : peut etre re-execute sans risque.
-- =====================================================================

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS doc_color_bandeau_haut_droite TEXT;

COMMENT ON COLUMN entreprises.doc_color_bandeau_haut_droite IS
  'Couleur de la zone droite du bandeau d en-tete (devis + numero + dates), au format hex #RRGGBB. NULL = utiliser doc_color_bandeau_haut comme fallback.';
