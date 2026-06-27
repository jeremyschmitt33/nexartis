-- =====================================================================
-- Imputation d'un avoir « à valoir » sur une nouvelle facture
-- Date : 2026-06-27  ·  project skuqfqnfitrovzeexwsr
-- DEJA APPLIQUEE EN BASE via MCP (2 migrations). Fichier de trace versionnee.
-- ADDITIVE. L'imputation est un REGLEMENT : ne touche jamais TTC/TVA/CA.
-- =====================================================================

-- 1) Colonnes -----------------------------------------------------------
-- Sur la facture CONSOMMATRICE : quel avoir a ete impute (id + numero snapshot)
-- et le montant impute (reglement par compensation).
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS avoir_impute_id uuid;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS avoir_impute_numero text;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS avoir_impute_montant numeric(12,2);
-- Sur l'AVOIR : cumul deja impute (gere le residu). Dispo = montant_ttc - cumul.
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS avoir_montant_impute numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_avoir_montant_impute_chk;
ALTER TABLE public.factures ADD CONSTRAINT factures_avoir_montant_impute_chk CHECK (avoir_montant_impute >= 0);

-- Garde-fou : on n'impute jamais plus que le montant de l'avoir.
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_avoir_impute_max_chk;
ALTER TABLE public.factures ADD CONSTRAINT factures_avoir_impute_max_chk
  CHECK (avoir_montant_impute <= COALESCE(montant_ttc, 0) + 0.01);

CREATE INDEX IF NOT EXISTS idx_factures_avoir_a_valoir_dispo
  ON public.factures(client_id)
  WHERE type = 'avoir' AND remboursement_statut = 'a_valoir';

-- 2) Debit ATOMIQUE du credit (anti double-usage + plafond dans le WHERE) ----
-- SECURITY INVOKER => RLS appliquee (un user ne debite que SES avoirs).
-- Retourne le montant reellement debite (le montant demande, ou 0 si refuse).
CREATE OR REPLACE FUNCTION public.debiter_avoir_impute(p_avoir_id uuid, p_montant numeric)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_rows int;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE factures
  SET avoir_montant_impute = avoir_montant_impute + p_montant
  WHERE id = p_avoir_id
    AND type = 'avoir'
    AND remboursement_statut = 'a_valoir'
    AND deleted_at IS NULL
    AND (avoir_montant_impute + p_montant) <= COALESCE(montant_ttc, 0) + 0.01;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN CASE WHEN v_rows = 1 THEN p_montant ELSE 0 END;
END;
$function$;

-- 3) Re-credit (rollback si la facture echoue, ou suppression de la facture) --
CREATE OR REPLACE FUNCTION public.recrediter_avoir_impute(p_avoir_id uuid, p_montant numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN;
  END IF;
  UPDATE factures
  SET avoir_montant_impute = GREATEST(0, avoir_montant_impute - p_montant)
  WHERE id = p_avoir_id AND type = 'avoir';
END;
$function$;
