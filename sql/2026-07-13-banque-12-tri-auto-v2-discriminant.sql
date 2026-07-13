-- ============================================================
-- Migration banque-12 : Phase 2 tri auto — discriminant suggéré/confirmé
-- Appliquée en prod (skuqfqnfitrovzeexwsr) le 13/07/2026.
-- Auditée : conception confrontée (agent confrontateur) + revue UX + contrôles avant/après.
--
-- Objet :
--   1. auto_point sur categorisation_regles : 1a (mono-catégorie certain) = true /
--      1b (ambigu) = false. Backfill DEFAULT true -> les 64 règles restent 1a.
--   2. categorie_id nullable : une règle 1b « binaire » (supermarché) reconnaît le
--      marchand SANS proposer de catégorie (question pro/perso posée à l'utilisateur).
--   3. categorisation_auto sur banque_mouvements : provenance = machine (règle) et non
--      utilisateur. Sert au tag « Classé auto » + au filtre de la validation en masse.
--      NB : les onglets se dérivent de (statut_pointage, categorisation_auto) :
--        - a_pointer + categorisation_auto=true  -> « À confirmer » (avec cat = Suggéré,
--          sans cat = binaire pro/perso)
--        - a_pointer + categorisation_auto=false -> « À trier »
--        - pointe    + categorisation_auto=true  -> « Classé auto »
--        - pointe    + categorisation_auto=false -> classé manuellement
--   4. Flip des assureurs (ALLIANZ/AXA/MAAF) 1a -> 1b : perso/pro indiscernable.
--   5. Dictionnaire 1b : Amazon/CDiscount/Fnac (suggéré autre_depense), ASSURANCE/
--      MUTUELLE (heuristique), 11 supermarchés (binaire, sans catégorie).
--   6. Backfill : les débits déjà catégorisés mais non pointés (6) = suggestions
--      machine existantes -> categorisation_auto=true (basculent en « À confirmer »).
--
-- Sécurité : ne touche JAMAIS statut_pointage -> RPC rpc_enregistrer_paiement /
--            rpc_annuler_paiement intacts. Idempotente (IF NOT EXISTS / WHERE NOT EXISTS).
--
-- Contrôles AVANT : 64 règles, 3 assureurs 1a, colonnes absentes, categorie_id NOT NULL,
--                   6 débits a_pointer+cat, 0 ligne pointe+cat (=> backfill sûr).
-- Contrôles APRÈS : 81 règles (61 1a / 20 1b), 3 assureurs flippés, 11 supermarchés
--                   sans cat, 6 « à confirmer » / 61 « à trier », 0 ligne pointe+cat.
-- ============================================================
SET lock_timeout = '3s';

ALTER TABLE categorisation_regles
  ADD COLUMN IF NOT EXISTS auto_point boolean NOT NULL DEFAULT true;

ALTER TABLE banque_mouvements
  ADD COLUMN IF NOT EXISTS categorisation_auto boolean NOT NULL DEFAULT false;

ALTER TABLE categorisation_regles
  ALTER COLUMN categorie_id DROP NOT NULL;

UPDATE categorisation_regles
  SET auto_point = false, updated_at = now()
  WHERE source = 'system' AND deleted_at IS NULL
    AND pattern IN ('ALLIANZ', 'AXA', 'MAAF') AND auto_point = true;

INSERT INTO categorisation_regles (pattern, type_match, categorie_id, sens, priorite, source, actif, auto_point)
SELECT v.pattern, 'contient', (SELECT id FROM depense_categories WHERE code = v.code AND deleted_at IS NULL), 'debit', v.prio, 'system', true, false
FROM (VALUES
  ('AMAZON',     'autre_depense', 945),
  ('AMZN',       'autre_depense', 945),
  ('CDISCOUNT',  'autre_depense', 945),
  ('FNAC',       'autre_depense', 945),
  ('ASSURANCE',  'assurances_pro', 960),
  ('MUTUELLE',   'protection_sociale', 960)
) AS v(pattern, code, prio)
WHERE NOT EXISTS (
  SELECT 1 FROM categorisation_regles r
  WHERE r.pattern = v.pattern AND r.source = 'system' AND r.deleted_at IS NULL
);

INSERT INTO categorisation_regles (pattern, type_match, categorie_id, sens, priorite, source, actif, auto_point)
SELECT v.pattern, 'contient', NULL, 'debit', 950, 'system', true, false
FROM (VALUES
  ('LECLERC'), ('CARREFOUR'), ('INTERMARCHE'), ('AUCHAN'), ('LIDL'),
  ('ALDI'), ('SUPER U'), ('CASINO'), ('MONOPRIX'), ('FRANPRIX'), ('COLRUYT')
) AS v(pattern)
WHERE NOT EXISTS (
  SELECT 1 FROM categorisation_regles r
  WHERE r.pattern = v.pattern AND r.source = 'system' AND r.deleted_at IS NULL
);

UPDATE banque_mouvements
  SET categorisation_auto = true
  WHERE deleted_at IS NULL
    AND statut_pointage = 'a_pointer'
    AND categorie_id IS NOT NULL
    AND source LIKE 'import%'
    AND categorisation_auto = false;
