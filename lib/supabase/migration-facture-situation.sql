-- =============================================================
-- Migration — Factures de situation (juin 2026 — V3.0c.17)
-- =============================================================
-- A executer dans Supabase SQL Editor.
-- Idempotente : peut etre rejouee sans erreur grace a `IF NOT EXISTS`.
--
-- Buts :
-- 1. Ajouter les colonnes manquantes pour les factures de situation (#1, #2, #3...).
-- 2. La colonne `type` (standard / acompte / situation / avoir) et
--    `pourcentage_situation` existent deja dans schema.sql, on ne les recree pas.
-- 3. Ces champs sont egalement attendus par `FactureData` (lib/pdf.ts) et par
--    `DocumentRender` (rendu HTML "Edition Signature").
-- =============================================================

-- ── 1. Numero de situation (#1, #2, #3...) ─────────────────────
ALTER TABLE factures ADD COLUMN IF NOT EXISTS numero_situation INTEGER;

-- ── 2. Reference + date du devis lie (facture de situation) ────
ALTER TABLE factures ADD COLUMN IF NOT EXISTS devis_ref TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS devis_date DATE;

-- ── 3. Montants cumules des situations precedentes ─────────────
ALTER TABLE factures ADD COLUMN IF NOT EXISTS montant_situation_precedent_ht NUMERIC(12,2);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS montant_situation_precedent_ttc NUMERIC(12,2);

-- ── 4. Reste a facturer (informatif, calcule cote backend plus tard) ──
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reste_a_facturer_ht NUMERIC(12,2);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reste_a_facturer_ttc NUMERIC(12,2);

-- ── 5. Commentaires de documentation ──────────────────────────
COMMENT ON COLUMN factures.numero_situation IS 'Numero de la tranche facturee (#1, #2, #3...) pour une facture de situation. NULL pour les autres types.';
COMMENT ON COLUMN factures.devis_ref IS 'Reference du devis lie a cette facture de situation (ex : D-2026-12345). Saisie libre pour la version MVP.';
COMMENT ON COLUMN factures.devis_date IS 'Date du devis lie. Optionnel.';
COMMENT ON COLUMN factures.montant_situation_precedent_ht IS 'Cumul HT des situations precedentes (pour le tableau d''avancement).';
COMMENT ON COLUMN factures.montant_situation_precedent_ttc IS 'Cumul TTC des situations precedentes.';
COMMENT ON COLUMN factures.reste_a_facturer_ht IS 'Reste a facturer HT (= total devis - situations precedentes - cette situation). V minimale : informatif.';
COMMENT ON COLUMN factures.reste_a_facturer_ttc IS 'Reste a facturer TTC. V minimale : informatif.';

-- =============================================================
-- Sanity check (a executer manuellement apres la migration) :
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'factures'
--      AND column_name IN ('type','numero_situation','pourcentage_situation','devis_ref','devis_date',
--                          'montant_situation_precedent_ht','montant_situation_precedent_ttc',
--                          'reste_a_facturer_ht','reste_a_facturer_ttc');
-- =============================================================
