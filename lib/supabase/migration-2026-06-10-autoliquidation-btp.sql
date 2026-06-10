-- ============================================================================
-- migration-2026-06-10-autoliquidation-btp.sql
-- ----------------------------------------------------------------------------
-- Ajoute le flag `autoliquidation_btp` aux tables `factures` et `devis`.
-- Quand TRUE : tous les taux TVA sont forces a 0% au rendu PDF/HTML et la
-- mention "Autoliquidation TVA par le preneur (art. 283-2 nonies CGI)" est
-- ajoutee automatiquement en pied de document (sous-traitance BTP).
--
-- Backward-compat : la colonne est DEFAULT FALSE, donc les documents existants
-- continuent a se rendre exactement comme avant. Le code applicatif gere aussi
-- le cas ou la migration n'est pas encore executee (catch 42703).
-- ============================================================================

ALTER TABLE factures ADD COLUMN IF NOT EXISTS autoliquidation_btp BOOLEAN DEFAULT FALSE;
ALTER TABLE devis    ADD COLUMN IF NOT EXISTS autoliquidation_btp BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN factures.autoliquidation_btp IS 'Si TRUE, facture en autoliquidation BTP (art. 283-2 nonies CGI). TVA a 0% sur toutes lignes, mention ajoutee.';
COMMENT ON COLUMN devis.autoliquidation_btp    IS 'Idem pour devis (anticipation BTP).';
