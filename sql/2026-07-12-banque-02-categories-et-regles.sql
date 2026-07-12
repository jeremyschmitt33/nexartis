-- ============================================================================
-- Fichier  : 2026-07-12-banque-02-categories-et-regles.sql
-- Module   : Dépenses & Banque V1 — fichier 2/7
-- POURQUOI : Chaque opération pointée reçoit une catégorie. Les catégories de
--            recette portent la ventilation URSSAF (prestation 21,2 % /
--            marchandise 12,3 % — taux datés du fichier 01). Les règles
--            système pré-remplissent la catégorie à l'import (suggestion,
--            jamais imposée : le pointage la confirme).
-- QUOI     : 1) table depense_categories + RLS + seed de 19 catégories
--               système : 16 « vraies » (3 recettes + 13 dépenses, conforme
--               au « ~16 » de la spec — fusion télécom+abonnements faite,
--               salaires et local retirés) + 3 techniques (apport perso,
--               privé, virement interne)
--            2) table categorisation_regles + RLS + seed des règles SYSTÈME
--               uniquement (périmètre V1 : PAS d'apprentissage des
--               corrections — source='apprise' réservée à la V1.5)
-- IDEMPOTENT : oui (IF NOT EXISTS + insertions gardées par NOT EXISTS).
-- ============================================================================

-- ─── 1) Table des catégories ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.depense_categories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id),
                     -- NULL = catégorie SYSTÈME (visible par tout le monde)
  code               TEXT NOT NULL,     -- identifiant stable pour le code ('materiaux'…)
  label              TEXT NOT NULL,     -- libellé affiché
  groupe             TEXT NOT NULL CHECK (groupe IN ('recette','depense','neutre')),
  ventilation_urssaf TEXT CHECK (ventilation_urssaf IN ('prestation','marchandise')),
                     -- uniquement sur les recettes : alimente la calculatrice URSSAF
  compte_pcg         TEXT,              -- compte comptable indicatif pour l'export comptable
  est_privee         BOOLEAN NOT NULL DEFAULT FALSE,  -- exclue de tous les totaux pro
  icone              TEXT,              -- nom d'icône lucide pour l'UI
  ordre              INT NOT NULL DEFAULT 100,
  actif              BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un code système unique ; un code custom unique PAR utilisateur (hors corbeille).
CREATE UNIQUE INDEX IF NOT EXISTS depense_categories_code_sys_uniq
  ON public.depense_categories (code) WHERE user_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS depense_categories_code_user_uniq
  ON public.depense_categories (user_id, code) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.depense_categories ENABLE ROW LEVEL SECURITY;

-- SELECT : catégories système (user_id IS NULL) + les siennes (pattern live
-- « entreprise + dirigeant », identique aux policies réelles de achats).
DROP POLICY IF EXISTS depense_categories_select ON public.depense_categories;
CREATE POLICY depense_categories_select ON public.depense_categories FOR SELECT
  USING (
    user_id IS NULL
    OR ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
        AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  );

