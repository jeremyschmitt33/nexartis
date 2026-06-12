-- ============================================================================
-- MIGRATION — Numerotation sequentielle et legale des factures
-- Date : 2026-06-12
--
-- POURQUOI ?
--   Avant : le numero de facture etait genere cote navigateur avec
--     `F-${annee}-${String(Date.now()).slice(-5)}`
--   => numeros NON sequentiels (ils sautent : 48213, 91002, 03847...),
--   non conformes a l'article 242 nonies A du CGI (suite chronologique
--   continue, sans trou), avec un risque de collision.
--
--   Apres : la BASE DE DONNEES genere elle-meme le numero au moment de
--   l'insertion, de facon ATOMIQUE (pas de collision meme si deux factures
--   sont creees en meme temps) et SEQUENTIELLE par entreprise et par annee.
--   Format : F-2026-0001, F-2026-0002, ... puis F-2027-0001 le 1er janvier.
--
--   Avantage : ca couvre AUTOMATIQUEMENT tous les endroits qui creent une
--   facture (creation manuelle, acompte, situation, avoir, future API...),
--   et les 4 rendus (HTML dashboard, PDF, PDF email, page signer) lisent
--   le meme numero depuis la base, donc parite garantie.
--
-- COMMENT L'EXECUTER ?
--   1. Supabase > votre projet > SQL Editor > New query.
--   2. Coller TOUT ce fichier. Run. Verifier "Success".
--
-- NOTE IMPORTANT :
--   - On ne renumerote JAMAIS les factures deja emises (interdit).
--     Ce mecanisme ne s'applique qu'aux NOUVELLES factures.
--   - Le compteur demarre a 1 pour chaque entreprise/annee.
--   - Aucun artisan reel n'est connecte a ce stade : demarrage propre.
--     (Si des factures de TEST existent dans votre compte, vous pouvez les
--      supprimer pour repartir de zero ; ce n'est pas obligatoire, l'ancien
--      format a 5 chiffres n'entre pas en collision avec le nouveau a 4.)
-- ============================================================================

-- 1) Table compteur : un compteur par entreprise (user_id) et par annee.
CREATE TABLE IF NOT EXISTS facture_compteurs (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee          INT  NOT NULL,
  dernier_numero INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, annee)
);

-- RLS activee SANS policy : aucun acces direct cote client. Seule la fonction
-- ci-dessous (SECURITY DEFINER) peut ecrire dans cette table.
ALTER TABLE facture_compteurs ENABLE ROW LEVEL SECURITY;

-- 2) Fonction declenchee AVANT chaque insertion de facture : elle calcule et
--    pose le numero sequentiel. Atomique grace a INSERT ... ON CONFLICT ...
--    RETURNING (verrou sur la ligne compteur => pas de doublon en concurrence).
CREATE OR REPLACE FUNCTION set_facture_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee INT;
  v_num   INT;
BEGIN
  -- Annee basee sur la date d'emission choisie (sinon date du jour).
  v_annee := EXTRACT(YEAR FROM COALESCE(NEW.date_emission, CURRENT_DATE))::INT;

  -- Increment atomique du compteur (cree la ligne a 1 si premiere facture
  -- de l'annee, sinon +1).
  INSERT INTO facture_compteurs (user_id, annee, dernier_numero)
  VALUES (NEW.user_id, v_annee, 1)
  ON CONFLICT (user_id, annee)
  DO UPDATE SET dernier_numero = facture_compteurs.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;

  -- Format final : F-2026-0001 (4 chiffres minimum, grandit au-dela de 9999).
  NEW.numero := 'F-' || v_annee || '-' || lpad(v_num::TEXT, 4, '0');

  RETURN NEW;
END;
$$;

-- 3) Branche la fonction en BEFORE INSERT sur la table factures.
DROP TRIGGER IF EXISTS trg_set_facture_numero ON factures;
CREATE TRIGGER trg_set_facture_numero
  BEFORE INSERT ON factures
  FOR EACH ROW EXECUTE FUNCTION set_facture_numero();

-- ============================================================================
-- VERIFICATIONS (a executer apres, manuellement) :
--
-- 1. Creer 2-3 factures depuis l'app : leurs numeros doivent se suivre
--    (F-2026-0001, F-2026-0002, F-2026-0003).
--
-- 2. Voir l'etat des compteurs :
--      SELECT * FROM facture_compteurs;
--
-- 3. Verifier qu'il n'y a aucun doublon de numero par entreprise :
--      SELECT user_id, numero, COUNT(*)
--      FROM factures GROUP BY user_id, numero HAVING COUNT(*) > 1;
--    (doit renvoyer 0 ligne)
-- ============================================================================
