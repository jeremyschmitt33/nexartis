-- ============================================================================
-- Migration 28/05/2026 — Session 3 — Bug créneau personnalisé + clients enrichis
-- ============================================================================
-- 1. Bug : la CHECK constraint sur planning_interventions.creneau refuse la
--    valeur 'creneau' utilisée pour le mode "Créneau personnalisé". Symptôme :
--    "Erreur lors de la création" quand on tente de créer une intervention
--    avec des heures custom (ex: 17h-18h).
-- 2. Création client inline avec téléphone + email + adresse complète (pas de
--    nouvelle colonne nécessaire — `clients` a déjà tout, juste à les peupler).
-- ============================================================================

-- 1. Étendre la CHECK pour accepter 'creneau' (mode personnalisé)
ALTER TABLE planning_interventions
  DROP CONSTRAINT IF EXISTS planning_interventions_creneau_check;

ALTER TABLE planning_interventions
  ADD CONSTRAINT planning_interventions_creneau_check
  CHECK (creneau IN ('matin', 'apres_midi', 'journee', 'creneau'));

-- Vérification (à exécuter après) :
-- SELECT pg_get_constraintdef(c.oid)
-- FROM pg_constraint c
-- JOIN pg_class t ON t.oid = c.conrelid
-- WHERE t.relname = 'planning_interventions'
--   AND c.conname = 'planning_interventions_creneau_check';
