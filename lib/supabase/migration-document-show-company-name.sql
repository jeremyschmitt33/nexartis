-- ============================================================================
-- migration-document-show-company-name.sql
-- ----------------------------------------------------------------------------
-- V3.1.7 — Ajoute le toggle "Afficher le nom de la société à côté du logo"
-- sur les devis et factures (rendus HTML + PDF).
--
-- Cas d'usage : si le logo de l'artisan contient déjà le wordmark de son
-- entreprise (ex : un logo Nexartis qui contient "NEXARTIS" en texte), il n'a
-- pas besoin que le nom soit affiché en gros à côté — ça créerait un doublon
-- visuel.
--
-- Comportement :
--   - DEFAULT TRUE  : backward-compat. Les artisans existants gardent le
--                     rendu actuel (logo + nom en gros à côté).
--   - Si l'artisan désactive le toggle dans Paramètres > Apparence :
--       * Le wordmark "Nom Société" disparaît du bandeau.
--       * Le logo est dessiné plus grand (récupère l'espace libéré).
--
-- Lu par :
--   - lib/logo-config.ts (helper logoConfigFromEntreprise)
--   - lib/pdf/header.ts (rendu PDF)
--   - components/document/DocumentRender.tsx (rendu HTML/écran)
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================================

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS document_show_company_name BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN entreprises.document_show_company_name IS
  'Toggle V3.1.7 : si FALSE, le nom de la société n''est pas affiché à côté du logo dans le bandeau des devis/factures (utile si le logo contient déjà le wordmark). Le logo est alors dessiné plus grand. NULL ou TRUE = comportement par défaut (nom affiché).';
