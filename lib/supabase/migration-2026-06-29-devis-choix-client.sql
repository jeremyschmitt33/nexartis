-- ============================================================
-- Migration 2026-06-29 — Devis avec lignes cochables par le client
-- Appliquée en prod via MCP Supabase (apply_migration: devis_lignes_choix_client)
-- ============================================================
--
-- Statut d'inclusion par ligne (combinaison optionnel + inclus_par_defaut) :
--   optionnel=false                          -> FERME      (toujours inclus, non décochable)
--   optionnel=true  + inclus_par_defaut=true  -> FACULTATIF (coché par défaut, le client peut retirer)
--   optionnel=true  + inclus_par_defaut=false -> OPTION +   (décoché par défaut, le client peut ajouter)
--
-- Le choix réel du client est figé à la signature dans devis_lignes.retenu_par_client,
-- et les montants acceptés dans devis.montant_*_signe (NULL = non modifié -> montants proposés).

ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS inclus_par_defaut BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS retenu_par_client BOOLEAN;

ALTER TABLE devis ADD COLUMN IF NOT EXISTS montant_ht_signe  NUMERIC(12,2);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS montant_tva_signe NUMERIC(12,2);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS montant_ttc_signe NUMERIC(12,2);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS modifie_par_client BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN devis_lignes.inclus_par_defaut IS 'Si optionnel=true : true=facultatif (coché par défaut), false=option en plus (décoché par défaut)';
COMMENT ON COLUMN devis_lignes.retenu_par_client IS 'Choix du client à la signature (NULL si non signé)';
COMMENT ON COLUMN devis.montant_ttc_signe IS 'Montant TTC réellement accepté par le client (NULL = non modifié)';
COMMENT ON COLUMN devis.modifie_par_client IS 'true si le client a retiré/ajouté des lignes à la signature';