-- Écriture : uniquement ses catégories CUSTOM (user_id NOT NULL). Les
-- catégories système ne sont modifiables que par service_role (aucune policy
-- d'écriture ne les couvre : user_id IS NULL ne passe jamais les checks).
DROP POLICY IF EXISTS depense_categories_insert ON public.depense_categories;
CREATE POLICY depense_categories_insert ON public.depense_categories FOR INSERT
  WITH CHECK (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  );
DROP POLICY IF EXISTS depense_categories_update ON public.depense_categories;
CREATE POLICY depense_categories_update ON public.depense_categories FOR UPDATE
  USING (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  )
  WITH CHECK (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  );
DROP POLICY IF EXISTS depense_categories_delete ON public.depense_categories;
CREATE POLICY depense_categories_delete ON public.depense_categories FOR DELETE
  USING (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  );

-- ─── Seed des 19 catégories système ─────────────────────────────────────────
-- Corrections de la confrontation appliquées : télécom fusionné dans
-- abonnements, salaires et local retirés (artisan solo). NOT EXISTS = rejouable.
INSERT INTO public.depense_categories (user_id, code, label, groupe, ventilation_urssaf, compte_pcg, est_privee, icone, ordre)
SELECT NULL, v.code, v.label, v.groupe, v.ventilation, v.pcg, v.privee, v.icone, v.ordre
FROM (VALUES
  -- Recettes (portent la ventilation URSSAF)
  ('recette_prestation',  'Recette — prestations (main d''œuvre)',            'recette', 'prestation',  '706', FALSE, 'hammer',            10),
  ('recette_marchandise', 'Recette — matériel / marchandises revendus',       'recette', 'marchandise', '707', FALSE, 'package',           20),
  ('recette_autre',       'Autre recette (subvention, intérêts…)',            'recette', NULL,          '758', FALSE, 'coins',             30),
  -- Dépenses professionnelles
  ('materiaux',           'Matériaux & fournitures chantier',                 'depense', NULL,          '601', FALSE, 'layers',            40),
  ('outillage',           'Outillage & petit matériel',                       'depense', NULL,          '606', FALSE, 'wrench',            50),
  ('sous_traitance',      'Sous-traitance',                                   'depense', NULL,          '611', FALSE, 'users',             60),
  ('carburant',           'Carburant & péages',                               'depense', NULL,          '606', FALSE, 'fuel',              70),
  ('vehicule',            'Véhicule (entretien, assurance, réparations)',     'depense', NULL,          '615', FALSE, 'car',               80),
  ('assurances_pro',      'Assurances pro (décennale, RC)',                   'depense', NULL,          '616', FALSE, 'shield',            90),
  ('urssaf',              'Cotisations sociales URSSAF',                      'depense', NULL,          '646', FALSE, 'landmark',         100),
  ('taxes',               'Impôts & taxes (CFE…)',                            'depense', NULL,          '63',  FALSE, 'receipt',          110),
  ('abonnements',         'Abonnements, téléphone & internet',                'depense', NULL,          '626', FALSE, 'smartphone',       120),
  ('frais_bancaires',     'Frais bancaires',                                  'depense', NULL,          '627', FALSE, 'piggy-bank',       130),
  ('publicite',           'Publicité & communication',                        'depense', NULL,          '623', FALSE, 'megaphone',        140),
  ('deplacements',        'Repas & déplacements',                             'depense', NULL,          '625', FALSE, 'utensils',         150),
  ('autre_depense',       'Autre dépense pro',                                'depense', NULL,          '6',   FALSE, 'more-horizontal',  160),
  -- Neutres (exclus du CA et des dépenses pro)
  ('apport_perso',        'Apport personnel',                                 'neutre',  NULL,          '108', FALSE, 'arrow-down-circle',170),
  ('prive',               'Privé / non professionnel',                        'neutre',  NULL,          NULL,  TRUE,  'home',             180),
  ('virement_interne',    'Virement interne / mouvement de caisse',           'neutre',  NULL,          '58',  FALSE, 'repeat',           190)
) AS v(code, label, groupe, ventilation, pcg, privee, icone, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.depense_categories c
  WHERE c.code = v.code AND c.user_id IS NULL AND c.deleted_at IS NULL
);

-- ─── 2) Table des règles de catégorisation ──────────────────────────────────
-- Périmètre V1 (confrontation §5) : règles SYSTÈME seules. La colonne source
-- accepte déjà 'user' et 'apprise' pour ne pas re-migrer en V1.5, mais AUCUNE
-- règle apprise n'est créée en V1.
CREATE TABLE IF NOT EXISTS public.categorisation_regles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),   -- NULL = règle SYSTÈME
  pattern         TEXT NOT NULL CHECK (char_length(pattern) BETWEEN 2 AND 60),
                  -- mot-clé cherché dans le libellé — PAS de regex (DoS possible)
  type_match      TEXT NOT NULL DEFAULT 'contient' CHECK (type_match IN ('contient','commence_par')),
  categorie_id    UUID NOT NULL REFERENCES public.depense_categories(id),
  chantier_id     UUID REFERENCES public.chantiers(id),  -- règle temporaire « tout Rexel → chantier X »
  sens            TEXT CHECK (sens IN ('debit','credit')),  -- NULL = les deux
  priorite        INT NOT NULL DEFAULT 100,          -- plus petit = gagne (user 100 < système ~900)
  source          TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('system','user','apprise')),
  nb_applications INT NOT NULL DEFAULT 0,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categorisation_regles_user_idx
  ON public.categorisation_regles (user_id, priorite) WHERE actif AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.categorisation_regles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.categorisation_regles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.categorisation_regles ENABLE ROW LEVEL SECURITY;

