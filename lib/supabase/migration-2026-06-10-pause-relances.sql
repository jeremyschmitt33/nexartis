-- =====================================================================
-- Migration : pause globale temporaire des relances auto (V2.1 10/06/2026)
-- =====================================================================
-- Ajoute la colonne `relances_pause_jusqu_au` (DATE, nullable) sur la table
-- `entreprises`. Quand non-null ET >= today, le cron `relances-auto-factures`
-- saute tous les envois pour cette entreprise.
--
-- Cas d'usage : vacances, litige en cours, audit comptable, periode
-- ou un email automatique serait contre-productif.
--
-- Securite : RLS deja active sur `entreprises`, pas de policy a modifier.
-- =====================================================================

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS relances_pause_jusqu_au DATE;

COMMENT ON COLUMN entreprises.relances_pause_jusqu_au IS
  'Si non-null ET >= today, le cron relances-auto-factures saute toutes les factures de cette entreprise. Pause globale temporaire.';
