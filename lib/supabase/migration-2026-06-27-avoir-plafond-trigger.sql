-- ============================================================
-- Migration : garde-fou ANTI-COURSE sur le plafond des avoirs
-- Date      : 2026-06-27
-- Objet     : empeche (au niveau base, donc fiable meme en concurrence)
--             qu'un avoir fasse depasser le total des avoirs imputes a une
--             facture au-dela du montant TTC de cette facture d'origine.
--             Le check JS cote app reste pour le message UX ; CE trigger est
--             la barriere reelle (double-clic / 2 onglets / retry reseau).
-- Nature    : ADDITIVE. N'agit QUE sur type='avoir' avec facture_origine_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_avoir_plafond()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origine_ttc numeric;
  v_deja        numeric;
BEGIN
  IF NEW.type = 'avoir' AND NEW.facture_origine_id IS NOT NULL THEN
    SELECT montant_ttc INTO v_origine_ttc
    FROM factures WHERE id = NEW.facture_origine_id;

    SELECT COALESCE(SUM(montant_ttc), 0) INTO v_deja
    FROM factures
    WHERE facture_origine_id = NEW.facture_origine_id
      AND type = 'avoir'
      AND deleted_at IS NULL;

    IF v_origine_ttc IS NOT NULL
       AND (v_deja + COALESCE(NEW.montant_ttc, 0)) > v_origine_ttc + 0.01 THEN
      RAISE EXCEPTION 'Avoir refuse: le total des avoirs (% EUR) depasserait le montant de la facture d origine (% EUR).',
        round((v_deja + COALESCE(NEW.montant_ttc,0))::numeric, 2),
        round(v_origine_ttc::numeric, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_avoir_plafond ON public.factures;
CREATE TRIGGER trg_check_avoir_plafond
  BEFORE INSERT ON public.factures
  FOR EACH ROW EXECUTE FUNCTION check_avoir_plafond();
