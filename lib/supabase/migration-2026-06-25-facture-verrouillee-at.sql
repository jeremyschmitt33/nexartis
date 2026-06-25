-- ============================================================
-- FACTURE : verrouillage a la TRANSMISSION (et non plus a l'emission)
-- APPLIQUEE EN PRODUCTION via MCP Supabase le 2026-06-25
-- (nom: factures_verrouillee_at_2026_06_25). Versionnee ici pour tracabilite.
--
-- Regle : une facture reste MODIFIABLE tant que verrouillee_at IS NULL,
-- meme si elle est deja emise/numerotee. Elle se verrouille a la 1re action
-- de transmission (envoi email, facture electronique, telechargement PDF,
-- envoi electronique SUPER PDP) -> verrouillee_at = now() pose cote app.
--
-- BACKFILL SECURITE : toute facture deja non-brouillon au moment de la
-- migration est consideree comme deja transmise -> verrouillee, pour qu'aucune
-- facture deja emise pour un vrai client ne redevienne modifiable.
-- ============================================================

alter table public.factures add column if not exists verrouillee_at timestamptz;

update public.factures
  set verrouillee_at = coalesce(updated_at, created_at, now())
  where coalesce(statut, '') <> 'brouillon' and verrouillee_at is null;
