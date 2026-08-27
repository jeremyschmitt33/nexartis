-- ============================================================================
-- FIX (2026-06-16) : nouveaux comptes -> creation auto du membre "dirigeant"
--
-- PROBLEME
--   Depuis la refonte multi-utilisateur (12/06), MODIFIER sa fiche entreprise
--   exige le role 'dirigeant' dans entreprise_membres (policy entreprises_update,
--   et les tables metier via current_entreprise_ids / current_role_in).
--   La Phase 1 a backfille les entreprises EXISTANTES, mais AUCUN mecanisme ne
--   cree la ligne 'dirigeant' pour les comptes crees ENSUITE. Resultat : un
--   compte tout neuf peut LIRE sa fiche (ancienne policy proprietaire) mais ne
--   peut PAS l'enregistrer -> erreur "Cannot coerce the result to a single JSON
--   object", logo qui ne s'enregistre pas, etc. (effet large sur les nouveaux comptes).
--
-- CORRECTIF
--   1) Trigger AFTER INSERT sur entreprises : cree la ligne dirigeant/actif.
--   2) Backfill des comptes deja crees apres la Phase 1 (idempotent).
--
-- A EXECUTER : Supabase > SQL Editor > New query > coller TOUT > Run > "Success".
-- REVERSIBLE : DROP TRIGGER trg_create_dirigeant_membre ON entreprises;
--              DROP FUNCTION create_dirigeant_membre();
-- ============================================================================

-- 1) Fonction (SECURITY DEFINER + search_path verrouille, comme les autres helpers)
CREATE OR REPLACE FUNCTION public.create_dirigeant_membre()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO entreprise_membres (entreprise_id, user_id, role, statut)
    VALUES (NEW.id, NEW.user_id, 'dirigeant', 'actif')
    ON CONFLICT (entreprise_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Trigger sur entreprises (couvre tous les chemins de creation : handle_new_user, routes...)
DROP TRIGGER IF EXISTS trg_create_dirigeant_membre ON entreprises;
CREATE TRIGGER trg_create_dirigeant_membre
AFTER INSERT ON entreprises
FOR EACH ROW EXECUTE FUNCTION create_dirigeant_membre();

-- 3) Rattrapage des comptes deja crees (comme test3) : idempotent.
INSERT INTO entreprise_membres (entreprise_id, user_id, role, statut)
SELECT e.id, e.user_id, 'dirigeant', 'actif'
FROM entreprises e
WHERE e.user_id IS NOT NULL
ON CONFLICT (entreprise_id, user_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION (doit renvoyer 0 ligne = aucune entreprise sans dirigeant) :
--   SELECT e.id FROM entreprises e
--   LEFT JOIN entreprise_membres m
--     ON m.entreprise_id = e.id AND m.role='dirigeant' AND m.statut='actif'
--   WHERE e.user_id IS NOT NULL AND m.id IS NULL;
-- ============================================================================
