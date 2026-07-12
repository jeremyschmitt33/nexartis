# Module « Dépenses & Banque » — Architecture base de données & backend
### Proposition de l'agent EXPERT DB/BACKEND · 11/07/2026 · basée sur la lecture RÉELLE de la base Supabase `skuqfqnfitrovzeexwsr` (51 tables) et du repo

> **Statut : proposition de conception. Aucune migration n'a été appliquée, aucun code écrit.**

---

## 0. Ce que j'ai vérifié dans la base RÉELLE (pas dans les docs)

La base de prod a été lue via le MCP Supabase (`list_tables` + `information_schema` + `pg_policies` + `pg_proc` + `storage.buckets`). Constats :

| Acquis annoncé | Vérifié ? | Réalité observée |
|---|---|---|
| `achats` existe | ✅ | Colonnes : `id, user_id, fournisseur_id, chantier_id, date_achat, description, montant_ht, taux_tva (défaut 20 !), montant_ttc, justificatif_url, notes, created_at, updated_at`. **Pas de `deleted_at`, pas de catégorie, pas de moyen de paiement.** |
| `fournisseurs` existe | ✅ | 6 lignes, pas de `deleted_at` (colonne `actif` à la place). |
| `factures_recues` existe (OCR dormant) | ✅ | 0 ligne. A déjà `deleted_at`, `fournisseur_id`, `achat_id` — bon modèle à imiter. |
| `paiements` existe mais VIDE | ✅ | 0 ligne. Colonnes : `facture_id NOT NULL, montant, date_paiement, methode, reference, notes`. **Pas de `deleted_at`, pas d'`updated_at`.** Le suivi réel passe par `factures.montant_paye` + `factures.date_paiement` + `factures.mode_paiement`. |
| `sous_traitant_paiements` existe | ✅ | 0 ligne, lié à `chantier_id` + `intervenant_id`. |
| Garde `IF numero IS NULL` sur les triggers | ⚠️ **PARTIELLEMENT FAUX** | `set_facture_numero()` a bien le garde (« si un numero est fourni, on le respecte »). **`generate_devis_numero()` n'a PAS de garde** : il écrase `NEW.numero` sans condition (définition live lue dans `pg_proc`). À corriger avant tout import de devis historiques. |

Deux découvertes supplémentaires importantes :

