-- ============================================================
-- Migration 2026-06-29 — Contre-proposition client
-- Appliquée en prod via MCP Supabase (apply_migration: devis_contreproposition)
-- ============================================================
-- Le client peut renvoyer une demande de modification (non contractuelle).
-- L'artisan l'étudie ; le statut du devis passe automatiquement à 'contreproposition'.

ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_statut_check;
ALTER TABLE devis ADD CONSTRAINT devis_statut_check
  CHECK (statut = ANY (ARRAY['brouillon','envoye','finalise','signe','refuse','expire','facture','contreproposition']::text[]));

ALTER TABLE devis ADD COLUMN IF NOT EXISTS contreproposition_at        TIMESTAMPTZ;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS contreproposition_message   TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS contreproposition_retirees  JSONB;        -- ordres des lignes que le client propose de retirer
ALTER TABLE devis ADD COLUMN IF NOT EXISTS contreproposition_ttc       NUMERIC(12,2); -- total TTC proposé (recalculé serveur)

COMMENT ON COLUMN devis.contreproposition_at IS 'Réception d''une contre-proposition client (NULL = aucune)';
COMMENT ON COLUMN devis.contreproposition_retirees IS 'Tableau JSON des ordres de lignes que le client propose de retirer';
