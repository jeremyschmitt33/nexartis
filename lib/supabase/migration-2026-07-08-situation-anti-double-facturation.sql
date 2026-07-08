-- ============================================================================
--  Nexartis — Anti double-facturation des FACTURES DE SITUATION
--  Date : 2026-07-08
--
--  CONTEXTE (constaté en base + en code) :
--   1. `factures.devis_id` existe déjà (FK -> devis, ON DELETE SET NULL) mais la
--      page « nouvelle facture » ne la renseignait JAMAIS pour une situation :
--      le lien facture <-> devis reposait sur la chaîne `devis_ref` (fragile :
--      renommage, doublon de numéro).
--   2. Aucune contrainte n'empêchait deux situations de même numéro sur un même
--      devis (concurrence : 2e appareil, associé, onglet dupliqué).
--
--  CE FICHIER :
--   A. Rend le dépôt autoportant (colonnes jsonb écrites par le code, jamais
--      versionnées jusqu'ici).
--   B. Backfille `devis_id` sur les situations existantes AVANT que le code ne
--      bascule ses requêtes d'historique sur cette colonne.
--   C. Pose le filet : index UNIQUE PARTIEL (devis_id, numero_situation).
--
--  ⚠️ PIÈGE MAJEUR — le prédicat `type = 'situation'` est OBLIGATOIRE.
--     13 factures STANDARD portent `numero_situation = 1` (valeur DEFAULT d'une
--     ancienne migration), dont plusieurs sur un même devis : un index sans ce
--     filtre ÉCHOUE à se créer (2 groupes de collisions réelles constatés).
--
--  ⚠️ La clé N'INCLUT PAS `user_id`. La RLS de `factures` scope par ENTREPRISE,
--     et `insertRow` écrit `user_id = créateur`. Inclure `user_id` rendrait deux
--     dirigeants de la même entreprise « distincts » et l'index ne bloquerait
--     RIEN. `devis_id` (uuid) identifie déjà un devis unique d'une entreprise.
--
--  ORDRE : exécuter ce fichier AVANT de déployer le code qui écrit `devis_id`.
--  RÉVERSIBLE : voir le bloc ROLLBACK en bas.
-- ============================================================================

-- ── A. Colonnes écrites par le code mais jamais versionnées (idempotent) ────
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS situation_lignes jsonb;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS plan_images jsonb;

COMMENT ON COLUMN public.factures.situation_lignes IS
  'Detail par ligne de devis facture dans cette situation : [{devis_ligne_id, montant_ht}]. Recalcule au save, jamais fige.';
COMMENT ON COLUMN public.factures.plan_images IS
  'Snapshot(s) du plan colorie (avancement) annexe(s) a la facture de situation : [{titre, dataUrl}].';


-- ── B. Backfill de devis_id sur les situations existantes ───────────────────
-- Jointure 1:1 garantie : index UNIQUE (user_id, numero) sur `devis`.
-- `d.user_id = f.user_id` empeche toute fuite multi-tenant.
-- (Au 08/07/2026 : 0 ligne concernee -- la seule situation jamais creee est en
--  corbeille et son devis_ref ne resout aucun devis. Le backfill est un no-op,
--  mais il DOIT rester ici pour toute base ou des situations existent.)
UPDATE public.factures f
SET devis_id = d.id
FROM public.devis d
WHERE f.type      = 'situation'
  AND f.devis_id IS NULL
  AND f.devis_ref IS NOT NULL
  AND d.user_id   = f.user_id
  AND d.numero    = f.devis_ref;


-- ── C. Filet anti double-facturation ────────────────────────────────────────
-- Deux situations ne peuvent pas porter le meme numero sur le meme devis.
-- Partiel : ne contraint QUE les situations vivantes reliees a un devis.
-- Une situation mise a la corbeille (deleted_at) libere son numero.
CREATE UNIQUE INDEX IF NOT EXISTS factures_situation_unique_par_devis
  ON public.factures (devis_id, numero_situation)
  WHERE type = 'situation'
    AND devis_id IS NOT NULL
    AND deleted_at IS NULL;

-- Bouche le trou NULL de l'index ci-dessus : en Postgres, NULL <> NULL, donc deux
-- situations a numero_situation NULL sur le meme devis y echapperaient.
-- Les factures standard/avoir ne sont pas concernees (type <> 'situation').
ALTER TABLE public.factures
  DROP CONSTRAINT IF EXISTS factures_situation_numero_obligatoire;
ALTER TABLE public.factures
  ADD CONSTRAINT factures_situation_numero_obligatoire
  CHECK (type <> 'situation' OR numero_situation IS NOT NULL)
  NOT VALID;   -- NOT VALID : ne re-scanne pas l'historique, ne contraint que les
               -- nouvelles ecritures. VALIDATE plus tard si besoin.


-- ── D. NOTE — pourquoi PAS de trigger « devis facture non supprimable » ─────
-- Un BEFORE DELETE sur `devis` levant une exception a ete envisage puis ECARTE :
--  * DANGER : la suppression d'un compte (auth.users) cascade vers `devis` ET
--    `factures`. L'ordre des cascades n'est pas garanti ; si les devis partent en
--    premier, le trigger verrait encore les factures et ferait ECHOUER toute la
--    suppression de compte (obligation RGPD). Remede pire que le mal.
--  * INUTILE : le code lit desormais l'historique par `devis_id` UNION `devis_ref`
--    (cf. chargerSituationsDuDevis). Si un devis purge remet `devis_id` a NULL, la
--    reference TEXTE `devis_ref` survit et retrouve les situations : le cumul
--    « deja facture » ne repart JAMAIS de zero. Le seul effet d'une purge est la
--    perte de la protection par index (devis_id NULL -> index partiel inoperant),
--    ce qui est le meme risque residuel, connu et documente, que le cas « devis
--    ambigu » (voir le commentaire sur devis_id dans factures/nouveau/page.tsx).
-- La garde cote client (lib/hooks.tsx purgeCorbeille) reste, en defense en
-- profondeur, pour conserver le devis quand l'appelant a le droit de le verifier.


-- ── Verifications post-migration (a lancer manuellement) ────────────────────
-- 1) L'index existe :
--    SELECT indexname FROM pg_indexes
--    WHERE tablename='factures' AND indexname='factures_situation_unique_par_devis';
-- 2) Aucune situation vivante orpheline (devis_ref resoluble mais devis_id NULL) :
--    SELECT f.id, f.numero, f.devis_ref FROM public.factures f
--    WHERE f.type='situation' AND f.deleted_at IS NULL AND f.devis_id IS NULL
--      AND EXISTS (SELECT 1 FROM public.devis d
--                  WHERE d.user_id=f.user_id AND d.numero=f.devis_ref);
--    -- doit renvoyer 0 ligne.


-- 3) Le CHECK est bien en place :
--    SELECT conname, convalidated FROM pg_constraint
--    WHERE conrelid='public.factures'::regclass
--      AND conname='factures_situation_numero_obligatoire';


-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_situation_numero_obligatoire;
-- DROP INDEX IF EXISTS public.factures_situation_unique_par_devis;
-- (Le backfill n'est pas annule : devis_id renseigne est une donnee correcte.)