1. **Le pattern RLS du projet n'est plus `user_id = auth.uid()`** pour les tables financières. Les policies live de `achats`, `paiements`, `factures_recues` sont :
   `(entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())) AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')`
   (multi-utilisateur par entreprise, données d'argent réservées au rôle dirigeant). **Toutes les nouvelles tables du module doivent reprendre CE pattern**, pas le pattern simple de CLAUDE.md.
2. **L'upload de justificatif dans `app/dashboard/achats/page.tsx` est un décor** : la zone de drop existe (« PDF, JPG, PNG max 5 Mo ») mais aucun appel storage n'est branché. `achats.justificatif_url` n'est alimenté par rien aujourd'hui. Buckets existants : `factures-recues` (privé, 0 policy = service_role uniquement), `myrenov-photos` (public), `rpc-realisations` (public) ; les photos de chantier passent par **Cloudflare R2** (`lib/r2.ts`, URLs présignées). Il faut donc créer le circuit justificatifs de bout en bout.

---

## 1. Schéma cible — vue d'ensemble

```
comptes_tresorerie (compte bancaire OU caisse espèces)
        │ compte_id
        ▼
banque_imports (1 ligne par fichier importé — audit + idempotence)
        │ import_id
        ▼
banque_mouvements (miroir brut du relevé + saisies manuelles caisse)
   │ catégorisé par ──► depense_categories (taxonomie ~20 catégories)
   │ suggéré par    ──► categorisation_regles (mots-clés appris)
   │
   ├── CRÉDIT pointé ──► paiements (activée : 1 ligne par encaissement)
   │                        │ facture_id (many-to-one = multi-acomptes)
   │                        ▼
   │                     factures.montant_paye (CACHE recalculé par trigger)
   │
   └── DÉBIT pointé  ──► achats (enrichie : la « dépense » reste un achat)
                            │ chantier_id  ◄── LE différenciateur rentabilité
                            ▼
                         chantiers
```

**Trois rôles, trois tables, zéro doublon :**
- `banque_mouvements` = la **réalité bancaire exhaustive** (tout ce qui passe sur le compte, y compris le privé, les virements internes, l'URSSAF).
- `achats` = le **registre des achats** (uniquement les dépenses professionnelles, avec justificatif, fournisseur, chantier). Une dépense **reste un `achats`**.
- `paiements` = le **livre des recettes** (un encaissement par ligne, rattaché à une facture). Table dormante **activée et étendue**, pas remplacée.

---

## 2. DDL complet commenté

> Convention : soft delete `deleted_at` partout, RLS pattern « entreprise + dirigeant » observé en live, index sur les parcours de lecture réels. Le helper de policy est factorisé dans le commentaire `-- RLS(dirigeant)` pour la lisibilité ; le SQL complet est écrit à chaque fois dans les fichiers de migration (section 9).

### 2.1 `comptes_tresorerie` — comptes bancaires ET caisse espèces

Une seule table pour les deux : la caisse espèces de Clementine n'est qu'un compte de type `caisse` dont le « fond de caisse » est le `solde_initial`, et dont les opérations sont des `banque_mouvements` en source `manuel`. Évite une table `caisse` redondante.

```sql
CREATE TABLE public.comptes_tresorerie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  nom             TEXT NOT NULL,                          -- "Compte pro Boursorama", "Caisse"
  type            TEXT NOT NULL DEFAULT 'bancaire'
                    CHECK (type IN ('bancaire','caisse')),
  banque_nom      TEXT,                                   -- NULL pour une caisse
  iban_masque     TEXT,                                   -- "FR76 •••• 1234" — JAMAIS l'IBAN complet
                                                          -- (celui de l'entreprise est déjà dans entreprises.iban ;
                                                          --  ici on ne stocke que de quoi reconnaître le compte)
  devise          TEXT NOT NULL DEFAULT 'EUR',
  solde_initial   NUMERIC(12,2) NOT NULL DEFAULT 0,       -- fond de caisse / solde au démarrage
  solde_initial_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- date de bascule (cf. plan §5.2 : "je démarre au 01/01/2026")
  couleur         TEXT,                                   -- pastille UI
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un même user ne crée pas deux comptes du même nom (hors corbeille)
CREATE UNIQUE INDEX comptes_tresorerie_nom_uniq
  ON public.comptes_tresorerie (user_id, lower(nom)) WHERE deleted_at IS NULL;

ALTER TABLE public.comptes_tresorerie ENABLE ROW LEVEL SECURITY;
-- RLS(dirigeant) : 4 policies SELECT/INSERT/UPDATE/DELETE, pattern exact observé sur achats :
CREATE POLICY comptes_tresorerie_select ON public.comptes_tresorerie FOR SELECT
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
CREATE POLICY comptes_tresorerie_insert ON public.comptes_tresorerie FOR INSERT
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
CREATE POLICY comptes_tresorerie_update ON public.comptes_tresorerie FOR UPDATE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'))
  WITH CHECK ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
CREATE POLICY comptes_tresorerie_delete ON public.comptes_tresorerie FOR DELETE
  USING ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
     AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant'));
```

> **Solde courant** : jamais stocké — `solde_initial + SUM(montant des mouvements non supprimés)` via une vue (`v_comptes_soldes`) ou un select agrégé. Un solde stocké dérive toujours (leçon `factures.montant_paye`, cf. §3.3).

### 2.2 `banque_imports` — 1 ligne par fichier importé (audit + idempotence + découpage)

```sql
CREATE TABLE public.banque_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  compte_id        UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
  fichier_nom      TEXT NOT NULL,
  fichier_hash     TEXT,                    -- sha256 du fichier : re-glisser le même fichier → avertissement
  format           TEXT NOT NULL CHECK (format IN ('csv','ofx','manuel')),
  statut           TEXT NOT NULL DEFAULT 'en_cours'
                     CHECK (statut IN ('en_cours','termine','erreur','annule')),
  nb_lignes_fichier INT NOT NULL DEFAULT 0, -- lignes détectées dans le fichier
  nb_importees      INT NOT NULL DEFAULT 0, -- réellement insérées
  nb_doublons       INT NOT NULL DEFAULT 0, -- rejetées par la dédup hash
  nb_erreurs        INT NOT NULL DEFAULT 0,
  periode_debut     DATE,
  periode_fin       DATE,
  erreur_message    TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX banque_imports_user_idx ON public.banque_imports (user_id, created_at DESC);
ALTER TABLE public.banque_imports ENABLE ROW LEVEL SECURITY;
-- RLS(dirigeant) : mêmes 4 policies que 2.1
```

Utilité triple : (a) écran « historique des imports » ; (b) **annulation d'un import entier** (soft-delete en cascade applicative des mouvements du `import_id`) ; (c) suivi de progression quand l'import est découpé en lots (cf. §7 perf).

### 2.3 `banque_mouvements` — le cœur du module

```sql
CREATE TABLE public.banque_mouvements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  compte_id        UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
  import_id        UUID REFERENCES public.banque_imports(id),   -- NULL = saisie manuelle

  -- ── Données brutes du relevé (jamais modifiées après import) ──
  date_operation   DATE NOT NULL,
  date_valeur      DATE,
  libelle_banque   TEXT NOT NULL,             -- libellé brut tel quel ("PRLV SEPA URSSAF AQUITAINE …")
  montant          NUMERIC(12,2) NOT NULL CHECK (montant <> 0),
                                              -- SIGNÉ : négatif = débit, positif = crédit.
                                              -- Une seule colonne = pas d'incohérence débit/crédit possible.
  ofx_fitid        TEXT,                      -- identifiant unique OFX (FITID) si dispo : dédup parfaite

  -- ── Dédup par hash (contrainte demandée : date+montant+libellé+compte) ──
  -- Colonne GÉNÉRÉE (fonctions immutables uniquement) : impossible à désynchroniser.
  hash_dedup       TEXT GENERATED ALWAYS AS (
                     md5(date_operation::text || '|' || montant::text || '|'
                         || upper(regexp_replace(libelle_banque, '\s+', ' ', 'g')))
                   ) STORED,

  -- ── Enrichissement utilisateur (le "pointage") ──
  libelle_perso    TEXT,                      -- renommage lisible par l'utilisatrice
  categorie_id     UUID REFERENCES public.depense_categories(id),
  chantier_id      UUID REFERENCES public.chantiers(id),   -- ⭐ différenciateur rentabilité chantier
  statut_pointage  TEXT NOT NULL DEFAULT 'a_pointer'
                     CHECK (statut_pointage IN ('a_pointer','pointe','ignore')),
  nature           TEXT NOT NULL DEFAULT 'normal'
                     CHECK (nature IN ('normal','remboursement','virement_interne')),
                     -- 'remboursement' = le toggle "avoir ou remboursement" de Clementine
                     -- (un crédit qui est un avoir fournisseur, pas une recette → exclu du CA)
                     -- 'virement_interne' = compte→caisse ou compte→compte (exclu de tout)
  est_prive        BOOLEAN NOT NULL DEFAULT FALSE,  -- flux perso sur compte pro (plan §4.4)
  justificatif_path TEXT,                    -- chemin dans le bucket privé "justificatifs" (cf. §8)
  notes            TEXT,
  source           TEXT NOT NULL DEFAULT 'import_csv'
                     CHECK (source IN ('import_csv','import_ofx','manuel')),

  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotence du ré-import : le MÊME mouvement ne rentre jamais deux fois sur un compte.
-- Index PARTIEL (hors corbeille) : si l'utilisatrice supprime une ligne par erreur
-- puis ré-importe le relevé, la ligne peut revenir — comportement voulu.
CREATE UNIQUE INDEX banque_mouvements_dedup_uniq
  ON public.banque_mouvements (compte_id, hash_dedup) WHERE deleted_at IS NULL;
-- Dédup OFX renforcée quand le FITID existe (2 opérations identiques le même jour
-- ont le même hash mais des FITID différents → le FITID prime, cf. §5.4)
CREATE UNIQUE INDEX banque_mouvements_fitid_uniq
  ON public.banque_mouvements (compte_id, ofx_fitid)
  WHERE ofx_fitid IS NOT NULL AND deleted_at IS NULL;

-- Parcours de lecture réels :
CREATE INDEX banque_mouvements_liste_idx      -- écran principal (liste par compte, tri date)
  ON public.banque_mouvements (compte_id, date_operation DESC) WHERE deleted_at IS NULL;
CREATE INDEX banque_mouvements_a_pointer_idx  -- badge "N opérations à pointer"
  ON public.banque_mouvements (user_id, statut_pointage) WHERE deleted_at IS NULL;
CREATE INDEX banque_mouvements_chantier_idx   -- rentabilité par chantier
  ON public.banque_mouvements (chantier_id) WHERE chantier_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX banque_mouvements_import_idx     -- annulation d'un import
  ON public.banque_mouvements (import_id) WHERE import_id IS NOT NULL;

ALTER TABLE public.banque_mouvements ENABLE ROW LEVEL SECURITY;
-- RLS(dirigeant) : mêmes 4 policies que 2.1
```

**Piège du hash évité** : 2 achats identiques le même jour chez le même commerçant (2 cafés à 1,20 €) ont le même hash → la 2ᵉ ligne serait rejetée à tort. Parade : au moment du parsing, si N lignes du MÊME fichier partagent le même hash, on suffixe le libellé d'un compteur invisible (`#2`, `#3`) AVANT insertion — les doublons intra-fichier sont légitimes, les doublons inter-fichiers sont des ré-imports. C'est la règle qu'utilisent les agrégateurs. En OFX le problème n'existe pas (FITID).

### 2.4 `depense_categories` — taxonomie (détail des seeds en §4)

```sql
CREATE TABLE public.depense_categories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id),  -- NULL = catégorie SYSTÈME (visible par tous)
  code             TEXT NOT NULL,                   -- 'materiaux', 'urssaf', 'prive'… stable pour le code
  label            TEXT NOT NULL,
  groupe           TEXT NOT NULL CHECK (groupe IN ('recette','depense','neutre')),
  ventilation_urssaf TEXT CHECK (ventilation_urssaf IN ('prestation','marchandise')),
                     -- alimente la calculatrice URSSAF : prestations 21,2 % vs marchandises 12,3 %
                     -- (taux stockés DATÉS dans parametres_fiscaux, jamais en dur)
  compte_pcg       TEXT,                            -- compte comptable indicatif ('606','626'…) pour
                                                    -- le "Pack comptable" destiné à l'expert-comptable
  est_privee       BOOLEAN NOT NULL DEFAULT FALSE,  -- catégorie "privé / non professionnel"
  icone            TEXT,                            -- nom d'icône lucide pour l'UI
  ordre            INT NOT NULL DEFAULT 100,
  actif            BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un code système unique ; un code custom unique PAR user
CREATE UNIQUE INDEX depense_categories_code_sys_uniq
  ON public.depense_categories (code) WHERE user_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX depense_categories_code_user_uniq
  ON public.depense_categories (user_id, code) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.depense_categories ENABLE ROW LEVEL SECURITY;
-- SELECT : catégories système (user_id IS NULL) + les siennes
CREATE POLICY depense_categories_select ON public.depense_categories FOR SELECT
  USING (user_id IS NULL
     OR ((entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
        AND (current_role_in(entreprise_of_user(user_id)) = 'dirigeant')));
-- INSERT/UPDATE/DELETE : uniquement ses catégories custom (user_id NOT NULL + pattern dirigeant).
-- Les catégories système ne sont modifiables que par service_role (aucune policy ne les couvre en écriture).
```

### 2.5 `categorisation_regles` — auto-catégorisation V1 (détail en §5.5)

```sql
CREATE TABLE public.categorisation_regles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id),   -- NULL = règle SYSTÈME livrée avec Nexartis
  pattern          TEXT NOT NULL,                    -- mot-clé cherché dans le libellé ("URSSAF", "REXEL")
  type_match       TEXT NOT NULL DEFAULT 'contient' CHECK (type_match IN ('contient','commence_par')),
                     -- pas de regex en V1 : un pattern regex mal échappé saisi par un user = DoS potentiel
  categorie_id     UUID NOT NULL REFERENCES public.depense_categories(id),
  chantier_id      UUID REFERENCES public.chantiers(id),  -- règle temporaire "tout Rexel → chantier X"
  sens             TEXT CHECK (sens IN ('debit','credit')),  -- NULL = les deux
  priorite         INT NOT NULL DEFAULT 100,         -- plus petit = gagne ; règles user < règles système
  source           TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('system','user','apprise')),
  nb_applications  INT NOT NULL DEFAULT 0,           -- stat de confiance, affichable ("appliquée 47 fois")
  actif            BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX categorisation_regles_user_idx
  ON public.categorisation_regles (user_id, priorite) WHERE actif AND deleted_at IS NULL;
ALTER TABLE public.categorisation_regles ENABLE ROW LEVEL SECURITY;
-- SELECT : système + les siennes (comme 2.4) ; écriture : les siennes uniquement (pattern dirigeant)
```

### 2.6 `parametres_fiscaux` — taux datés, jamais de chiffre en dur

Exigence du plan (§5.3, §5.4) : seuils TVA et taux URSSAF **stockés datés et paramétrables**.

```sql
CREATE TABLE public.parametres_fiscaux (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL,          -- 'urssaf_bic_prestation', 'urssaf_bic_marchandise',
                                      -- 'tva_franchise_seuil_base', 'tva_franchise_seuil_majore',
                                      -- 'ik_bareme_auto_4cv'… (les barèmes IK peuvent vivre ici en JSONB)
  valeur      NUMERIC(12,4),
  valeur_json JSONB,                  -- pour les barèmes à tranches (IK)
  date_debut  DATE NOT NULL,
  date_fin    DATE,                   -- NULL = toujours en vigueur
  source_ref  TEXT,                   -- URL service-public/URSSAF de référence (traçabilité)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX parametres_fiscaux_code_periode_uniq
  ON public.parametres_fiscaux (code, date_debut);
ALTER TABLE public.parametres_fiscaux ENABLE ROW LEVEL SECURITY;
CREATE POLICY parametres_fiscaux_select ON public.parametres_fiscaux FOR SELECT USING (TRUE);
-- Aucune policy d'écriture = service_role uniquement (comme superpdp_sync_state, précédent existant).
```

Seed initial : `urssaf_bic_prestation = 21,2 % (2026-01-01 → 2026-06-30 avec modulation ACRE gérée côté app)`, `urssaf_bic_marchandise = 12,3 %`, seuils de franchise TVA en vigueur (à re-vérifier sur service-public.fr au moment de la migration, comme exigé par le plan §5.3).

### 2.7 Extension des tables EXISTANTES (pas de nouvelles tables en doublon)

```sql
-- (a) Régime fiscal : conditionne tout le module (micro = pas de TVA déductible, pas de FEC, IK non déductibles)
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS regime_fiscal TEXT NOT NULL DEFAULT 'micro'
    CHECK (regime_fiscal IN ('micro','reel_simplifie','reel_normal'));
-- entreprises.franchise_tva (boolean) EXISTE DÉJÀ — on le garde, les deux sont orthogonaux
-- (un micro peut sortir de franchise en dépassant le seuil).

-- (b) achats : devient le registre des achats complet
ALTER TABLE public.achats
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,                          -- convention projet (manquait !)
  ADD COLUMN IF NOT EXISTS categorie_id UUID REFERENCES public.depense_categories(id),
  ADD COLUMN IF NOT EXISTS mouvement_id UUID REFERENCES public.banque_mouvements(id),
      -- le rapprochement décaissement : CE mouvement bancaire a payé CET achat.
      -- NULLABLE : un achat en espèces/perso n'a pas de mouvement bancaire.
  ADD COLUMN IF NOT EXISTS moyen_paiement TEXT
      CHECK (moyen_paiement IN ('carte','virement','prelevement','cheque','especes','perso')),
  ADD COLUMN IF NOT EXISTS paye_sur_fonds TEXT NOT NULL DEFAULT 'pro'
      CHECK (paye_sur_fonds IN ('pro','perso','caisse')),
      -- 'perso' = NOTE DE FRAIS (dépense avancée sur fonds personnels → remboursable) :
      -- pas de table dédiée, c'est un achat avec un statut de remboursement.
  ADD COLUMN IF NOT EXISTS remboursement_statut TEXT NOT NULL DEFAULT 'na'
      CHECK (remboursement_statut IN ('na','a_rembourser','rembourse')),
  ADD COLUMN IF NOT EXISTS rembourse_mouvement_id UUID REFERENCES public.banque_mouvements(id),
      -- le virement compte pro → compte perso qui a remboursé la note de frais
  ADD COLUMN IF NOT EXISTS fournisseur_libre TEXT;
      -- nom du commerçant quand on ne veut PAS créer une fiche fournisseur ("Boulangerie du coin")
-- ⚠️ à l'application : passer le DÉFAUT de achats.taux_tva de 20.00 à 0 quand
-- entreprises.franchise_tva = TRUE (géré côté app, pas de trigger : lecture du profil au moment de la saisie).
CREATE INDEX IF NOT EXISTS achats_mouvement_idx ON public.achats (mouvement_id) WHERE mouvement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS achats_chantier_idx  ON public.achats (chantier_id)  WHERE chantier_id IS NOT NULL;

-- (c) paiements : ACTIVÉE (livre des recettes + multi-acomptes many-to-one)
ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS mouvement_id UUID REFERENCES public.banque_mouvements(id),
      -- le rapprochement encaissement : CE virement entrant correspond à CE paiement.
      -- Un mouvement peut financer PLUSIEURS paiements (un virement solde 2 factures) :
      -- la ventilation des montants partiels vit ICI, dans paiements.montant.
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS paiements_facture_idx   ON public.paiements (facture_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS paiements_mouvement_idx ON public.paiements (mouvement_id) WHERE mouvement_id IS NOT NULL;
```

### 2.8 Trigger de synchronisation `factures.montant_paye` (LA source unique — cf. §3.3)

```sql
-- factures.montant_paye devient un CACHE en lecture, recalculé automatiquement.
-- Plus AUCUNE écriture directe de montant_paye côté app (liste des fichiers à modifier en §9.3).
CREATE OR REPLACE FUNCTION public.sync_facture_montant_paye()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_facture_id UUID;
  v_total NUMERIC(12,2);
  v_derniere DATE;
BEGIN
  v_facture_id := COALESCE(NEW.facture_id, OLD.facture_id);
  SELECT COALESCE(SUM(montant), 0), MAX(date_paiement)
    INTO v_total, v_derniere
    FROM public.paiements
   WHERE facture_id = v_facture_id AND deleted_at IS NULL;
  UPDATE public.factures
     SET montant_paye = v_total,
         date_paiement = v_derniere,
         -- le statut n'est promu à 'payee' que si le TTC est couvert (multi-acomptes : reste dû sinon)
         statut = CASE WHEN v_total >= montant_ttc AND montant_ttc > 0 THEN 'payee' ELSE statut END,
         updated_at = now()
   WHERE id = v_facture_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_sync_facture_montant_paye
AFTER INSERT OR UPDATE OR DELETE ON public.paiements
FOR EACH ROW EXECUTE FUNCTION public.sync_facture_montant_paye();
```

> Garde-fou applicatif (pas en trigger pour rester réversible) : refuser un paiement qui ferait dépasser `montant_ttc` (409), et refuser `SUM(paiements.montant) > mouvement.montant` pour un même `mouvement_id` (409).

### 2.9 Véhicules + indemnités kilométriques — **phase 2 recommandée** (tables prêtes)

En **micro**, les IK ne sont **pas déductibles** (abattement forfaitaire) : pour Daniela c'est purement informatif. Je propose de livrer ces tables en phase 2, conditionnées à `regime_fiscal <> 'micro'` OU à un usage « info seulement ». DDL prêt :

```sql
CREATE TABLE public.vehicules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nom TEXT NOT NULL,                      -- "Jumpy", "RAV4" (les 2 véhicules de l'export Clementine)
  immatriculation TEXT,
  type TEXT NOT NULL DEFAULT 'voiture' CHECK (type IN ('voiture','utilitaire','moto')),
  puissance_cv INT,                       -- entrée du barème IK
  date_assurance_fin DATE,                -- rappels J-30/J-7 (demande explicite de Daniela, quick win)
  date_controle_technique DATE,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.ik_trajets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vehicule_id UUID NOT NULL REFERENCES public.vehicules(id),
  chantier_id UUID REFERENCES public.chantiers(id),   -- ⭐ même différenciateur : coût trajet par chantier
  date_trajet DATE NOT NULL,
  motif TEXT,
  ville_depart TEXT,
  ville_arrivee TEXT,
  km NUMERIC(8,1) NOT NULL CHECK (km > 0),
  aller_retour BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Le barème (tranches 5 000 / 20 000 km, régularisation annuelle au changement de tranche)
-- vit dans parametres_fiscaux (valeur_json), daté par année. Le calcul se fait côté app,
-- JAMAIS figé par trajet : le montant IK annuel = f(total km année, barème année).
-- RLS(dirigeant) sur les deux tables.
```

---

## 3. Articulation avec l'existant — zéro doublon

### 3.1 Une « dépense » reste-t-elle un `achats` ? → OUI

`achats` a déjà tout ce qui compte (fournisseur, chantier, montants, justificatif_url) et une page dashboard vivante (`app/dashboard/achats/page.tsx`, avec export PDF et export comptable CSV déjà branchés). Créer une table `depenses` serait le doublon type. On **enrichit** `achats` (§2.7.b) :

- Saisie manuelle (mobile, photo du ticket) → `achats` direct, `mouvement_id = NULL`.
- Pointage d'un débit bancaire comme « dépense pro » → l'app **crée un `achats` pré-rempli** (date, TTC, fournisseur deviné par règle) lié par `achats.mouvement_id`, ou **lie un achat existant** (l'achat saisi à la main la semaine d'avant est retrouvé par montant±date et proposé en premier).
- Débits NON-achats (URSSAF, taxes, frais bancaires, salaires, privé) → restent de simples `banque_mouvements` catégorisés. Ils n'ont rien à faire dans le registre des achats.

**Règle anti-double-compte** (à graver dans le code de reporting) : le « registre des achats » = table `achats` uniquement. Les tableaux de trésorerie = `banque_mouvements` uniquement. La rentabilité chantier = `achats.chantier_id` (+ IK phase 2), jamais la somme des deux.

### 3.2 Rapprochement mouvement ↔ facture (encaissement, multi-acomptes many-to-one)

**Pas de table de liaison dédiée : la table `paiements` EST la table de liaison**, avec les montants partiels dans `paiements.montant` :

```
Facture F-2026-012 (1 855 €)
  ├── paiement #1 : 795 €  ← mouvement "VIR AGNOLI ACOMPTE" du 03/06   (acompte 1)
  ├── paiement #2 : 500 €  ← mouvement "VIR AGNOLI" du 20/06           (acompte 2)
  └── paiement #3 : 560 €  ← mouvement "VIR AGNOLI SOLDE" du 08/07     (solde)
  → trigger : montant_paye = 1 855, statut = 'payee' ; avant le 08/07, reste dû = 560 €
```

Cas couverts : plusieurs virements → une facture (multi-acomptes, demande de Daniela) ; un virement → plusieurs factures (ventilé en N paiements pointant le même `mouvement_id`) ; paiement sans banque (chèque, espèces : `mouvement_id NULL`, `methode` déjà existante dans la table) ; annulation d'un pointage = soft-delete du paiement → le trigger recalcule.

### 3.3 `factures.montant_paye` : LA source unique de vérité

Situation actuelle = risque de double source identifié : `paiements` (vide) ET `factures.montant_paye` (utilisé). **Décision proposée : `paiements` devient l'unique source d'écriture ; `factures.montant_paye` devient un cache en lecture seule, maintenu par le trigger §2.8.** Avantages : tous les écrans existants qui LISENT `montant_paye` (dashboard, PDF, relances, `chantiers.montant_encaisse`) continuent de marcher sans modification ; seuls les écrans qui l'ÉCRIVENT changent (ils insèrent un `paiements` à la place — inventaire exact à faire par `grep -rn "montant_paye" app/ lib/ components/` en début de chantier, à inclure dans la PR).

**Backfill obligatoire** (migration §9, étape M6) : pour chaque facture existante avec `montant_paye > 0`, créer UN paiement synthétique (`montant = montant_paye`, `date_paiement = COALESCE(factures.date_paiement::date, updated_at::date)`, `methode = COALESCE(mode_paiement,'virement')`, `notes = 'Repris de l''historique'`) **avant** de poser le trigger — sinon le premier paiement réel écraserait l'historique.

### 3.4 Et `factures_recues` (OCR dormant) et `sous_traitant_paiements` ?

- `factures_recues` a déjà `achat_id` : le jour où l'OCR s'active, une facture reçue génère un `achats` — l'architecture proposée n'y touche pas et reste compatible.
- `sous_traitant_paiements` reste le prévisionnel sous-traitance par chantier. Un décaissement bancaire vers un sous-traitant se pointe comme un `achats` de catégorie `sous_traitance` rattaché au chantier ; V2 possible : `sous_traitant_paiements.mouvement_id`. Pas de fusion en V1 (tables à 0 ligne, aucun enjeu de migration).

---

## 4. Taxonomie de catégories — ~20 au lieu des ~80 de Clementine

Clementine ventile par taux de TVA parce que ses clients sont au réel. **Daniela est en micro (franchise) : la TVA ne sert à rien**, ce qui divise la taxonomie par 4. Ce qui compte pour un micro : (a) livre des recettes, (b) registre des achats, (c) ventilation URSSAF prestation/marchandise, (d) séparer le privé.

Seed system (`user_id = NULL`) proposé — 21 catégories :

| code | label | groupe | ventilation_urssaf | compte_pcg | est_privee |
|---|---|---|---|---|---|
| `recette_prestation` | Recette — prestations (main d'œuvre) | recette | prestation | 706 | |
| `recette_marchandise` | Recette — matériel / marchandises revendus | recette | marchandise | 707 | |
| `recette_autre` | Autre recette (subvention, intérêts…) | recette | | 758 | |
| `apport_perso` | Apport personnel | neutre | | 108 | |
| `materiaux` | Matériaux & fournitures chantier | depense | | 601 | |
| `outillage` | Outillage & petit matériel | depense | | 2154/606 | |
| `sous_traitance` | Sous-traitance | depense | | 611 | |
| `carburant` | Carburant & péages | depense | | 606 | |
| `vehicule` | Véhicule (entretien, assurance, LLD) | depense | | 615/616 | |
| `assurances_pro` | Assurances pro (décennale, RC) | depense | | 616 | |
| `urssaf` | Cotisations sociales URSSAF | depense | | 646 | |
| `taxes` | Impôts & taxes (CFE…) | depense | | 63 | |
| `abonnements` | Abonnements & logiciels | depense | | 626 | |
| `telecom` | Téléphone & internet | depense | | 626 | |
| `frais_bancaires` | Frais bancaires | depense | | 627 | |
| `publicite` | Publicité & communication | depense | | 623 | |
| `local` | Loyer & charges du local | depense | | 613 | |
| `deplacements` | Repas & déplacements | depense | | 625 | |
| `salaires` | Salaires & rémunérations | depense | | 641 | |
| `autre_depense` | Autre dépense pro | depense | | 6 | |
| `prive` | Privé / non professionnel | neutre | | — | ✓ |
| `virement_interne` | Virement interne / mouvement de caisse | neutre | | 58 | |

Mapping vers les besoins réels : **livre des recettes** = `paiements` joint aux factures (+ mouvements crédit `recette_*` sans facture, cas rare à afficher en anomalie) ; **registre des achats** = `achats` groupés par catégorie ; **ventilation URSSAF** = somme des recettes par `ventilation_urssaf` × taux datés de `parametres_fiscaux` ; **privé** = exclu de tout, affiché grisé. L'utilisatrice peut créer ses catégories custom (mêmes colonnes, `user_id` renseigné) mais on ne livre PAS 80 catégories : chaque catégorie ajoutée doit être demandée par l'usage.

---

## 5. Moteur d'import CSV/OFX

### 5.1 Réutilisation de l'existant (lu dans le repo)

`lib/import/mappers.ts` (1 662 lignes) fournit déjà : `detectSource()` (signatures d'en-têtes, y compris le format comptable Obat en écriture double), `detectCategory()` avec **`detectCategoryExcel()` = détection sémantique multi-signaux** (familles de synonymes FR/EN, accents, pluriels, renforcement par nom de fichier), les transforms `parseFrenchDate`, `parseAmount`, `parseTVARate`. `app/api/import/parse/route.ts` gère déjà CSV (Papaparse + strip BOM) et Excel (ExcelJS choisi pour éviter les CVE de SheetJS — ne pas réintroduire xlsx). `lib/import/obat-comptable.ts` **prétraite déjà un relevé comptable en écriture double** : c'est le modèle exact pour le relevé Clementine (540 lignes → ~270 opérations).

### 5.2 Ce qu'on ajoute

1. **Nouvelle `DataCategory` `banque_mouvements`** dans `mappers.ts`, avec familles sémantiques : date (`date|date opération|date comptable|booked`), libellé (`libellé|libelle|label|description|motif|communication`), montant signé (`montant|amount`), OU colonnes séparées (`débit|debit` / `crédit|credit`), solde (`solde|balance` — ignoré, jamais importé). Règle de fusion débit/crédit → `montant` signé : `crédit - débit` ligne à ligne, erreur si les deux sont remplis.
2. **`lib/import/clementine-releve.ts`** sur le modèle d'`obat-comptable.ts` : détection de l'écriture double (chaque opération = 2 lignes de sens opposés avec même référence de pièce) → réduction à 1 ligne par opération réelle, en gardant le libellé « métier » (pas la contrepartie 512).
3. **`lib/import/ofx.ts`** : parser OFX maison (~120 lignes, zéro dépendance npm — les libs OFX npm sont mortes/non maintenues, même logique que le choix ExcelJS). L'OFX est du SGML plat : extraire les blocs `<STMTTRN>` → `DTPOSTED` (AAAAMMJJ…), `TRNAMT` (point décimal, signé), `FITID` (id unique banque = dédup parfaite), `NAME` + `MEMO` (concaténés → `libelle_banque`), `<ACCTID>` (proposer le compte cible). Encodage : gérer `latin-1` (fréquent sur OFX bancaires FR) via détection du header `CHARSET:1252`.

### 5.3 Normalisation

- **Montants FR** : `"1 234,56"`, espaces insécables (` `, ` `), `"12,50 €"`, négatifs `"-12,50"` ou `"(12,50)"` → NUMERIC. Étendre `parseAmount` existant (qui ne gère pas encore les espaces de milliers ni les parenthèses).
- **Dates** : `DD/MM/YYYY` (réutiliser `parseFrenchDate`), `YYYY-MM-DD`, OFX `YYYYMMDDHHMMSS`. Rejet explicite (ligne en erreur, pas import silencieux) si ambiguïté `MM/DD`.
- **Libellés** : trim + compression des espaces pour le hash (fait par la colonne générée) ; le brut est conservé tel quel dans `libelle_banque`.

### 5.4 Idempotence du ré-import

Trois niveaux : (1) `banque_imports.fichier_hash` → « ce fichier exact a déjà été importé le 12/06, continuer ? » ; (2) index unique `(compte_id, ofx_fitid)` → dédup parfaite OFX ; (3) index unique `(compte_id, hash_dedup)` → dédup CSV. Insertion en `INSERT ... ON CONFLICT DO NOTHING` + comptage des rejets → `nb_doublons`. **Ré-importer le même relevé, ou deux relevés qui se chevauchent (export mensuel + export trimestriel), ne crée jamais de doublon et l'utilisatrice voit le décompte** (« 143 importées, 27 déjà présentes »).

---

## 6. Auto-catégorisation V1 — règles par mots-clés apprises

Table `categorisation_regles` (§2.5). Fonctionnement :

1. **Seed système** (~15 règles, `source='system'`, priorité 900) : `URSSAF→urssaf`, `DGFIP|IMPOT→taxes`, `REXEL|CEF |YESSS|SONEPAR|POINT P|LEROY MERLIN|BRICO→materiaux`, `TOTALENERGIES|ESSO|AVIA|DKV→carburant`, `AXA|MAAF|MMA|ALLIANZ→assurances_pro`, `FREE|ORANGE|SFR|BOUYGUES→telecom`, `COTIS|FRAIS BANC|COMMISSION→frais_bancaires`, `RETRAIT DAB→prive (suggestion)`, etc.
2. **Application** : à l'import (et sur demande « re-catégoriser »), pour chaque mouvement sans catégorie : première règle qui matche par `priorite ASC` (user 100 < apprise 500 < système 900) sur `upper(libelle_banque)`. La catégorie posée par une règle reste une **suggestion** tant que `statut_pointage = 'a_pointer'` — le pointage la confirme.
3. **Apprentissage des corrections** : quand l'utilisatrice change la catégorie d'un mouvement, l'app extrait le token le plus discriminant du libellé (heuristique V1 : plus long mot > 3 lettres hors mots-vides bancaires `VIR|PRLV|SEPA|CB|CARTE|PAIEMENT|FACTURE|EUR` + numéros) et propose : « Toujours classer "REXEL" en Matériaux ? » → si oui, `INSERT` règle `source='apprise'`, `priorite=500`. Jamais de règle créée silencieusement (sinon une erreur de clic pollue tout).
4. **Boucle de comptage** : `nb_applications` incrémenté par lot après chaque application (une seule requête `UPDATE ... FROM`), utile pour proposer le ménage des règles mortes.

Pas de ML, pas d'embedding, pas d'appel LLM en V1 : sur des libellés bancaires FR, 15 règles système + l'apprentissage couvrent typiquement 80 %+ des lignes récurrentes dès le 2ᵉ mois.

---

## 7. Routes API

Toutes sous `app/api/banque/`, toutes avec le kit `lib/api-security.ts` lu dans le repo : `getAuthenticatedUser()` (401 sinon), `checkRateLimit(user.id, N, fenêtre)` (429 via `rateLimitError()`), `isValidUUID` sur tout id (400), réponses via `secureJson`/`secureError` (jamais `error.message` brut), writes via le client Supabase authentifié → **RLS = 2ᵉ verrou de propriété** (jamais service_role sauf mention).

| Route | Méthode | Payload (zod) | Codes | Rate limit |
|---|---|---|---|---|
| `/api/banque/comptes` | GET / POST | POST : `{nom, type, banque_nom?, iban_masque?, solde_initial, solde_initial_date}` | 200/201, 400, 401, 409 (nom dupliqué → catch code PG `23505`), 429 | 30/min |
| `/api/banque/comptes/[id]` | PATCH / DELETE | PATCH : champs partiels ; DELETE = soft (`deleted_at`) refusé 409 si mouvements non pointés | 200, 400, 401, 404, 409 | 30/min |
| `/api/banque/import/parse` | POST | multipart `file` (≤ 4 Mo → 413 sinon, marge sous la limite body Vercel) + `compte_id`. Détecte format/écriture double, normalise, calcule les hash, **pré-marque les doublons déjà en base** (1 seule requête `SELECT hash_dedup WHERE compte_id AND hash IN (...)` par lot), renvoie preview + `stats {total, nouveaux, doublons, erreurs}`. N'écrit RIEN. | 200, 400 (format inconnu), 401, 413, 422 (0 ligne exploitable), 429 | 10/min |
| `/api/banque/import/execute` | POST | `{import_id?, compte_id, format, fichier_nom, fichier_hash, rows: [...max 500], chunk_index, total_chunks}` — crée `banque_imports` au 1ᵉʳ chunk, `INSERT ON CONFLICT DO NOTHING` par lot, met à jour les compteurs, applique les règles de catégorisation sur les lignes insérées, statut `termine` au dernier chunk | 200, 400, 401, 404 (compte), 409 (import déjà `termine` = rejeu), 429 | 20/min |
| `/api/banque/imports/[id]` | DELETE | Annule un import : soft-delete de tous ses mouvements **non pointés** ; 409 si des mouvements sont déjà pointés/rapprochés | 200, 401, 404, 409 | 10/min |
| `/api/banque/mouvements` | GET / POST | GET : filtres `compte_id, statut, categorie_id, chantier_id, du, au, q` + pagination curseur (`date_operation,id`) ; POST (saisie manuelle/caisse) : `{compte_id, date_operation, libelle, montant, categorie_id?, chantier_id?}` | 200/201, 400, 401, 404 | 60/min |
| `/api/banque/mouvements/[id]` | PATCH / DELETE | PATCH : `{categorie_id?, chantier_id?, libelle_perso?, nature?, est_prive?, statut_pointage?, notes?}` — si changement de catégorie : renvoyer `suggestion_regle` (§6.3) ; DELETE : soft, 409 si rapproché | 200, 400, 401, 404, 409 | 60/min |
| `/api/banque/mouvements/[id]/justificatif` | POST / DELETE | `{path}` après upload direct storage (cf. §8) : vérifie que le path commence par `user.id/`, taille ≤ 5 Mo via `HEAD`, mime pdf/jpg/png/webp | 200, 400, 401, 404, 415 | 30/min |
| `/api/banque/rapprocher` | POST | `{mouvement_id, affectations: [{facture_id, montant}]}` (crédit) ou `{mouvement_id, achat_id?}` (débit ; sans `achat_id` → création d'un achat pré-rempli, renvoyé pour édition). Vérifs : somme ≤ montant du mouvement (409), montant par facture ≤ reste dû (409), tout dans une transaction (RPC Postgres `rpc_rapprocher_mouvement` — précédent projet : `sql/rpc-replace-lignes-transactional.sql`) | 200, 400, 401, 404, 409 | 30/min |
| `/api/banque/rapprocher/suggestions` | GET | `?mouvement_id=` → factures au reste dû ≈ montant (±1 €) du même client (match nom dans libellé), achats à montant/date proches | 200, 401, 404 | 30/min |
| `/api/banque/regles` | GET / POST / PATCH / DELETE | CRUD des règles user ; POST valide `pattern` : longueur 2–60, pas de regex | 200/201, 400, 401, 404 | 30/min |

**Point de vigilance perf — import 10 000 lignes vs timeout Vercel (10 s hobby / 60 s pro)** :
- Le **parsing et la normalisation restent côté client impossible ?** Non : le projet parse déjà côté serveur (Papaparse/ExcelJS en route handler) — on garde ce pattern, mais `parse` ne fait QUE parser (pas d'I/O DB ligne à ligne) : 10 000 lignes CSV se parsent en < 1 s.
- L'**écriture est découpée côté client** : chunks de 500 lignes → 20 appels `execute` séquentiels pour 10 000 lignes, chacun = 1 seul `INSERT` multi-lignes + 1 `UPDATE` compteurs (~300–800 ms). Aucun appel ne s'approche des 10 s ; la barre de progression est gratuite (`chunk_index/total_chunks`).
- **Interdits** : aucune requête par ligne (le `checkDuplicate` unitaire de `app/api/import/execute/route.ts` existant, acceptable pour 50 clients, serait mortel ici — la dédup est déléguée à l'index unique + `ON CONFLICT`) ; pas d'application des règles en N requêtes (une passe en mémoire sur les 500 lignes avec les règles chargées une fois).
- Si un chunk meurt (réseau) : le client rejoue le même chunk — idempotent par construction (hash unique).

---

## 8. Stockage des justificatifs

**Bucket Supabase Storage privé `justificatifs`** (précédent : `factures-recues` privé existe déjà ; R2 est réservé aux photos volumineuses de chantier — un justificatif est petit et bénéficie des policies RLS storage natives + URLs signées Supabase, plus simple que la chaîne SigV4 de `lib/r2.ts`).

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('justificatifs', 'justificatifs', FALSE,
        5242880,  -- 5 Mo (Clementine plafonne à 2 Mo : on fait mieux, argument commercial gratuit)
        ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policies storage : le 1er segment du chemin = user_id (pattern standard Supabase)
CREATE POLICY justificatifs_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'justificatifs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY justificatifs_select ON storage.objects FOR SELECT
  USING (bucket_id = 'justificatifs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY justificatifs_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'justificatifs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY justificatifs_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'justificatifs' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Convention de chemins** : `{user_id}/{aaaa}/{mm}/{entite}-{entite_id}/{timestamp}-{nom-slugifie}.{ext}`
ex. `d3f…/2026/07/mouvement-9c2…/1720691234-facture-rexel.pdf` — le préfixe année/mois rend le « Pack comptable mensuel » (plan §5.7) trivial : lister un préfixe = tous les justificatifs du mois à zipper.

Affichage : URLs **signées à la demande** (`createSignedUrl`, 60 s) — jamais d'URL publique, jamais d'URL signée stockée en base (on stocke le `path`). Uniformisation : `achats.justificatif_url` (aujourd'hui jamais alimenté, upload UI factice — vérifié) sera alimenté avec un **path** de ce même bucket ; renommage logique en « path » documenté dans le code sans renommer la colonne (éviter une migration de renommage risquée).

Limite multi-utilisateur connue : la policy `auth.uid()` ne donne accès qu'à l'uploader. Comme les tables financières sont déjà restreintes au rôle `dirigeant` (= le même user en pratique), c'est cohérent en V1 ; si un 2ᵉ dirigeant par entreprise apparaît, on fera évoluer la policy storage vers les helpers `entreprise_of_user`/`current_entreprise_ids` (fonctions SQL existantes, utilisables dans les policies storage).

---

## 9. Plan de migration SQL ordonné et RÉVERSIBLE

Chaque fichier dans `lib/supabase/` (convention repo : `migration-2026-07-XX-banque-MX-….sql`), avec bloc `-- ROLLBACK` commenté en pied de fichier. Ordre strict (dépendances FK) :

| # | Fichier | Contenu | Rollback |
|---|---|---|---|
| M0 | `…-M0-fix-devis-numero-garde.sql` | **Préalable découvert par l'audit live** : ajouter le garde `IF NEW.numero IS NULL OR trim(NEW.numero) = '' THEN … END IF;` à `generate_devis_numero()` (le pendant facture `set_facture_numero` l'a déjà, la version devis NON — vérifié dans `pg_proc`) | `CREATE OR REPLACE` ancienne version (conservée en commentaire) |
| M1 | `…-M1-regime-fiscal-parametres.sql` | `entreprises.regime_fiscal` + table `parametres_fiscaux` + seed taux URSSAF/seuils TVA datés | `DROP TABLE parametres_fiscaux; ALTER TABLE entreprises DROP COLUMN regime_fiscal;` |
| M2 | `…-M2-depense-categories.sql` | Table + RLS + seed des 21 catégories système | `DROP TABLE depense_categories;` |
| M3 | `…-M3-comptes-tresorerie.sql` | Table + RLS + index | `DROP TABLE comptes_tresorerie;` |
| M4 | `…-M4-banque-mouvements.sql` | `banque_imports` + `banque_mouvements` + index uniques hash/fitid + RLS | `DROP TABLE banque_mouvements; DROP TABLE banque_imports;` |
| M5 | `…-M5-achats-extension.sql` | `ALTER TABLE achats ADD …` (§2.7.b) + index. Colonnes toutes NULLABLES ou avec défaut → zéro impact sur la page achats existante | `ALTER TABLE achats DROP COLUMN …` (données de liaison perdues, structure restaurée) |
| M6 | `…-M6-paiements-activation.sql` | **Dans CET ordre, une transaction** : (1) `ALTER TABLE paiements ADD mouvement_id, deleted_at, updated_at` ; (2) **backfill** un paiement synthétique par facture à `montant_paye > 0 AND deleted_at IS NULL` ; (3) `CREATE FUNCTION sync_facture_montant_paye` + trigger ; (4) contrôle : `SELECT count(*) FROM factures f WHERE montant_paye <> (SELECT COALESCE(SUM(montant),0) FROM paiements p WHERE p.facture_id=f.id AND p.deleted_at IS NULL)` doit renvoyer **0** | `DROP TRIGGER + DROP FUNCTION` ; `DELETE FROM paiements WHERE notes = 'Repris de l''historique'` ; `ALTER TABLE paiements DROP COLUMN …` — `montant_paye` n'ayant jamais été modifié par le backfill, retour à l'état exact |
| M7 | `…-M7-categorisation-regles.sql` | Table + RLS + seed ~15 règles système | `DROP TABLE categorisation_regles;` |
| M8 | `…-M8-storage-justificatifs.sql` | Bucket + 4 policies storage | `DELETE FROM storage.buckets WHERE id='justificatifs'` (après purge objets) + `DROP POLICY` |
| M9 (phase 2) | `…-M9-vehicules-ik.sql` | `vehicules`, `ik_trajets` + barèmes IK dans `parametres_fiscaux` | `DROP TABLE ik_trajets; DROP TABLE vehicules;` |

**À faire en base AVANT toute ligne de code UI** : M0 à M4 + M8 (le socle : régime, catégories, comptes, mouvements, bucket). M5–M7 avant les écrans de pointage/rapprochement. Tester chaque migration sur la **branche Supabase de dev** (`create_branch` MCP disponible) ou un compte bac-à-sable, jamais directement en prod (convention projet).

**Impact code à traiter avec M6 (même PR)** : inventaire `grep -rn "montant_paye" app/ lib/ components/` — chaque ÉCRITURE directe (`update({montant_paye: …})`) remplacée par un `INSERT INTO paiements` ; les lectures ne bougent pas. Sans ça, double source de vérité réintroduite le jour même.

---

## 10. Résumé (15 lignes)

1. Base live lue (MCP Supabase, projet `skuqfqnfitrovzeexwsr`) : `achats`/`paiements`/`fournisseurs`/`factures_recues` confirmées ; **le garde `IF numero IS NULL` manque sur `generate_devis_numero`** (il existe côté factures) ; l'upload justificatif de la page achats est factice.
2. Le pattern RLS réel du projet est **entreprise + rôle dirigeant** (`entreprise_of_user`/`current_entreprise_ids`), pas `user_id = auth.uid()` : toutes les nouvelles tables le reprennent.
3. 6 nouvelles tables : `comptes_tresorerie` (banque + caisse unifiées), `banque_imports`, `banque_mouvements`, `depense_categories` (21 seeds), `categorisation_regles`, `parametres_fiscaux` (taux datés) ; + `vehicules`/`ik_trajets` en phase 2 (IK non déductibles en micro).
4. **Zéro table en doublon** : une dépense reste un `achats` (enrichi : `deleted_at`, `categorie_id`, `mouvement_id`, note de frais via `paye_sur_fonds='perso'`) ; un encaissement devient un `paiements` (table dormante **activée**, pas remplacée).
5. Multi-acomptes many-to-one : `paiements` EST la table de liaison mouvement↔facture, montants partiels dans `paiements.montant` ; `factures.montant_paye` devient un **cache trigger-maintenu** — source unique = `paiements`, backfill de l'historique obligatoire.
6. Dédup d'import : colonne générée `hash_dedup` (md5 date|montant|libellé normalisé) + index uniques partiels `(compte_id, hash)` et `(compte_id, ofx_fitid)` ; ré-import et chevauchements idempotents par `ON CONFLICT DO NOTHING`.
7. Import : réutilisation de `detectCategoryExcel` (détection sémantique) + nouveau parser OFX maison sans dépendance + prétraitement écriture double sur le modèle d'`obat-comptable.ts` ; écriture par chunks de 500 → jamais près du timeout Vercel 10 s.
8. Auto-catégorisation V1 : règles mots-clés (système + apprises des corrections, jamais créées silencieusement), pas de ML.
9. Justificatifs : bucket privé `justificatifs` 5 Mo (> 2 Mo Clementine), chemins `{user_id}/{aaaa}/{mm}/…`, URLs signées 60 s, prêt pour le « Pack comptable mensuel ».
10. 10 migrations ordonnées M0→M9, chacune avec rollback écrit ; M0–M4+M8 à passer en base avant tout code UI.
11. `regime_fiscal` sur `entreprises` conditionne le module (micro par défaut) ; taux URSSAF 21,2 %/12,3 % et seuils TVA stockés **datés** en base, jamais en dur.
12. Différenciateur : `chantier_id` sur mouvements ET achats → rentabilité réelle par chantier, ce que Clementine ne fait pas.

## 11. Risques principaux

1. **Double source de vérité `montant_paye`** : si une seule écriture directe survit dans le code après M6, les chiffres divergent silencieusement. Mitigation : grep exhaustif dans la PR M6 + requête de contrôle en fin de migration (doit renvoyer 0) + éventuel `REVOKE UPDATE(montant_paye)` en durcissement ultérieur.
2. **Trigger `sync_facture_montant_paye` vs factures verrouillées/avoirs** : la table `factures` a une mécanique riche (verrouillage `verrouillee_at`, avoirs, situations). Le trigger ne touche que `montant_paye/date_paiement/statut` mais doit être testé contre le trigger de plafond d'avoir existant (`migration-2026-06-27-avoir-plafond-trigger.sql`).
3. **Garde manquant sur `generate_devis_numero`** (découvert à l'audit) : bloquant pour l'import des devis historiques Clementine — M0 avant tout.
4. **Hash de dédup et vrais doublons intra-journée** : géré par suffixe intra-fichier (§2.3), mais deux FICHIERS différents contenant chacun un vrai doublon du même jour restent un angle mort (rare ; l'OFX/FITID l'élimine — pousser l'OFX quand la banque le propose).
5. **Écriture double Clementine mal dédoublonnée** → montants comptés deux fois : relecture humaine sur les 540 lignes de Daniela avant généralisation du parser.
6. **RLS storage owner-based vs multi-dirigeant** : acceptable en V1, à faire évoluer avec les helpers entreprise si le multi-dirigeant arrive.
7. **Rate limit en mémoire** (`lib/api-security.ts`) : par instance Vercel, contournable en burst — connu du projet, à durcir (Upstash) le jour où le module banque devient sensible aux abus.
8. **Timeout Vercel** : maîtrisé par chunks, mais le ZIP du « Pack comptable » (justificatifs) devra être généré en streaming ou différé — à traiter dans la spec de cette feature, pas ici.

## 12. Fichiers réellement lus pour cette proposition

- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\CLAUDE.md`
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\PLAN_CLEMENTINE_IMPORT_BANQUE_2026-07-10.md` (sections 4, 5, 9 + reste)
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\ARCHITECTURE_LIAISONS.md`
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\lib\import\mappers.ts` (1 662 l. — detectSource/detectCategory/transforms)
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\lib\api-security.ts` (intégral)
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\app\api\import\parse\route.ts` et `app\api\import\execute\route.ts`
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\app\dashboard\achats\page.tsx` (onglets achats/reçues, upload factice, exports)
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\lib\supabase\migration-2026-06-25-reception-efacture.sql` (pattern RLS + bucket privé de référence)
- `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis\lib\r2.ts` (stockage R2 existant)
- **Base Supabase live `skuqfqnfitrovzeexwsr`** : `list_tables` (51 tables), colonnes de `achats/paiements/factures/entreprises/fournisseurs/factures_recues/sous_traitant_paiements/chantiers`, `pg_policies` (achats, paiements, storage), `pg_proc` (`generate_devis_numero`, `set_facture_numero`, `generate_facture_numero`), `storage.buckets`.
