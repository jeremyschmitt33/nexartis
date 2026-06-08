-- ============================================
-- Migration D5 — Sauvegarde Pénalités / Indemnité forfaitaire / Escompte
-- Date : 2026-06-08
-- Contexte : Les champs Pénalités de retard, Indemnité forfaitaire (40€)
-- et Escompte de la page Paramètres > Facturation n'étaient pas sauvegardés
-- en DB. Cette migration ajoute les 3 colonnes correspondantes sur la table
-- `entreprises` avec les valeurs par défaut légales françaises (art. L441-10
-- du Code de commerce).
--
-- Comment exécuter :
-- 1. Ouvrir Supabase Dashboard → Project → SQL Editor
-- 2. Copier-coller ce fichier entier
-- 3. Run
-- 4. Vérifier qu'aucune erreur n'apparaît
-- ============================================

-- Ajout des 3 colonnes (idempotent grâce à IF NOT EXISTS)
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS penalites_retard_defaut TEXT
    DEFAULT '3 fois le taux d''intérêt légal';

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS indemnite_forfaitaire_defaut TEXT
    DEFAULT '40 EUR';

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS escompte_defaut TEXT
    DEFAULT 'Aucun escompte accordé';

-- Renseigner les valeurs par défaut sur les comptes existants
-- (uniquement si NULL pour ne rien écraser)
UPDATE entreprises
SET penalites_retard_defaut = '3 fois le taux d''intérêt légal'
WHERE penalites_retard_defaut IS NULL;

UPDATE entreprises
SET indemnite_forfaitaire_defaut = '40 EUR'
WHERE indemnite_forfaitaire_defaut IS NULL;

UPDATE entreprises
SET escompte_defaut = 'Aucun escompte accordé'
WHERE escompte_defaut IS NULL;

-- Vérification
SELECT
  COUNT(*) AS total_entreprises,
  COUNT(penalites_retard_defaut) AS avec_penalites,
  COUNT(indemnite_forfaitaire_defaut) AS avec_indemnite,
  COUNT(escompte_defaut) AS avec_escompte
FROM entreprises;
