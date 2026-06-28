-- ============================================================
-- Migration : verrou anti-doublon / idempotence des uploads photo
-- Date : 2026-06-28
-- Appliquee en base via MCP Supabase (migration "photos_unique_user_r2key").
-- Trace (la base est deja a jour). 0 doublon existant verifie avant application.
-- Permet au confirm d'upload (rapport ET chantier) d'etre idempotent :
-- un double-tap / retry apres crash ne cree pas de 2e ligne (ON CONFLICT 23505).
-- ============================================================
CREATE UNIQUE INDEX uq_photos_user_r2key ON public.photos (user_id, r2_key);
