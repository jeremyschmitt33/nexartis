# Réception e-facture — V1 (à confronter) — 25/06/2026

> V1 produite par l'architecte (Claude) à partir de : `DESIGN_RECEPTION_EFACTURE.md`,
> `RAPPORT_SUPERPDP_RECEPTION_2026-06-24.md`, inspection LIVE de la base
> (projet `skuqfqnfitrovzeexwsr`) et du code existant.
> **Statut : V1 — DOIT être confrontée par l'agent confrontateur avant tout push / migration.**

## Contexte vérifié en base (source de vérité)
- `factures_recues` et `superpdp_sync_state` : **n'existent pas** → brique 1 = bien la première.
- Pattern RLS multi-entreprise confirmé sur `achats`/`fournisseurs`/`factures` :
  `(entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())) AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')`
  pour SELECT / INSERT(with_check) / UPDATE(qual+check) / DELETE.
- `superpdp_connexions` : **RLS activée, 0 policy** = verrouillée au `service_role`. → on reproduit ce schéma exact pour `superpdp_sync_state`.
- `achats` colonnes : id, user_id, fournisseur_id, chantier_id, date_achat, description, montant_ht, taux_tva, montant_ttc, justificatif_url, notes, created_at, updated_at. **Pas de `deleted_at`.**
- `fournisseurs` : id, user_id, nom, contact, email, telephone, adresse, code_postal, ville, siret, notes, actif, created_at, updated_at. **Pas de `deleted_at`.**
- Buckets Storage : seulement `myrenov-photos` et `rpc-realisations`, **tous deux publics**. → bucket privé `factures-recues` à créer.
- Cron existants (vercel.json) protégés par `Authorization: Bearer ${CRON_SECRET}`, `runtime nodejs`, `maxDuration 60`, client `service_role`. Modèle = `app/api/cron/relances-auto-factures/route.ts`.
- UI réelle = « V4 light premium » : hex en dur `#0f1a3a` (navy), `#ff7a1a` (orange), `#fafbfc`, polices `font-hanken` / `font-spline-mono`. (⚠️ CLAUDE.md mentionne Syne/Manrope/navy Tailwind = OBSOLÈTE ; suivre le code réel.)
- Émission = **réservée admin** (`getAdminUser`) tant que non finalisée. En prod, **seul Jerem** a une connexion SUPER PDP → le cron de réception ne traite de fait que lui.

## ⚠️ BLOQUANT OPÉRATIONNEL identifié (à trancher avec le confrontateur)
Pour **recevoir**, SUPER PDP exige une **ligne d'annuaire ouverte en réception** (adresse = SIREN).
La route `connect` actuelle (`buildAuthorizeUrl`) **ne passe PAS** `superpdp_send_and_receive=receive` et ne crée pas d'entrée d'annuaire. → Risque : aucune facture ne sera routée vers Jerem même si tout le code est parfait.
**Action V1 :** route de diagnostic admin `GET /api/superpdp/annuaire-check` qui appelle `GET /v1.beta/french_directory/companies?...` (ou `directory_entries`) pour confirmer que le SIREN de Jerem est bien **récepteur**. Si non → ouvrir l'entrée (`POST /v1.beta/directory_entries`) ou re-consentir avec `superpdp_send_and_receive=receive`.

---

## BRIQUE 1 — DB (SQL exact proposé)

```sql
-- Table des factures REÇUES (réception e-facture, obligation 01/09/2026)
create table if not exists public.factures_recues (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,                       -- titulaire de la connexion SUPER PDP
  -- Identité SUPER PDP
  superpdp_invoice_id text not null,                      -- clé d'idempotence
  superpdp_direction  text not null default 'in',
  -- Émetteur (fournisseur)
  emetteur_nom        text,
  emetteur_siren      text,
  emetteur_siret      text,
  emetteur_tva_intra  text,
  -- Facture
  numero              text,
  date_emission       date,
  date_echeance       date,
  devise              text not null default 'EUR',
  montant_ht          numeric,
  montant_tva         numeric,
  montant_ttc         numeric,
  -- Cycle de vie (statut interne Nexartis)
  statut              text not null default 'recue'
                      check (statut in ('recue','consultee','approuvee','litige','refusee','encaissee')),
  statut_pdp_code     text,                               -- dernier code SUPER PDP connu (brut)
  statut_pdp_text     text,                               -- libellé brut (jamais recalculé)
  -- Refus motivé (DGFiP) — seule action destinataire obligatoire 2026
  refus_motif_code    text,
  refus_motif_text    text,
  refus_at            timestamptz,
  -- Fichier (Storage privé, jamais d'URL publique)
  fichier_path        text,
  fichier_format      text,                               -- 'factur-x' | 'ubl' | 'cii' | 'original'
  fichier_taille      bigint,
  -- Rapprochement (V2)
  fournisseur_id      uuid references public.fournisseurs(id) on delete set null,
  achat_id            uuid references public.achats(id)       on delete set null,
  -- Debug / re-parsing
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- Idempotence = vrai garde-fou anti-doublon
create unique index if not exists factures_recues_uniq_pdp
  on public.factures_recues (user_id, superpdp_invoice_id)
  where deleted_at is null;

create index if not exists factures_recues_user_statut
  on public.factures_recues (user_id, statut) where deleted_at is null;
create index if not exists factures_recues_date
  on public.factures_recues (date_emission);

alter table public.factures_recues enable row level security;

-- RLS : pattern multi-entreprise du projet (dirigeant uniquement). Service_role bypass.
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

-- État de synchro (curseur de polling) — server-only, comme superpdp_connexions
create table if not exists public.superpdp_sync_state (
  user_id              uuid primary key,
  last_seen_invoice_id bigint,            -- plus grand id SUPER PDP traité (séquence croissante)
  last_sync_at         timestamptz,
  last_sync_status     text,              -- 'ok' | 'erreur' | 'non_connecte'
  last_sync_error      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.superpdp_sync_state enable row level security; -- 0 policy = service_role only

-- Bucket privé pour les fichiers reçus
insert into storage.buckets (id, name, public)
values ('factures-recues', 'factures-recues', false)
on conflict (id) do nothing;
-- Pas de storage policy => accessible uniquement via service_role (route serveur + signed URL courte).
```

