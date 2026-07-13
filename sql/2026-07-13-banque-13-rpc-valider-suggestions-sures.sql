-- =========================================================================
-- Migration banque-13 : rpc_valider_suggestions_sures + rpc_compter_suggestions_sures
-- Appliquée en prod (skuqfqnfitrovzeexwsr) le 13/07/2026. Conçue + confrontée
-- (agent confrontateur sécurité) + contrôles avant/après.
--
-- Objet : déplacer les GARDE-FOUS métier du bouton « Valider les suggestions
-- sûres » côté SERVEUR, pour qu'un futur bug d'interface ne puisse JAMAIS
-- valider en masse un privé, un crédit, une catégorie pro/perso ambiguë ou un
-- gros montant.
--
-- Sécurité : SECURITY INVOKER => la RLS 'dirigeant' de banque_mouvements
-- (policy UPDATE avec USING + WITH CHECK, vérifiée) est la barrière tenant+rôle.
-- Les fonctions lisent depense_categories : les catégories système (user_id NULL)
-- sont visibles par tous, celles du tenant par son dirigeant => jamais de
-- fail-open sur le test est_privee. Droits : REVOKE PUBLIC + GRANT authenticated.
--
-- Garde-fous « qualité » (dans le WHERE) : a_pointer + categorisation_auto +
-- categorie_id NOT NULL (exclut binaires) + montant<0 (jamais crédit) +
-- nature='normal' + est_prive=false + abs(montant)<300 + catégorie de
-- groupe 'depense', non privée, hors {assurances_pro, protection_sociale, vehicule}.
--
-- Contrôle AVANT : 4 suggestions « sûres » attendues (2 SFR + 1 Bouygues + 1 Amazon ;
-- assureurs exclus). Contrôle APRÈS : les 2 fonctions existent en INVOKER,
-- rpc_compter_suggestions_sures() = 4.
--
-- NOTE (upgrade fail-closed durable, à faire plus tard) : ajouter
-- depense_categories.auto_validable boolean DEFAULT false, marquer explicitement
-- les catégories sûres, puis remplacer le bloc groupe/est_privee/NOT IN par
-- « c.auto_validable = true » dans les DEUX fonctions.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_valider_suggestions_sures()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.banque_mouvements AS m
  SET statut_pointage = 'pointe'            -- updated_at géré par le trigger set_updated_at
  WHERE m.statut_pointage    = 'a_pointer'
    AND m.categorisation_auto = true
    AND m.categorie_id IS NOT NULL
    AND m.montant  < 0
    AND m.nature   = 'normal'
    AND m.est_prive = false
    AND m.deleted_at IS NULL
    AND abs(m.montant) < 300
    AND EXISTS (
      SELECT 1 FROM public.depense_categories AS c
      WHERE c.id = m.categorie_id
        AND c.groupe = 'depense'
        AND c.est_privee = false
        AND c.code NOT IN ('assurances_pro', 'protection_sociale', 'vehicule')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_compter_suggestions_sures()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.banque_mouvements AS m
  WHERE m.statut_pointage    = 'a_pointer'
    AND m.categorisation_auto = true
    AND m.categorie_id IS NOT NULL
    AND m.montant  < 0
    AND m.nature   = 'normal'
    AND m.est_prive = false
    AND m.deleted_at IS NULL
    AND abs(m.montant) < 300
    AND EXISTS (
      SELECT 1 FROM public.depense_categories AS c
      WHERE c.id = m.categorie_id
        AND c.groupe = 'depense'
        AND c.est_privee = false
        AND c.code NOT IN ('assurances_pro', 'protection_sociale', 'vehicule')
    );
$$;

REVOKE ALL ON FUNCTION public.rpc_valider_suggestions_sures()  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_compter_suggestions_sures()  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_valider_suggestions_sures() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_compter_suggestions_sures() TO authenticated;
