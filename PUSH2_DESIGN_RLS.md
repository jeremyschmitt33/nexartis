# Push 2 — Design : retrait du filtre `user_id` en lecture + masquage strict par rôle

> Objectif : un employé voit les données de SON entreprise (et seulement elle) selon son rôle.
> Le masquage des montants pour l'Ouvrier est **strict** (impossible à récupérer techniquement, pas juste caché à l'écran).
> ⚠️ À DÉPLOYER AVEC Jeremy + test visuel par rôle. Jamais en aveugle.

## 1. Constat de départ (état prod vérifié via MCP)

- Phase 2a a **ajouté** des policies `*_select` (membership) mais **n'a pas supprimé** les anciennes `"Users can view own *"` (`auth.uid() = user_id`). Les deux coexistent et se combinent en **OR**.
- Conséquence : aujourd'hui, tout membre actif voit **toutes** les données de l'entreprise (la policy membership ne distingue pas le rôle). C'est sans effet tant qu'il n'y a qu'un dirigeant, mais ce serait une fuite dès qu'un employé existe.
- Colonnes sensibles (montants) à ne jamais exposer à l'Ouvrier :
  - `chantiers` : montant_devis_total, montant_facture, montant_encaisse, cout_mo, cout_materiaux
  - `intervenants` : taux_horaire (+ email/téléphone des collègues)
  - `prestations` : prix_unitaire_ht ; `materiel` : valeur_achat, credit_*, assurance_* ; `sous_traitant_paiements` : montant_*

## 2. Matrice de LECTURE par rôle (cible)

| Table | Dirigeant | Commercial / Chef chantier | Ouvrier |
|---|---|---|---|
| devis, devis_lignes | ✅ | ✅ | ❌ |
| factures, facture_lignes | ✅ | ❌ | ❌ |
| achats | ✅ | ❌ | ❌ |
| paiements | ✅ | ❌ | ❌ |
| relances | ✅ | ❌ | ❌ |
| fournisseurs | ✅ | ❌ | ❌ |
| sous_traitant_paiements | ✅ | ❌ | ❌ |
| materiel | ✅ | ❌ (a des montants) | ❌ |
| prestations | ✅ | ✅ | ❌ |
| clients | ✅ | ✅ | ❌ (voit coords client via la vue chantier safe) |
| chantiers (table de base, AVEC montants) | ✅ | ✅ | ❌ |
| **chantiers_ouvrier (vue SANS montants)** | — | — | ✅ (seulement chantiers affectés) |
| intervenants (table, AVEC taux_horaire) | ✅ | ✅ | ❌ |
| **intervenants_safe (vue SANS taux/contact)** | — | — | ✅ |
| planning_interventions | ✅ | ✅ | ✅ (planning équipe complet, aucun montant) |
| intervention_intervenants | ✅ | ✅ | ✅ |
| chantier_notes | ✅ | ✅ | ✅ (notes de ses chantiers) |
| points_collecte | ✅ | ✅ | ✅ |

> Note : `materiel` passe à **dirigeant seul** (il contient des données financières : crédit, assurance, valeur). On retire `materiel` et `fournisseurs` du menu Commercial dans `lib/roles.ts` pour rester cohérent avec « Commercial = pas de finances ».

## 3. Mécanique d'étanchéité (le cœur)

### 3a. Policies SELECT role-aware
Réécrire chaque policy `*_select` (membership) pour ajouter le filtre de rôle, et **supprimer** les doublons legacy `"Users can view own *"` (SELECT) — comportement strictement identique pour le dirigeant (la policy membership couvre déjà ses lignes).

Forme générale (ex. devis, lisible par dirigeant + commercial) :
```sql
DROP POLICY IF EXISTS "Users can view own devis" ON devis;
DROP POLICY IF EXISTS devis_select ON devis;
CREATE POLICY devis_select ON devis FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
```
Pour les tables dirigeant-seul : `... IN ('dirigeant')`.

### 3b. Masquage des montants Ouvrier = vues sans les colonnes montant
Les utilisateurs Supabase partagent le rôle Postgres `authenticated` → impossible de masquer une colonne par utilisateur via des GRANT de colonne. Donc :
- L'Ouvrier est **bloqué** sur la table de base `chantiers` et `intervenants` (policies ci-dessus ne l'incluent pas).
- Il lit à la place des **vues dédiées** qui n'exposent QUE les colonnes sûres :
  - `chantiers_ouvrier` : colonnes non-montant de chantiers + coords du chantier (adresse_chantier…) + nom/téléphone/adresse du client (jointure clients), **scopé aux chantiers où l'Ouvrier est affecté**.
  - `intervenants_safe` : id, prenom, nom, metier, couleur, role, is_self, actif (PAS taux_horaire/email/téléphone), même entreprise.
- Les vues sont créées par un propriétaire privilégié (bypass RLS de la table de base) et **portent elles-mêmes** tout le filtrage (entreprise + rôle ouvrier + affectation). `REVOKE ... FROM anon; GRANT SELECT ... TO authenticated;`.
- « Affecté » = il existe une `planning_interventions` (ou `intervention_intervenants`) avec `intervenant_id = ` l'intervenant lié au compte de l'Ouvrier, sur ce chantier.

### 3c. Lien compte ↔ intervenant (prérequis du scope Ouvrier)
Le scope « chantiers affectés » nécessite `entreprise_membres.intervenant_id`. On l'alimente à l'invitation : le dirigeant choisit (optionnel mais recommandé pour un Ouvrier) la fiche intervenant correspondante. Sans lien, l'Ouvrier ne voit aucun chantier (fail-safe, jamais de fuite).

### 3d. Écriture (INSERT/UPDATE/DELETE)
Hors périmètre strict de ce Push (lecture/masquage). À durcir en Phase 3 (un Ouvrier ne doit pas pouvoir modifier un devis via l'API même si l'UI ne l'expose pas). Noté comme dette.

## 4. Front
- `lib/hooks.tsx` : retrait du `.eq('user_id', user.id)` en **lecture** (`useSupabaseQuery`, `useSupabaseRecord`, `useEntreprise`). La sécurité repose alors sur la RLS 2a + role-aware. (Les écritures gardent leur `.eq('user_id')`.)
- Routage Ouvrier : `useChantiers`/`useIntervenants` interrogent `chantiers_ouvrier`/`intervenants_safe` quand le rôle courant est `ouvrier`.
- `app/dashboard/layout.tsx` : menu réduit + garde de route par rôle via `canAccessDashboardPath` (redirection vers `DEFAULT_LANDING[role]`). Édition en stratégie `.NEW` (fichier > 600 lignes).
- Invitation : sélection d'intervenant (alimente `intervenant_id`).

## 5. Tests obligatoires (à faire AVEC Jeremy avant de se fier au système)
1. Dirigeant : aucune régression (voit tout, comme avant).
2. Créer un Ouvrier de test lié à un intervenant affecté à 1 chantier : il voit CE chantier (sans montant), son planning équipe, PAS les devis/factures/CA. Tenter de requêter `devis`, `chantiers` (base), `intervenants.taux_horaire` → 0 ligne / colonne absente.
3. Commercial de test : voit devis/clients/chantiers (avec montants) mais PAS factures/achats/CA.
4. Test cross-entreprise : un employé de l'entreprise A ne voit jamais rien de B (impersonation SQL via `request.jwt.claims`).
