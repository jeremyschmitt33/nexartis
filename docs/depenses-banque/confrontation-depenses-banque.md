# CONFRONTATION — Module « Dépenses & Banque »
### Agent CONFRONTATEUR · 11/07/2026 · Vérifications faites en direct sur la base Supabase `skuqfqnfitrovzeexwsr` et le repo Nexartis

> Méthode : j'ai relu les 3 propositions + le plan de référence, puis j'ai exécuté mes propres requêtes SQL (pg_proc, pg_policies, pg_trigger, information_schema, comptages) et mes propres grep sur le code. Chaque affirmation vérifiée est accompagnée de sa preuve. Je ne valide rien sur parole.

---

## 1. VÉRIFICATION DES FAITS — les 4 affirmations de l'expert DB

| # | Affirmation | Verdict | Preuve |
|---|---|---|---|
| 1 | Le garde `IF numero IS NULL` manque sur `generate_devis_numero()` en prod | ✅ **CONFIRMÉ** | `SELECT prosrc FROM pg_proc` : la fonction fait `NEW.numero := prefix \|\| year \|\| LPAD(seq…)` **sans aucune condition**, alors que `set_facture_numero()` commence par `IF NEW.numero IS NOT NULL AND trim(NEW.numero) <> '' THEN RETURN NEW;`. Et le trigger est bien **branché** : `pg_trigger` montre `auto_numero_devis` → `generate_devis_numero` sur la table `devis`. Bonus confirmé : `generate_facture_numero()` existe mais n'est rattachée à **aucun** trigger (fonction morte, ne pas la patcher — cohérent avec le plan §3.4). |
| 2 | Le pattern RLS réel est `entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()) AND current_role_in(...) = 'dirigeant'` | ✅ **CONFIRMÉ** | `pg_policies` sur `achats`, `paiements`, `factures_recues` **et aussi `factures`** : les 4 policies (SELECT/UPDATE/DELETE + INSERT en with_check) utilisent exactement ce pattern. Le pattern simple `user_id = auth.uid()` de CLAUDE.md est **obsolète pour les tables financières** — CLAUDE.md devrait être mis à jour pour éviter qu'une future session le réintroduise. |
| 3 | `paiements` est vide | ✅ **CONFIRMÉ** | `SELECT count(*)` : **0 ligne** dans `paiements`. Contexte chiffré utile : 57 factures, dont **33 avec `montant_paye > 0`** → le backfill M6 créera exactement 33 paiements synthétiques. Colonnes réelles de `paiements` : `id, user_id (NOT NULL), facture_id (NOT NULL), montant (NOT NULL), date_paiement (date), methode, reference, notes, created_at`. ⚠️ Le backfill devra renseigner `user_id` (NOT NULL) depuis `factures.user_id` — le DDL du backfill dans brainstorm-db ne le mentionne pas explicitement. |
| 4 | L'upload justificatif de la page Achats est un décor sans logique storage | ✅ **CONFIRMÉ** | Grep `storage\|upload\|\.from\(` dans `app/dashboard/achats/page.tsx` : **zéro appel storage**, seul résultat le commentaire ligne 678 `/* Upload justificatif — wrapping V4 (logique d'upload non touchée). */`. Et en base : `achats` contient 2 lignes, **0 avec `justificatif_url` renseigné**. La zone de drop est bien factice. |

**Conclusion : l'expert DB a dit vrai sur ses 4 constats fondateurs. Sa crédibilité factuelle est établie.** Ça ne rend pas sa solution parfaite (voir §3).

---

## 2. CONTRADICTIONS ENTRE LES 3 DOCUMENTS

### C1 — 🔴 L'écran principal « Opérations » n'est pas servi par le schéma DB (la plus grave)
L'UX promet (§1.3, §2.1, §2.2) : *« Opérations = lignes bancaires importées **+ dépenses saisies à la main** + encaissements pointés »*, et que l'onglet est « utile à vide » grâce aux saisies manuelles.
Le DB dit (§3.1) : *« Saisie manuelle (mobile, photo du ticket) → `achats` direct, `mouvement_id = NULL` »* — donc **une dépense saisie à la main n'est PAS un `banque_mouvements`** — et la route `GET /api/banque/mouvements` (§7) ne renvoie que `banque_mouvements`.
**Résultat : la dépense photo-du-ticket, le geste star mobile de l'UX, n'apparaîtrait jamais dans le sous-onglet Opérations.** L'état vide « à trois portes » mène à un écran qui reste vide après la porte n°1 et n°2 (sauf caisse). Il faut trancher : soit l'écran Opérations est une **UNION (mouvements ∪ achats sans mouvement ∪ paiements hors banque)** — avec pagination et filtres à spécifier sur cette union, ce qui n'est pas trivial — soit l'écran n'affiche que les flux banque+caisse et l'UX doit réécrire ses promesses. Aucun des deux documents ne voit le problème.

### C2 — 🔴 `chantier_id` sur `banque_mouvements` : différenciateur ou piège à double compte ?
Le DB pose `chantier_id` sur `banque_mouvements` (« ⭐ LE différenciateur rentabilité ») **ET** décrète la règle anti-double-compte : *« la rentabilité chantier = `achats.chantier_id` (+ IK phase 2), jamais la somme des deux »*. Donc un mouvement bancaire rattaché à un chantier mais non converti en achat **ne compte pas** dans la rentabilité. L'UX, elle, affiche la chip chantier dès la liste des opérations et laisse pointer un débit avec un chantier sans forcément créer d'achat. **L'utilisatrice rattachera une ligne Rexel à un chantier, verra la chip, et le chiffre « Ce chantier vous a rapporté… » ne bougera pas.** C'est le bug de confiance parfait. Deux issues propres : (a) supprimer `chantier_id` de `banque_mouvements` en V1 et forcer le passage par un achat pré-rempli (le flux existe déjà dans le DB §3.1) ; (b) inclure dans la rentabilité les mouvements à chantier sans achat lié. Je recommande (a) : un seul chemin, zéro ambiguïté.

### C3 — 🟠 Justificatifs : l'UX promet HEIC + 10 Mo + compression, le DB livre 5 Mo pdf/jpg/png/webp
UX §2.3.4 et §6.12 : *« HEIC accepté, 10 Mo max, compression côté client, jamais de rejet sec »*. DB §8 : bucket `allowed_mime_types = pdf/jpeg/png/webp`, `file_size_limit = 5242880` (5 Mo). **Un iPhone qui envoie un HEIC de 7 Mo est rejeté deux fois par le schéma DB.** La conversion HEIC→JPEG côté client (heic2any ou canvas) est faisable mais c'est du travail non chiffré nulle part. À arbitrer explicitement : soit on spécifie la conversion client (et 5 Mo suffit après compression), soit l'UX retire la promesse HEIC de la V1.

### C4 — 🟠 Nombre de catégories : 21 (DB) vs « 12-15 max » (UX)
Le seed DB fait 21 catégories système ; l'UX écrit « 12-15 catégories max en V1 ». Pas dramatique, mais c'est exactement le genre de divergence qui produit un écran de pointage à rallonge. Trancher un chiffre et une liste unique (je propose : fusionner `telecom`+`abonnements`, `taxes`+`urssaf` restent séparés, retirer `salaires` et `local` du seed pour une électricienne solo → ~16).

### C5 — 🟠 Le solde : trois positions différentes
UX étape 2 d'import : *« le solde de fin de fichier proposé automatiquement comme solde de référence »* ; UX friction #9 : *« on n'affiche PAS de solde du compte en V1 »* ; DB : `solde_initial` stocké + vue `v_comptes_soldes`. Si on n'affiche aucun solde en V1 (position que je soutiens — un solde faux détruit la confiance), alors la capture du « solde de référence » à l'import est du bruit : la retirer de l'étape 2, garder `solde_initial` uniquement pour la caisse (où il est indispensable et fiable).

### C6 — 🟡 Promesses d'import non couvertes par le moteur décrit
L'UX accepte `.qif` (§2.4 étape 1) — aucun parser QIF au plan DB. L'UX promet « encodages UTF-8/Latin-1 auto-détectés » pour les CSV — le DB ne traite la détection latin-1 que pour l'OFX (header `CHARSET:1252`) ; la route parse existante strip le BOM mais rien ne prouve qu'elle détecte le Windows-1252 (les CSV Crédit Agricole/Banque Populaire sont souvent en 1252 : les « é » deviendraient des `Ã©` dans les libellés ET dans le hash de dédup → doublons futurs si la banque change d'encodage). Retirer `.qif` de la V1 ; spécifier la détection d'encodage CSV (test simple : présence d'octets invalides UTF-8 → décoder en 1252).

### C7 — 🟡 « Décision actée » qui n'existe pas
L'UX affirme (§1.4) que déplacer « Fournisseurs » en sous-onglet d'Achats est une « décision actée ». **Ce n'est dans aucune des 8 décisions du plan de référence (§7).** C'est une bonne idée, mais c'est une restructuration de navigation + redirection d'URL qui gonfle la V1 sans lien avec la valeur du module. À sortir du périmètre V1 ou à faire acter réellement.

### C8 — 🟡 Limite 10 000 lignes vs payload 4 Mo
UX : « 10 000 lignes (vs 1 500 chez Clementine) ». DB : route parse limitée à 4 Mo. Un `.xlsx` de 10 000 lignes peut dépasser 4 Mo. Cohérent pour le CSV, à plafonner honnêtement pour Excel (« CSV jusqu'à 10 000 lignes ; Excel selon la taille du fichier »).

---

## 3. LE CHOIX STRUCTURANT — `paiements` source de vérité, `montant_paye` cache par trigger

### 3.1 Le rayon d'impact réel est PLUS PETIT que craint — je l'ai mesuré
Grep exhaustif `montant_paye` sur le repo. Résultat capital : **ni `lib/pdf*.ts`, ni `app/signer/**` ne lisent `montant_paye`** (grep ciblés : zéro résultat). La peur « casser les PDF et la page /signer » est **infondée**. Les vrais consommateurs :

**Écritures applicatives (à remplacer par des INSERT paiements) — seulement 3 + 1 :**
- `app/dashboard/factures/[id]/page.tsx:403` — bouton « Marquer payée » (`montant_paye: cashAVerser`)
- `app/dashboard/factures/[id]/page.tsx:1306` — enregistrement d'un paiement partiel (`montant_paye: newPaye`, statut `partiellement_payee`)
- `lib/services/cop-facture.ts:73` — facture de contrat d'ouverture de porte créée directement `montant_paye = ttc`
- `app/api/import/execute/route.ts:240` — **l'angle mort du plan DB** : la whitelist d'import factures accepte `montant_paye` en INSERT direct (et `lib/import/mappers.ts` le mappe pour obat/tolteck/batappli/henrri/excel). **Or c'est précisément le chemin qui servira à importer les 36 factures Clementine de Daniela.** Si M6 pose le trigger puis qu'on importe : les factures importées ont un `montant_paye` sans lignes `paiements` ; le premier pointage bancaire ultérieur recalcule et **écrase silencieusement l'historique importé**. Le plan DB dit « grep en début de chantier » mais son inventaire M6 ne cite pas la route d'import. **L'import doit générer les paiements synthétiques à l'insertion** (ou l'exécuter avant M6 + re-backfill).
- (`lib/avoir.ts:306` écrit `montant_paye: 0` à la création d'un avoir — inoffensif, un INSERT à 0.)

**Lectures (ne bougent pas, c'est l'avantage du cache)** : `app/dashboard/page.tsx`, `factures/page.tsx`, `factures/[id]/page.tsx`, `statistiques/page.tsx`, `chantiers/[id]/page.tsx`, `components/calculatrice/CalcUrssaf.tsx`, `lib/avoir.ts`, `app/api/cron/relances-auto-factures/route.ts`, `app/api/cron/rappels-suggestions/route.ts`, `app/api/factures/[id]/relancer-maintenant/route.ts`. (`equipe/page.tsx` lit `sous_traitant_paiements.montant_paye` — homonyme, hors sujet.)

### 3.2 MAIS le trigger proposé (§2.8) est bugué sur 3 points — REJETÉ tel quel
J'ai lu les triggers live de `factures` (`pg_trigger` : `trg_check_avoir_plafond`, `trg_propagate_avoir_remboursement`, `trg_facture_situation_plan`, `trg_exclusivite_facturation_devis`, `set_updated_at`) et le code métier. Le trigger `sync_facture_montant_paye` du brainstorm-db :

1. **Ne pose jamais `partiellement_payee`.** Or ce statut est activement utilisé : les crons de relance filtrent `statut IN ('envoyee','en_retard','partiellement_payee')` et **`CalcUrssaf.tsx:93-95` ne compte `montant_paye` que si `statut === 'partiellement_payee'`** (sinon il prend le TTC entier). Avec le trigger proposé, un acompte de 795 € sur une facture de 1 855 € laisserait le statut `envoyee` + poserait `date_paiement` → **la calculatrice URSSAF compterait 1 855 € encaissés au lieu de 795 €**. Cotisations surestimées = bug métier direct chez la première utilisatrice.
2. **Ignore l'imputation d'avoir.** Le code réel (`factures/[id]/page.tsx:1304`) promeut `payee` quand `paye + avoir_impute >= ttc`. Le trigger teste `v_total >= montant_ttc` seul : une facture soldée « cash + avoir imputé » resterait éternellement non-payée aux yeux du trigger. Divergence avec `propagate_avoir_remboursement` (lu en live : calcule `paye + avoirs - ttc`) et toute la mécanique V2 imputation.
3. **Ne rétrograde jamais le statut** quand un paiement est soft-supprimé (annulation d'un pointage erroné) : `statut` reste `payee` avec un `montant_paye` recalculé plus bas → incohérence visible partout.

Détails secondaires : `date_paiement` est un `timestamptz` côté app (`new Date().toISOString()`) mais le trigger y met un `MAX(date)` — à typer proprement ; et chaque UPDATE du trigger re-déclenche `trg_propagate_avoir_remboursement` (acceptable, mais à tester).

### 3.3 Mon verdict sur le choix structurant
**Le principe « `paiements` = source de vérité » est VALIDÉ** (c'est la seule façon propre de faire du multi-acomptes, et le rayon d'impact mesuré est faible). **L'implémentation par trigger est VALIDÉE AVEC RÉSERVES BLOQUANTES** : le trigger doit répliquer la vraie machine à statuts (`payee` / `partiellement_payee` / rétrogradation / avoir imputé), sinon préférer l'alternative moins magique : **une RPC Postgres transactionnelle `rpc_enregistrer_paiement` / `rpc_annuler_paiement`** qui insère le paiement ET recalcule `montant_paye + statut` avec la logique métier complète, appelée par le module banque ET par le bouton « Marquer payée » refactoré. Avantages : un seul endroit qui connaît la règle, pas de cascade de triggers, testable unitairement, réversible. Le backfill (33 lignes) reste obligatoire dans les deux cas et doit renseigner `paiements.user_id`. Et dans la même PR : patcher la route d'import (paiements synthétiques) et `cop-facture.ts`.

---

## 4. VERDICTS PAR PROPOSITION

### Proposition DB/backend (brainstorm-db.md) — ✅ VALIDÉ AVEC RÉSERVES
**Solide** : les 4 constats live sont vrais (§1) ; le choix « enrichir `achats`, activer `paiements`, zéro table doublon » est le bon ; la dédup à 3 niveaux (fichier hash / FITID / hash partiel hors corbeille) avec le suffixe intra-fichier est du niveau agrégateur pro ; les migrations ordonnées avec rollback et la réutilisation de `mappers.ts`/`obat-comptable.ts` sont exactement la bonne méthode ; le refus regex/ML en V1 est sage ; `parametres_fiscaux` daté répond au plan §5.3/5.4.
**Réserves** : (a) trigger §2.8 bugué — 3 défauts bloquants (§3.2) ; (b) inventaire M6 incomplet — la route d'import écrit `montant_paye` (§3.1) ; (c) `chantier_id` sur `banque_mouvements` contredit sa propre règle anti-double-compte (C2) ; (d) backfill sans `user_id` explicite ; (e) 21 catégories vs 12-15 UX (C4) ; (f) bucket sans HEIC vs promesse UX (C3) ; (g) le périmètre total (9 tables/extensions + 11 routes + moteur de règles + OFX) est une V1 très grasse (§5).

### Proposition UX (brainstorm-ux.md) — ✅ VALIDÉ AVEC RÉSERVES
**Solide** : le wording artisan est excellent et prêt à l'emploi ; la file de pointage enchaînée, l'état vide à trois portes, le « C'est perso » en un tap, l'honnêteté du calcul de rentabilité (« si vous n'avez pas tout rattaché, le chiffre est optimiste ») et le refus d'afficher un solde en V1 sont des décisions produit justes ; la réutilisation des composants existants est bien ancrée.
**Réserves** : (a) l'écran Opérations promet une liste que l'API DB ne sait pas servir — LA contradiction à résoudre avant maquette (C1) ; (b) HEIC/10 Mo/compression non chiffrés côté DB (C3) ; (c) `.qif` et « encodage auto-détecté » non couverts (C6) ; (d) « décision actée » Fournisseurs→sous-onglet : non actée, hors périmètre V1 (C7) ; (e) la « proposition par défaut intelligente » via le Planning et la « mémoire fournisseur × chantier » sont deux moteurs de suggestion de plus à coder — bonnes idées, mais V1.1, pas V1 (aucune API du plan DB ne les sert) ; (f) 10 000 lignes vs 4 Mo (C8).

### Proposition Concurrence (brainstorm-concurrence.md) — ✅ VALIDÉ AVEC RÉSERVES
**Solide** : la synthèse transversale (« personne ne fait chantier + banque + caisse + conformité micro sous 25 € ») est convaincante et donne un positionnement prix clair ; le tableau des capacités est exploitable ; sourcer les prix Obat en direct est la bonne pratique.
**Réserves** : (a) je n'ai **pas pu contre-vérifier** les faits marché (fermeture de Blank au 09/07/2026, dates e-reporting 2027, prix Indy/Tiime/Shine) — avant tout usage marketing ou décision fondée dessus, re-sourcer ces 3 points ; (b) l'affirmation « le pointage des encaissements va devenir une obligation légale » est un raccourci : l'e-reporting passera par une Plateforme Agréée, Nexartis n'en est pas une — ne jamais promettre de conformité, seulement « vos données seront prêtes » ; (c) 9 des 13 idées sont des distractions pour la phase actuelle (§6) ; (d) le document ne priorise pas par rapport au périmètre V1 — c'est un catalogue, pas un plan.

---

## 5. PÉRIMÈTRE V1 RECOMMANDÉ — découpage tranchant

La somme des 3 propositions (9 objets DB, 11 routes, 3 sous-onglets, moteur de règles, moteur de suggestions planning, caisse, notes de frais, pack comptable, URSSAF temps réel…) **n'est pas une V1, c'est un produit entier**. Découpage :

### V1 — « importer, pointer, rattacher » (livrable, testable par Daniela seule)
- **M0 obligatoire** : garde `IF numero IS NULL` sur `generate_devis_numero` (bloquant import Clementine, vérifié manquant).
- `entreprises.regime_fiscal` + `parametres_fiscaux` (taux datés).
- `comptes_tresorerie` (bancaire + caisse), `banque_imports`, `banque_mouvements` (**sans `chantier_id`**, cf. C2), `depense_categories` (~16 seeds, liste unique arbitrée).
- Import **CSV uniquement** (générique + écriture double Clementine) avec dédup 3 niveaux et détection d'encodage 1252. **OFX glisse en V1.5** si le parser maison dépasse 2 jours — le besoin réel immédiat, c'est le CSV Clementine de Daniela.
- Pointage : catégorie + « C'est perso » + remboursement/virement interne + justificatif (bucket privé, **5 Mo, pdf/jpg/png/webp, pas de HEIC promis**) + file enchaînée.
- Débit pointé → création/liaison `achats` (avec `deleted_at`, `categorie_id`, `mouvement_id`) ; **brancher ENFIN le vrai upload de la page Achats sur le même bucket** (le décor actuel est un bug vivant).
- Crédit pointé → `paiements` activé (many-to-one, multi-acomptes) via **RPC transactionnelle** (§3.3) + backfill 33 factures + patch import/cop-facture.
- Rentabilité chantier v1 : facturé vs somme des `achats.chantier_id` (chips chantier dans le formulaire achat — déjà existant).
- Caisse espèces (même table, `type='caisse'`, mouvements `source='manuel'`).
- Auto-catégorisation **système seule** (~15 règles en dur en table, `source='system'`) — l'apprentissage des corrections (`source='apprise'` + heuristique de token) passe en V1.5.
- Livre des recettes + registre des achats en PDF (idée concurrence #4 : petit effort, livrable légal, jsPDF déjà là).

### V1.5 — « confort et intelligence »
Règles apprises + suggestions de rapprochement scorées (facture au reste dû ≈ montant) ; OFX ; bandeau URSSAF temps réel (idée #5) ; jauge dérive prévu/engagé (idée #1) ; dépense « refacturable » (idée #9) ; alerte plafond 1 000 € espèces (idée #7) ; suggestion chantier via Planning + mémoire fournisseur×chantier ; multi-chantiers split ; export ZIP annuel (idée #12) ; réorganisation sidebar Fournisseurs ; date de bascule/archive 2025 si l'historique est importé.

### V2 — « plateforme »
Agrégateur live payant ; OCR tickets (API type Mindee) ; Factur-X (#10 — le calendrier réel de réception généralisée le rendra pertinent, pas avant) ; coût main-d'œuvre dans la rentabilité (#6) ; IK/véhicules + calcul trajets (#8 — non déductible en micro, purement informatif pour Daniela) ; trésorerie prévisionnelle (#11) ; e-reporting via partenaire PA (#13).

### Les 13 idées concurrence — tri sans pitié
**À garder maintenant (V1)** : #4 (livre/registre PDF). **V1.5** : #1, #3, #5, #7, #9, #12. **Distractions à écarter aujourd'hui** : #2 (OCR — dépendance API payante, promesse fragile), #6 (coût MO — nécessite un coût horaire que Daniela n'a pas), #8 (IK routing — API de routage + barèmes pour une donnée non déductible en micro), #10 (Factur-X — pari sur un calendrier réglementaire), #11 (trésorerie prévisionnelle — Obat lui-même ne l'a pas livrée), #13 (e-reporting — positionnement marketing OK, feature non). La fermeture de Blank = un article SEO, pas une ligne de code du module.

---

## 6. RISQUES LÉGAUX / RGPD / CAS LIMITES

1. **Données tierces dans les relevés** : les libellés bancaires contiennent des noms de clients/tiers (données personnelles). Base légale OK (intérêt légitime/obligation comptable) mais : mention dans la politique de confidentialité, durée de conservation définie (10 ans pour pièces comptables vs minimisation RGPD — documenter l'arbitrage), et suppression de compte → purge des mouvements ET du bucket justificatifs (à écrire dans le flux de suppression existant).
2. **Jamais l'IBAN complet ni de credentials** : le schéma respecte ça (`iban_masque`) — verrouiller par revue de code que le parser OFX ne stocke pas `<ACCTID>` complet en clair dans `banque_imports`.
3. **CNI/RIB de l'export Clementine** : le plan le dit déjà — jamais en base applicative. À rappeler dans la spec d'import : le dossier `bibliotheque/` est exclu.
4. **Ne JAMAIS promettre de conformité e-reporting/PA** (cf. verdict concurrence) : formulation autorisée = « vos encaissements pointés seront prêts à transmettre », rien de plus.
5. **Dates ambiguës (01/02/2026)** : la règle DB « rejet explicite si ambiguïté MM/DD » est bonne mais incomplète — préciser l'heuristique : si AU MOINS une ligne du fichier a un jour > 12, tout le fichier est FR ; sinon, préviewer les 5 premières lignes interprétées en DD/MM et demander UNE confirmation (« Ces dates sont bien jour/mois ? »). Jamais de choix silencieux.
6. **Signes des montants selon les banques** : colonnes débit/crédit toutes deux positives (fréquent), montant signé, négatifs `(12,50)` — couvert par le DB, MAIS ajouter le garde-fou de cohérence : si > 90 % des lignes d'un relevé sont positives ET qu'une colonne s'appelle « Débit », suspecter l'inversion et le montrer dans l'aperçu (totaux Entrées/Sorties affichés à l'étape 2 — l'utilisatrice détectera une inversion d'un coup d'œil : bonne mitigation UX déjà prévue).
7. **Encodage CSV Windows-1252** : cf. C6 — impacte le hash de dédup, donc l'idempotence. À traiter en V1, pas en polish.
8. **Idempotence** : le triptyque hash fichier / FITID / hash ligne + `ON CONFLICT DO NOTHING` + rejeu de chunk idempotent est le point le plus abouti des 3 docs. Angle mort résiduel assumé (2 vrais doublons identiques dans 2 fichiers différents) : acceptable, documenté.
9. **RLS des nouvelles tables** : le pattern « entreprise + dirigeant » vérifié en live est le bon à répliquer ; la policy storage `auth.uid()` (owner-based) est cohérente en V1 mono-dirigeant — divergence connue et tracée, OK.

---

## 7. LES 5 QUESTIONS QUE JEREMY DOIT TRANCHER

1. **Mécanique paiements** : trigger corrigé (avec machine à statuts complète `payee`/`partiellement_payee`/rétrogradation/avoir imputé) ou RPC transactionnelle unique (ma recommandation, §3.3) ? Ce choix conditionne M6 et le refactor des 3 écritures + import.
2. **Contenu de l'écran « Opérations »** (C1) : union banque + achats manuels + paiements (fidèle à la promesse UX, plus coûteux) ou banque/caisse seulement avec un sous-onglet Achats assumé ? À trancher AVANT la maquette HTML.
3. **`chantier_id` sur `banque_mouvements`** (C2) : le retirer en V1 (un seul chemin : mouvement → achat → chantier, ma recommandation) ou définir la rentabilité comme somme des deux ?
4. **Justificatifs** (C3) : accepter la spec DB (5 Mo, pas de HEIC) et retirer la promesse UX, ou financer la conversion HEIC + compression côté client en V1 ? Et confirmer que le fix de l'upload factice de la page Achats fait partie de la même livraison.
5. **Périmètre V1** (§5) : valider le découpage V1/V1.5/V2 proposé — en particulier OFX en V1.5 si > 2 jours, apprentissage des règles en V1.5, véhicules/IK en V2, et sidebar Fournisseurs hors V1.

---

## RÉSUMÉ (15 lignes)

1. Les 4 affirmations de l'expert DB sont **toutes confirmées par mes propres requêtes** : garde manquant sur `generate_devis_numero` (trigger branché), pattern RLS « entreprise + dirigeant » partout sur les tables financières, `paiements` = 0 ligne (33 factures à backfiller), upload justificatif achats 100 % factice (0 justificatif en base).
2. Bonne nouvelle mesurée : **ni les PDF ni la page /signer ne lisent `montant_paye`** — le rayon d'impact du choix structurant est petit : 3 écritures app + la route d'import.
3. **Mais le trigger proposé est bugué 3 fois** : jamais `partiellement_payee` (fausserait la calculatrice URSSAF), ignore l'avoir imputé, ne rétrograde jamais — et l'inventaire M6 oublie que l'import Clementine écrit `montant_paye` directement.
4. Recommandation : garder « `paiements` = source de vérité » mais via une **RPC transactionnelle** plutôt qu'un trigger, ou un trigger réécrit avec la vraie machine à statuts.
5. Contradiction majeure inter-docs : l'écran « Opérations » promis par l'UX (banque + saisies manuelles + encaissements) **n'est pas servi par l'API du schéma DB** — à trancher avant maquette.
6. Deuxième contradiction : `chantier_id` sur `banque_mouvements` crée un double chemin de rentabilité que le DB interdit lui-même — le retirer en V1.
7. Divergences à arbitrer : HEIC/10 Mo (UX) vs 5 Mo sans HEIC (DB) ; 21 vs 12-15 catégories ; `.qif` et encodage 1252 non couverts ; « décision actée » Fournisseurs qui n'est pas actée.
8. La somme des 3 propositions n'est pas une V1 : je propose V1 = M0 + import CSV + pointage + achats/paiements activés + caisse + rentabilité simple + livre/registre PDF ; OFX, règles apprises, URSSAF live, jauges en V1.5 ; OCR, Factur-X, IK, trésorerie, agrégateur en V2.
9. Sur les 13 idées concurrence : 1 en V1 (#4), 6 en V1.5, **6 distractions à écarter** (#2, #6, #8, #10, #11, #13-produit) ; les faits marché (Blank, e-reporting) sont plausibles mais non contre-vérifiés — re-sourcer avant usage.
10. Aucune proposition n'est rejetée en bloc : DB, UX et Concurrence sont **VALIDÉES AVEC RÉSERVES** — le socle est sain, les réserves sont précises et corrigeables.
11. Risques légaux tenus si : pas de promesse de conformité e-reporting, purge RGPD des mouvements/justificatifs à la suppression de compte, exclusion des CNI/RIB de l'import.
12. Prérequis absolu inchangé : **M0 (garde numérotation) avant tout import de pièces** — vérifié bloquant en prod.
13. Le backfill doit renseigner `paiements.user_id` (NOT NULL, oublié du DDL proposé).
14. CLAUDE.md documente un pattern RLS obsolète pour les tables financières — à mettre à jour pour ne pas réintroduire l'ancien pattern.
15. Cinq questions pour jeremy (§7) : mécanique paiements, contenu d'« Opérations », chantier_id sur mouvements, spec justificatifs, découpage V1.
