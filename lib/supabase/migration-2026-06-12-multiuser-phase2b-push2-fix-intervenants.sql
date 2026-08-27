-- ============================================================================
-- Migration 2026-06-12 — Multi-utilisateur Push 2 / CORRECTIF intervenants (ecriture)
-- ----------------------------------------------------------------------------
-- POURQUOI : la verification post-deploiement a montre que la table `intervenants`
--   (fiches equipe / RH) avait gardé des policies d'ECRITURE non role-aware.
--   En particulier `intervenants_delete` etait en "membership SANS filtre de role"
--   => un OUVRIER (membre actif) aurait pu SUPPRIMER des fiches equipe. Les
--   policies insert/update etaient en "proprietaire seul" (auth.uid()=user_id),
--   donc deja sures, mais on harmonise tout proprement ici.
--
-- CIBLE : ecriture sur intervenants = DIRIGEANT + COMMERCIAL (coherent avec la
--   lecture intervenants_select = dir+commercial). OUVRIER = aucune ecriture.
--
-- A EXECUTER : Supabase > SQL Editor > New query > coller > Run > "Success".
--   (Aucun deploiement de code necessaire. Idempotent / rejouable.)
-- ============================================================================

-- 1) Supprimer toutes les policies d'ecriture existantes sur intervenants
--    (legacy "owner-only" + membership 2a).
DROP POLICY IF EXISTS "Users can insert own intervenants" ON intervenants;
DROP POLICY IF EXISTS "Users can update own intervenants" ON intervenants;
DROP POLICY IF EXISTS "Users can delete own intervenants" ON intervenants;
DROP POLICY IF EXISTS intervenants_insert ON intervenants;
DROP POLICY IF EXISTS intervenants_update ON intervenants;
DROP POLICY IF EXISTS intervenants_delete ON intervenants;

-- 2) Recreer en role-aware : dirigeant + commercial uniquement.
--    WITH CHECK empeche d'ecrire une fiche rattachee a une autre entreprise.
CREATE POLICY intervenants_insert ON intervenants FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

CREATE POLICY intervenants_update ON intervenants FOR UPDATE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
) WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

CREATE POLICY intervenants_delete ON intervenants FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ============================================================================
-- VERIFICATION (apres) : aucune policy d'ecriture intervenants ne doit etre
-- "membership sans role". Doit renvoyer 3 lignes, toutes role-aware.
--   SELECT policyname, cmd,
--     (qual ilike '%current_role_in%' OR with_check ilike '%current_role_in%') as role_aware
--   FROM pg_policies
--   WHERE schemaname='public' AND tablename='intervenants'
--     AND cmd IN ('INSERT','UPDATE','DELETE');
-- ============================================================================
