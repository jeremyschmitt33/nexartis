-- ============================================================================
-- Fichier  : 2026-07-12-banque-01-regime-fiscal-parametres.sql
-- Module   : Dépenses & Banque V1 — fichier 1/7
-- POURQUOI : Le module calcule l'URSSAF et surveille les seuils TVA/micro.
--            Ces taux et seuils changent avec la loi : ils doivent vivre en
--            base, DATÉS (date_debut/date_fin), jamais en dur dans le code.
--            Le régime fiscal de l'entreprise (micro par défaut) conditionne
--            tout le module (pas de TVA déductible en micro, etc.).
-- QUOI     : 1) colonne entreprises.regime_fiscal
--            2) table parametres_fiscaux + RLS (lecture pour tous, écriture
--               réservée au service_role — comme superpdp_sync_state)
--            3) seed des taux URSSAF et seuils TVA/micro en vigueur au
--               01/01/2026 (⚠️ à re-vérifier sur service-public.fr AVANT
--               d'appliquer : ces montants sont revalorisés périodiquement)
-- IDEMPOTENT : oui (IF NOT EXISTS + ON CONFLICT DO NOTHING).
-- ============================================================================

-- ─── 1) Régime fiscal de l'entreprise ───────────────────────────────────────
-- 'micro' = micro-entreprise (cas de Daniela) ; les régimes réels arriveront
-- plus tard. NB : entreprises.franchise_tva (booléen) existe déjà et reste
-- orthogonal (un micro peut sortir de franchise en dépassant le seuil).
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS regime_fiscal TEXT NOT NULL DEFAULT 'micro'
    CHECK (regime_fiscal IN ('micro','reel_simplifie','reel_normal'));

-- ─── 2) Table des paramètres fiscaux datés ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parametres_fiscaux (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL,           -- identifiant stable pour le code applicatif
  libelle     TEXT,                    -- description lisible par un humain
  valeur      NUMERIC(12,4),           -- taux en % ou montant en euros
  valeur_json JSONB,                   -- pour les barèmes à tranches (IK, plus tard)
  date_debut  DATE NOT NULL,           -- date d'entrée en vigueur
  date_fin    DATE,                    -- NULL = toujours en vigueur
  source_ref  TEXT,                    -- URL officielle de référence (traçabilité)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un même code ne peut pas avoir deux lignes qui démarrent le même jour.
CREATE UNIQUE INDEX IF NOT EXISTS parametres_fiscaux_code_periode_uniq
  ON public.parametres_fiscaux (code, date_debut);

ALTER TABLE public.parametres_fiscaux ENABLE ROW LEVEL SECURITY;

-- Lecture libre (données publiques légales), AUCUNE policy d'écriture :
-- seuls les scripts service_role (ou le SQL editor) peuvent modifier les taux.
DROP POLICY IF EXISTS parametres_fiscaux_select ON public.parametres_fiscaux;
CREATE POLICY parametres_fiscaux_select ON public.parametres_fiscaux
  FOR SELECT USING (TRUE);

-- ─── 3) Seed des valeurs en vigueur au 01/01/2026 ───────────────────────────
-- ⚠️ AVANT D'APPLIQUER : vérifier chaque montant sur les pages source_ref.
--    Convention : les taux sont stockés en POURCENTAGE (21.2 = 21,2 %),
--    les seuils en EUROS.
INSERT INTO public.parametres_fiscaux (code, libelle, valeur, date_debut, source_ref)
VALUES
  ('urssaf_bic_prestation',
   'Taux micro-social — prestations de services BIC (artisanales/commerciales), en %',
   21.2000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F36232'),
  ('urssaf_bic_marchandise',
   'Taux micro-social — ventes de marchandises (BIC), en %',
   12.3000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F36232'),
  ('tva_franchise_seuil_base_prestation',
   'Franchise en base de TVA — seuil de base prestations de services, en €',
   37500.0000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F21746'),
  ('tva_franchise_seuil_majore_prestation',
   'Franchise en base de TVA — seuil majoré prestations de services, en €',
   41250.0000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F21746'),
  ('tva_franchise_seuil_base_vente',
   'Franchise en base de TVA — seuil de base ventes de marchandises, en €',
   85000.0000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F21746'),
  ('tva_franchise_seuil_majore_vente',
   'Franchise en base de TVA — seuil majoré ventes de marchandises, en €',
   93500.0000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F21746'),
  -- ⚠️ Plafonds micro : NOUVELLE période triennale 2026-2028 (revalorisation
  -- au 01/01/2026) : 83 600 € / 203 100 € — et NON plus 77 700 / 188 700
  -- (valeurs 2023-2025). Vérifié le 12/07/2026 (autoentrepreneur.urssaf.fr +
  -- LégiFiscal « nouveaux seuils micro-entreprises 2026 »).
  ('micro_plafond_ca_prestation',
   'Plafond de chiffre d''affaires micro-entreprise — prestations de services BIC, en € (période 2026-2028)',
   83600.0000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F32353'),
  ('micro_plafond_ca_vente',
   'Plafond de chiffre d''affaires micro-entreprise — ventes de marchandises, en € (période 2026-2028)',
   203100.0000, '2026-01-01',
   'https://entreprendre.service-public.fr/vosdroits/F32353')
ON CONFLICT (code, date_debut) DO NOTHING;

-- ─── VÉRIFICATION après application ─────────────────────────────────────────
-- SELECT code, valeur, date_debut FROM public.parametres_fiscaux ORDER BY code;
--   → doit renvoyer 8 lignes.
-- SELECT regime_fiscal, count(*) FROM public.entreprises GROUP BY 1;
--   → toutes les entreprises doivent être en 'micro'.

-- ============================================================================
-- ROLLBACK (à exécuter uniquement pour annuler CE fichier) :
--
-- DROP TABLE IF EXISTS public.parametres_fiscaux;
-- ALTER TABLE public.entreprises DROP COLUMN IF EXISTS regime_fiscal;
-- ============================================================================
