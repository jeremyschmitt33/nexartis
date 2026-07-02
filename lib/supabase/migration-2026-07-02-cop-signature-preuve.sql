-- ============================================================================
-- MIGRATION — Contrat d'ouverture de porte : journal de preuve de signature
-- Date : 2026-07-02 (phase 1b-A)
--
-- POURQUOI ?
--   Une signature manuscrite au doigt (canvas) n'a pas la presomption de
--   fiabilite d'une signature electronique qualifiee. Pour la rendre opposable,
--   on l'entoure d'un FAISCEAU D'INDICES cote serveur : horodatage (deja via
--   date_signature), + IP + user-agent au moment de la signature.
--   Ces colonnes ne sont JAMAIS modifiables par le client (posees serveur).
--
-- COMMENT L'EXECUTER ?
--   Supabase > SQL Editor > New query > coller > Run > "Success".
--
-- SANS DANGER : ADD COLUMN IF NOT EXISTS, ne touche a aucune donnee existante.
-- ============================================================================

ALTER TABLE contrats_ouverture
  ADD COLUMN IF NOT EXISTS signature_ip TEXT,
  ADD COLUMN IF NOT EXISTS signature_user_agent TEXT;
