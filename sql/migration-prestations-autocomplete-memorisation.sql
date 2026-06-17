-- ============================================================================
-- Migration : Auto-memorisation + autocompletion des prestations
-- Date : 2026-06-17
-- DEJA APPLIQUEE EN PRODUCTION le 2026-06-17 via MCP Supabase (verifiee).
-- Ce fichier sert de trace/historique. Idempotent : peut etre rejoue sans risque.
--
-- Comportement :
--  - A l'enregistrement d'un devis/facture, chaque ligne prestation
--    (designation non vide <=120 car., prix > 0) est memorisee dans `prestations`.
--  - Cle d'unicite = (user_id, designation normalisee, prix_unitaire_ht).
--    => Meme designation a un prix DIFFERENT = variante separee (ex: ouverture
--       de porte a 20/30/40 EUR sont 3 entrees distinctes, toutes proposees).
--    => Meme designation au MEME prix = pas de doublon, on incremente usage_count.
--  - On n'ecrase JAMAIS le prix de reference (choix produit valide par Jeremy).
-- ============================================================================

-- 1. Extension unaccent (pour normalisation insensible aux accents)
create extension if not exists unaccent with schema extensions;

-- 2. Fonction de normalisation IMMUTABLE (minuscule + trim + sans accents)
--    IMMUTABLE est requis pour pouvoir l'utiliser dans un index.
create or replace function public.nx_norm_designation(txt text)
returns text language sql immutable parallel safe
set search_path = public, extensions as $$
  select lower(btrim(extensions.unaccent('extensions.unaccent', coalesce(txt,''))));
$$;

-- 3. Index unique anti-doublon : (user_id, designation normalisee, prix)
create unique index if not exists prestations_uniq_user_desig_prix
  on public.prestations (user_id, public.nx_norm_designation(designation), prix_unitaire_ht);

-- 4. RPC de memorisation (best-effort, appelee depuis le front APRES un save reussi)
--    SECURITY DEFINER : contourne la RLS mais re-verifie auth.uid() et insere
--    toujours user_id = auth.uid(). Aucune donnee cross-tenant possible.
create or replace function public.upsert_prestations_from_lignes(p_lignes jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user  uuid := auth.uid();
  v_l     jsonb;
  v_desig text;
  v_prix  numeric;
  v_unite text;
  v_tva   numeric;
begin
  if v_user is null then return; end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then return; end if;

  for v_l in select * from jsonb_array_elements(p_lignes) loop
    -- ne memoriser que les vraies prestations (jamais sections/commentaires)
    if coalesce(v_l->>'type','prestation') not in ('prestation','line') then continue; end if;
    v_desig := btrim(coalesce(v_l->>'designation',''));
    if v_desig = '' or char_length(v_desig) > 120 then continue; end if;
    v_prix := coalesce(nullif(v_l->>'prix_unitaire_ht','')::numeric, 0);
    if v_prix <= 0 then continue; end if;
    v_unite := coalesce(nullif(btrim(v_l->>'unite'),''), 'U');
    v_tva   := coalesce(nullif(v_l->>'taux_tva','')::numeric, 0);

    insert into public.prestations (user_id, designation, unite, prix_unitaire_ht, taux_tva, usage_count)
    values (v_user, v_desig, v_unite, v_prix, v_tva, 1)
    on conflict (user_id, public.nx_norm_designation(designation), prix_unitaire_ht)
    do update set usage_count = public.prestations.usage_count + 1,
                  updated_at  = now();
  end loop;
end;
$$;

-- Securite : la RPC ne doit JAMAIS etre appelable par un visiteur anonyme.
revoke execute on function public.upsert_prestations_from_lignes(jsonb) from public;
revoke execute on function public.upsert_prestations_from_lignes(jsonb) from anon;
grant  execute on function public.upsert_prestations_from_lignes(jsonb) to authenticated;
