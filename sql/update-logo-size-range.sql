-- =====================================================================
-- Migration UPDATE : etendre l'echelle des sliders logo a 60-200%
-- Date : 5 juin 2026 - V3.1.1
-- =====================================================================
-- Met a jour les contraintes CHECK pour autoriser logo_size et nom_size
-- jusqu'a 200% (au lieu de 140%). A executer SI tu as deja execute la
-- migration add-logo-customization.sql.
-- =====================================================================

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_doc_logo_size_check,
  DROP CONSTRAINT IF EXISTS entreprises_doc_nom_size_check;

ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_logo_size_check
  CHECK (doc_logo_size IS NULL OR (doc_logo_size >= 60 AND doc_logo_size <= 200));

ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_nom_size_check
  CHECK (doc_nom_size IS NULL OR (doc_nom_size >= 60 AND doc_nom_size <= 200));
