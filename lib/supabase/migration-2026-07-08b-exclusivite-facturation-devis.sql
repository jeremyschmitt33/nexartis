-- ============================================================================
--  Nexartis — EXCLUSIVITE DE FACTURATION D'UN DEVIS
--  Date : 2026-07-08
--
--  LE TROU (constate en production) :
--   Le cumul « deja facture » d'une facture de situation ne compte QUE les
--   factures `type = 'situation'` (cf. chargerSituationsDuDevis). Une facture
--   PLEINE, creee par le bouton « Convertir en facture » (type = 'standard',
--   devis_id renseigne), lui est donc TOTALEMENT INVISIBLE.
--   Consequence : convertir un devis en entier PUIS emettre des situations sur
--   ce meme devis repart d'un cumul a ZERO -> DOUBLE FACTURATION.
--
--   Pire, `handleConvertToFacture` n'avait aucun garde anti double-clic :
--   en base au 08/07/2026, le devis D-2026-69323 (marche 5 100 EUR HT) porte
--   TROIS factures pleines de 5 100 EUR (15 300 EUR), creees a 21:16, 21:18:38
--   et 21:18:44. Toutes en brouillon, aucune envoyee : aucun client n'a ete
--   double-facture, mais la porte etait grande ouverte.
--
--  LA REGLE (decision Jeremy, 08/07/2026) :
--   Un devis se facture SOIT en UNE facture complete, SOIT par situations.
--   Jamais les deux. Jamais deux factures completes.
--
--  POURQUOI UN TRIGGER ET PAS UN INDEX UNIQUE :
--   Un index `UNIQUE (devis_id) WHERE type='standard'` echouerait a se creer :
--   les 3 factures ci-dessus le violent deja. Le trigger, lui, ne contraint que
--   les ECRITURES FUTURES et tolere l'historique. (Ces doublons appartiennent a
--   un compte client : ne pas y toucher, c'est a lui de nettoyer ses brouillons.)
--
--  POURQUOI IL COUVRE AUSSI L'UPDATE (correctif du confrontateur) :
--   La corbeille est un SOFT delete (`UPDATE deleted_at = now()`) et la
--   restauration un `UPDATE deleted_at = NULL` (lib/hooks.tsx softDeleteRow /
--   restoreRow). Un trigger INSERT seul se contournait en 3 clics :
--     convertir -> mettre la facture pleine a la corbeille (devis parait libre)
--     -> emettre des situations -> RESTAURER la pleine (UPDATE : aucun trigger)
--   => devis avec facture pleine ET situations. Le trigger se declenche donc
--   aussi sur UPDATE, mais UNIQUEMENT quand la ligne (re)devient active sur un
--   devis : de-suppression, changement de `devis_id`, ou changement de `type`.
--   Les UPDATE courants (statut, montants, envoi...) ne paient aucun surcout.
--
--  CONCURRENCE :
--   Deux INSERT simultanes (2 appareils) verraient chacun « aucune facture »
--   en READ COMMITTED. Un `pg_advisory_xact_lock` par devis les serialise :
--   le second voit le premier et se fait refuser. Un index unique sur les
--   pleines serait plus fort mais est impossible (historique en violation).
--
--  SUPPRESSION DE COMPTE (RGPD) : non impactee. Les cascades sont des DELETE ;
--   ce trigger n'ecoute que INSERT et UPDATE.
--
--  ⚠️ RESTAURATION LOGIQUE D'UN DUMP (pg_restore / dump data-only) : elle rejoue
--   des INSERT et se ferait REFUSER sur les doublons historiques. Utiliser
--   `pg_restore --disable-triggers` ou `SET session_replication_role='replica'`.
--   Le PITR physique de Supabase (WAL) n'est PAS concerne.
--
--  REVERSIBLE : voir ROLLBACK en bas.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.exclusivite_facturation_devis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER            -- doit voir TOUTES les factures du devis, hors RLS
SET search_path = public
AS $$
DECLARE
  type_nouveau   text;
  pleine_existe  boolean;
  situ_existe    boolean;
  numero_pleine  text;