**Application :** via MCP Supabase `apply_migration` (projet `skuqfqnfitrovzeexwsr`), nom `2026_06_25_reception_efacture`. Puis archiver le `.sql` dans `lib/supabase/migration-2026-06-25-reception-efacture.sql`.

## BRIQUE 2 — Lib réception (`lib/superpdp/reception.ts` + extension `client.ts`)
- Étendre `SuperPdpList<T>` → `{ data; count?; has_after?; has_before? }`.
- `downloadInvoiceFile(accessToken, id, format?)` : `GET /v1.beta/invoices/{id}/download?format=…` → `{ bytes: Uint8Array; contentType; ext }`.
- `fetchReceivedInvoices(accessToken, { sinceId? })` : boucle `GET /v1.beta/invoices?direction=in&order=asc&starting_after_id=…&limit=50` tant que `has_after`. Mappe vers un **type normalisé** `ReceivedInvoice` (parsing DÉFENSIF du payload, tout optionnel, `raw` conservé). Borne dure (ex. ≤ 200 factures/appel).
- Flag `SUPERPDP_RECEPTION_MODE` (défaut `direction_in`) qui isole l'hypothèse (a). Changer d'hypothèse = changer cette seule fonction.
- Inconnu encapsulé : forme exacte du payload entrant (déjà parsé vs XML). On lit `en_invoice`/champs plats défensivement ; sinon montants/emetteur restent NULL et on garde `raw_payload` pour re-parsing.

## BRIQUE 3 — Cron polling (`app/api/cron/superpdp-reception/route.ts`)
- `GET`, `Authorization: Bearer ${CRON_SECRET}`, `runtime nodejs`, `maxDuration 60`, client `service_role`.
- Sélectionne ≤ 20 connexions actives (`superpdp_connexions` deleted_at null), priorité aux `superpdp_sync_state.last_sync_at` les plus anciens.
- Pour chaque user : `getValidAccessTokenForUser` (saute proprement 409/401 en notant `last_sync_status`), lit le curseur, `fetchReceivedInvoices({ sinceId })`, et pour chaque facture : `downloadInvoiceFile` → upload `factures-recues/{user_id}/{superpdp_invoice_id}.{ext}` → **upsert** `factures_recues` `ON CONFLICT (user_id, superpdp_invoice_id) DO NOTHING`. Met à jour le curseur (max id) + `superpdp_sync_state`.
- `vercel.json` : `{ "path": "/api/cron/superpdp-reception", "schedule": "0 6,12,18 * * *" }` (3×/jour).

## BRIQUE 4 — UI onglet « Factures reçues » (page Achats)
- Ajout d'**onglets** dans `app/dashboard/achats/page.tsx` : `Achats` (existant) | `Factures reçues` (badge = nb `recue`).
- Composant `FacturesRecuesTab` (client) + hook `useFacturesRecues` (ajouter `factures_recues` à `SOFT_DELETE_TABLES` dans `lib/hooks.tsx`). Dual layout (cards 375px / table desktop), filtres statut/fournisseur/période, pastilles de statut.
- Détail (drawer) : émetteur + SIREN, montants, dates, **aperçu fichier**, historique statut. Ouverture → `recue → consultee` (via `updateRow`, seulement si `recue`).
- Téléchargement/aperçu **sécurisé** : route `GET /api/superpdp/facture-recue-fichier?id=…` (vérifie propriété, renvoie **signed URL courte** depuis le bucket privé). Jamais d'URL publique côté client.
- État « pas connecté SUPER PDP » → CTA Paramètres. **Bandeau d'onboarding incitatif** avant 09/2026.

