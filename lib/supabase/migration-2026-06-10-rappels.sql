-- ============================================
-- Migration Rappels enrichis — table rappels
-- Date : 2026-06-10
-- Contexte : l'artisan a besoin d'une zone de "post-it" libre pour noter
-- des choses qui ne sont liées à aucun chantier/devis/facture précis
-- (ex: "Rappeler comptable demain", "Aller chercher placo vendredi",
-- "Renouveler décennale en juin"). Les 3 tables existantes
-- (chantier_notes / intervention_notes_client / relances) sont toutes
-- contextualisées à un chantier ou un document, elles ne couvrent pas
-- ce besoin de rappel libre.
--
-- Cette table peut aussi servir à enregistrer des suggestions générées
-- automatiquement (champ `source` ≠ 'manuel').
--
-- Comment exécuter :
-- 1. Ouvrir Supabase Dashboard → Project → SQL Editor
-- 2. Copier-coller ce fichier entier
-- 3. Run
-- ============================================

CREATE TABLE IF NOT EXISTS rappels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif','fait','reporte')),
  lien_chantier_id UUID REFERENCES chantiers(id) ON DELETE SET NULL,
  lien_devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
  lien_facture_id UUID REFERENCES factures(id) ON DELETE SET NULL,
  lien_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manuel',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Index performance : requête principale "rappels actifs de l'utilisateur, triés par date"
CREATE INDEX IF NOT EXISTS idx_rappels_user_actif
  ON rappels (user_id, statut, due_date NULLS LAST)
  WHERE deleted_at IS NULL;

-- RLS — chaque utilisateur ne voit/édite que ses propres rappels
ALTER TABLE rappels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rappels_select_own" ON rappels;
CREATE POLICY "rappels_select_own" ON rappels
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rappels_insert_own" ON rappels;
CREATE POLICY "rappels_insert_own" ON rappels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rappels_update_own" ON rappels;
CREATE POLICY "rappels_update_own" ON rappels
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rappels_delete_own" ON rappels;
CREATE POLICY "rappels_delete_own" ON rappels
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION trigger_set_timestamp_rappels()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_rappels ON rappels;
CREATE TRIGGER set_timestamp_rappels
  BEFORE UPDATE ON rappels
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp_rappels();

-- Vérification
SELECT
  COUNT(*) AS total_rappels,
  COUNT(*) FILTER (WHERE statut = 'actif' AND deleted_at IS NULL) AS actifs,
  COUNT(*) FILTER (WHERE statut = 'fait') AS faits,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS supprimes
FROM rappels;