BEGIN
  -- Sans devis lie, rien a arbitrer (factures standard classiques, avoirs, COP...).
  IF NEW.devis_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Une ligne en corbeille n'occupe pas le devis : elle le libere.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  type_nouveau := COALESCE(NEW.type, 'standard');

  -- Un avoir n'est pas une facturation du devis : il annule une facture.
  IF type_nouveau = 'avoir' THEN
    RETURN NEW;
  END IF;

  -- Sur UPDATE, ne re-verifier QUE si la ligne (re)devient active sur ce devis.
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
         (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL)   -- restauration
      OR (OLD.devis_id IS DISTINCT FROM NEW.devis_id)              -- rattachement
      OR (COALESCE(OLD.type,'standard') IS DISTINCT FROM type_nouveau)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Serialise les ecritures concurrentes sur CE devis (libere en fin de transaction).
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.devis_id::text, 0));

  -- `f.id <> NEW.id` : ne jamais se compter soi-meme (cas UPDATE/restauration).
  SELECT EXISTS (
    SELECT 1 FROM public.factures f
    WHERE f.devis_id = NEW.devis_id
      AND f.id <> NEW.id
      AND f.deleted_at IS NULL
      AND COALESCE(f.type, 'standard') NOT IN ('situation', 'avoir')
  ) INTO pleine_existe;

  SELECT EXISTS (
    SELECT 1 FROM public.factures f
    WHERE f.devis_id = NEW.devis_id
      AND f.id <> NEW.id
      AND f.deleted_at IS NULL
      AND f.type = 'situation'
  ) INTO situ_existe;

  IF type_nouveau = 'situation' AND pleine_existe THEN
    RAISE EXCEPTION 'Ce devis a deja ete facture en une facture complete : il ne peut pas recevoir de facture de situation.'
      USING ERRCODE = '23514';
  END IF;

  IF type_nouveau <> 'situation' AND situ_existe THEN
    RAISE EXCEPTION 'Ce devis est facture par situations : il ne peut pas etre converti en une facture complete.'
      USING ERRCODE = '23514';
  END IF;

  IF type_nouveau <> 'situation' AND pleine_existe THEN
    SELECT f.numero INTO numero_pleine
    FROM public.factures f
    WHERE f.devis_id = NEW.devis_id AND f.id <> NEW.id AND f.deleted_at IS NULL
      AND COALESCE(f.type, 'standard') NOT IN ('situation', 'avoir')
    ORDER BY f.created_at LIMIT 1;
    RAISE EXCEPTION 'Ce devis est deja facture (facture %). Un devis ne peut etre converti qu''une seule fois.', COALESCE(numero_pleine, '?')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exclusivite_facturation_devis ON public.factures;
CREATE TRIGGER trg_exclusivite_facturation_devis
  BEFORE INSERT OR UPDATE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.exclusivite_facturation_devis();


-- ── Verifications post-migration ────────────────────────────────────────────
-- 1) Le trigger existe et couvre INSERT + UPDATE :
--    SELECT tgname, tgtype FROM pg_trigger
--    WHERE tgrelid='public.factures'::regclass AND tgname='trg_exclusivite_facturation_devis';
-- 2) Devis en violation HISTORIQUE (tolere, non bloquant) :
--    SELECT d.numero, count(*) FROM devis d JOIN factures f ON f.devis_id=d.id
--    WHERE f.deleted_at IS NULL AND COALESCE(f.type,'standard') NOT IN ('situation','avoir')
--    GROUP BY 1 HAVING count(*) > 1;


-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_exclusivite_facturation_devis ON public.factures;
-- DROP FUNCTION IF EXISTS public.exclusivite_facturation_devis();
