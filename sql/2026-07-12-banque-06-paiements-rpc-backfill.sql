-- ============================================================================
-- Fichier  : 2026-07-12-banque-06-paiements-rpc-backfill.sql
-- Module   : Dépenses & Banque V1 — fichier 6/7 — LE fichier critique
-- POURQUOI : La table paiements (0 ligne aujourd'hui) devient LA source de
--            vérité des encaissements (multi-acomptes : plusieurs virements →
--            une facture). factures.montant_paye devient un CACHE recalculé.
--            Décision jeremy n°1 : PAS de trigger (celui du brainstorm était
--            bugué 3 fois — cf. confrontation §3.2) mais DEUX RPC
--            transactionnelles qui répliquent la VRAIE machine à statuts du
--            code métier (app/dashboard/factures/[id]/page.tsx) :
--              · « Marquer payée » (l.393-412)  : cash = TTC − avoir imputé,
--                statut 'payee'.
--              · Paiement partiel (l.1294-1310) : plafond cash =
--                TTC − avoir imputé ; statut 'payee' si
--                (cash + avoir imputé) >= TTC − 0.01, sinon
--                'partiellement_payee'.
--              · Annulation : rétrogradation du statut (le trigger rejeté ne
--                rétrogradait jamais). Le code actuel n'a PAS d'annulation de
--                paiement : on définit la rétrogradation à zéro paiement vers
--                'en_retard' si l'échéance est dépassée, sinon 'envoyee'
--                (les états « non payée » que filtrent les crons de relance).
-- QUOI     : 1) ALTER paiements (mouvement_id, deleted_at, updated_at)
--            2) rpc_enregistrer_paiement / rpc_annuler_paiement
--            3) BACKFILL des 33 factures à montant_paye > 0 (EN DERNIER,
--               clairement séparé, contrôles avant/après en commentaire)
--
-- ⚠️⚠️ COORDINATION AVEC LE CODE APPLICATIF — À LIRE ABSOLUMENT ⚠️⚠️
-- La route d'import (app/api/import/execute/route.ts:240) écrit
-- factures.montant_paye DIRECTEMENT (whitelist d'import). Ces RPC ne cassent
-- PAS ce chemin : aucun trigger n'est posé, l'app peut continuer d'écrire
-- montant_paye sans conflit. MAIS le patch applicatif doit partir dans le
-- MÊME lot de déploiement que la mise en service du module banque :
--   (a) route d'import → générer des paiements synthétiques à l'insertion
--       quand montant_paye > 0 (sinon : facture importée avec montant_paye
--       sans lignes paiements → le premier appel RPC sur cette facture
--       écraserait l'historique importé) ;
--   (b) bouton « Marquer payée » → rpc_enregistrer_paiement(facture_id,
--       reste_dû) au lieu d'updateRow(montant_paye) ;
--   (c) modale « Enregistrer un paiement » → rpc_enregistrer_paiement ;
--   (d) lib/services/cop-facture.ts:73 → créer le paiement via la RPC (ou un
--       INSERT paiements) après la création de la facture.
-- D'ici là : l'app continue d'écrire montant_paye directement, sans conflit.
-- Le backfill ci-dessous se base sur l'état de la base À SON EXÉCUTION —
-- si un import a lieu entre ce backfill et le déploiement du patch (a),
-- relancer simplement le bloc BACKFILL (il est idempotent).
--
-- SÉCURITÉ : les RPC sont SECURITY INVOKER (défaut) → les RLS de factures,
-- paiements et banque_mouvements s'appliquent au demandeur (2ᵉ verrou :
-- seul le dirigeant de l'entreprise passe). EXECUTE retiré à anon.
--
-- INTERACTION AVEC LES TRIGGERS LIVE DE factures (analysée le 12/07, pg_trigger) :
--   · trg_propagate_avoir_remboursement (AFTER UPDATE OF montant_paye, statut)
--     SE DÉCLENCHE sur les UPDATE des deux RPC : il recalcule le statut de
--     remboursement des avoirs liés (paye + avoirs − ttc) — c'est VOULU, la
--     cohérence des avoirs est conservée. Pas de récursion : il n'écrit que
--     remboursement_statut (colonne hors de sa clause OF) sur les avoirs.
--   · trg_check_avoir_plafond : no-op ici (n'agit que si NEW.type = 'avoir',
--     or la RPC refuse les avoirs).
--   · trg_exclusivite_facturation_devis : no-op sur UPDATE quand ni devis_id,
--     ni type, ni deleted_at ne changent (early return vérifié dans son prosrc).
--   · Le BACKFILL (INSERT paiements uniquement) ne touche pas factures →
--     aucun trigger de factures ne se déclenche.
-- IDEMPOTENT : oui (ADD IF NOT EXISTS, CREATE OR REPLACE, backfill gardé
-- par NOT EXISTS).
-- ============================================================================

-- ─── 1) Extension de la table paiements ─────────────────────────────────────
ALTER TABLE public.paiements
  -- Rapprochement encaissement : CE virement entrant finance CE paiement.
  -- Un mouvement peut financer PLUSIEURS paiements (un virement solde
  -- 2 factures) : la ventilation vit ici, dans paiements.montant.
  ADD COLUMN IF NOT EXISTS mouvement_id UUID REFERENCES public.banque_mouvements(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS paiements_facture_idx
  ON public.paiements (facture_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS paiements_mouvement_idx
  ON public.paiements (mouvement_id) WHERE mouvement_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.paiements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- NB : paiements a DÉJÀ RLS + les 4 policies « entreprise + dirigeant »
-- (vérifié en live le 12/07 : paiements_select/insert/update/delete).

-- ─── 2a) RPC : enregistrer un paiement ──────────────────────────────────────
-- Insère le paiement ET recalcule montant_paye + date_paiement + statut dans
-- LA MÊME transaction, avec la machine à statuts du code métier.
-- Erreurs métier : levées en EXCEPTION avec un préfixe stable (MONTANT_…,
-- FACTURE_…, MOUVEMENT_…) que l'app peut mapper vers des messages français.
CREATE OR REPLACE FUNCTION public.rpc_enregistrer_paiement(
  p_facture_id    UUID,
  p_montant       NUMERIC,
  p_date_paiement DATE DEFAULT CURRENT_DATE,
  p_methode       TEXT DEFAULT NULL,   -- NULL = 'virement' sur le paiement, mode_paiement facture inchangé
  p_mouvement_id  UUID DEFAULT NULL,   -- NULL = paiement hors banque (chèque, espèces…)
  p_reference     TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_f            RECORD;
  v_mvt          RECORD;
  v_total_avant  NUMERIC(12,2);
  v_total_apres  NUMERIC(12,2);
  v_avoir        NUMERIC(12,2);
  v_ttc          NUMERIC(12,2);
  v_cash_max     NUMERIC(12,2);
  v_deja_affecte NUMERIC(12,2);
  v_statut       TEXT;
  v_derniere     DATE;
  v_paiement_id  UUID;
  v_methode      TEXT;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'MONTANT_INVALIDE: le montant doit être strictement positif';
  END IF;

  -- Normalisation OBLIGATOIRE : paiements.methode a un CHECK strict en
  -- minuscules ('virement','cheque','cb','especes','autre' — vérifié live
  -- 12/07 : paiements_methode_check), alors que l'app envoie aujourd'hui
  -- 'Virement' / 'Especes' (majuscules). Sans mapping → violation de CHECK.
  v_methode := CASE lower(COALESCE(NULLIF(trim(p_methode), ''), 'virement'))
    WHEN 'virement' THEN 'virement'
    WHEN 'cheque'   THEN 'cheque'   WHEN 'chèque'  THEN 'cheque'
    WHEN 'cb'       THEN 'cb'       WHEN 'carte'   THEN 'cb'
    WHEN 'carte bancaire' THEN 'cb'
    WHEN 'especes'  THEN 'especes'  WHEN 'espèces' THEN 'especes'
    ELSE 'autre'
  END;

  -- Verrou sur la facture : deux paiements simultanés se sérialisent ici.
  -- SECURITY INVOKER : si la facture n'est pas visible par le demandeur
  -- (RLS), NOT FOUND → FACTURE_INTROUVABLE (pas de fuite d'information).
  SELECT id, user_id, montant_ttc, COALESCE(avoir_impute_montant, 0) AS avoir,
         statut, type, deleted_at, date_echeance
    INTO v_f
    FROM public.factures
   WHERE id = p_facture_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FACTURE_INTROUVABLE: facture inexistante ou non accessible';
  END IF;
  IF v_f.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'FACTURE_SUPPRIMEE: cette facture est dans la corbeille';
  END IF;
  IF v_f.type = 'avoir' THEN
    RAISE EXCEPTION 'FACTURE_AVOIR: un avoir ne reçoit pas de paiement';
  END IF;

  v_ttc      := COALESCE(v_f.montant_ttc, 0);
  v_avoir    := v_f.avoir;
  -- Machine à statuts du code métier : le cash ne « mange » jamais la part
  -- déjà réglée par un avoir imputé. Plafond cash = TTC − avoir imputé.
  v_cash_max := GREATEST(0, v_ttc - v_avoir);

  SELECT COALESCE(SUM(montant), 0) INTO v_total_avant
    FROM public.paiements
   WHERE facture_id = p_facture_id AND deleted_at IS NULL;

  v_total_apres := round(v_total_avant + p_montant, 2);
  IF v_total_apres > v_cash_max + 0.01 THEN
    RAISE EXCEPTION 'MONTANT_TROP_ELEVE: total % > reste encaissable % (TTC % − avoir imputé % − déjà payé %)',
      v_total_apres, GREATEST(0, round(v_cash_max - v_total_avant, 2)), v_ttc, v_avoir, v_total_avant;
  END IF;

  -- Garde-fou rapprochement : la somme des paiements adossés à un même
  -- mouvement bancaire ne peut pas dépasser le montant du mouvement.
  IF p_mouvement_id IS NOT NULL THEN
    SELECT id, montant INTO v_mvt
      FROM public.banque_mouvements
     WHERE id = p_mouvement_id AND deleted_at IS NULL
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MOUVEMENT_INTROUVABLE: mouvement inexistant ou non accessible';
    END IF;
    IF v_mvt.montant <= 0 THEN
      RAISE EXCEPTION 'MOUVEMENT_PAS_UN_CREDIT: seul un crédit (montant positif) finance un encaissement';
    END IF;
    SELECT COALESCE(SUM(montant), 0) INTO v_deja_affecte
      FROM public.paiements
     WHERE mouvement_id = p_mouvement_id AND deleted_at IS NULL;
    IF v_deja_affecte + p_montant > v_mvt.montant + 0.01 THEN
      RAISE EXCEPTION 'MOUVEMENT_DEPASSE: % déjà affectés + % > montant du mouvement %',
        v_deja_affecte, p_montant, v_mvt.montant;
    END IF;
  END IF;

  -- user_id NOT NULL : repris de la facture (correction confrontation §1.3).
  INSERT INTO public.paiements
    (user_id, facture_id, montant, date_paiement, methode, reference, notes, mouvement_id)
  VALUES
    (v_f.user_id, p_facture_id, round(p_montant, 2),
     COALESCE(p_date_paiement, CURRENT_DATE),
     v_methode, p_reference, p_notes, p_mouvement_id)
  RETURNING id INTO v_paiement_id;

  SELECT MAX(date_paiement) INTO v_derniere
    FROM public.paiements
   WHERE facture_id = p_facture_id AND deleted_at IS NULL;

  -- Statut : 'payee' quand cash + avoir imputé couvrent le TTC (tolérance
  -- 1 centime, comme le code métier l.1304), sinon 'partiellement_payee'.
  v_statut := CASE
    WHEN v_ttc > 0 AND (v_total_apres + v_avoir) >= v_ttc - 0.01 THEN 'payee'
    ELSE 'partiellement_payee'
  END;

  UPDATE public.factures
     SET montant_paye  = v_total_apres,
         date_paiement = v_derniere::timestamptz,
         mode_paiement = COALESCE(p_methode, mode_paiement),
         statut        = v_statut,
         updated_at    = now()
   WHERE id = p_facture_id;

  RETURN jsonb_build_object(
    'paiement_id',  v_paiement_id,
    'facture_id',   p_facture_id,
    'montant_paye', v_total_apres,
    'statut',       v_statut,
    'reste_du',     GREATEST(0, round(v_cash_max - v_total_apres, 2))
  );
END;
$$;

-- ─── 2b) RPC : annuler un paiement (pointage erroné) ────────────────────────
-- Soft-delete du paiement + recalcul complet AVEC RÉTROGRADATION du statut
-- (le point que le trigger rejeté ne gérait pas).
CREATE OR REPLACE FUNCTION public.rpc_annuler_paiement(
  p_paiement_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_p        RECORD;
  v_f        RECORD;
  v_total    NUMERIC(12,2);
  v_avoir    NUMERIC(12,2);
  v_ttc      NUMERIC(12,2);
  v_statut   TEXT;
  v_derniere DATE;
BEGIN
  SELECT id, facture_id, deleted_at INTO v_p
    FROM public.paiements
   WHERE id = p_paiement_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAIEMENT_INTROUVABLE: paiement inexistant ou non accessible';
  END IF;
  IF v_p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'PAIEMENT_DEJA_ANNULE: ce paiement est déjà annulé';
  END IF;

  SELECT id, montant_ttc, COALESCE(avoir_impute_montant, 0) AS avoir,
         statut, date_echeance
    INTO v_f
    FROM public.factures
   WHERE id = v_p.facture_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FACTURE_INTROUVABLE: facture du paiement inaccessible';
  END IF;

  UPDATE public.paiements
     SET deleted_at = now(), updated_at = now()
   WHERE id = p_paiement_id;

  SELECT COALESCE(SUM(montant), 0), MAX(date_paiement)
    INTO v_total, v_derniere
    FROM public.paiements
   WHERE facture_id = v_p.facture_id AND deleted_at IS NULL;

  v_ttc   := COALESCE(v_f.montant_ttc, 0);
  v_avoir := v_f.avoir;

  -- Rétrogradation : on ne recalcule le statut QUE depuis les états liés au
  -- paiement (on ne touche jamais à brouillon/archivee/annulee…).
  IF v_f.statut IN ('payee', 'partiellement_payee', 'envoyee', 'en_retard') THEN
    v_statut := CASE
      WHEN v_ttc > 0 AND (v_total + v_avoir) >= v_ttc - 0.01 THEN 'payee'
      WHEN v_total > 0.009 THEN 'partiellement_payee'
      WHEN v_f.date_echeance IS NOT NULL AND v_f.date_echeance < CURRENT_DATE THEN 'en_retard'
      ELSE 'envoyee'
    END;
  ELSE
    v_statut := v_f.statut;
  END IF;

  UPDATE public.factures
     SET montant_paye  = v_total,
         date_paiement = v_derniere::timestamptz,  -- NULL s'il ne reste aucun paiement
         statut        = v_statut,
         updated_at    = now()
   WHERE id = v_p.facture_id;

  RETURN jsonb_build_object(
    'paiement_id',  p_paiement_id,
    'facture_id',   v_p.facture_id,
    'montant_paye', v_total,
    'statut',       v_statut
  );
END;
$$;

-- Droits : jamais anon, uniquement les utilisateurs connectés (les RLS font
-- le reste en SECURITY INVOKER) + service_role pour les scripts.
REVOKE ALL ON FUNCTION public.rpc_enregistrer_paiement(UUID, NUMERIC, DATE, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_enregistrer_paiement(UUID, NUMERIC, DATE, TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_annuler_paiement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_annuler_paiement(UUID) TO authenticated, service_role;

-- ============================================================================
-- ─── 3) BACKFILL — EN DERNIER, BLOC SÉPARÉ ──────────────────────────────────
-- Pour chaque facture existante avec montant_paye > 0 (33 au comptage du
-- 12/07/2026), créer UN paiement synthétique reprenant l'historique.
-- - user_id repris de factures.user_id (NOT NULL — correction confrontation).
-- - Ne modifie JAMAIS factures.montant_paye : le cache reste tel quel,
--   le backfill se contente d'aligner la nouvelle source de vérité dessus.
-- - Idempotent : NOT EXISTS sur les paiements actifs de la facture.
-- - Exécuté dans le SQL editor (rôle postgres) → les RLS ne bloquent pas.
-- ============================================================================

-- CONTRÔLE AVANT (à exécuter et noter le résultat — attendu : 33,
-- re-vérifié en live le 12/07 par l'audit) :
-- SELECT count(*) FROM public.factures f
--  WHERE f.montant_paye > 0 AND f.deleted_at IS NULL
--    AND COALESCE(f.type, 'standard') <> 'avoir'
--    AND NOT EXISTS (SELECT 1 FROM public.paiements p
--                     WHERE p.facture_id = f.id AND p.deleted_at IS NULL);

INSERT INTO public.paiements (user_id, facture_id, montant, date_paiement, methode, notes)
SELECT f.user_id,
       f.id,
       round(f.montant_paye, 2),
       COALESCE(f.date_paiement::date, f.updated_at::date, CURRENT_DATE),
       -- ⚠️ Normalisation OBLIGATOIRE : paiements.methode a un CHECK strict
       -- en minuscules ('virement','cheque','cb','especes','autre') et les
       -- valeurs live de factures.mode_paiement sont 'Virement' / 'Especes'
       -- (majuscules, vérifié le 12/07). Sans ce CASE, l'INSERT entier ÉCHOUE.
       CASE lower(COALESCE(NULLIF(trim(f.mode_paiement), ''), 'virement'))
         WHEN 'virement' THEN 'virement'
         WHEN 'cheque'   THEN 'cheque'   WHEN 'chèque'  THEN 'cheque'
         WHEN 'cb'       THEN 'cb'       WHEN 'carte'   THEN 'cb'
         WHEN 'carte bancaire' THEN 'cb'
         WHEN 'especes'  THEN 'especes'  WHEN 'espèces' THEN 'especes'
         ELSE 'autre'
       END,
       'Repris de l''historique (backfill banque du 2026-07-12)'
  FROM public.factures f
 WHERE f.montant_paye > 0
   AND f.deleted_at IS NULL
   -- Un avoir ne reçoit pas de paiement (même règle que la RPC). 0 cas au
   -- 12/07 ; garde de rejouabilité pour les rejeux futurs du bloc.
   AND COALESCE(f.type, 'standard') <> 'avoir'
   AND NOT EXISTS (
     SELECT 1 FROM public.paiements p
      WHERE p.facture_id = f.id AND p.deleted_at IS NULL
   );

-- CONTRÔLE APRÈS (les deux requêtes doivent renvoyer 0) :
-- 1. Plus aucune facture payée sans ligne paiements :
-- SELECT count(*) FROM public.factures f
--  WHERE f.montant_paye > 0 AND f.deleted_at IS NULL
--    AND COALESCE(f.type, 'standard') <> 'avoir'
--    AND NOT EXISTS (SELECT 1 FROM public.paiements p
--                     WHERE p.facture_id = f.id AND p.deleted_at IS NULL);
-- 2. Le cache et la source de vérité sont alignés au centime :
-- SELECT count(*) FROM public.factures f
--  WHERE f.deleted_at IS NULL AND f.montant_paye > 0
--    AND round(f.montant_paye, 2) <> (
--      SELECT round(COALESCE(SUM(p.montant), 0), 2)
--        FROM public.paiements p
--       WHERE p.facture_id = f.id AND p.deleted_at IS NULL);

-- ============================================================================
-- ROLLBACK :
--
-- -- 1) Retirer le backfill (les paiements synthétiques sont marqués) :
-- DELETE FROM public.paiements
--  WHERE notes = 'Repris de l''historique (backfill banque du 2026-07-12)';
--   (factures.montant_paye n'a jamais été modifié → retour à l'état exact)
-- -- 2) Retirer les RPC :
-- DROP FUNCTION IF EXISTS public.rpc_enregistrer_paiement(UUID, NUMERIC, DATE, TEXT, UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.rpc_annuler_paiement(UUID);
-- -- 3) Retirer les colonnes ajoutées :
-- DROP TRIGGER IF EXISTS set_updated_at ON public.paiements;
-- DROP INDEX IF EXISTS public.paiements_facture_idx;
-- DROP INDEX IF EXISTS public.paiements_mouvement_idx;
-- ALTER TABLE public.paiements
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS deleted_at,
--   DROP COLUMN IF EXISTS mouvement_id;
-- ============================================================================
