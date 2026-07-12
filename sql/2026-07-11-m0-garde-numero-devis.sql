-- ============================================================================
-- M0 (2026-07-11) — Garde de numérotation sur generate_devis_numero()
-- ============================================================================
-- POURQUOI : le trigger auto_numero_devis écrase NEW.numero à CHAQUE insertion,
-- sans condition. Un import de devis historiques (ex. Clementine, numéros légaux
-- figés type « 202606/9 ») verrait ses numéros détruits → rupture de chronologie,
-- risque en contrôle fiscal.
-- QUOI : même garde que celui déjà en prod sur set_facture_numero() —
-- si un numéro est fourni, on le respecte ; s'il est vide, comportement
-- STRICTEMENT identique à l'existant (numéro auto).
-- BLINDAGE AJOUTÉ : le calcul du compteur ne considère que les numéros dont le
-- suffixe est numérique. Sans ça, un numéro importé non conforme (ex. « 202606/9 »
-- avec un préfixe vide) ferait planter le CAST → création de devis cassée pour
-- l'utilisateur. Comportement inchangé pour tous les numéros générés par Nexartis.
-- ROLLBACK : réappliquer l'ancienne version (conservée en commentaire en bas).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_devis_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
  DECLARE
    prefix TEXT;
    year TEXT;
    seq INTEGER;
  BEGIN
    -- M0 : si un numéro est fourni (import historique figé), on le respecte
    -- et on ne touche à rien. Même garde que set_facture_numero().
    IF NEW.numero IS NOT NULL AND trim(NEW.numero) <> '' THEN
      RETURN NEW;
    END IF;

    -- Branche « vide » : logique STRICTEMENT identique à l'existant,
    -- + filtre numérique sur le suffixe (blindage anti-CAST invalide).
    SELECT COALESCE(e.prefix_devis, 'D') INTO prefix
    FROM entreprises e WHERE e.user_id = NEW.user_id;

    year := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(
      CAST(SUBSTRING(d.numero FROM LENGTH(prefix) + 5) AS INTEGER)
    ), 0) + 1 INTO seq
    FROM devis d
    WHERE d.user_id = NEW.user_id
      AND d.numero LIKE prefix || year || '%'
      AND SUBSTRING(d.numero FROM LENGTH(prefix) + 5) ~ '^[0-9]+$';

    NEW.numero := prefix || year || LPAD(seq::TEXT, 5, '0');
    RETURN NEW;
  END;
  $function$;

-- ============================================================================
-- ROLLBACK (ancienne version, relevée en prod le 11/07/2026) :
--
-- CREATE OR REPLACE FUNCTION public.generate_devis_numero()
-- RETURNS trigger LANGUAGE plpgsql AS $f$
--   DECLARE
--     prefix TEXT; year TEXT; seq INTEGER;
--   BEGIN
--     SELECT COALESCE(e.prefix_devis, 'D') INTO prefix
--     FROM entreprises e WHERE e.user_id = NEW.user_id;
--     year := TO_CHAR(CURRENT_DATE, 'YYYY');
--     SELECT COALESCE(MAX(
--       CAST(SUBSTRING(d.numero FROM LENGTH(prefix) + 5) AS INTEGER)
--     ), 0) + 1 INTO seq
--     FROM devis d
--     WHERE d.user_id = NEW.user_id
--       AND d.numero LIKE prefix || year || '%';
--     NEW.numero := prefix || year || LPAD(seq::TEXT, 5, '0');
--     RETURN NEW;
--   END;
--   $f$;
-- ============================================================================
