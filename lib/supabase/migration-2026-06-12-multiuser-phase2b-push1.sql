-- ============================================================================
-- Migration 2026-06-12 — Multi-utilisateur Phase 2b / PUSH 1
-- « Tuyauterie d'invitation » (inviter / révoquer / lookup / activer)
-- ----------------------------------------------------------------------------
-- CONTEXTE (à lire avant d'exécuter) :
--   - Les Phases 1 et 2a sont DÉJÀ en prod : table `entreprise_membres` créée,
--     RLS « membership » active sur ~25 tables, et 3 fonctions SQL
--     SECURITY DEFINER existent déjà en base (NE PAS les recréer) :
--       * current_entreprise_ids() RETURNS SETOF uuid
--       * entreprise_of_user(target uuid) RETURNS uuid
--       * current_role_in(ent uuid) RETURNS text
--   - L'écriture client est COUPÉE sur entreprise_membres
--     (REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated). SEUL le
--     service_role écrit des membres, et le service_role BYPASS la RLS.
--     => On n'ajoute donc AUCUNE policy d'écriture ici : les routes API
--        /api/equipe/* utilisent la clé SERVICE_ROLE côté serveur.
--
-- CONTENU DE CE PUSH :
--   1. Index d'accélération du lookup public par token d'invitation.
--   2. Vérification (pas de recréation) de l'index unique « 1 user = 1
--      entreprise active » dont dépend /api/equipe/activer.
--
-- Cette migration est IDEMPOTENTE (ré-exécutable sans erreur).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Index d'accélération du lookup par invite_token
-- ----------------------------------------------------------------------------
-- Les routes GET /api/equipe/invitation/[token] et POST /api/equipe/activer
-- font un lookup `WHERE invite_token = $1 AND statut = 'invite'`. On indexe
-- uniquement les lignes encore en attente d'activation (statut = 'invite'),
-- ce qui garde l'index petit (les membres actifs ont invite_token = NULL).
CREATE INDEX IF NOT EXISTS idx_membres_invite_token
  ON public.entreprise_membres (invite_token)
  WHERE statut = 'invite';


-- ----------------------------------------------------------------------------
-- 2) Index unique « 1 user = 1 entreprise active »
-- ----------------------------------------------------------------------------
-- DÉJÀ PRÉSENT DEPUIS LA PHASE 2a sous le nom `uq_membre_user_actif` :
--   CREATE UNIQUE INDEX uq_membre_user_actif
--     ON public.entreprise_membres (user_id)
--     WHERE (user_id IS NOT NULL AND statut = 'actif');
-- => On ne le recrée donc PAS. /api/equipe/activer s'appuie dessus : si un
--    user tente de devenir membre actif d'une 2e entreprise, l'UPDATE lève
--    une violation d'unicité (code 23505) que la route attrape et traduit en
--    message clair. Le bloc ci-dessous est un FILET : il (re)crée l'index
--    UNIQUEMENT s'il venait à manquer (IF NOT EXISTS), sans jamais doublonner.
CREATE UNIQUE INDEX IF NOT EXISTS uq_membre_user_actif
  ON public.entreprise_membres (user_id)
  WHERE (user_id IS NOT NULL AND statut = 'actif');


-- ============================================================================
-- VÉRIFICATIONS (à lancer après exécution — résultats attendus en commentaire)
-- ============================================================================
--
-- a) Les deux index doivent exister :
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'entreprise_membres'
--      AND indexname IN ('idx_membres_invite_token', 'uq_membre_user_actif');
--    -> 2 lignes attendues.
--
-- b) Aucun doublon de membre actif par user (l'unique doit tenir) :
--    SELECT user_id, count(*) FROM public.entreprise_membres
--    WHERE statut = 'actif' AND user_id IS NOT NULL
--    GROUP BY user_id HAVING count(*) > 1;
--    -> 0 ligne attendue.
--
-- c) Les 3 fonctions helper sont bien présentes (ne pas les recréer) :
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('current_entreprise_ids', 'entreprise_of_user', 'current_role_in');
--    -> 3 lignes attendues.
-- ============================================================================
