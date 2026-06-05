-- =====================================================================
-- Migration : personnalisation de l'incrustation du logo sur les documents
-- Date : 5 juin 2026 - V3.1
-- =====================================================================
-- Permet a l'artisan de configurer comment son logo apparait sur les devis
-- et factures (style d'incrustation + tailles).
--
-- 3 nouvelles colonnes :
--
-- 1. doc_logo_style (TEXT)
--    Style d'incrustation du logo dans le bandeau :
--      - 'carte-classique' (par defaut) : carte blanche 90x90 actuelle
--      - 'carte-minimaliste'            : carte blanche 64x64 plus discrete
--      - 'sans-carte'                   : logo directement sur le bandeau (pour PNG transparent)
--
-- 2. doc_logo_size (INTEGER, pourcentage 60-140, defaut 100)
--    Multiplicateur de taille du logo : 60% (petit) -> 140% (grand)
--
-- 3. doc_nom_size (INTEGER, pourcentage 60-140, defaut 100)
--    Multiplicateur de taille du nom d'entreprise affiche a cote du logo
--
-- A EXECUTER UNE SEULE FOIS dans Supabase (SQL Editor > New query > Run).
-- Idempotent : peut etre re-execute sans risque.
-- =====================================================================

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS doc_logo_style TEXT,
  ADD COLUMN IF NOT EXISTS doc_logo_size INTEGER,
  ADD COLUMN IF NOT EXISTS doc_nom_size INTEGER;

-- Contrainte de validation : 3 styles autorises
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_doc_logo_style_check;

ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_logo_style_check
  CHECK (doc_logo_style IS NULL OR doc_logo_style IN ('carte-classique', 'carte-minimaliste', 'sans-carte'));

-- Contrainte de validation : tailles entre 60% et 140%
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_doc_logo_size_check,
  DROP CONSTRAINT IF EXISTS entreprises_doc_nom_size_check;

ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_logo_size_check
  CHECK (doc_logo_size IS NULL OR (doc_logo_size >= 60 AND doc_logo_size <= 140));

ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_nom_size_check
  CHECK (doc_nom_size IS NULL OR (doc_nom_size >= 60 AND doc_nom_size <= 140));

COMMENT ON COLUMN entreprises.doc_logo_style IS
  'Style d incrustation du logo : carte-classique | carte-minimaliste | sans-carte. NULL = carte-classique (defaut historique).';

COMMENT ON COLUMN entreprises.doc_logo_size IS
  'Taille du logo en pourcentage 60-140. NULL = 100 (taille standard).';

COMMENT ON COLUMN entreprises.doc_nom_size IS
  'Taille du nom d entreprise dans le bandeau, en pourcentage 60-140. NULL = 100 (taille standard).';
