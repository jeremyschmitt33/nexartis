-- ============================================================================
-- VERROU SERVEUR : factures de situation reservees a l'offre Complet
-- ============================================================================
-- A EXECUTER DANS Supabase > SQL Editor.
--
-- >>> IMPORTANT : a executer DE PREFERENCE EN PRESENCE DE CLAUDE / quand tu es
--     dispo, pour tester IMMEDIATEMENT juste apres qu'une facture STANDARD se
--     cree toujours normalement. Un trigger sur la table factures touche TOUTES
--     les creations de factures : on verifie tout de suite que rien n'est casse.
--
-- Effet : empeche la creation d'une facture de type 'situation' pour un compte
-- en offre ESSENTIEL paye (abonnement actif/suspendu + subscription_plan='essential').
-- Les essais (trial), les comptes lifetime et l'offre Complet ne sont JAMAIS bloques.
-- Fail-open : si le plan n'est pas trouve, l'insertion est autorisee (on ne bloque
-- jamais un client par erreur).
--
-- Colonne de type sur la table factures : "type" (standard / acompte / situation / avoir).
-- (Verifie le 30/06/2026 : la colonne s'appelle bien "type", pas "facture_type".)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_facture_situation_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abonnement text;
  v_plan       text;
BEGIN
  IF NEW.type = 'situation' THEN
    SELECT e.abonnement_type, e.subscription_plan
      INTO v_abonnement, v_plan
      FROM public.entreprise_membres m
      JOIN public.entreprises e ON e.id = m.entreprise_id
     WHERE m.user_id = NEW.user_id
       AND m.statut = 'actif'
     LIMIT 1;

    -- Plan effectif : trial / lifetime => acces complet. On ne bloque que les
    -- offres payantes Essentiel (actif/suspendu + plan 'essential').
    IF v_abonnement IS NOT NULL
       AND v_abonnement NOT IN ('trial', 'lifetime')
       AND COALESCE(v_plan, 'complete') <> 'complete' THEN
      RAISE EXCEPTION 'Les factures de situation sont reservees a l''offre Complet'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facture_situation_plan ON public.factures;
CREATE TRIGGER trg_facture_situation_plan
  BEFORE INSERT ON public.factures
  FOR EACH ROW
  EXECUTE FUNCTION public.check_facture_situation_plan();

-- ============================================================================
-- TEST RAPIDE APRES EXECUTION (depuis le logiciel) :
--   1. Cree une facture STANDARD  -> doit fonctionner normalement.
--   2. Cree une facture de SITUATION avec un compte d'essai ou Complet -> OK.
--   (Aucun compte Essentiel paye n'existe encore, donc rien a tester de ce cote.)
--
-- POUR ANNULER LE VERROU (si besoin) :
--   DROP TRIGGER IF EXISTS trg_facture_situation_plan ON public.factures;
--   DROP FUNCTION IF EXISTS public.check_facture_situation_plan();
-- ============================================================================
