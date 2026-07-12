-- ============================================================================
-- Fichier  : 2026-07-12-banque-05-achats-extension.sql
-- Module   : Dépenses & Banque V1 — fichier 5/7
-- POURQUOI : Une dépense RESTE un `achats` (décision spec §3 — aucune table
--            « dépense » en doublon). On enrichit la table existante pour :
--            - le soft delete (convention projet, manquait !),
--            - la catégorie (fichier 02),
--            - le rapprochement bancaire (CE mouvement a payé CET achat),
--            - les notes de frais (dépense avancée sur fonds perso).
-- QUOI     : ALTER TABLE achats ADD COLUMN (tout est NULLABLE ou avec défaut
--            → ZÉRO impact sur la page achats existante) + 2 index.
-- ⚠️ POINT D'ATTENTION APPLICATIF (pas de trigger, décision assumée) :
--            achats.taux_tva a un défaut de 20.00 en base ; quand
--            entreprises.franchise_tva = TRUE, l'app doit proposer 0 à la
--            saisie (lecture du profil au moment de la saisie).
-- RLS      : la table achats a DÉJÀ ses 4 policies « entreprise + dirigeant »
--            (vérifié en live le 12/07) — rien à ajouter ici. Le code
--            applicatif doit par contre ajouter le filtre
--            WHERE deleted_at IS NULL sur toutes ses lectures.
-- IDEMPOTENT : oui.
-- ============================================================================

ALTER TABLE public.achats
  -- Convention projet : soft delete (la colonne manquait sur cette table).
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,

  -- Catégorie de dépense (fichier 02).
  ADD COLUMN IF NOT EXISTS categorie_id UUID REFERENCES public.depense_categories(id),

  -- Rapprochement décaissement : CE mouvement bancaire a payé CET achat.
  -- NULLABLE : un achat en espèces ou payé sur fonds perso n'a pas de
  -- mouvement bancaire.
  ADD COLUMN IF NOT EXISTS mouvement_id UUID REFERENCES public.banque_mouvements(id),

  -- Comment l'achat a été payé (informatif, utile au registre des achats).
  ADD COLUMN IF NOT EXISTS moyen_paiement TEXT
    CHECK (moyen_paiement IN ('carte','virement','prelevement','cheque','especes','perso')),

  -- Sur quels fonds : 'perso' = NOTE DE FRAIS (avancée sur fonds personnels,
  -- remboursable) — pas de table dédiée, c'est un achat avec un statut.
  ADD COLUMN IF NOT EXISTS paye_sur_fonds TEXT NOT NULL DEFAULT 'pro'
    CHECK (paye_sur_fonds IN ('pro','perso','caisse')),

  -- Suivi du remboursement de la note de frais.
  ADD COLUMN IF NOT EXISTS remboursement_statut TEXT NOT NULL DEFAULT 'na'
    CHECK (remboursement_statut IN ('na','a_rembourser','rembourse')),

  -- Le virement compte pro → compte perso qui a remboursé la note de frais.
  ADD COLUMN IF NOT EXISTS rembourse_mouvement_id UUID REFERENCES public.banque_mouvements(id),

  -- Nom du commerçant quand on ne veut PAS créer une fiche fournisseur
  -- (« Boulangerie du coin »).
  ADD COLUMN IF NOT EXISTS fournisseur_libre TEXT;

-- Parcours de lecture réels.
CREATE INDEX IF NOT EXISTS achats_mouvement_idx
  ON public.achats (mouvement_id) WHERE mouvement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS achats_chantier_idx
  ON public.achats (chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS achats_categorie_idx
  ON public.achats (categorie_id) WHERE categorie_id IS NOT NULL;

-- ─── VÉRIFICATION après application ─────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='achats' AND column_name IN
--  ('deleted_at','categorie_id','mouvement_id','moyen_paiement',
--   'paye_sur_fonds','remboursement_statut','rembourse_mouvement_id','fournisseur_libre');
--   → 8 lignes.
-- La page /dashboard/achats doit continuer de fonctionner à l'identique
-- (toutes les colonnes ajoutées sont nullables ou avec défaut).

-- ============================================================================
-- ROLLBACK (la structure revient à l'état exact d'avant ; les données de
-- liaison saisies entre-temps sont perdues, c'est attendu) :
--
-- DROP INDEX IF EXISTS public.achats_mouvement_idx;
-- DROP INDEX IF EXISTS public.achats_categorie_idx;
-- -- (achats_chantier_idx peut être conservé : il ne dépend que de l'existant)
-- ALTER TABLE public.achats
--   DROP COLUMN IF EXISTS fournisseur_libre,
--   DROP COLUMN IF EXISTS rembourse_mouvement_id,
--   DROP COLUMN IF EXISTS remboursement_statut,
--   DROP COLUMN IF EXISTS paye_sur_fonds,
--   DROP COLUMN IF EXISTS moyen_paiement,
--   DROP COLUMN IF EXISTS mouvement_id,
--   DROP COLUMN IF EXISTS categorie_id,
--   DROP COLUMN IF EXISTS deleted_at;
-- ============================================================================
