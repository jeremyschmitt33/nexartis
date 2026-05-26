-- ============================================================
-- Migration : Etape 2 du tutoriel onboarding
-- Date : 2026-05-26
-- ============================================================
-- Ajoute la colonne tour_parametres_seen pour gerer une seconde
-- bulle qui s'affiche quand l'utilisateur arrive sur la page
-- Parametres apres avoir vu la 1ere bulle du dashboard.
--
-- Cette migration est ADDITIONNELLE et suppose que
-- migration-onboarding.sql a deja ete executee. Si la table
-- user_onboarding n'existe pas, executez d'abord cette derniere.
-- ============================================================

-- 1. Ajouter la nouvelle colonne (par defaut false pour les
--    nouveaux comptes, on la mettra a true ensuite pour les
--    utilisateurs deja onboardes).
ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS tour_parametres_seen BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_onboarding.tour_parametres_seen IS
  'TRUE quand l''utilisateur a vu (ou ferme) la bulle confirmant que le profil entreprise se remplit dans les Parametres. Affiche apres la 1ere bulle du dashboard.';

-- 2. Marquer comme deja vu pour les utilisateurs qui ont deja
--    soit termine le tour, soit deja vu la 1ere bulle dashboard.
--    Justification : ne pas leur reafficher la bulle 2
--    retroactivement, ils sont deja productifs.
UPDATE public.user_onboarding
SET tour_parametres_seen = true
WHERE tour_completed_at IS NOT NULL
   OR tour_dashboard_seen = true;

-- ============================================================
-- Verification (a executer apres la migration) :
-- ============================================================
-- SELECT
--   count(*) FILTER (WHERE tour_parametres_seen = true)  AS deja_vu,
--   count(*) FILTER (WHERE tour_parametres_seen = false) AS a_voir
-- FROM public.user_onboarding;
--
-- "deja_vu" doit etre egal au nombre d'utilisateurs existants
-- au moment de l'execution. "a_voir" doit etre 0 (sauf nouveaux
-- comptes crees apres la migration).
-- ============================================================
