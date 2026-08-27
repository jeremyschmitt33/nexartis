-- Migration 2026-06-29 — Nouveau type de document : "courrier" (courrier libre).
-- Appliquee en prod via MCP Supabase (project skuqfqnfitrovzeexwsr).
--
-- Additif : on elargit la contrainte CHECK de documents_types.type pour
-- autoriser 'courrier' en plus de 'cgv' et 'pv_reception'. Aucune donnee
-- existante n'est invalidee (l'ancien jeu de valeurs reste autorise).

alter table public.documents_types
  drop constraint if exists documents_types_type_check;

alter table public.documents_types
  add constraint documents_types_type_check
  check (type = any (array['cgv'::text, 'pv_reception'::text, 'courrier'::text]));
