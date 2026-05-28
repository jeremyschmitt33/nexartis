-- Migration 28/05/2026 — Session 9 : intervenant "self" (dirigeant) auto-créé
--
-- Objectif : permettre aux comptes en mode Société sans équipe (0 intervenants
-- en BDD) de planifier dès le 1er jour. On auto-crée une fiche intervenant
-- "self" qui représente le dirigeant lui-même.
--
-- Mécanique :
--   - colonne booléenne `is_self` sur intervenants (false par défaut pour
--     préserver les fiches existantes — aucune n'est "self" rétroactivement).
--   - index unique partiel : un seul intervenant `is_self = true` par
--     utilisateur (empêche les doubles inserts en cas de race condition
--     entre 2 onglets ouverts simultanément).
--
-- L'intervenant "self" est :
--   - masqué dans la page Mon équipe (pas d'édition, pas de suppression).
--   - affiché comme "Vous" dans le planning (modal + chips + panneau détail).

ALTER TABLE intervenants
  ADD COLUMN IF NOT EXISTS is_self BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_intervenants_one_self_per_user
  ON intervenants(user_id) WHERE is_self = true;