-- SELECT : règles système + les siennes ; écriture : les siennes uniquement.
DROP POLICY IF EXISTS categorisation_regles_select ON public.categorisation_regles;
CREATE POLICY categorisation_regles_select ON public.categorisation_regles FOR SELECT
  USING (
    user_id IS NULL
    OR ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
        AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  );
DROP POLICY IF EXISTS categorisation_regles_insert ON public.categorisation_regles;
CREATE POLICY categorisation_regles_insert ON public.categorisation_regles FOR INSERT
  WITH CHECK (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  );
DROP POLICY IF EXISTS categorisation_regles_update ON public.categorisation_regles;
CREATE POLICY categorisation_regles_update ON public.categorisation_regles FOR UPDATE
  USING (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  )
  WITH CHECK (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  );
DROP POLICY IF EXISTS categorisation_regles_delete ON public.categorisation_regles;
CREATE POLICY categorisation_regles_delete ON public.categorisation_regles FOR DELETE
  USING (
    user_id IS NOT NULL
    AND (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
    AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')
  );

-- ─── Seed des règles SYSTÈME (~20) ──────────────────────────────────────────
-- Les règles ne font que SUGGÉRER : le pointage confirme. Match sur
-- upper(libelle_banque). URSSAF passe en priorité 880 pour gagner sur les
-- patterns plus génériques (ex. « COMMISSION » ne doit pas capter une ligne
-- URSSAF avant elle).
INSERT INTO public.categorisation_regles (user_id, pattern, type_match, categorie_id, sens, priorite, source)
SELECT NULL, v.pattern, 'contient', c.id, v.sens, v.priorite, 'system'
FROM (VALUES
  ('URSSAF',            'urssaf',          'debit', 880),
  ('DGFIP',             'taxes',           'debit', 890),
  ('IMPOT',             'taxes',           'debit', 890),
  ('REXEL',             'materiaux',       'debit', 900),
  ('SONEPAR',           'materiaux',       'debit', 900),
  ('YESSS',             'materiaux',       'debit', 900),
  ('POINT P',           'materiaux',       'debit', 900),
  ('LEROY MERLIN',      'materiaux',       'debit', 900),
  ('BRICO',             'materiaux',       'debit', 900),
  ('TOTALENERGIES',     'carburant',       'debit', 900),
  ('ESSO',              'carburant',       'debit', 900),
  ('AVIA',              'carburant',       'debit', 900),
  ('AUTOROUTE',         'carburant',       'debit', 900),
  ('AXA',               'assurances_pro',  'debit', 900),
  ('MAAF',              'assurances_pro',  'debit', 900),
  ('ALLIANZ',           'assurances_pro',  'debit', 900),
  ('ORANGE',            'abonnements',     'debit', 910),
  ('SFR',               'abonnements',     'debit', 910),
  ('BOUYGUES TELECOM',  'abonnements',     'debit', 910),
  ('FREE MOBILE',       'abonnements',     'debit', 910),
  ('FRAIS BANC',        'frais_bancaires', 'debit', 920),
  ('COTISATION CARTE',  'frais_bancaires', 'debit', 920),
  ('COMMISSION',        'frais_bancaires', 'debit', 930),
  ('RETRAIT DAB',       'prive',           'debit', 940)
) AS v(pattern, code_categorie, sens, priorite)
JOIN public.depense_categories c
  ON c.code = v.code_categorie AND c.user_id IS NULL AND c.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorisation_regles r
  WHERE r.pattern = v.pattern AND r.source = 'system' AND r.deleted_at IS NULL
);

-- ─── VÉRIFICATION après application ─────────────────────────────────────────
-- SELECT groupe, count(*) FROM public.depense_categories WHERE user_id IS NULL GROUP BY 1;
--   → recette 3, depense 13, neutre 3 (total 19).
-- SELECT count(*) FROM public.categorisation_regles WHERE source='system';
--   → 24.

-- ============================================================================
-- ROLLBACK (ordre inverse des dépendances FK) :
--
-- DROP TABLE IF EXISTS public.categorisation_regles;
-- DROP TABLE IF EXISTS public.depense_categories;
--   (⚠️ si les fichiers 04/05 sont déjà appliqués, il faut d'abord détacher
--    les FK : banque_mouvements.categorie_id et achats.categorie_id)
-- ============================================================================
