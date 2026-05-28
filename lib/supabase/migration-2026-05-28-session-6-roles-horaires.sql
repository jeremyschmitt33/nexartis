-- Migration 28/05/2026 — Session 6 : rôles équipe + horaires de travail configurables
-- Feature 1 (S1) : ajoute une colonne "role" optionnelle à intervenants
--   Valeurs prévues côté UI : Dirigeant | Chef d'équipe | Compagnon | Apprenti | Assistant
--   Distinct de niveau_acces (droits) et de type_contrat (CDI/CDD/...).
-- Feature 2 (S5) : ajoute les 4 horaires de travail par défaut à entreprises
--   Utilisés dans le planning pour les créneaux Matin / Après-midi / Journée entière.
--   Format HH:MM. Defaults = anciennes valeurs hardcodées (08:00, 12:00, 13:00, 17:00).

ALTER TABLE intervenants
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS heure_debut_matin TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS heure_fin_matin TEXT DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS heure_debut_apres_midi TEXT DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS heure_fin_apres_midi TEXT DEFAULT '17:00';
