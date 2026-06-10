-- ============================================
-- Migration : ajouter decennale_date_fin sur entreprises
-- Date : 2026-06-10
-- Contexte : Le cron quotidien `/api/cron/rappels-suggestions` cree
-- un rappel automatique J-60 avant l'expiration de la garantie decennale.
-- Pour fonctionner, il a besoin d'une date de fin de validite stockee
-- sur l'entreprise. La colonne `decennale_numero` existait deja, mais
-- la date n'etait nulle part.
--
-- Comment executer :
-- 1. Ouvrir Supabase Dashboard -> Project -> SQL Editor
-- 2. Copier-coller ce fichier entier
-- 3. Run
--
-- Note : la colonne est nullable et la migration est idempotente,
-- donc aucun risque sur les entreprises existantes (elles seront
-- ignorees par le cron tant que la date n'est pas saisie).
-- ============================================

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS decennale_date_fin DATE;

COMMENT ON COLUMN entreprises.decennale_date_fin IS
  'Date de fin de validite de la garantie decennale. Utilisee par le cron pour generer un rappel automatique 60 jours avant expiration.';

-- Verification
SELECT
  COUNT(*) AS total_entreprises,
  COUNT(decennale_date_fin) AS avec_date_fin,
  COUNT(*) - COUNT(decennale_date_fin) AS sans_date_fin
FROM entreprises;
