-- ============================================================================
-- Migration V2.3b — Assignations indépendantes en vue matrice (30/05/2026)
-- Stocke date/heure par ASSIGNATION dans intervention_intervenants.
-- Rétrocompat : nullable + fallback parent en lecture front. Backfill inclus.
-- ============================================================================

-- 1. Ajout des colonnes (NULLABLE pour rétrocompat)
ALTER TABLE intervention_intervenants
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME,
  ADD COLUMN IF NOT EXISTS slot       TEXT
    CHECK (slot IS NULL OR slot IN ('matin','apres_midi','journee','creneau'));

-- 2. Index pour requêtes vue matrice et conflits horaires
CREATE INDEX IF NOT EXISTS idx_ii_user_start_date
  ON intervention_intervenants(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_ii_intervenant_start_date
  ON intervention_intervenants(intervenant_id, start_date);

-- 3. Backfill depuis l'intervention parent
UPDATE intervention_intervenants ii
SET start_date = pi.date_debut::date,
    end_date   = COALESCE(pi.date_fin, pi.date_debut)::date,
    start_time = pi.heure_debut,
    end_time   = pi.heure_fin,
    slot       = pi.creneau
FROM planning_interventions pi
WHERE ii.intervention_id = pi.id
  AND ii.start_date IS NULL;

-- Vérifications post-migration (à passer en SELECT manuel) :
--   SELECT COUNT(*) FROM intervention_intervenants WHERE start_date IS NULL;
--     -> doit être 0 si toutes les parents avaient une date_debut
--   SELECT ii.intervention_id, ii.intervenant_id, ii.start_date, pi.date_debut
--   FROM intervention_intervenants ii
--   JOIN planning_interventions pi ON pi.id = ii.intervention_id
--   LIMIT 10;
