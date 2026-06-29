-- Migration 2026-06-29 — Journal des envois de documents du coffre-fort.
-- Appliquee en prod via MCP Supabase (project skuqfqnfitrovzeexwsr).
--
-- Objectif : tracer CHAQUE envoi d'un document du coffre (decennale, RIB...)
-- pour que l'artisan soit couvert (preuve de qui a recu quoi et quand).
--
-- Securite : table INSERT-ONLY cote utilisateur. Une seule policy (SELECT) :
-- l'artisan lit ses propres envois mais ne peut ni les modifier ni les
-- supprimer. Les insertions se font uniquement via le service_role depuis
-- la route serveur /api/documents/envoyer (qui contourne la RLS).

create table if not exists public.documents_envois (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents_stockes(id) on delete set null,
  document_nom text not null,
  destinataire_nom text,
  destinataire_email text not null,
  mode text not null default 'manuel',
  devis_id uuid,
  message text,
  created_at timestamptz not null default now()
);

alter table public.documents_envois enable row level security;

create policy "de_select" on public.documents_envois
  for select using (user_id = auth.uid());

create index if not exists documents_envois_user_created_idx
  on public.documents_envois (user_id, created_at desc);
create index if not exists documents_envois_document_idx
  on public.documents_envois (document_id);
