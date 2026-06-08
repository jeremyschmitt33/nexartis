-- ============================================
-- Migration D3 — Soft delete sur table intervenants
-- Date : 2026-06-08
-- Contexte : la suppression d'un membre d'équipe utilisait `DELETE` (hard
-- delete). Pour l'audit BTP et le suivi historique des chantiers réalisés
-- par d'anciens employés, on passe en soft delete (deleted_at TIMESTAMPTZ).
-- Aligné avec les tables `devis` et `factures` qui utilisent déjà ce pattern.
--
-- Comment exécuter :
-- 1. Ouvrir Supabase Dashboard → Project → SQL Editor
-- 2. Copier-coller ce fichier entier
-- 3. Run
-- ============================================

-- Ajout de la colonne deleted_at (idempotent)
ALTER TABLE intervenants
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index partiel pour accélérer les requêtes "non supprimés"
CREATE INDEX IF NOT EXISTS idx_intervenants_active
  ON intervenants(user_id)
  WHERE deleted_at IS NULL;

-- Vérification
SELECT
  COUNT(*) AS total_intervenants,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS actifs,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS supprimes
FROM intervenants;
