-- ============================================================================
-- Retenue de garantie sur les FACTURES DE SITUATION (2026-07-13)
-- ============================================================================
-- POURQUOI : la loi du 16/07/1971 autorise le maître d'ouvrage (le client) à
-- retenir jusqu'à 5 % du montant HT d'une situation de travaux, en garantie de
-- la bonne exécution. Le moteur de calcul (lib/situation.ts) sait déjà produire
-- ce montant (retenueGarantieHt, plafonné à 5 %) ; il manque seulement deux
-- colonnes pour le STOCKER sur la facture, afin de le réafficher à l'identique
-- sur le PDF et le rendu HTML du dashboard.
--
-- QUOI :
--   - retenue_garantie_pct : le taux appliqué (0 à 5), NULL si aucune retenue.
--   - retenue_garantie_ht  : le montant HT effectivement retenu (snapshot figé).
--
-- Le montant net à payer affiché = Total TTC − retenue_garantie_ht (via le canal
-- générique `deductions` partagé PDF/HTML, exactement comme un avoir imputé).
--
-- IMPACT : purement ADDITIF. Les colonnes sont NULLABLE et sans valeur par
-- défaut → toutes les factures existantes et toutes les factures standard
-- restent STRICTEMENT inchangées (aucune ligne « retenue » n'est rendue tant que
-- retenue_garantie_ht est NULL ou 0).
--
-- SÉCURITÉ / RLS : aucune nouvelle policy à créer. `factures` a déjà ses policies
-- financières ; l'ajout de colonnes hérite automatiquement des règles existantes.
--
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS → ré-exécutable sans erreur.
--
-- RÉVERSIBILITÉ (rollback) :
--   ALTER TABLE public.factures
--     DROP COLUMN IF EXISTS retenue_garantie_pct,
--     DROP COLUMN IF EXISTS retenue_garantie_ht;
-- ============================================================================

-- --- CONTRÔLE AVANT ---------------------------------------------------------
-- Nombre de factures (référence) + colonnes déjà présentes ou non.
SELECT count(*) AS factures_total FROM public.factures;

SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'factures'
  AND column_name IN ('retenue_garantie_pct', 'retenue_garantie_ht');

-- --- MIGRATION --------------------------------------------------------------
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS retenue_garantie_pct NUMERIC(4,2)
    CHECK (retenue_garantie_pct IS NULL OR (retenue_garantie_pct >= 0 AND retenue_garantie_pct <= 5)),
  ADD COLUMN IF NOT EXISTS retenue_garantie_ht NUMERIC(12,2);

COMMENT ON COLUMN public.factures.retenue_garantie_pct
  IS 'Taux de retenue de garantie appliqué (0..5 %, plafond légal loi 16/07/1971). NULL = aucune retenue.';
COMMENT ON COLUMN public.factures.retenue_garantie_ht
  IS 'Montant HT retenu en garantie (snapshot figé). Déduit du net à payer, TVA/TTC restent pleins.';

-- --- CONTRÔLE APRÈS ---------------------------------------------------------
-- Les deux colonnes doivent maintenant exister avec le bon type/échelle.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'factures'
  AND column_name IN ('retenue_garantie_pct', 'retenue_garantie_ht')
ORDER BY column_name;

-- Vérifie que la contrainte CHECK sur le plafond 5 % est bien en place.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.factures'::regclass
  AND pg_get_constraintdef(oid) ILIKE '%retenue_garantie_pct%';
