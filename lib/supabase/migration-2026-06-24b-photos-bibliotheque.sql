-- ============================================================
-- MIGRATION PHOTOS -> BIBLIOTHEQUE GENERALISEE — 2026-06-24 (b)
--
-- Generalise "photos de chantier" en "bibliotheque photo" rattachee au CLIENT,
-- avec liens OPTIONNELS vers chantier / devis / facture.
--
-- DEJA APPLIQUEE EN PRODUCTION via MCP (versionnee ici pour tracabilite).
-- 100% ADDITIF cote donnees (aucune photo perdue ; backfill du client depuis le chantier).
-- ============================================================

-- 1. Renommage de la table
ALTER TABLE chantier_photos RENAME TO photos;

-- 2. Nouveaux liens
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS client_id  UUID REFERENCES clients(id)  ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS devis_id   UUID REFERENCES devis(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS facture_id UUID REFERENCES factures(id) ON DELETE SET NULL;

-- 3. chantier_id devient optionnel + ne supprime plus les photos si le chantier est supprime
ALTER TABLE photos ALTER COLUMN chantier_id DROP NOT NULL;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS chantier_photos_chantier_id_fkey;
ALTER TABLE photos ADD CONSTRAINT photos_chantier_id_fkey
  FOREIGN KEY (chantier_id) REFERENCES chantiers(id) ON DELETE SET NULL;

-- 4. Backfill : rattacher les photos existantes au client de leur chantier
UPDATE photos p SET client_id = c.client_id
  FROM chantiers c
  WHERE p.chantier_id = c.id AND p.client_id IS NULL;

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_photos_client  ON photos(client_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_facture ON photos(facture_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_devis   ON photos(devis_id)   WHERE deleted_at IS NULL;

-- 6. Vue de compatibilite TEMPORAIRE (le temps que le nouveau code se deploie).
--    A SUPPRIMER apres deploiement :  DROP VIEW IF EXISTS chantier_photos;
CREATE OR REPLACE VIEW chantier_photos AS SELECT * FROM photos;

-- La policy RLS "Owner peut voir ses photos" (SELECT auth.uid() = user_id) et les
-- index user/chantier suivent automatiquement le renommage de la table.
