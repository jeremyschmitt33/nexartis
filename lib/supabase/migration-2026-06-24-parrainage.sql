-- ============================================================
-- MIGRATION PARRAINAGE — 2026-06-24
-- A executer dans Supabase SQL Editor (ou applique via MCP).
--
-- OBJECTIF :
--   1) Donner a CHAQUE entreprise un code de parrainage unique (referral_code),
--      genere automatiquement a l'inscription (trigger) + backfill des existants.
--   2) Creer la table `parrainages` qui relie un parrain a un filleul et suit
--      le statut de la recompense (1 mois offert pour les deux).
--
-- 100% ADDITIF : aucune colonne existante modifiee, aucune donnee touchee.
-- Securite : RLS activee sur `parrainages` (un parrain ne voit QUE ses filleuls ;
--            toute ecriture passe par le service role cote serveur).
-- ============================================================


-- ------------------------------------------------------------
-- 1. COLONNE referral_code SUR entreprises
-- ------------------------------------------------------------
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS referral_code TEXT;


-- ------------------------------------------------------------
-- 2. FONCTION : generer un code unique, court et non devinable
--    Alphabet sans caracteres ambigus (pas de 0/O/1/I/L).
--    8 caracteres => ~8.5e11 combinaisons.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  TEXT;
  i     INT;
  collision BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM entreprises WHERE referral_code = code) INTO collision;
    EXIT WHEN NOT collision;
  END LOOP;
  RETURN code;
END;
$$;


-- ------------------------------------------------------------
-- 3. TRIGGER : remplir referral_code automatiquement a l'insertion
--    (s'applique quel que soit le chemin d'insertion : route API ou trigger auth)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_referral_code ON entreprises;
CREATE TRIGGER trg_set_referral_code
  BEFORE INSERT ON entreprises
  FOR EACH ROW
  EXECUTE FUNCTION set_referral_code();


-- ------------------------------------------------------------
-- 4. BACKFILL des entreprises existantes (une par une pour eviter les collisions)
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM entreprises WHERE referral_code IS NULL LOOP
    UPDATE entreprises SET referral_code = generate_referral_code() WHERE id = r.id;
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- 5. CONTRAINTE D'UNICITE (apres backfill)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_entreprises_referral_code
  ON entreprises(referral_code)
  WHERE referral_code IS NOT NULL;


-- ------------------------------------------------------------
-- 6. TABLE parrainages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parrainages (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui a parraine qui (references vers entreprises)
  parrain_entreprise_id      UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  filleul_entreprise_id      UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,

  -- Etat de la recompense
  --   en_attente               : filleul inscrit, pas encore paye son 1er mois
  --   recompense               : filleul ET parrain recompenses (coupon applique aux deux)
  --   recompense_filleul_seul  : filleul recompense ; parrain en credit en attente (pas encore abonne)
  --   non_recompense_plafond   : filleul recompense ; parrain plafonne (10 atteint) => pas de bonus parrain
  --   annule                   : remboursement / fraude / expiration sans paiement
  statut                     TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','recompense','recompense_filleul_seul','non_recompense_plafond','annule')),

  -- Credit parrain en attente (parrain pas encore abonne au moment du paiement du filleul)
  parrain_credit_en_attente  BOOLEAN NOT NULL DEFAULT FALSE,
  parrain_credit_expire_at   TIMESTAMPTZ,           -- le credit parrain expire (ex: +90 jours)

  -- Tracabilite Stripe / anti-fraude
  filleul_first_invoice_id   TEXT,                  -- facture Stripe declencheuse (1er paiement filleul)
  filleul_recompense_at      TIMESTAMPTZ,
  parrain_recompense_at      TIMESTAMPTZ,
  notes                      TEXT,                  -- trace technique (ex: raison d'annulation)

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- On ne peut pas se parrainer soi-meme
  CONSTRAINT parrainage_pas_soi_meme CHECK (parrain_entreprise_id <> filleul_entreprise_id),
  -- Un filleul ne peut etre parraine qu'une seule fois
  CONSTRAINT parrainage_filleul_unique UNIQUE (filleul_entreprise_id)
);

CREATE INDEX IF NOT EXISTS idx_parrainages_parrain ON parrainages(parrain_entreprise_id);
CREATE INDEX IF NOT EXISTS idx_parrainages_statut  ON parrainages(statut);


-- ------------------------------------------------------------
-- 7. RLS (Row Level Security)
--    - Un parrain (utilisateur connecte) peut LIRE les parrainages qu'il a generes.
--    - Aucune policy INSERT/UPDATE/DELETE pour les utilisateurs :
--      toutes les ecritures passent par le service role (cote serveur), qui ignore la RLS.
-- ------------------------------------------------------------
ALTER TABLE parrainages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parrain peut voir ses parrainages" ON parrainages;
CREATE POLICY "Parrain peut voir ses parrainages"
  ON parrainages FOR SELECT
  USING (
    parrain_entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 8. VERIFICATIONS (a lancer manuellement apres coup, optionnel)
-- ------------------------------------------------------------
-- SELECT count(*) AS sans_code FROM entreprises WHERE referral_code IS NULL;        -- doit etre 0
-- SELECT count(*) AS doublons FROM (SELECT referral_code FROM entreprises GROUP BY referral_code HAVING count(*) > 1) t;  -- doit etre 0
-- SELECT referral_code FROM entreprises LIMIT 5;
