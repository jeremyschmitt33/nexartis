-- ============================================================
-- RECEPTION e-facture (obligation 01/09/2026) — Brique 1 (V2 post-confrontation)
-- APPLIQUEE EN PRODUCTION via MCP Supabase le 2026-06-25 (nom: reception_efacture_2026_06_25).
-- Versionnee ici pour tracabilite / re-execution.
--
-- Cree : table factures_recues (RLS multi-entreprise dirigeant) + superpdp_sync_state
-- (server-only) + bucket prive Storage 'factures-recues'.
-- Correctifs confrontateur : superpdp_invoice_id en bigint (curseur coherent, anti
-- path-traversal), type_document (facture/avoir), tva_details jsonb (multi-taux),
-- CHECK statut elargi (rejetee/irrecevable/en_attente/classee), index unique TOTAL.
-- ============================================================

create table if not exists public.factures_recues (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  superpdp_invoice_id bigint not null,
  superpdp_direction  text not null default 'in',
  emetteur_nom        text,
  emetteur_siren      text,
  emetteur_siret      text,
  emetteur_tva_intra  text,
  type_document       text not null default 'facture' check (type_document in ('facture','avoir')),
  numero              text,
  date_emission       date,
  date_echeance       date,
  devise              text not null default 'EUR',
  montant_ht          numeric,
  montant_tva         numeric,
  montant_ttc         numeric,
  tva_details         jsonb,
  statut              text not null default 'recue'
                      check (statut in ('recue','consultee','approuvee','litige','refusee','encaissee','rejetee','irrecevable','en_attente','classee')),
  statut_pdp_code     text,
  statut_pdp_text     text,
  refus_motif_code    text,
  refus_motif_text    text,
  refus_at            timestamptz,
  fichier_path        text,
  fichier_format      text,
  fichier_taille      bigint,
  fournisseur_id      uuid references public.fournisseurs(id) on delete set null,
  achat_id            uuid references public.achats(id)       on delete set null,
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create unique index if not exists factures_recues_uniq_pdp
  on public.factures_recues (user_id, superpdp_invoice_id);
create index if not exists factures_recues_user_statut
  on public.factures_recues (user_id, statut) where deleted_at is null;
create index if not exists factures_recues_date
  on public.factures_recues (date_emission);

alter table public.factures_recues enable row level security;

create policy factures_recues_select on public.factures_recues for select
  using ((entreprise_of_user(user_id) in (select current_entreprise_ids()))
         and (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
create policy factures_recues_insert on public.factures_recues for insert
  with check ((entreprise_of_user(user_id) in (select current_entreprise_ids()))
         and (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
create policy factures_recues_update on public.factures_recues for update
  using ((entreprise_of_user(user_id) in (select current_entreprise_ids()))
         and (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  with check ((entreprise_of_user(user_id) in (select current_entreprise_ids()))
         and (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
create policy factures_recues_delete on public.factures_recues for delete
  using ((entreprise_of_user(user_id) in (select current_entreprise_ids()))
         and (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));

create table if not exists public.superpdp_sync_state (
  user_id              uuid primary key,
  last_seen_invoice_id bigint,
  last_sync_at         timestamptz,
  last_sync_status     text,
  last_sync_error      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.superpdp_sync_state enable row level security; -- 0 policy = service_role only

insert into storage.buckets (id, name, public)
values ('factures-recues', 'factures-recues', false)
on conflict (id) do nothing;
