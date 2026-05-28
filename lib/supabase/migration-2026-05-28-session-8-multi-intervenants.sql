-- ============================================================================
-- Migration 28/05/2026 — Session 8 : Multi-intervenants par intervention
-- ============================================================================
-- Aujourd'hui : 1 intervention = 1 intervenant (colonne `intervenant_id` sur
-- `planning_interventions`).
-- Demain      : 1 intervention = N intervenants, avec un rôle "Référent" ou
-- "Équipier". Le Référent pilote l'intervention. Les Équipiers sont ajoutés
-- ensuite. L'intervention apparaît dans la ligne de CHAQUE intervenant lié.
--
-- La colonne legacy `planning_interventions.intervenant_id` reste remplie
-- avec l'ID du Référent (rétrocompat : autres écrans, exports, anciens
-- rapports). Toute la nouvelle logique passe par la table jonction
-- `intervention_intervenants`.
--
-- Idempotent : peut être ré-exécutée plusieurs fois sans erreur ni doublon.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table jonction `intervention_intervenants`
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intervention_intervenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intervention_id UUID NOT NULL REFERENCES planning_interventions(id) ON DELETE CASCADE,
  intervenant_id UUID NOT NULL REFERENCES intervenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('referent', 'equipier')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT intervention_intervenants_unique UNIQUE (intervention_id, intervenant_id)
);

-- Index pour les lookups les plus fréquents
CREATE INDEX IF NOT EXISTS idx_intervention_intervenants_intervention
  ON intervention_intervenants(intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_intervenants_intervenant
  ON intervention_intervenants(intervenant_id);
CREATE INDEX IF NOT EXISTS idx_intervention_intervenants_user
  ON intervention_intervenants(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE intervention_intervenants ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS pour idempotence (CREATE POLICY ne supporte pas IF NOT EXISTS)
DROP POLICY IF EXISTS "intervention_intervenants_select" ON intervention_intervenants;
DROP POLICY IF EXISTS "intervention_intervenants_insert" ON intervention_intervenants;
DROP POLICY IF EXISTS "intervention_intervenants_update" ON intervention_intervenants;
DROP POLICY IF EXISTS "intervention_intervenants_delete" ON intervention_intervenants;

CREATE POLICY "intervention_intervenants_select" ON intervention_intervenants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "intervention_intervenants_insert" ON intervention_intervenants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intervention_intervenants_update" ON intervention_intervenants
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "intervention_intervenants_delete" ON intervention_intervenants
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Migration data : pour chaque intervention existante avec un
-- `intervenant_id`, on crée une liaison "referent" dans la table jonction.
-- ON CONFLICT DO NOTHING : si la migration est ré-exécutée, les lignes
-- existantes sont conservées (la contrainte UNIQUE protège contre les
-- doublons).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO intervention_intervenants (user_id, intervention_id, intervenant_id, role)
SELECT
  pi.user_id,
  pi.id AS intervention_id,
  pi.intervenant_id,
  'referent' AS role
FROM planning_interventions pi
WHERE pi.intervenant_id IS NOT NULL
ON CONFLICT (intervention_id, intervenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérifications (à exécuter manuellement après pour s'assurer du résultat) :
--
--   -- Le nombre de Référents doit égaler le nombre d'interventions avec
--   -- un intervenant_id non NULL.
--   SELECT
--     (SELECT COUNT(*) FROM planning_interventions WHERE intervenant_id IS NOT NULL) AS interventions_legacy,
--     (SELECT COUNT(*) FROM intervention_intervenants WHERE role = 'referent') AS referents;
--
--   -- Inspecter quelques liaisons :
--   SELECT ii.intervention_id, ii.role, i.prenom, i.nom
--   FROM intervention_intervenants ii
--   JOIN intervenants i ON i.id = ii.intervenant_id
--   ORDER BY ii.created_at DESC
--   LIMIT 20;
-- ─────────────────────────────────────────────────────────────────────────────
