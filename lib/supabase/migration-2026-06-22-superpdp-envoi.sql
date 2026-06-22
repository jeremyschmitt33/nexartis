-- ============================================================
--  Etape 3 SUPER PDP : envoi electronique d'une facture
--  Colonnes de SUIVI ajoutees a la table factures.
--  ADDITIF : colonnes NULL par defaut -> aucun impact sur l'existant.
--
--  Deja applique en base via l'outil de migration (2026-06-22).
--  Ce fichier sert d'archive / de re-execution si besoin.
-- ============================================================

alter table public.factures add column if not exists superpdp_invoice_id text;   -- id renvoye par SUPER PDP
alter table public.factures add column if not exists superpdp_status text;        -- ex: 'deposee'
alter table public.factures add column if not exists superpdp_envoyee_at timestamptz; -- horodatage de l'envoi
