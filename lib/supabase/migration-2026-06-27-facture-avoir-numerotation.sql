-- ============================================================
-- Migration : Facture d'avoir V2 — serie dediee AV + suivi remboursement
-- Date      : 2026-06-27
-- Objet     :
--   1) Compteur dedie 'avoir_compteurs' (serie AV-AAAA-NNNN), isole du
--      compteur factures -> aucun risque sur la numerotation legale F.
--   2) Branche le trigger set_facture_numero sur NEW.type :
--        type='avoir' -> AV-AAAA-NNNN (compteur avoir_compteurs)
--        sinon        -> F-AAAA-NNNN  (compteur facture_compteurs, INCHANGE)
--   3) Colonnes suivi remboursement + date facture d'origine (Factur-X 381).
-- Nature    : ADDITIVE. La branche 'else' reproduit a l'identique le
--             comportement existant -> les factures standard/acompte/situation
--             ne changent pas. Seul type='avoir' diverge.
-- ============================================================

-- 1) Compteur dedie aux avoirs (miroir de facture_compteurs)
CREATE TABLE IF NOT EXISTS public.avoir_compteurs (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee          int  NOT NULL,
  dernier_numero int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, annee)
);
ALTER TABLE public.avoir_compteurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avoir_compteurs_select_own ON public.avoir_compteurs;
CREATE POLICY avoir_compteurs_select_own ON public.avoir_compteurs
  FOR SELECT USING (auth.uid() = user_id);

-- 2) Colonnes avoir (suivi remboursement + date origine pour Factur-X / BOFiP)
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS facture_origine_date date;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS remboursement_statut text NOT NULL DEFAULT 'non_du';
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS rembourse_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factures_remboursement_statut_chk') THEN
    ALTER TABLE public.factures
      ADD CONSTRAINT factures_remboursement_statut_chk
      CHECK (remboursement_statut IN ('non_du','a_rembourser','rembourse'));
  END IF;
END $$;

COMMENT ON COLUMN public.factures.remboursement_statut IS
  'Avoir uniquement : non_du (origine impayee), a_rembourser (origine payee), rembourse.';
COMMENT ON COLUMN public.factures.facture_origine_date IS
  'Avoir : date d emission de la facture d origine (reference Factur-X / BOFiP).';

-- 3) Trigger de numerotation : branche sur le type (AV vs F)
CREATE OR REPLACE FUNCTION public.set_facture_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_annee INT;
  v_num   INT;
BEGIN
  v_annee := EXTRACT(YEAR FROM COALESCE(NEW.date_emission, CURRENT_DATE))::INT;

  IF NEW.type = 'avoir' THEN
    -- Serie dediee AVOIR (compteur isole)
    INSERT INTO avoir_compteurs (user_id, annee, dernier_numero)
    VALUES (NEW.user_id, v_annee, 1)
    ON CONFLICT (user_id, annee)
    DO UPDATE SET dernier_numero = avoir_compteurs.dernier_numero + 1
    RETURNING dernier_numero INTO v_num;

    NEW.numero := 'AV-' || v_annee || '-' || lpad(v_num::TEXT, 4, '0');
  ELSE
    -- Serie FACTURE (comportement existant, inchange)
    INSERT INTO facture_compteurs (user_id, annee, dernier_numero)
    VALUES (NEW.user_id, v_annee, 1)
    ON CONFLICT (user_id, annee)
    DO UPDATE SET dernier_numero = facture_compteurs.dernier_numero + 1
    RETURNING dernier_numero INTO v_num;

    NEW.numero := 'F-' || v_annee || '-' || lpad(v_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$function$;
