-- ============================================
-- Migration Relances automatiques factures V1
-- Date : 2026-06-10
-- Contexte : cron quotidien qui envoie un email J+7, J+15, J+30
-- apres date d'echeance pour les factures impayees.
-- 4 colonnes ajoutees :
--   * entreprises.relances_auto_actives : toggle artisan (defaut TRUE)
--   * factures.relance_envoyee_j7  : timestamp envoi J+7 (NULL = jamais envoye)
--   * factures.relance_envoyee_j15 : timestamp envoi J+15
--   * factures.relance_envoyee_j30 : timestamp envoi J+30
--
-- Comment executer :
-- 1. Ouvrir Supabase Dashboard > Project > SQL Editor
-- 2. Copier-coller ce fichier entier
-- 3. Run
-- ============================================

ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS relances_auto_actives BOOLEAN DEFAULT TRUE;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS relance_envoyee_j7 TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS relance_envoyee_j15 TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS relance_envoyee_j30 TIMESTAMPTZ;

COMMENT ON COLUMN entreprises.relances_auto_actives IS 'Active ou non l envoi automatique des relances factures J+7/15/30 (defaut TRUE).';
COMMENT ON COLUMN factures.relance_envoyee_j7  IS 'Timestamp d envoi de la relance J+7 (NULL = pas encore envoyee).';
COMMENT ON COLUMN factures.relance_envoyee_j15 IS 'Timestamp d envoi de la relance J+15 (NULL = pas encore envoyee).';
COMMENT ON COLUMN factures.relance_envoyee_j30 IS 'Timestamp d envoi de la relance J+30 (NULL = pas encore envoyee).';

-- Index leger pour optimiser la requete du cron (factures en retard non payees)
CREATE INDEX IF NOT EXISTS idx_factures_relances_cron
  ON factures (user_id, date_echeance)
  WHERE deleted_at IS NULL AND statut IN ('envoyee','en_retard');
