-- ============================================================================
-- 2026-07-13-factures-statut-archivee-fix.sql
-- Correctif d'un bug préexistant (relevé dans la passation du 12/07).
-- ----------------------------------------------------------------------------
-- Symptôme : archiver une facture échouait en production.
-- Cause : handleArchive (app/dashboard/factures/[id]/page.tsx) écrit
--   statut='archivee', et toute l'UI est conçue autour de cette valeur
--   (bouton « Désarchiver », filtre « Archivées » de la liste, compteurs),
--   MAIS le CHECK factures_statut_check ne l'autorisait pas → violation de
--   contrainte à chaque archivage.
-- Correctif : élargir la contrainte pour autoriser 'archivee' (additif — tous
--   les statuts existants restent valides ; aucune ligne existante n'est
--   impactée : 0 facture en 'archivee' avant, 0 violation). Aucun changement
--   de code : le code attendait déjà cette valeur.
-- Vérifié avant/après. Appliqué en prod le 13/07/2026.
-- ============================================================================

ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_statut_check;
ALTER TABLE public.factures ADD CONSTRAINT factures_statut_check
  CHECK (statut = ANY (ARRAY[
    'brouillon'::text, 'envoyee'::text, 'partiellement_payee'::text,
    'payee'::text, 'en_retard'::text, 'annulee'::text, 'archivee'::text
  ]));
