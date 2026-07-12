# Socle DB « Dépenses & Banque » V1 — mode d'emploi des migrations

**Série du 12/07/2026 · 7 fichiers SQL · AUCUN n'est encore appliqué en base.**
Référence : `SPEC_DEPENSES_BANQUE_V1_2026-07-11.md` (décisions §6 = loi) + corrections de
`docs/depenses-banque/confrontation-depenses-banque.md` toutes intégrées.

> Préalable : la migration M0 (garde de numérotation devis,
> `sql/2026-07-11-m0-garde-numero-devis.sql`) est **déjà appliquée et vérifiée** le 12/07.
> Ne pas la rejouer.

## Comment appliquer (pour jeremy, pas à pas)

1. Ouvrir https://supabase.com/dashboard → projet Nexartis → menu de gauche **SQL Editor**.
2. Ouvrir le fichier 01 dans le Bloc-notes (ou VS Code), tout copier, coller dans le SQL Editor,
   cliquer **Run** (bouton vert en bas à droite).
3. Exécuter la ou les requêtes de la section `VÉRIFICATION` en bas du fichier, comparer au
   résultat attendu écrit en commentaire.
4. Si c'est bon → fichier suivant. Si ça échoue → NE PAS continuer, le bloc `ROLLBACK` en bas
   du fichier permet de revenir en arrière proprement.
5. **L'ORDRE EST OBLIGATOIRE** (01 → 07) : chaque fichier dépend des tables du précédent.

Tous les fichiers sont **idempotents** : les relancer une deuxième fois ne casse rien et ne
crée pas de doublon.

## Les 7 fichiers

| # | Fichier | Ce qu'il fait | Vérification attendue |
|---|---|---|---|
| 01 | `…-01-regime-fiscal-parametres.sql` | `entreprises.regime_fiscal` + table `parametres_fiscaux` + seed des taux URSSAF (21,2 % / 12,3 %) et seuils TVA/micro **datés** au 01/01/2026. Montants vérifiés par l'audit du 12/07 : seuils TVA 37 500/41 250 et 85 000/93 500 confirmés (loi Midy, seuil unique 25 000 € abandonné) ; **plafonds micro corrigés → 83 600 € / 203 100 €** (nouvelle période triennale 2026-2028, les 77 700/188 700 initialement seedés étaient les valeurs 2023-2025). | 8 lignes dans `parametres_fiscaux` ; toutes les entreprises en `micro`. |
| 02 | `…-02-categories-et-regles.sql` | `depense_categories` (19 catégories système : 3 recettes + 13 dépenses + 3 neutres — télécom fusionné dans abonnements, salaires et local retirés) + `categorisation_regles` (24 règles SYSTÈME seules, pas d'apprentissage en V1). | recette 3 / depense 13 / neutre 3 ; 24 règles `system`. |
| 03 | `…-03-comptes-tresorerie.sql` | Comptes bancaires + caisse espèces dans une seule table (jamais d'IBAN complet, pas de solde stocké). | RLS activée + 4 policies. |
| 04 | `…-04-imports-et-mouvements.sql` | `banque_imports` (audit/annulation) + `banque_mouvements` (miroir brut du relevé, `hash_dedup` en colonne générée, index uniques partiels, **SANS chantier_id** — décision jeremy n°3). | 8 policies sur les 2 tables ; test d'insertion/dédup en commentaire. |
| 05 | `…-05-achats-extension.sql` | Enrichit `achats` : `deleted_at`, `categorie_id`, `mouvement_id`, `paye_sur_fonds` (notes de frais), etc. Colonnes nullables/défaut → zéro impact sur la page Achats actuelle. | 8 nouvelles colonnes ; la page /dashboard/achats marche comme avant. |
| 06 | `…-06-paiements-rpc-backfill.sql` | **Le fichier critique.** Active `paiements` (source de vérité des encaissements) : colonnes `mouvement_id`/`deleted_at`/`updated_at`, les 2 RPC transactionnelles `rpc_enregistrer_paiement` / `rpc_annuler_paiement` (vraie machine à statuts : `payee`/`partiellement_payee`, avoir imputé, rétrogradation), puis **backfill des 33 factures** historiques (bloc séparé, en dernier). | Contrôle avant : 33 factures sans paiement. Contrôles après : les 2 requêtes doivent renvoyer **0**. |
| 07 | `…-07-storage-justificatifs.sql` | Bucket privé `justificatifs` (5 Mo, pdf/jpeg/png/webp — les HEIC iPhone sont convertis côté navigateur) + 4 policies storage. Plan B dashboard décrit dans le fichier si le SQL echoue. | 1 bucket privé + 4 policies `justificatifs_*`. |

## Ce qui reste côté code applicatif (rien de tout ça n'est fait par le SQL)

**À déployer dans le MÊME lot que la mise en service du module** (sinon double source de
vérité sur `montant_paye`) :

1. **Route d'import** (`app/api/import/execute/route.ts:240`) : quand une facture importée a un
   `montant_paye > 0`, créer aussi le paiement synthétique. En attendant, la route continue
   d'écrire `montant_paye` directement **sans conflit** (aucun trigger n'est posé) ; si un
   import a lieu après le backfill, relancer simplement le bloc BACKFILL du fichier 06
   (idempotent).
2. **Bouton « Marquer payée »** (`app/dashboard/factures/[id]/page.tsx:393`) →
   `supabase.rpc('rpc_enregistrer_paiement', { p_facture_id, p_montant: resteDu })`.
   ⚠️ Cas limite à gérer côté app : si `resteDu = 0` (facture entièrement soldée
   par un avoir imputé), la RPC refuse (`MONTANT_INVALIDE`, un paiement doit être
   > 0) — dans ce cas passer directement le statut à `payee` sans créer de
   paiement (comportement actuel de `handleMarkPaid` conservé pour ce cas).
3. **Modale « Enregistrer un paiement »** (même fichier, l.1294) → même RPC avec le montant saisi.
4. **`lib/services/cop-facture.ts:73`** → créer le paiement après la création de la facture.
5. Moteur d'import CSV (détection Windows-1252, écriture double Clementine, chunks de 500,
   réplication de la formule `hash_dedup` documentée dans l'en-tête du fichier 04).
6. Vrai upload de justificatifs (page Achats + pointage) : conversion HEIC→JPEG + compression
   côté navigateur, upload vers le bucket `justificatifs`, URLs signées 60 s.
7. Ajouter le filtre `deleted_at IS NULL` sur les lectures de `achats` (la colonne est nouvelle).
8. Purge RGPD : à la suppression de compte, purger `banque_mouvements` et le bucket
   `justificatifs` (+ mention libellés bancaires dans la politique de confidentialité).
9. Mettre à jour `CLAUDE.md` : le pattern RLS des tables financières est
   « entreprise + dirigeant », plus `user_id = auth.uid()`.

## Hors périmètre V1 (schéma prêt, code plus tard)

- OFX (`ofx_fitid` et les CHECK `'ofx'` existent déjà, aucun code V1 ne les alimente).
- Apprentissage des règles de catégorisation (`source='apprise'` accepté par le CHECK,
  jamais créé en V1) — règles système seules.
