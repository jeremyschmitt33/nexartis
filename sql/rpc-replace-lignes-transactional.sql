-- ═══════════════════════════════════════════════════════════════════════════
-- P5 (audit) — Fonctions RPC transactionnelles pour le remplacement de lignes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CONTEXTE : avant cette migration, l'édition d'un devis ou d'une facture
-- faisait un DELETE de toutes les lignes existantes PUIS une boucle d'INSERT
-- ligne par ligne. Si la connexion réseau était coupée entre les deux
-- (ou pendant la boucle), TOUTES les lignes étaient perdues définitivement.
--
-- Cette migration crée 2 fonctions Postgres qui font DELETE+INSERT dans une
-- transaction atomique. Si quoi que ce soit échoue, Postgres rollback
-- automatiquement, et l'état d'origine est préservé.
--
-- ⚠️  À EXÉCUTER dans Supabase → SQL Editor → New Query → coller → Run.
-- Idempotent : peut être lancé plusieurs fois.
--
-- HISTORIQUE :
-- - 05/07/2026 (Push 4 Plan 2D) : replace_devis_lignes préserve désormais
--   optionnel, inclus_par_defaut et source_plan (lien plan↔ligne). Ce fichier
--   reflète la définition EN PROD — ne jamais ré-exécuter une version plus
--   ancienne, elle effacerait ces colonnes à chaque sauvegarde de devis.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Fonction 1 : replace_devis_lignes ────────────────────────────────────
CREATE OR REPLACE FUNCTION replace_devis_lignes(
  p_devis_id UUID,
  p_lignes JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_owner_id UUID;
  v_ligne JSONB;
BEGIN
  -- 1) Récupérer l'utilisateur connecté (auth.uid() vient du JWT Supabase)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- 2) Vérifier que le devis appartient bien à l'utilisateur (sécurité multi-tenant)
  SELECT user_id INTO v_owner_id
  FROM devis
  WHERE id = p_devis_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Devis introuvable';
  END IF;

  IF v_owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Accès interdit à ce devis';
  END IF;

  -- 3) Validation : on attend un array JSON
  IF jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'p_lignes doit être un tableau JSON';
  END IF;

  -- 4) Tout ce qui suit est dans la transaction implicite de la fonction.
  --    Si une étape échoue, l'ensemble est annulé (rollback automatique).

  -- Supprimer les anciennes lignes
  DELETE FROM devis_lignes WHERE devis_id = p_devis_id;

  -- Insérer les nouvelles lignes une par une depuis le JSONB
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO devis_lignes (
      devis_id,
      designation,
      quantite,
      unite,
      prix_unitaire_ht,
      taux_tva,
      ordre,
      type,
      niveau,
      numero,
      parent_id,
      optionnel,
      inclus_par_defaut,
      source_plan
    )
    VALUES (
      p_devis_id,
      COALESCE(v_ligne->>'designation', ''),
      COALESCE((v_ligne->>'quantite')::numeric, 0),
      v_ligne->>'unite',
      COALESCE((v_ligne->>'prix_unitaire_ht')::numeric, 0),
      COALESCE((v_ligne->>'taux_tva')::numeric, 10),
      COALESCE((v_ligne->>'ordre')::integer, 0),
      v_ligne->>'type',
      COALESCE((v_ligne->>'niveau')::integer, 3),
      v_ligne->>'numero',
      CASE
        WHEN v_ligne->>'parent_id' IS NULL THEN NULL
        ELSE (v_ligne->>'parent_id')::uuid
      END,
      COALESCE((v_ligne->>'optionnel')::boolean, false),
      COALESCE((v_ligne->>'inclus_par_defaut')::boolean, true),
      CASE
        WHEN jsonb_typeof(v_ligne->'source_plan') = 'object' THEN v_ligne->'source_plan'
        ELSE NULL
      END
    );
  END LOOP;
END;
$$;

-- Donner le droit d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION replace_devis_lignes(UUID, JSONB) TO authenticated;


-- ─── Fonction 2 : replace_facture_lignes ──────────────────────────────────
CREATE OR REPLACE FUNCTION replace_facture_lignes(
  p_facture_id UUID,
  p_lignes JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_owner_id UUID;
  v_ligne JSONB;
BEGIN
  -- 1) Récupérer l'utilisateur connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- 2) Vérifier que la facture appartient bien à l'utilisateur
  SELECT user_id INTO v_owner_id
  FROM factures
  WHERE id = p_facture_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Facture introuvable';
  END IF;

  IF v_owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Accès interdit à cette facture';
  END IF;

  -- 3) Validation
  IF jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'p_lignes doit être un tableau JSON';
  END IF;

  -- 4) Transaction atomique : DELETE + INSERT
  DELETE FROM facture_lignes WHERE facture_id = p_facture_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO facture_lignes (
      facture_id,
      designation,
      quantite,
      unite,
      prix_unitaire_ht,
      taux_tva,
      ordre,
      type,
      niveau,
      numero,
      parent_id
    )
    VALUES (
      p_facture_id,
      COALESCE(v_ligne->>'designation', ''),
      COALESCE((v_ligne->>'quantite')::numeric, 0),
      v_ligne->>'unite',
      COALESCE((v_ligne->>'prix_unitaire_ht')::numeric, 0),
      COALESCE((v_ligne->>'taux_tva')::numeric, 20),
      COALESCE((v_ligne->>'ordre')::integer, 0),
      v_ligne->>'type',
      COALESCE((v_ligne->>'niveau')::integer, 3),
      v_ligne->>'numero',
      CASE
        WHEN v_ligne->>'parent_id' IS NULL THEN NULL
        ELSE (v_ligne->>'parent_id')::uuid
      END
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_facture_lignes(UUID, JSONB) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE proname IN ('replace_devis_lignes', 'replace_facture_lignes');
-- ═══════════════════════════════════════════════════════════════════════════
