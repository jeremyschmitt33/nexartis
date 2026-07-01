-- ============================================================================
-- MIGRATION — Contrat d'ouverture de porte (COP) — Phase 1a (socle)
-- Date : 2026-07-01
--
-- POURQUOI ?
--   Nouveau document "Contrat d'ouverture de porte" reserve aux SERRURIERS.
--   Il se comporte comme un DEVIS (bareme + TVA au choix de l'artisan, meme
--   look que les devis) et pourra plus tard basculer en facture (colonne
--   facture_id prevue des maintenant, non utilisee en 1a).
--
--   Cette migration cree UNIQUEMENT le socle base de donnees :
--     a) table contrats_ouverture (+ RLS 4 policies user_id = auth.uid())
--     b) table cop_compteurs (compteur sequentiel, RLS sans policy)
--     c) fonction + trigger set_cop_numero() (numero COP-YYYY-#### atomique)
--     d) colonnes cop_* sur entreprises (prereglages du bareme serrurier)
--
--   Les colonnes signature (phase 1b) sont creees ici mais NON utilisees en 1a.
--
-- COMMENT L'EXECUTER ?
--   1. Supabase > votre projet > SQL Editor > New query.
--   2. Coller TOUT ce fichier. Run. Verifier "Success. No rows returned".
--   3. Ce script est IDEMPOTENT (relancable sans danger) : IF NOT EXISTS +
--      CREATE OR REPLACE + DROP POLICY IF EXISTS avant chaque CREATE POLICY.
--
-- NOTE RGPD :
--   On NE stocke JAMAIS le numero d'une piece d'identite. La colonne
--   piece_nature ne contient QUE le TYPE de piece (ex : 'CNI'), a seule fin
--   de tracer que l'intervenant a verifie le droit d'acces de l'occupant.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- a) TABLE PRINCIPALE : contrats_ouverture
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contrats_ouverture (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Numero pose par le trigger (format COP-YYYY-####). NULL a l'insert.
  numero                    TEXT,

  -- Liaisons optionnelles.
  client_id                 UUID REFERENCES clients(id) ON DELETE SET NULL,
  facture_id                UUID,  -- phase 1b : lien vers la facture generee

  -- Cycle de vie du document.
  statut                    TEXT NOT NULL DEFAULT 'brouillon'
                              CHECK (statut IN ('brouillon','envoye','signe','annule')),

  -- Occupant (snapshot texte : le document est fige au moment de la creation).
  client_nom                TEXT,
  client_prenom             TEXT,
  client_adresse            TEXT,
  client_cp                 TEXT,
  client_ville              TEXT,

  statut_occupant           TEXT CHECK (statut_occupant IN ('locataire','proprietaire')),
  identite_verifiee         BOOLEAN DEFAULT FALSE,
  -- RGPD : TYPE de piece uniquement (ex 'CNI'), JAMAIS de numero.
  piece_nature              TEXT,

  date_intervention         TIMESTAMPTZ,
  lieu                      TEXT,

  -- Bareme : tableau de lignes { designation, quantite, unite, pu_ht, tva_taux }.
  lignes                    JSONB NOT NULL DEFAULT '[]',

  total_ht                  NUMERIC DEFAULT 0,
  total_tva                 NUMERIC DEFAULT 0,
  total_ttc                 NUMERIC DEFAULT 0,

  -- Cases juridiques (renonciation au delai de retractation d'urgence, etc.).
  renonciation_info         BOOLEAN DEFAULT FALSE,
  renonciation_execution    BOOLEAN DEFAULT FALSE,
  renonciation_perte        BOOLEAN DEFAULT FALSE,
  attestation_acces         BOOLEAN DEFAULT FALSE,
  consentement_risque       BOOLEAN DEFAULT FALSE,

  notes                     TEXT,
  nature_urgence            TEXT,

  -- ── Champs signature (phase 1b) : crees maintenant, NON utilises en 1a ──
  signature_token           UUID,
  signature_token_expire_at TIMESTAMPTZ,
  signature_token_used_at   TIMESTAMPTZ,
  client_signature_base64   TEXT,
  serrurier_signature_base64 TEXT,
  signed_by                 TEXT,
  date_signature            TIMESTAMPTZ,
  temoins                   JSONB,

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

-- Index utiles (liste par utilisateur, filtre corbeille).
CREATE INDEX IF NOT EXISTS idx_cop_user       ON contrats_ouverture (user_id);
CREATE INDEX IF NOT EXISTS idx_cop_deleted_at ON contrats_ouverture (deleted_at);


-- ════════════════════════════════════════════════════════════════════════════
-- b) RLS : 4 policies user_id = auth.uid() (pattern projet)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE contrats_ouverture ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contrats_ouverture_select" ON contrats_ouverture;
DROP POLICY IF EXISTS "contrats_ouverture_insert" ON contrats_ouverture;
DROP POLICY IF EXISTS "contrats_ouverture_update" ON contrats_ouverture;
DROP POLICY IF EXISTS "contrats_ouverture_delete" ON contrats_ouverture;

CREATE POLICY "contrats_ouverture_select" ON contrats_ouverture FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "contrats_ouverture_insert" ON contrats_ouverture FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "contrats_ouverture_update" ON contrats_ouverture FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "contrats_ouverture_delete" ON contrats_ouverture FOR DELETE
  USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- c) TABLE COMPTEUR : cop_compteurs (calque facture_compteurs)
--    RLS activee SANS policy : aucun acces direct client. Seule la fonction
--    SECURITY DEFINER ci-dessous peut y ecrire.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cop_compteurs (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee          INT  NOT NULL,
  dernier_numero INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, annee)
);

