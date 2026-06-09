-- ============================================================
-- Migration : Etape 3 du tutoriel onboarding (5 nouvelles bulles)
-- Date : 2026-06-09
-- ============================================================
-- Ajoute 5 nouvelles colonnes pour couvrir les 5 bulles
-- supplementaires du tour V2 :
--   - tour_install_seen           (PWA : installer Nexartis)
--   - tour_voice_seen             (commande vocale)
--   - tour_theme_seen             (theme couleurs documents)
--   - tour_equipe_mode_seen       (mode Solo / Societe)
--   - tour_chantier_journal_seen  (journal de chantier)
--
-- Cette migration est ADDITIONNELLE et suppose que
-- migration-onboarding.sql + migration-onboarding-step2.sql ont
-- deja ete executees.
--
-- Pour les utilisateurs existants : on positionne les 5 nouvelles
-- colonnes a TRUE si tour_completed_at IS NOT NULL — ils ont deja
-- termine le tour V1, on ne les saoule pas avec les nouveautes.
-- Decision Jerem : "pas de bandeau Nouveautes, ca sera la
-- normalite pour les nouveaux".
-- ============================================================

-- 1. Ajouter les 5 nouvelles colonnes (idempotent)
ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS tour_install_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS tour_voice_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS tour_theme_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS tour_equipe_mode_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS tour_chantier_journal_seen BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_onboarding.tour_install_seen IS
  'TRUE quand l''utilisateur a vu (ou skippe) la bulle "Installe Nexartis sur ton telephone" (PWA).';

COMMENT ON COLUMN public.user_onboarding.tour_voice_seen IS
  'TRUE quand l''utilisateur a vu (ou skippe) la bulle "Dicte tes devis et factures". Skippe silencieusement pour les plans Essentiel hors trial (bouton vocal absent du DOM).';

COMMENT ON COLUMN public.user_onboarding.tour_theme_seen IS
  'TRUE quand l''utilisateur a vu la bulle "Habille tes documents a tes couleurs" sur la page Parametres.';

COMMENT ON COLUMN public.user_onboarding.tour_equipe_mode_seen IS
  'TRUE quand l''utilisateur a vu la bulle "Mode Solo ou Societe" sur la page Equipe.';

COMMENT ON COLUMN public.user_onboarding.tour_chantier_journal_seen IS
  'TRUE quand l''utilisateur a vu la bulle "Tiens un journal de chantier" sur la 1ere page chantier ouverte.';

-- 2. Marquer comme deja vu pour les utilisateurs qui ont DEJA
--    termine le tour V1 (tour_completed_at IS NOT NULL).
--    Justification : ne pas leur reafficher 5 nouvelles bulles
--    retroactivement, ils sont productifs.
--
--    Cas particulier : les utilisateurs en cours de tour V1
--    (tour_completed_at IS NULL mais avec certaines etapes
--    cochees) garderont les 5 nouvelles a FALSE, donc ils
--    decouvriront le tour V2 complet. C'est volontaire :
--    eux n'ont pas encore termine, ils sont encore en phase
--    d'apprentissage.
UPDATE public.user_onboarding
SET
  tour_install_seen = true,
  tour_voice_seen = true,
  tour_theme_seen = true,
  tour_equipe_mode_seen = true,
  tour_chantier_journal_seen = true
WHERE tour_completed_at IS NOT NULL;

-- ============================================================
-- Verification (a executer apres la migration) :
-- ============================================================
-- SELECT
--   count(*) FILTER (WHERE tour_install_seen = true)            AS install_vu,
--   count(*) FILTER (WHERE tour_voice_seen = true)              AS voice_vu,
--   count(*) FILTER (WHERE tour_theme_seen = true)              AS theme_vu,
--   count(*) FILTER (WHERE tour_equipe_mode_seen = true)        AS equipe_vu,
--   count(*) FILTER (WHERE tour_chantier_journal_seen = true)   AS journal_vu,
--   count(*) FILTER (WHERE tour_completed_at IS NOT NULL)       AS deja_onboardes
-- FROM public.user_onboarding;
--
-- Les 5 premieres colonnes doivent etre >= au nombre
-- "deja_onboardes" (anciens utilisateurs preserves).
-- ============================================================
