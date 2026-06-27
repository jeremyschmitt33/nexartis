-- =====================================================================
-- Migration : V2 Suivi du remboursement d'un avoir
-- Date      : 2026-06-27
-- Nature    : ADDITIVE. project ref skuqfqnfitrovzeexwsr
-- =====================================================================
-- DEJA APPLIQUEE EN BASE PROD via MCP Supabase le 2026-06-27 (testee :
-- insert + update + rollback, 4 assertions vertes). Ce fichier sert de
-- trace versionnee (le code applicatif depend de ces objets).
--
-- Contenu :
--   1) 4e etat 'a_valoir' (avoir deduit d'une facture future, pas de cash).
--   2) Colonnes rembourse_montant / rembourse_mode (trace du solde).
--   3) Index partiel sur les avoirs en attente de remboursement.
--   4) Trigger qui bascule les avoirs lies en 'a_rembourser' quand la
--      facture d'origine est payee APRES la creation de l'avoir (corrige
--      le bug ou l'obligation de remboursement restait invisible).
-- =====================================================================

-- 1) 4e etat
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_remboursement_statut_chk;
ALTER TABLE public.factures
  ADD CONSTRAINT factures_remboursement_statut_chk
  CHECK (remboursement_statut IN ('non_du','a_rembourser','rembourse','a_valoir'));

-- 2) Tracabilite du solde
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS rembourse_montant numeric(12,2);
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS rembourse_mode text;
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_rembourse_mode_chk;
ALTER TABLE public.factures
  ADD CONSTRAINT factures_rembourse_mode_chk
  CHECK (rembourse_mode IS NULL OR rembourse_mode IN ('virement','cheque','especes','cb','a_valoir','autre'));

COMMENT ON COLUMN public.factures.rembourse_montant IS 'Avoir : montant reellement rembourse/impute au client.';
COMMENT ON COLUMN public.factures.rembourse_mode IS 'Avoir : virement|cheque|especes|cb|a_valoir|autre.';

-- 3) Index partiel
CREATE INDEX IF NOT EXISTS idx_factures_avoir_a_rembourser
  ON public.factures(facture_origine_id)
  WHERE remboursement_statut = 'a_rembourser';

-- 4) Trigger de propagation (base sur les MONTANTS, robuste aux libelles de statut)
CREATE OR REPLACE FUNCTION public.propagate_avoir_remboursement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_avoirs numeric;
  v_refund_du    numeric;
  v_new_statut   text;
BEGIN
  -- Anti-recursion : seules les factures d'origine declenchent (pas les avoirs).
  IF NEW.type IS NOT DISTINCT FROM 'avoir' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(montant_ttc), 0) INTO v_total_avoirs
  FROM factures
  WHERE facture_origine_id = NEW.id
    AND type = 'avoir'
    AND deleted_at IS NULL;

  IF v_total_avoirs <= 0 THEN
    RETURN NEW;
  END IF;

  -- Regle : montant a rembourser = max(0, paye + avoirs - ttc).
  v_refund_du := GREATEST(0, COALESCE(NEW.montant_paye, 0) + v_total_avoirs - COALESCE(NEW.montant_ttc, 0));
  v_new_statut := CASE WHEN v_refund_du > 0.01 THEN 'a_rembourser' ELSE 'non_du' END;

  -- Ne touche JAMAIS un avoir deja solde (rembourse / a_valoir).
  UPDATE factures
  SET remboursement_statut = v_new_statut
  WHERE facture_origine_id = NEW.id
    AND type = 'avoir'
    AND deleted_at IS NULL
    AND remboursement_statut IN ('non_du', 'a_rembourser')
    AND remboursement_statut <> v_new_statut;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagate_avoir_remboursement ON public.factures;
CREATE TRIGGER trg_propagate_avoir_remboursement
AFTER UPDATE OF montant_paye, statut ON public.factures
FOR EACH ROW
EXECUTE FUNCTION public.propagate_avoir_remboursement();
