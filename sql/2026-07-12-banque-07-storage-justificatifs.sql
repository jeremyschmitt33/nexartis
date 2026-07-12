-- ============================================================================
-- Fichier  : 2026-07-12-banque-07-storage-justificatifs.sql
-- Module   : Dépenses & Banque V1 — fichier 7/7
-- POURQUOI : Les justificatifs (tickets, factures fournisseur) ont besoin d'un
--            bucket PRIVÉ. L'upload actuel de la page Achats est factice
--            (vérifié : zéro appel storage) — ce bucket sert au vrai circuit,
--            pour les mouvements bancaires ET la page Achats.
-- QUOI     : bucket 'justificatifs' (privé, 5 Mo, pdf/jpeg/png/webp) +
--            4 policies storage owner-based (1er segment du chemin = user_id).
-- DÉCISION jeremy n°4 : les HEIC iPhone sont CONVERTIS EN JPEG côté
--            navigateur AVANT upload (+ compression) — le bucket n'accepte
--            donc jamais de HEIC, et 5 Mo suffisent après compression.
-- CONVENTION DE CHEMINS (côté app) :
--            {user_id}/{aaaa}/{mm}/{entite}-{entite_id}/{timestamp}-{nom}.{ext}
--            Affichage : URLs SIGNÉES à la demande (createSignedUrl, 60 s) —
--            jamais d'URL publique, on stocke uniquement le path en base.
-- NOTE MULTI-UTILISATEUR : la policy auth.uid() ne donne accès qu'à
--            l'uploader. Cohérent en V1 (tables financières déjà réservées au
--            dirigeant) ; à faire évoluer vers les helpers entreprise si un
--            2ᵉ dirigeant apparaît. Divergence connue et assumée.
-- PRÉCÉDENT : les policies storage créées en SQL fonctionnent dans ce projet
--            (rpc_realisations_* et myrenov_* existent en live). Si jamais le
--            CREATE POLICY échoue avec « must be owner of table objects »,
--            suivre le plan B dashboard décrit en bas de fichier.
-- IDEMPOTENT : oui.
-- ============================================================================

-- ─── 1) Le bucket privé ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'justificatifs', 'justificatifs',
  FALSE,                      -- PRIVÉ : accès uniquement par URL signée
  5242880,                    -- 5 Mo (Clementine plafonne à 2 Mo)
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2) Les 4 policies (owner-based : 1er dossier du chemin = user_id) ──────
DROP POLICY IF EXISTS justificatifs_insert ON storage.objects;
CREATE POLICY justificatifs_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'justificatifs'
          AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS justificatifs_select ON storage.objects;
CREATE POLICY justificatifs_select ON storage.objects FOR SELECT
  USING (bucket_id = 'justificatifs'
     AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS justificatifs_update ON storage.objects;
CREATE POLICY justificatifs_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'justificatifs'
     AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'justificatifs'
          AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS justificatifs_delete ON storage.objects;
CREATE POLICY justificatifs_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'justificatifs'
     AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── VÉRIFICATION après application ─────────────────────────────────────────
-- SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'justificatifs';
--   → 1 ligne, public = false, 5242880.
-- SELECT policyname FROM pg_policies
--  WHERE schemaname = 'storage' AND tablename = 'objects'
--    AND policyname LIKE 'justificatifs%';
--   → 4 lignes.

-- ============================================================================
-- PLAN B — si le CREATE POLICY échoue dans le SQL editor
-- (« must be owner of table objects » sur certains projets récents) :
-- création via le dashboard Supabase, pas à pas :
--   1. Ouvrir https://supabase.com/dashboard → projet Nexartis
--      (skuqfqnfitrovzeexwsr).
--   2. Menu de gauche : cliquer sur « Storage » (icône dossier).
--   3. Bouton vert « New bucket » : nom = justificatifs, laisser
--      « Public bucket » DÉCOCHÉ, ouvrir « Additional configuration » :
--      Restrict file upload size = 5 MB ; Allowed MIME types =
--      application/pdf, image/jpeg, image/png, image/webp. Cliquer « Save ».
--   4. Toujours dans Storage : onglet « Policies » (en haut), section du
--      bucket justificatifs → « New policy » → « For full customization ».
--   5. Créer 4 policies (une par opération SELECT / INSERT / UPDATE /
--      DELETE), nom = justificatifs_select, justificatifs_insert, etc.,
--      rôle cible = authenticated, et coller comme définition (USING et/ou
--      WITH CHECK selon l'opération) :
--        bucket_id = 'justificatifs'
--        AND (storage.foldername(name))[1] = auth.uid()::text
--   6. Vérifier avec la requête de VÉRIFICATION ci-dessus.
-- ============================================================================

-- ============================================================================
-- ROLLBACK :
--
-- DROP POLICY IF EXISTS justificatifs_insert ON storage.objects;
-- DROP POLICY IF EXISTS justificatifs_select ON storage.objects;
-- DROP POLICY IF EXISTS justificatifs_update ON storage.objects;
-- DROP POLICY IF EXISTS justificatifs_delete ON storage.objects;
-- -- Vider le bucket AVANT de le supprimer (sinon la suppression échoue) :
-- DELETE FROM storage.objects WHERE bucket_id = 'justificatifs';
-- DELETE FROM storage.buckets WHERE id = 'justificatifs';
-- ============================================================================
