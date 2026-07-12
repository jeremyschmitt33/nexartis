-- ============================================================================
-- Fichier  : 2026-07-12-banque-03-comptes-tresorerie.sql
-- Module   : Dépenses & Banque V1 — fichier 3/7
-- POURQUOI : Les mouvements importés (fichier 04) doivent être rattachés à un
--            compte. Une seule table pour les comptes bancaires ET la caisse
--            espèces : la caisse n'est qu'un compte de type 'caisse' dont le
--            fond de caisse est le solde_initial et dont les opérations sont
--            des mouvements en source 'manuel'.
-- QUOI     : table comptes_tresorerie + index d'unicité du nom + RLS
--            (pattern live « entreprise + dirigeant », répliqué de achats).
-- RAPPEL SÉCURITÉ : JAMAIS d'IBAN complet — uniquement iban_masque
--            (ex. « FR76 •••• 1234 ») pour reconnaître le compte.
-- NOTE     : le solde courant n'est JAMAIS stocké (il dériverait) — il se
--            calcule : solde_initial + SUM(mouvements non supprimés).
--            En V1 on n'affiche d'ailleurs AUCUN solde bancaire (décision
--            confrontation C5) ; solde_initial ne sert qu'à la caisse.
-- IDEMPOTENT : oui.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comptes_tresorerie (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  nom                TEXT NOT NULL,                    -- « Compte pro Boursorama », « Caisse »
  type               TEXT NOT NULL DEFAULT 'bancaire'
                       CHECK (type IN ('bancaire','caisse')),
  banque_nom         TEXT,                             -- NULL pour une caisse
  iban_masque        TEXT,                             -- JAMAIS l'IBAN complet
  devise             TEXT NOT NULL DEFAULT 'EUR',
  solde_initial      NUMERIC(12,2) NOT NULL DEFAULT 0, -- fond de caisse / solde de départ
  solde_initial_date DATE NOT NULL DEFAULT CURRENT_DATE,
  couleur            TEXT,                             -- pastille UI
  actif              BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un même utilisateur ne crée pas deux comptes du même nom (hors corbeille).
CREATE UNIQUE INDEX IF NOT EXISTS comptes_tresorerie_nom_uniq
  ON public.comptes_tresorerie (user_id, lower(nom)) WHERE deleted_at IS NULL;

-- Convention projet : updated_at maintenu par trigger.
DROP TRIGGER IF EXISTS set_updated_at ON public.comptes_tresorerie;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.comptes_tresorerie
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.comptes_tresorerie ENABLE ROW LEVEL SECURITY;

-- Les 4 policies, pattern EXACT observé en live sur achats (données d'argent
-- réservées au rôle dirigeant de l'entreprise).
DROP POLICY IF EXISTS comptes_tresorerie_select ON public.comptes_tresorerie;
CREATE POLICY comptes_tresorerie_select ON public.comptes_tresorerie FOR SELECT
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

DROP POLICY IF EXISTS comptes_tresorerie_insert ON public.comptes_tresorerie;
CREATE POLICY comptes_tresorerie_insert ON public.comptes_tresorerie FOR INSERT
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

DROP POLICY IF EXISTS comptes_tresorerie_update ON public.comptes_tresorerie;
CREATE POLICY comptes_tresorerie_update ON public.comptes_tresorerie FOR UPDATE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

DROP POLICY IF EXISTS comptes_tresorerie_delete ON public.comptes_tresorerie;
CREATE POLICY comptes_tresorerie_delete ON public.comptes_tresorerie FOR DELETE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

-- ─── VÉRIFICATION après application ─────────────────────────────────────────
-- SELECT relrowsecurity FROM pg_class WHERE relname='comptes_tresorerie';  → true
-- SELECT count(*) FROM pg_policies WHERE tablename='comptes_tresorerie';   → 4

-- ============================================================================
-- ROLLBACK :
--
-- DROP TABLE IF EXISTS public.comptes_tresorerie;
--   (⚠️ si le fichier 04 est déjà appliqué, supprimer d'abord banque_mouvements
--    et banque_imports qui la référencent)
-- ============================================================================
