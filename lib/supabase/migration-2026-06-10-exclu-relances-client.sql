-- =====================================================================
-- Migration : exclusion d'un client des relances automatiques (V2 10/06/2026)
-- =====================================================================
-- Ajoute la colonne `exclu_relances_auto` (BOOLEAN, default FALSE) sur la
-- table `clients`. Quand TRUE, le cron `relances-auto-factures` saute
-- toutes les factures de ce client : aucun email automatique
-- J+7 / J+15 / J+30 ne sera envoye, meme si la facture est en retard.
--
-- Cas d'usage : gros comptes, amis, contentieux en cours, relation
-- specifique. L'artisan garde la main pour relancer manuellement.
--
-- Securite : RLS deja active sur `clients`, pas de policy a modifier.
-- =====================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS exclu_relances_auto BOOLEAN DEFAULT FALSE;

-- Backfill defensif : aucune ligne existante n'est exclue par defaut.
UPDATE clients SET exclu_relances_auto = FALSE WHERE exclu_relances_auto IS NULL;

COMMENT ON COLUMN clients.exclu_relances_auto IS
  'Si TRUE, ce client est exclu du cron relances-auto-factures. Coche depuis la fiche client (Modifier).';
