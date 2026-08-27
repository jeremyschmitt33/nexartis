-- ============================================================================
-- MULTI-UTILISATEUR — PHASE 1 : fondations (table membres + fonctions + backfill)
-- Date : 2026-06-12
--
-- OBJECTIF
--   Poser la "plomberie" du multi-utilisateur SANS changer le comportement
--   actuel. Apres cette migration, chaque entreprise existante a 1 membre
--   "Dirigeant" (son proprietaire historique). Les regles de securite (RLS)
--   des tables metier ne sont PAS modifiees ici : elles le seront en Phase 2,
--   quand on permettra d'inviter un employe. Donc : AUCUN changement visible,
--   risque quasi nul.
--
-- A EXECUTER
--   Supabase > SQL Editor > New query > coller TOUT > Run > "Success".
--   (Aucun deploiement de code necessaire pour cette phase.)
--
-- REVERSIBLE
--   Pour annuler : DROP TABLE entreprise_membres CASCADE;
--   puis DROP FUNCTION current_entreprise_ids();
-- ============================================================================

-- 1) TABLE DES MEMBRES ------------------------------------------------------
-- Un membre = un compte de connexion rattache a une entreprise, avec un role.
CREATE TABLE IF NOT EXISTS entreprise_membres (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id     UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,   -- NULL tant que l'invite n'a pas active son compte
  role              TEXT NOT NULL CHECK (role IN ('dirigeant','commercial','ouvrier')),
  statut            TEXT NOT NULL DEFAULT 'invite' CHECK (statut IN ('actif','invite','revoque')),
  email_invite      TEXT,
  invite_token      UUID,
  invite_expires_at TIMESTAMPTZ,
  intervenant_id    UUID REFERENCES intervenants(id) ON DELETE SET NULL, -- lien optionnel vers la fiche RH (rempli plus tard)
  invited_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  -- Un user ne peut etre membre qu'une fois par entreprise.
  CONSTRAINT uq_membre_user UNIQUE (entreprise_id, user_id)
);

-- Index de performance (les fonctions ci-dessous filtrent sur ces colonnes).
CREATE INDEX IF NOT EXISTS idx_membres_user_statut ON entreprise_membres(user_id, statut);
CREATE INDEX IF NOT EXISTS idx_membres_entreprise ON entreprise_membres(entreprise_id, user_id);

-- Unicite des invitations VIVANTES par email (insensible a la casse), sans
-- bloquer une reinvitation apres revocation (correctif audit, utile Phase 2).
CREATE UNIQUE INDEX IF NOT EXISTS uq_membre_email_live
  ON entreprise_membres (entreprise_id, lower(email_invite))
  WHERE email_invite IS NOT NULL AND statut <> 'revoque';

-- 2) FONCTIONS HELPER (SECURITY DEFINER) ------------------------------------
-- SECURITY DEFINER = la fonction s'execute avec les droits du proprietaire et
-- contourne la RLS => evite la recursion infinie quand la RLS de la table
-- membres s'appuie sur ces fonctions. search_path verrouille (anti-injection).

-- Entreprises auxquelles l'utilisateur courant appartient (membre actif).
-- Auto-limitee a auth.uid() => ne fuit jamais les donnees d'un autre tenant.
-- (Les fonctions entreprise_of_user / current_role_in necessaires aux policies
--  metier seront ajoutees en Phase 2, avec la reecriture RLS auditee.)
CREATE OR REPLACE FUNCTION current_entreprise_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT entreprise_id FROM entreprise_membres
  WHERE user_id = auth.uid() AND statut = 'actif'
$$;

-- 3) RLS DE LA TABLE MEMBRES (stricte) --------------------------------------
ALTER TABLE entreprise_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_membres FORCE ROW LEVEL SECURITY;

-- Lecture : un user ne voit QUE les membres des entreprises dont il est membre actif.
-- (current_entreprise_ids est SECURITY DEFINER => pas de recursion RLS.)
DROP POLICY IF EXISTS membres_select ON entreprise_membres;
CREATE POLICY membres_select ON entreprise_membres
  FOR SELECT USING (entreprise_id IN (SELECT current_entreprise_ids()));

-- Ecriture : AUCUNE policy INSERT/UPDATE/DELETE cote client.
-- => seules les routes serveur (service_role, qui contourne la RLS) peuvent
--    creer/modifier des membres. Impossible pour un user de se rattacher seul.

-- DURCISSEMENT (audit croise 2026-06-12) :
-- 1) Couper explicitement tout droit d'ecriture cote client (anon/authenticated).
--    PostgREST refuse alors l'INSERT AVANT d'evaluer les contraintes UNIQUE =>
--    ferme le canal d'enumeration "tel email est-il membre de telle entreprise".
--    Le service_role (routes serveur, Phase 2) conserve ses droits.
REVOKE INSERT, UPDATE, DELETE ON entreprise_membres FROM anon, authenticated;
-- 2) Ne pas exposer la fonction helper en RPC aux visiteurs anonymes.
REVOKE EXECUTE ON FUNCTION current_entreprise_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_entreprise_ids() TO authenticated, service_role;

-- 4) BACKFILL : chaque entreprise actuelle -> 1 Dirigeant actif --------------
-- Idempotent (ON CONFLICT) : relancable sans danger.
INSERT INTO entreprise_membres (entreprise_id, user_id, role, statut)
SELECT e.id, e.user_id, 'dirigeant', 'actif'
FROM entreprises e
WHERE e.user_id IS NOT NULL
ON CONFLICT (entreprise_id, user_id) DO NOTHING;

-- ============================================================================
-- VERIFICATIONS (a executer apres, manuellement) :
--
-- 1. Il doit y avoir au moins autant de membres dirigeants que d'entreprises :
--      SELECT
--        (SELECT COUNT(*) FROM entreprises WHERE user_id IS NOT NULL) AS nb_entreprises,
--        (SELECT COUNT(*) FROM entreprise_membres WHERE role='dirigeant' AND statut='actif') AS nb_dirigeants;
--    (les deux nombres doivent etre egaux)
--
-- 2. Aucune entreprise sans dirigeant :
--      SELECT e.id FROM entreprises e
--      LEFT JOIN entreprise_membres m ON m.entreprise_id = e.id AND m.role='dirigeant'
--      WHERE e.user_id IS NOT NULL AND m.id IS NULL;
--    (doit renvoyer 0 ligne)
--
-- 3. Les fonctions repondent (connecte en tant qu'utilisateur normal) :
--      SELECT * FROM current_entreprise_ids();   -- doit lister VOTRE entreprise
-- ============================================================================
