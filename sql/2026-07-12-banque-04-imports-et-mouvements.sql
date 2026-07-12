-- ============================================================================
-- Fichier  : 2026-07-12-banque-04-imports-et-mouvements.sql
-- Module   : Dépenses & Banque V1 — fichier 4/7
-- POURQUOI : Le cœur du module : le miroir brut du relevé bancaire (et les
--            saisies manuelles de caisse), avec une idempotence d'import à
--            3 niveaux (hash du fichier / FITID / hash de ligne) pour que
--            ré-importer le même relevé — ou deux relevés qui se chevauchent —
--            ne crée JAMAIS de doublon.
-- QUOI     : 1) table banque_imports (1 ligne par fichier : audit, compteurs,
--               annulation d'un import entier)
--            2) table banque_mouvements avec hash_dedup en COLONNE GÉNÉRÉE
--               + index uniques PARTIELS (hors corbeille)
--            3) RLS pattern live « entreprise + dirigeant » sur les deux.
-- CORRECTIONS DE LA CONFRONTATION APPLIQUÉES :
--            - PAS de chantier_id sur banque_mouvements (décision jeremy n°3 :
--              un seul chemin de rentabilité, mouvement → achat → chantier).
--            - OFX hors périmètre V1 (la colonne ofx_fitid et son index
--              restent dans le schéma pour la V1.5, mais aucun code V1 ne
--              produit de lignes 'ofx' / 'import_ofx').
-- ⚠️ HASH DE DÉDUP — formule à répliquer À L'IDENTIQUE côté application
--    (route /api/banque/import/parse, pour pré-marquer les doublons) :
--      hash = md5( joursDepuisEpoch(date_operation) + '|' +
--                  montant.toFixed(2) + '|' +
--                  libelle.trim().replace(/\s+/g,' ').toUpperCase() )
--    - joursDepuisEpoch = nombre de jours entiers depuis le 01/01/1970
--      (en SQL : date_operation - DATE '1970-01-01' — on ne peut PAS utiliser
--      date::text dans une colonne générée, ce cast n'est pas IMMUTABLE).
--    - montant en NUMERIC(12,2) : toujours 2 décimales, point décimal,
--      signe '-' devant les débits (ex. « -45.90 »).
--    - Détection d'encodage Windows-1252 OBLIGATOIRE à l'import : des accents
--      cassés changeraient le hash → doublons futurs.
--    - Doublons intra-fichier légitimes (2 cafés à 1,20 € le même jour) :
--      suffixer le libellé (« #2 ») AVANT insertion, côté application.
-- IDEMPOTENT : oui.
-- ============================================================================

-- ─── 1) banque_imports — 1 ligne par fichier importé ────────────────────────
CREATE TABLE IF NOT EXISTS public.banque_imports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  compte_id         UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
  fichier_nom       TEXT NOT NULL,
  fichier_hash      TEXT,                 -- sha256 du fichier : re-glisser le même → avertissement
  format            TEXT NOT NULL CHECK (format IN ('csv','ofx','manuel')),
                    -- 'ofx' prévu au schéma mais HORS périmètre V1 (V1.5)
  statut            TEXT NOT NULL DEFAULT 'en_cours'
                      CHECK (statut IN ('en_cours','termine','erreur','annule')),
  nb_lignes_fichier INT NOT NULL DEFAULT 0,
  nb_importees      INT NOT NULL DEFAULT 0,
  nb_doublons       INT NOT NULL DEFAULT 0,
  nb_erreurs        INT NOT NULL DEFAULT 0,
  periode_debut     DATE,
  periode_fin       DATE,
  erreur_message    TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banque_imports_user_idx
  ON public.banque_imports (user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON public.banque_imports;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.banque_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.banque_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS banque_imports_select ON public.banque_imports;
CREATE POLICY banque_imports_select ON public.banque_imports FOR SELECT
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
DROP POLICY IF EXISTS banque_imports_insert ON public.banque_imports;
CREATE POLICY banque_imports_insert ON public.banque_imports FOR INSERT
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
DROP POLICY IF EXISTS banque_imports_update ON public.banque_imports;
CREATE POLICY banque_imports_update ON public.banque_imports FOR UPDATE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
DROP POLICY IF EXISTS banque_imports_delete ON public.banque_imports;
CREATE POLICY banque_imports_delete ON public.banque_imports FOR DELETE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

-- ─── 2) banque_mouvements — le miroir brut du relevé ────────────────────────
CREATE TABLE IF NOT EXISTS public.banque_mouvements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  compte_id         UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
  import_id         UUID REFERENCES public.banque_imports(id),  -- NULL = saisie manuelle

  -- ── Données brutes du relevé (jamais modifiées après import) ──
  date_operation    DATE NOT NULL,
  date_valeur       DATE,
  libelle_banque    TEXT NOT NULL,        -- libellé brut tel quel
  montant           NUMERIC(12,2) NOT NULL CHECK (montant <> 0),
                    -- SIGNÉ : négatif = débit, positif = crédit
  ofx_fitid         TEXT,                 -- identifiant unique OFX (V1.5)

  -- ── Dédup par hash : COLONNE GÉNÉRÉE, impossible à désynchroniser ──
  -- (date - epoch)::text car date::text n'est pas IMMUTABLE (DateStyle) ;
  -- btrim = équivalent du .trim() JS (espaces de tête/queue retirés APRÈS le
  -- regroupement des blancs) ; formule JS équivalente dans l'en-tête.
  hash_dedup        TEXT GENERATED ALWAYS AS (
                      md5(
                        (date_operation - DATE '1970-01-01')::text || '|' ||
                        montant::text || '|' ||
                        upper(btrim(regexp_replace(libelle_banque, '\s+', ' ', 'g')))
                      )
                    ) STORED,

  -- ── Enrichissement utilisateur (le « pointage ») ──
  -- ⚠️ PAS de chantier_id ici (décision jeremy n°3) : le rattachement chantier
  --    passe TOUJOURS par un achats lié (achats.mouvement_id, fichier 05).
  libelle_perso     TEXT,
  categorie_id      UUID REFERENCES public.depense_categories(id),
  statut_pointage   TEXT NOT NULL DEFAULT 'a_pointer'
                      CHECK (statut_pointage IN ('a_pointer','pointe','ignore')),
  nature            TEXT NOT NULL DEFAULT 'normal'
                      CHECK (nature IN ('normal','remboursement','virement_interne')),
                      -- 'remboursement' = crédit qui est un avoir fournisseur (exclu du CA)
                      -- 'virement_interne' = compte→caisse ou compte→compte (exclu de tout)
  est_prive         BOOLEAN NOT NULL DEFAULT FALSE,  -- flux perso sur compte pro
  justificatif_path TEXT,                 -- chemin dans le bucket privé 'justificatifs' (fichier 07)
  notes             TEXT,
  source            TEXT NOT NULL DEFAULT 'import_csv'
                      CHECK (source IN ('import_csv','import_ofx','manuel')),

  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotence du ré-import : le MÊME mouvement ne rentre jamais 2 fois sur un
-- compte. Index PARTIEL (hors corbeille) : une ligne supprimée par erreur peut
-- revenir via un ré-import — comportement voulu.
CREATE UNIQUE INDEX IF NOT EXISTS banque_mouvements_dedup_uniq
  ON public.banque_mouvements (compte_id, hash_dedup) WHERE deleted_at IS NULL;

-- Dédup OFX renforcée quand le FITID existe (prêt pour la V1.5).
CREATE UNIQUE INDEX IF NOT EXISTS banque_mouvements_fitid_uniq
  ON public.banque_mouvements (compte_id, ofx_fitid)
  WHERE ofx_fitid IS NOT NULL AND deleted_at IS NULL;

-- Parcours de lecture réels :
CREATE INDEX IF NOT EXISTS banque_mouvements_liste_idx       -- liste par compte, tri date
  ON public.banque_mouvements (compte_id, date_operation DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS banque_mouvements_a_pointer_idx   -- badge « N opérations à pointer »
  ON public.banque_mouvements (user_id, statut_pointage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS banque_mouvements_import_idx      -- annulation d'un import
  ON public.banque_mouvements (import_id) WHERE import_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.banque_mouvements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.banque_mouvements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.banque_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS banque_mouvements_select ON public.banque_mouvements;
CREATE POLICY banque_mouvements_select ON public.banque_mouvements FOR SELECT
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
DROP POLICY IF EXISTS banque_mouvements_insert ON public.banque_mouvements;
CREATE POLICY banque_mouvements_insert ON public.banque_mouvements FOR INSERT
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
DROP POLICY IF EXISTS banque_mouvements_update ON public.banque_mouvements;
CREATE POLICY banque_mouvements_update ON public.banque_mouvements FOR UPDATE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
DROP POLICY IF EXISTS banque_mouvements_delete ON public.banque_mouvements;
CREATE POLICY banque_mouvements_delete ON public.banque_mouvements FOR DELETE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

-- ─── VÉRIFICATION après application ─────────────────────────────────────────
-- Test de la colonne générée et de la dédup (à faire sur un compte de test,
-- puis nettoyer) :
--   INSERT INTO banque_mouvements (user_id, compte_id, date_operation, libelle_banque, montant)
--   VALUES ('<uuid user>', '<uuid compte>', '2026-07-01', 'TEST  DEDUP', -10.00);
--   → hash_dedup non NULL ; ré-exécuter la même insertion avec
--     ON CONFLICT DO NOTHING → 0 ligne insérée.
-- SELECT count(*) FROM pg_policies WHERE tablename IN ('banque_imports','banque_mouvements');
--   → 8.

-- ============================================================================
-- ROLLBACK (ordre inverse des FK) :
--
-- DROP TABLE IF EXISTS public.banque_mouvements;
-- DROP TABLE IF EXISTS public.banque_imports;
--   (⚠️ si les fichiers 05/06 sont déjà appliqués, détacher d'abord
--    achats.mouvement_id, achats.rembourse_mouvement_id, paiements.mouvement_id)
-- ============================================================================
