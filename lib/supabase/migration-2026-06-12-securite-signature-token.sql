-- ============================================================================
-- MIGRATION SECURITE (R1-003) — Expiration + usage unique des tokens de
-- signature de devis
-- Date : 2026-06-12
--
-- POURQUOI ?
--   Le signature_token (UUID v4) du devis n'avait NI expiration NI invalidation
--   apres signature. Un lien de signature fuite (email transfere, historique,
--   capture) restait donc valide indefiniment : un tiers pouvait consulter les
--   coordonnees du client ET signer le devis sous un nom arbitraire.
--
--   Cette migration ajoute :
--     - signature_token_expire_at : date d'expiration du lien (mise a now()+30j
--       au moment de l'envoi, cote code dans app/api/send-devis).
--     - signature_token_used_at   : horodate l'utilisation du token apres une
--       signature reussie => le token devient inutilisable (single-use) MAIS
--       on conserve le token en base pour que le dashboard puisse continuer a
--       relire le devis par ce token (on n'efface pas signature_token = NULL,
--       qui casserait l'affichage post-signature ; on prefere ce marqueur).
--
-- COMMENT L'EXECUTER ?
--   1. Supabase > votre projet > SQL Editor.
--   2. Coller TOUT ce fichier.
--   3. "Run". Verifier "Success".
--
-- NOTE : Les devis EXISTANTS (deja envoyes avant cette migration) auront
--   signature_token_expire_at = NULL. Le code traite NULL comme "pas
--   d'expiration definie" => ces anciens liens restent valides (pas de
--   regression sur les devis en cours). Seuls les NOUVEAUX envois (via
--   send-devis) recevront une date d'expiration.
-- ============================================================================

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS signature_token_expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_token_used_at TIMESTAMPTZ;

-- ============================================================================
-- VERIFICATIONS (manuel) :
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'devis'
--     AND column_name IN ('signature_token_expire_at', 'signature_token_used_at');
-- ============================================================================
