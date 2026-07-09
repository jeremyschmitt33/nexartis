-- ============================================================================
-- 2026-07-09 — Colonnes dediees pour l'import (zero perte, bien triee)
-- ----------------------------------------------------------------------------
-- Contexte : l'import Excel/CSV rangeait pays + n TVA (clients) et
-- commentaire + code (prestations) dans des champs texte generiques (notes /
-- designation) faute de colonnes dediees. On leur donne leur vraie colonne.
--
-- Ajout additif et non destructif (colonnes nullables). RLS inchangee : les
-- policies existantes sont au niveau LIGNE (user_id), elles couvrent
-- automatiquement les nouvelles colonnes.
--
-- Deja appliquee en production le 2026-07-09 (Supabase project skuqfqnfitrovzeexwsr).
-- ============================================================================

ALTER TABLE public.clients     ADD COLUMN IF NOT EXISTS pays        text;
ALTER TABLE public.clients     ADD COLUMN IF NOT EXISTS tva_intra   text;
ALTER TABLE public.prestations ADD COLUMN IF NOT EXISTS reference   text;
ALTER TABLE public.prestations ADD COLUMN IF NOT EXISTS description text;
