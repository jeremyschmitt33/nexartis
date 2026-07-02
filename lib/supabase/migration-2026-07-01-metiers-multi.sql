-- ============================================================================
-- MIGRATION — Metiers multi-choix (liste predefinie + champ libre)
-- Date : 2026-07-01
--
-- POURQUOI ?
--   Avant : le metier etait UN champ texte libre (entreprises.metier). Une faute
--   de frappe ("serurier") cassait le gating (ex : carte "Contrat d'ouverture de
--   porte" reservee aux serruriers qui n'apparaissait plus).
--
--   Apres : on ajoute une colonne `metiers` (liste de slugs predefinis) remplie
--   via des cases a cocher. Le champ `metier` (texte libre) est CONSERVE pour un
--   metier hors liste ou une precision. Le code lit les deux via hasMetier()
--   (lib/metiers.ts) — retro-compatible avec les comptes existants.
--
-- COMMENT L'EXECUTER ?
--   1. Supabase > votre projet > SQL Editor > New query.
--   2. Coller ce fichier. Run. Verifier "Success".
--
-- SANS DANGER : ADD COLUMN IF NOT EXISTS, ne touche a aucune donnee existante.
-- ============================================================================

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS metiers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- (Optionnel) Pre-remplir metiers pour les comptes dont le champ libre matche
-- deja un metier connu, pour ne pas leur faire re-cocher. Non destructif :
-- ne modifie que les lignes ou metiers est encore vide.
UPDATE entreprises SET metiers = '["serrurier"]'::jsonb
  WHERE metiers = '[]'::jsonb AND lower(coalesce(metier,'')) LIKE '%serrur%';
UPDATE entreprises SET metiers = '["electricien"]'::jsonb
  WHERE metiers = '[]'::jsonb AND lower(coalesce(metier,'')) LIKE '%electric%';
UPDATE entreprises SET metiers = '["plombier"]'::jsonb
  WHERE metiers = '[]'::jsonb AND lower(coalesce(metier,'')) LIKE '%plomb%';