ALTER TABLE cop_compteurs ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- d) FONCTION + TRIGGER : numerotation atomique COP-YYYY-#### (calque facture)
--    Annee basee sur date_intervention (sinon date du jour).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_cop_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee INT;
  v_num   INT;
BEGIN
  -- Annee basee sur la date d'intervention choisie (sinon date du jour).
  v_annee := EXTRACT(YEAR FROM COALESCE(NEW.date_intervention, now()))::INT;

  -- Increment atomique du compteur (cree la ligne a 1 si premier COP de
  -- l'annee, sinon +1). Verrou sur la ligne compteur => pas de doublon.
  INSERT INTO cop_compteurs (user_id, annee, dernier_numero)
  VALUES (NEW.user_id, v_annee, 1)
  ON CONFLICT (user_id, annee)
  DO UPDATE SET dernier_numero = cop_compteurs.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;

  -- Format final : COP-2026-0001 (4 chiffres minimum, grandit au-dela de 9999).
  NEW.numero := 'COP-' || v_annee || '-' || lpad(v_num::TEXT, 4, '0');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cop_numero ON contrats_ouverture;
CREATE TRIGGER trg_set_cop_numero
  BEFORE INSERT ON contrats_ouverture
  FOR EACH ROW EXECUTE FUNCTION set_cop_numero();


-- ════════════════════════════════════════════════════════════════════════════
-- e) PREREGLAGES SERRURIER : colonnes cop_* sur entreprises
--    Servent a preremplir le bareme du COP (forfaits, taux, majoration nuit).
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS cop_forfait_ouverture_ht   NUMERIC;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS cop_forfait_deplacement_ht NUMERIC;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS cop_taux_horaire_ht        NUMERIC;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS cop_majoration_nuit_pct    NUMERIC;
ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS cop_intervenant_defaut     TEXT;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATIONS (a executer apres, manuellement)
-- ════════════════════════════════════════════════════════════════════════════
-- 1. Creer 2-3 COP depuis l'app : leurs numeros doivent se suivre
--    (COP-2026-0001, COP-2026-0002, COP-2026-0003).
-- 2. Etat des compteurs :        SELECT * FROM cop_compteurs;
-- 3. Aucun doublon de numero :   SELECT user_id, numero, COUNT(*)
--      FROM contrats_ouverture GROUP BY user_id, numero HAVING COUNT(*) > 1;
--    (doit renvoyer 0 ligne)
-- ============================================================================
