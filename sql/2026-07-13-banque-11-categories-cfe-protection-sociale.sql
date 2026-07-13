-- ============================================================================
-- 2026-07-13-banque-11-categories-cfe-protection-sociale.sql
-- Chantier 4 (taxonomie) — 2 catégories dépense manquantes pour l'artisan micro,
-- recommandées par l'expert-comptable (revue du 13/07/2026) :
--   * protection_sociale : mutuelle / prévoyance / retraite Madelin perso
--     (souvent confondue à tort avec les cotisations URSSAF) ;
--   * cfe : la Cotisation Foncière des Entreprises, impôt récurrent que tout
--     artisan paie, jusqu'ici noyé dans « taxes ».
-- On clarifie aussi le libellé de 'taxes' (« Autres impôts & taxes »).
--
-- Rappel de cadrage (expert-comptable) : en micro, la catégorie d'une DÉPENSE
-- n'a AUCUN impact fiscal/social (charges non déductibles) — ces catégories ne
-- servent qu'au pilotage. La rigueur se met sur les RECETTES et leur ventilation
-- prestation (21,2 %) / marchandise (12,3 %), qui provient des FACTURES.
--
-- Additif, idempotent. Catégories globales (user_id NULL). Appliqué en prod.
-- ============================================================================

INSERT INTO depense_categories (user_id, code, label, groupe, est_privee, ordre, actif)
SELECT NULL, v.code, v.label, 'depense', false, v.ordre, true
FROM (VALUES
  ('protection_sociale','Mutuelle / prévoyance perso',105),
  ('cfe','CFE (cotisation entreprise)',115)
) AS v(code, label, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM depense_categories d WHERE d.code = v.code AND d.deleted_at IS NULL
);

UPDATE depense_categories SET label = 'Autres impôts & taxes'
WHERE code = 'taxes' AND deleted_at IS NULL AND label = 'Impôts & taxes (CFE…)';
