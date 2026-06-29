-- ============================================================
-- Migration 2026-06-29 — Gestion des déchets (loi AGEC) optionnelle
-- Appliquée en prod via MCP Supabase (apply_migration: afficher_dechets_optionnel)
-- ============================================================
-- Réglage global par entreprise (défaut des nouveaux devis) + drapeau par devis.
-- Défaut true partout => aucun devis existant n'est impacté.

ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS afficher_dechets BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS afficher_dechets BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN entreprises.afficher_dechets IS 'Réglage global : afficher la section gestion des déchets sur les nouveaux devis';
COMMENT ON COLUMN devis.afficher_dechets IS 'Par devis : afficher/masquer la section gestion des déchets';