## BRIQUE 5 — Rendu lisible + refus motivé
- **Factur-X / original** : PDF lisible directement (iframe sur signed URL).
- **UBL / CII** (XML pur) : route serveur qui parse et renvoie un **rendu HTML lisible** (émetteur, lignes, totaux) — XML échappé (anti-XSS).
- **Refus motivé** (obligatoire 2026) : route `POST /api/superpdp/facture-recue-refus` `{ id, motifCode, motifText }` → `POST /v1.beta/invoice_events` `fr:210` + `details[]` → statut `refusee`. Liste de motifs DGFiP (sous-ensemble courant + texte libre ; ⚠️ liste exacte ~40 codes à reconfirmer auprès de SUPER PDP). Une facture `refusee` n'est **jamais** comptabilisée.

## Sécurité (rappel tolérance zéro)
Isolation multi-tenant (le cron pose explicitement `user_id` = titulaire de la connexion) ; `raw_payload` non fiable (parsing défensif + échappement nom émetteur) ; bucket privé + signed URL courte + vérif propriété + nom d'objet basé sur l'id (anti path-traversal) ; idempotence unique index + ON CONFLICT ; cron borné + `CRON_SECRET` ; jetons via `service_role` only.

---

# V2 — CE QUI A ÉTÉ RÉELLEMENT LIVRÉ (post-confrontation + vérification)

**Méthode appliquée :** V1 (architecte) → agent confrontateur (4 bloquants + améliorations) → V2 implémentée → agent vérificateur indépendant (1 bloquant build trouvé + corrigé) → push `.bat`.

## Corrections du confrontateur intégrées
- **ID curseur** : `superpdp_invoice_id` en **bigint** (et curseur `bigint`) → tri numérique correct, plus de risque de curseur faux. Index unique **total** (pas de `WHERE deleted_at`) → pas de doublon fantôme.
- **type_document (facture/avoir)** + **tva_details jsonb** ajoutés (ne pas afficher un avoir comme une facture, multi-taux préservé).
- **CHECK statut élargi** : ajout `rejetee`, `irrecevable`, `en_attente`, `classee`.
- **Budget cron** : plafond **par run** (150) ET **par user** (30) + throttle (~60 ms) → anti-timeout 60 s et anti-famine.
- **Idempotence fichier** : INSERT DB d'abord (`ON CONFLICT DO NOTHING` + `.select('id')`), téléchargement/upload **seulement si nouvelle ligne**.
- **Refus motivé = V1** (pas V2), codes tirés de la norme **AFNOR XP Z12-012 v1.3** (`lib/superpdp/refus-motifs.ts`).
- **Rendu** : on demande d'abord le **Factur-X (PDF) généré par la PA** (affichage iframe) ; fallback données structurées « rendu indicatif » + téléchargement de l'original pour UBL/CII (pas de re-parsing XML risqué).
- **Notification email** à l'arrivée d'une facture (cron → `sendEmail`).
- **Badge « à traiter »** distinct (le compteur reste basé sur `recue`).
- **Anti path-traversal** : `superpdp_invoice_id` validé entier positif + extension whitelistée (`pdf|xml`).
- **BLOQUANT annuaire** : ajout du scope `superpdp_send_and_receive=send_and_receive` dans `buildAuthorizeUrl` + route diagnostic `GET /api/superpdp/annuaire-check`.

## Correction du vérificateur intégrée
- `sendEmail` attend `to: { email, name? }` (et non une string) → corrigé dans le cron.
- Bandeau « pas connecté » affiché seulement si 0 facture (évite la contradiction pour un membre non-admin).

## Fichiers livrés
- DB (déjà appliquée en prod via MCP) : `lib/supabase/migration-2026-06-25-reception-efacture.sql`
- Lib : `lib/superpdp/client.ts` (étendu), `lib/superpdp/reception.ts`, `lib/superpdp/refus-motifs.ts`
- API : `app/api/cron/superpdp-reception/route.ts`, `app/api/superpdp/{annuaire-check,facture-recue-fichier,facture-recue-refus}/route.ts`
- UI : `components/dashboard/FacturesRecuesTab.tsx`, `app/dashboard/achats/page.tsx` (onglets), `lib/hooks.tsx`
- Config : `vercel.json` (cron 6h/12h/18h)
- Push : `push-reception-efacture.bat`

## ⚠️ Reste à faire APRÈS le push (pour être vraiment opérationnel)
1. **Pousser** via `push-reception-efacture.bat`, vérifier Vercel = Ready.
2. **Diagnostic annuaire** (bloquant n°1) : ouvrir `/api/superpdp/annuaire-check` (connecté en admin) et vérifier qu'une entrée `direction=receive` existe pour le SIREN. Sinon : re-consentir la connexion SUPER PDP (le flux ouvre désormais `send_and_receive`) ou ouvrir la ligne.
3. **Test bout en bout** : s'auto-envoyer une facture vers le SIREN récepteur et vérifier qu'elle remonte dans l'onglet « Factures reçues » (seul vrai test que la chaîne réception fonctionne).
4. Reconfirmer auprès de SUPER PDP : forme exacte du payload entrant, liste complète des codes motif, que `download?format=factur-x` fonctionne sur une entrante UBL/CII.
