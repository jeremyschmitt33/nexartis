-- ============================================================================
-- Module Plan 2D — PUSH 5 (06/07/2026)
-- Colonne plans.export_images : images PNG du plan (data URL base64), une
-- entrée par niveau injecté dans un devis. Pattern identique au logo
-- entreprise (entreprises.logo_url = data URL base64 en TEXT) : la même
-- chaîne est lue par les 4 rendus du devis (HTML dashboard, PDF download,
-- PDF email, page publique /signer/[token]) => parité par construction.
--
-- Forme du JSONB : [{ "niveauId": "...", "nom": "RDC", "dataUrl": "data:image/png;base64,...", "genereLe": "ISO" }]
-- Généré côté navigateur à CHAQUE injection réussie (best-effort), remplacé
-- niveau par niveau. La colonne export_image_path (TEXT, prévue R2) reste
-- inutilisée — décision Push 5 : base64 en DB comme le logo.
--
-- À exécuter dans Supabase (SQL Editor) AVANT le push du code Push 5.
-- Idempotent : IF NOT EXISTS.
-- ============================================================================

ALTER TABLE plans ADD COLUMN IF NOT EXISTS export_images JSONB;

COMMENT ON COLUMN plans.export_images IS
  'Push 5 — images PNG du plan par niveau (data URL base64), affichées dans les 4 rendus du devis. Regénérées à chaque injection.';
