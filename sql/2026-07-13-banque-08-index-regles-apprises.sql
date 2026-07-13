-- ============================================================================
-- 2026-07-13-banque-08-index-regles-apprises.sql
-- Lot 2c — Filet anti-doublon sur les règles apprises (apprentissage).
-- ----------------------------------------------------------------------------
-- Contexte : PanneauPointage.tsx crée une règle apprise via un SELECT-then-INSERT
-- sur (user_id, pattern, source='apprise', deleted_at IS NULL) — SANS ON CONFLICT.
-- Sous concurrence (double-clic / 2 onglets) deux INSERT pourraient créer deux
-- règles identiques. Cet index unique partiel garantit l'unicité et fait échouer
-- le 2e INSERT (échec avalé côté app, le pointage étant déjà enregistré).
--
-- Sûr à appliquer : au moment de la création, 0 règle 'apprise' existe en base
-- (feature tout juste déployée) → aucun doublon préexistant possible.
-- Vérifié par l'agent vérificateur le 13/07/2026. Appliqué en prod (apply_migration).
--
-- Rejouable : IF NOT EXISTS. Ré-apprentissage après soft-delete OK (l'ancienne
-- règle sort du prédicat partiel dès que deleted_at est renseigné).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorisation_regles_apprise_pattern
ON categorisation_regles (user_id, pattern)
WHERE source = 'apprise' AND deleted_at IS NULL;
