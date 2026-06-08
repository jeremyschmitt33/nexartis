-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION : Ajout du champ subscription_plan (Essentiel vs Complet)
-- Date : 8 juin 2026
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cette migration introduit la notion de plan d'abonnement sur la table
-- entreprises, en plus du champ existant abonnement_type :
--
--   abonnement_type      → état de l'abonnement ('trial', 'actif', 'suspendu', 'lifetime')
--   subscription_plan    → niveau d'abonnement choisi ('essential', 'complete')
--
-- Les utilisateurs existants sont migrés en 'complete' (rétrocompatibilité :
-- ils gardent l'accès à tout ce qu'ils avaient avant).
--
-- Le feature gating dans l'application s'appuie sur ce champ + le helper
-- lib/plans.ts pour décider quelles routes/fonctions sont accessibles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Ajout de la colonne subscription_plan
-- ─────────────────────────────────────────────────────────────

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT
    DEFAULT 'complete'
    CHECK (subscription_plan IN ('essential', 'complete'));

-- ─────────────────────────────────────────────────────────────
-- 2. Backfill : tous les utilisateurs existants → 'complete'
--    (ils ont l'historique d'avoir eu accès à tout, on ne casse rien)
-- ─────────────────────────────────────────────────────────────

UPDATE entreprises
SET subscription_plan = 'complete'
WHERE subscription_plan IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Index pour les requêtes admin (filtrer par plan)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_entreprises_subscription_plan
  ON entreprises (subscription_plan);

-- ─────────────────────────────────────────────────────────────
-- 4. Mise à jour de la vue admin pour exposer le plan
-- ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS admin_users_view;

CREATE OR REPLACE VIEW admin_users_view AS
SELECT
  e.id,
  e.user_id,
  e.nom AS entreprise_nom,
  e.email,
  e.telephone,
  e.metier,
  e.ville,
  e.abonnement_type,
  e.subscription_plan,
  e.trial_started_at,
  e.abonnement_expire_at,
  e.notes_admin,
  e.created_at,
  u.email AS auth_email,
  u.last_sign_in_at,
  u.email_confirmed_at
FROM entreprises e
JOIN auth.users u ON u.id = e.user_id
ORDER BY e.created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS post-migration (à exécuter manuellement pour contrôle)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Vérifier que la colonne existe :
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'entreprises' AND column_name = 'subscription_plan';
--
-- 2. Vérifier la distribution actuelle des plans :
--    SELECT subscription_plan, COUNT(*)
--    FROM entreprises
--    GROUP BY subscription_plan;
--
-- 3. Vérifier que la contrainte CHECK fonctionne (doit échouer) :
--    UPDATE entreprises SET subscription_plan = 'invalid' WHERE id = (SELECT id FROM entreprises LIMIT 1);
--    -- Résultat attendu : erreur "violates check constraint"
--
-- ═══════════════════════════════════════════════════════════════════════════
