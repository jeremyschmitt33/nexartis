-- ============================================================================
-- Migration 28/05/2026 — Refonte Paramètres + Planning saisie libre + Notifs
-- ============================================================================
-- Cette migration accompagne le commit du 28/05/2026 :
--   1. Médiateur de consommation : passage d'un champ unique à 4 sous-champs
--      (nom, adresse, code postal, ville).
--   2. Préférence notification : nouveau toggle "Devis signé" persisté en base.
--   3. Planning : saisie libre client/chantier (visites de courtoisie, premiers
--      RDV, contrôles sur prospect non encore en base) + type d'intervention.
--
-- À exécuter dans Supabase : Project > SQL Editor > New query > coller > Run.
-- 100 % rétro-compatible : aucune colonne supprimée, valeurs par défaut sûres.
-- ============================================================================

-- ── 1. Table `entreprises` — Médiateur en 4 sous-champs + notif ────────────
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS mediateur_nom TEXT,
  ADD COLUMN IF NOT EXISTS mediateur_adresse TEXT,
  ADD COLUMN IF NOT EXISTS mediateur_code_postal TEXT,
  ADD COLUMN IF NOT EXISTS mediateur_ville TEXT,
  ADD COLUMN IF NOT EXISTS notify_devis_signe BOOLEAN DEFAULT TRUE;

-- Note : l'ancienne colonne `mediateur` (texte libre) est CONSERVÉE pour
-- rétro-compatibilité. Le code lit en priorité les 4 nouveaux champs et fait
-- automatiquement fallback sur `mediateur` si les 4 sont vides. À terme, on
-- pourra écrire une migration de copie + suppression de la colonne ancienne.

-- ── 2. Table `planning_interventions` — Saisie libre + type ────────────────
ALTER TABLE planning_interventions
  ADD COLUMN IF NOT EXISTS client_libre TEXT,
  ADD COLUMN IF NOT EXISTS chantier_libre TEXT,
  ADD COLUMN IF NOT EXISTS type_intervention TEXT;

-- Note : ces 3 colonnes restent NULL pour toutes les interventions existantes.
-- Elles ne sont remplies que lorsque l'utilisateur saisit un nom de contact
-- ou un lieu qui ne correspond à aucun client/chantier en base.

-- ── 3. Vérification (à exécuter ensuite pour confirmer) ────────────────────
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'entreprises'
--   AND column_name IN ('mediateur_nom','mediateur_adresse','mediateur_code_postal','mediateur_ville','notify_devis_signe')
-- ORDER BY column_name;
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'planning_interventions'
--   AND column_name IN ('client_libre','chantier_libre','type_intervention')
-- ORDER BY column_name;
