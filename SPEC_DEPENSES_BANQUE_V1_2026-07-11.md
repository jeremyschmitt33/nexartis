# SPEC — Module « Dépenses & Banque » V1
### Nexartis · 11/07/2026 · consolidée par Claude (chef d'équipe) après brainstorming de 3 agents experts + confrontation

> **Statut : EN ATTENTE DE VALIDATION PAR JEREMY. Rien n'a été codé, aucune migration exécutée.**
> Annexes détaillées dans `docs/depenses-banque/` : `brainstorm-db.md` (schéma SQL complet),
> `brainstorm-ux.md` (écrans + wording), `brainstorm-concurrence.md` (18 concurrents, 13 idées),
> `confrontation-depenses-banque.md` (vérifications live + verdicts).
> Les 3 propositions ont été VALIDÉES AVEC RÉSERVES par le confrontateur ; cette spec intègre déjà ses corrections.

---

## 1. Ce que la V1 livre (résumé)

L'artisan télécharge le relevé CSV de sa banque, l'importe dans Nexartis (aucun format de
colonnes imposé — notre détection sémantique s'en charge), pointe chaque opération en
quelques secondes (catégorie + justificatif photo + « c'est perso » si besoin), transforme
un débit en achat rattaché à un chantier, pointe un virement entrant sur une facture
(y compris plusieurs acomptes sur la même facture), tient sa caisse espèces, et obtient :
la rentabilité réelle de chaque chantier + le livre des recettes et le registre des achats
en PDF pour son comptable. Le tout 100 % gratuit (pas d'agrégateur bancaire en V1).

Positionnement confirmé par l'étude concurrentielle : personne ne combine
chantier + banque + caisse + conformité micro sous 25 €/mois.

## 2. Vérifications faites en production (base live + repo, par 2 agents indépendants)

- 🔴 **Le garde `IF numero IS NULL` MANQUE sur `generate_devis_numero()` en prod** (le
  trigger `auto_numero_devis` est branché et écrase sans condition). `set_facture_numero()`
  est protégé, lui. → **M0 : migration corrective OBLIGATOIRE avant tout import de devis.**
- Le pattern RLS réel des tables financières n'est plus `user_id = auth.uid()` mais
  `entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()) AND current_role_in(...) = 'dirigeant'`.
  → Toutes les nouvelles tables reprennent CE pattern. → CLAUDE.md à mettre à jour.
- La table `paiements` existe mais contient **0 ligne** ; 33 factures ont un `montant_paye > 0`
  (taille exacte du backfill à prévoir, sans oublier `paiements.user_id NOT NULL`).
- L'upload de justificatif de la page Achats est **factice** (aucune logique storage,
  0 justificatif en base). Son branchement réel fait partie de la V1.
- Ni les PDF (`lib/pdf*.ts`) ni la page `/signer` ne lisent `montant_paye` → le chantier
  « paiements source de vérité » a un rayon d'impact FAIBLE : 3 écritures app
  (`factures/[id]/page.tsx` ×2, `lib/services/cop-facture.ts`) + la route d'import
  (`app/api/import/execute/route.ts:240`, qui devra générer des paiements synthétiques).

## 3. Architecture retenue (détail SQL complet dans l'annexe DB)

- **Une dépense reste un `achats`** (enrichi : `deleted_at`, `categorie_id`, `mouvement_id`,
  `paye_sur_fonds` perso/pro). Aucune table « dépense » en doublon.
- **`paiements` est activée et devient LA source de vérité des encaissements** — c'est elle
  qui porte le multi-acomptes (plusieurs virements → une facture, montants partiels).
  `factures.montant_paye` devient un cache recalculé.
  **Mécanique retenue sur recommandation du confrontateur : RPC Postgres transactionnelle**
  (`rpc_enregistrer_paiement` / `rpc_annuler_paiement`) qui insère le paiement ET recalcule
  `montant_paye` + statut avec la VRAIE machine à statuts (`payee` / `partiellement_payee` /
  rétrogradation / avoir imputé) — le trigger initialement proposé était bugué 3 fois
  (il aurait faussé la calculatrice URSSAF, entre autres).
- Nouvelles tables : `comptes_tresorerie` (bancaire + caisse), `banque_imports`,
  `banque_mouvements` (**sans `chantier_id`** : un seul chemin de rentabilité,
  mouvement → achat → chantier, zéro double compte), `depense_categories` (~16 catégories
  seedées, ventilation URSSAF prestation 21,2 % / marchandise 12,3 %), `parametres_fiscaux`
  (taux DATÉS en base, jamais en dur), `entreprises.regime_fiscal`.
- **Idempotence d'import à 3 niveaux** : hash du fichier, FITID, hash de ligne
  (date+montant+libellé+compte) en contrainte UNIQUE + `ON CONFLICT DO NOTHING`.
  Import par chunks de 500 lignes (timeout Vercel). Détection d'encodage Windows-1252
  obligatoire (sinon les accents cassent le hash → doublons).
- Justificatifs : bucket Supabase Storage **privé** `justificatifs`, 5 Mo,
  pdf/jpg/png/webp — les photos iPhone (HEIC) sont converties automatiquement en JPEG
  côté navigateur avant upload (décision jeremy). Purge à la suppression de compte.
- Auto-catégorisation V1 : ~15 règles système par mots-clés en table
  (l'apprentissage des corrections = V1.5).

## 4. Périmètre tranché

**V1 — « importer, pointer, rattacher »** : M0 numérotation · régime fiscal + paramètres
datés · import CSV (générique + écriture double Clementine) · pointage complet (catégorie,
perso, remboursement, virement interne, justificatif, file enchaînée) · débit → achat
rattaché chantier (+ vrai upload page Achats) · crédit → paiements multi-acomptes via RPC
+ backfill 33 factures + patch import · rentabilité chantier simple · caisse espèces ·
livre des recettes + registre des achats PDF.

**V1.5** : OFX · règles apprises · suggestions de rapprochement scorées · bandeau URSSAF
temps réel · jauge dérive devis/réel · dépense refacturable · alerte plafond espèces
1 000 € · suggestion chantier via Planning · export ZIP annuel · sidebar Fournisseurs.

**V2** : agrégateur bancaire payant (~50 users) · OCR tickets · Factur-X · coût
main-d'œuvre · IK/véhicules · trésorerie prévisionnelle · e-reporting (via partenaire).

**Écartées comme distractions** (6 des 13 idées concurrence) : OCR immédiat, coût MO,
IK routing, Factur-X anticipé, trésorerie prévisionnelle, e-reporting-produit.

## 5. Garde-fous légaux / RGPD

Jamais d'IBAN complet ni de credentials en base · libellés bancaires = données
personnelles (mention politique de confidentialité + purge à la suppression de compte) ·
CNI/RIB exclus de tout import · aucune promesse de conformité e-reporting (formulation :
« vos données seront prêtes ») · dates ambiguës JJ/MM : jamais de choix silencieux,
confirmation utilisateur · aperçu Entrées/Sorties à l'import pour détecter les signes
inversés · seuils TVA/URSSAF paramétrables en base, jamais en dur.

## 6. ✅ Décisions VALIDÉES par jeremy le 11/07/2026

1. **Mécanique paiements : RPC transactionnelle** (pas de trigger). Précision demandée
   par jeremy et actée : Nexartis n'est PAS une plateforme de paiement — le module fait
   uniquement de la LECTURE de relevés téléchargés par l'artisan. Aucune initiation de
   paiement, aucune connexion bancaire, jamais. La table `paiements` = simple registre
   interne « telle facture a reçu tel montant à telle date ».
2. **Écran « Opérations » = banque + caisse uniquement** en V1, avec un accès clair vers
   Achats pour les dépenses saisies à la main.
3. **`chantier_id` retiré des mouvements bancaires** : un seul chemin,
   mouvement → achat → chantier. Un seul chiffre de rentabilité, toujours juste.
4. **Justificatifs : tous formats dès la V1, iPhone compris** — conversion automatique
   HEIC→JPEG + compression côté navigateur (l'utilisateur ne s'aperçoit de rien),
   stockage final pdf/jpg/png/webp, 5 Mo après compression.
5. **Découpage V1 / V1.5 / V2 validé tel quel.**

## 7. La comptabilité se CALCULE depuis les pointages (demande jeremy du 11/07)

Le module n'est pas qu'un rangement : chaque opération pointée nourrit la comptabilité
de l'artisan, automatiquement.

- **CA encaissé réel** = somme des encaissements pointés (banque + caisse). En micro,
  c'est LA base des déclarations URSSAF (mensuelles/trimestrielles) — pas le CA facturé.
- **Ventilation URSSAF automatique** : chaque catégorie de recette porte sa nature
  (prestations 21,2 % / marchandises 12,3 %, taux datés en base) → le module sait dire
  « ce trimestre : X € à déclarer, ≈ Y € de cotisations à prévoir ».
- **Surveillance des seuils** : cumul annuel encaissé comparé aux plafonds micro et au
  seuil de franchise TVA (paramétrables en base) → alertes AVANT la bascule, jamais après.
- **Livre des recettes + registre des achats** (obligations légales du micro) générés en
  PDF directement depuis les pointages — datés, numérotés, prêts pour un contrôle.
- Maquette V1 : ces chiffres apparaissent dans la vue « Par chantier » et les exports ;
  le bandeau URSSAF temps réel (montant à déclarer affiché en permanence) arrive en V1.5.
- Garde-fou inchangé : Nexartis CALCULE et PRÉPARE, mais ne télédéclare pas (pas
  expert-comptable, pas de promesse de conformité) — l'artisan reste maître du bouton.

## 8. Prochaines étapes après validation

> **Décision jeremy 12/07/2026 : PAS d'import réel sur le compte de Daniela par nous.**
> Elle fera son import elle-même sur son propre compte (le moteur d'import et la
> migration M0 — appliquée et vérifiée le 12/07 — le permettent désormais).

(a) Maquette HTML de validation de l'onglet (méthode habituelle, avant tout code) ;
(b) migration M0 numérotation (bloquante, aussi pour l'import réel Daniela) ;
(c) migrations du socle DB dans l'ordre de l'annexe, chacune réversible et auditée ;
(d) import CSV bout-en-bout testé sur compte bac-à-sable avec le relevé Clementine réel
(540 lignes en écriture double) avant toute mise en prod.
