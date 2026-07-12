# PLAN — Import Clementine + Module « Banque / Dépenses »
### Nexartis · session du 10/07/2026 · établi par l'équipe d'agents (Import, Banque, Confrontateur/UX, Vérificateur) — supervision Claude

> **Statut : PLAN uniquement. Rien n'a été codé ni inséré en base.** Ce document sert à valider les décisions AVANT toute implémentation. Toutes les affirmations techniques et légales ont été auditées par un agent vérificateur (lecture réelle de la base Supabase `skuqfqnfitrovzeexwsr` et du repo).

---

## 0. Résumé en 10 lignes (à lire en premier)

- **Deux missions** : (1) importer les données Clementine de Daniela dans Nexartis ; (2) un onglet pour voir/pointer ses opérations bancaires + justificatif.
- **L'export contient** : 13 clients, 47 prestations, 2 fournisseurs, 2 véhicules, et surtout **des devis/factures uniquement en PDF** (pas de données ligne à ligne) + un relevé bancaire comptable de 540 lignes.
- **Bonne nouvelle import** : Nexartis a **déjà** un moteur d'import CSV → clients et prestations s'importeront quasi tout seuls.
- **Blocage n°1 (bloquant, confirmé)** : les numéros de facture de Nexartis sont générés par un automatisme SQL qui **écraserait** les numéros légaux figés de Daniela (2025-002…). À corriger avant tout import de pièces.
- **Banque** : il **n'existe plus de solution gratuite** pour brancher une vraie banque en live (l'offre gratuite de référence a fermé en juillet 2025). Le live coûte ~500 €/mois (Bridge) ou sur devis (Powens, ce qu'utilise Clementine).
- **Reco banque** : **V1 = import de relevé (CSV/OFX) gratuit et sans agrément** ; agrégateur live en **V2**, en option payante.
- **Angle mort racine** : on ne sait pas si Daniela est **micro-entrepreneur** ou **EI au réel** — ça change la TVA, l'export comptable et tout le module. À trancher.
- **Repense l'onglet** : pas « Banque » (copie de Clementine) mais **« Dépenses & Banque »**, où la banque n'est qu'une source parmi d'autres.
- **L'idée qui bat Clementine** : relier une dépense à un **chantier** → savoir *« est-ce que ce chantier m'a fait gagner de l'argent ? »*. Clementine ne saura jamais répondre à ça.
- **8 décisions t'attendent en section 7.**

---

## 1. Inventaire réel de l'export Clementine

Dossier `export-01-01-2024-31-12-2026/` :

| Fichier / dossier | Contenu | Importable ? |
|---|---|---|
| `clients.csv` | 13 clients (7 sur 13 ont le nom dans la colonne « entreprise ») | ✅ auto |
| `produits.csv` | 47 prestations, toutes en « Hors-Taxe » (franchise TVA) | ✅ auto |
| `fournisseurs.csv` | 2 (Rexel, + 1) | 🟠 saisie manuelle (2 min) |
| `vehicules.csv` | 2 (Jumpy, RAV4) | 🟠 manuel / module Matériel |
| `collaborateurs.csv` | 1 (Daniela elle-même) | ❌ ne pas importer (c'est la titulaire) |
| `notes_de_frais.csv` | 5 lignes (écriture comptable double) | 🟠 hors périmètre / manuel |
| `especes.csv` | vide | — |
| `releve_bancaire.csv` | 540 lignes en **écriture double** (~270 opérations réelles) | 🟠 voir Mission 2 |
| `devis/` | **7 devis en PDF** | 🟠 reconstruction (voir 3.3) |
| `factures/ventes/` | **36 factures de vente en PDF** | 🟠 reconstruction (voir 3.3) |
| `factures/achats/` | 109 justificatifs d'achat (PDF **scannés**) | ❌ OCR requis / archivage seul |
| `bibliotheque/` | RIB, **CNI recto/verso**, cartes grises, relevés PDF | ⚠️ données sensibles → coffre-fort chiffré uniquement |

**Point clé** : les devis et factures ne sont **pas** disponibles en données structurées (aucun CSV avec les lignes). Pour les remettre dans les onglets Devis/Factures de Nexartis, il faut **reconstruire les lignes à partir des PDF**.

---

## 2. Étude de Clementine — ce qu'on garde comme inspiration

**Clementine = expert-comptable en ligne** (offre à 59 €/mois HT observée) : il fait le **bilan, la liasse fiscale, la TVA, l'IS** — Nexartis ne joue pas dans cette cour et n'a pas à le faire. Onglets de l'app : À faire · Tableau de bord · Banques (Relevés + Espèces + synchro via **Powens**) · Paiements · **Recouvrement** · Achats · Facturation · Comptabilité/Bilan · Salariés · Bibliothèque · Configuration.

**Ce que Daniela aime chez Clementine** (WhatsApp) : « compte bancaire relié → pointage des opérations avec ajout du justificatif » et « service de recouvrement → gain de temps, pas d'embrouilles direct avec le client ».

**Fonctions dont Nexartis peut s'inspirer** (par priorité de pertinence artisan) : pointage bancaire + justificatif · relances/recouvrement · notes de frais + indemnités kilométriques · liens de paiement · factures récurrentes · tableau de bord trésorerie · export pour l'expert-comptable.

**Ce qu'on ne copie PAS** : bilan, liasse fiscale, déclarations TVA/IS (métier de comptable, hors sujet et risqué).

---

## 3. MISSION 1 — Import des données

### 3.1 Ce qui s'importe quasi automatiquement (moteur d'import existant)
Nexartis a déjà `app/dashboard/import/` + `lib/import/mappers.ts` gérant les sources `obat`, `obat_comptable`, `tolteck`, `batappli`, `henrri`, `excel`. **Clementine n'est pas géré**, mais la source générique **`excel`** (reconnaissance par noms de colonnes français) couvre les CSV Clementine.

> ⚠️ Détail relevé par l'audit : un fichier `push-import-clementine.bat` existe à la racine du repo **mais aucun code de connecteur Clementine n'existe derrière**. À clarifier (faux départ d'une session précédente ?) — ne pas croire qu'un support Clementine est déjà là.

- **Clients (13)** → table `clients`. Le moteur remplit automatiquement le nom depuis « entreprise » quand la colonne « nom » est vide. ✅
- **Prestations (47)** → table `prestations`. Unité « Article » → « U », « Hors-Taxe » → pas de TVA, code → référence, type → catégorie. ✅
- **Fournisseurs (2)** → **saisie manuelle recommandée** : leurs en-têtes CSV sont identiques à ceux des clients, le moteur les prendrait pour des clients. 2 lignes = 2 minutes.

### 3.2 Ce qui n'a pas de case toute prête
- **Véhicules (2)** → pas de table dédiée ; se rapprochent du module **Matériel**. Manuel.
- **Notes de frais (5)** et **relevé bancaire** → relèvent de la Mission 2 / hors périmètre import.
- **Documents sensibles** (CNI, RIB) → **jamais en base applicative**, coffre-fort chiffré seulement.

### 3.3 Devis & factures (le cœur de l'effort) — reconstruction depuis les PDF
Test d'extraction effectué :
- **7 devis + ~9 factures « natives » Clementine** : vrai texte, gabarit régulier → **parsables automatiquement** (risque modéré, relecture obligatoire).
- **~27 factures manuelles 2025** (mise en page libre, groupées par pièce) → **parsing peu fiable**, ressaisie/relecture assistée recommandée.
- **109 justificatifs d'achat** : PDF **scannés** (images) → OCR nécessaire ; **hors périmètre** de la reconstruction, au mieux archivés.

Méthode : petit parser dédié au gabarit Clementine → génère des CSV `devis / devis_lignes / factures / facture_lignes` → import via le moteur existant, **avec relecture humaine des montants et du rattachement client**.

### 3.4 🚨 Blocage n°1 (CONFIRMÉ par l'audit) — la numérotation légale
Les tables `devis` et `factures` ont un automatisme SQL (`generate_devis_numero`, `set_facture_numero`) qui **réécrit le numéro à chaque insertion, sans condition**. Un import « tel quel » **détruirait** les numéros légaux figés de Daniela (rupture de chronologie = risqué en contrôle fiscal).

**Correctif requis avant tout import de pièces** (au choix) :
- **Option A (recommandée)** : ajouter un garde `IF NEW.numero IS NULL OR NEW.numero = '' THEN … END IF;` dans les 2 fonctions. Le comportement normal (numéro auto quand vide) reste identique ; on peut en plus fournir un numéro figé. Migration simple et réversible.
- Points de vigilance associés (audit) : importer les factures avec `devis_id = NULL` (sinon le trigger « 1 devis = 1 facture » bloque) ; **resynchroniser les compteurs** après import ; ne **pas** patcher la fonction morte `generate_facture_numero()` (non branchée).

### 3.5 Pièges légaux à respecter
- **Numéros figés & chronologiques** : préserver exactement « 2025-001 » → « 2025-025 » et les numéros natifs. Ne jamais renuméroter.
- **Franchise TVA (art. 293 B du CGI)** : tout sans TVA, mention datée (voir angle mort TVA en 5.3).
- **Séparer l'historique 2025 des indicateurs 2026** (voir 5.2).

### 3.6 Ordre d'import & test
1. clients → 2. fournisseurs (manuel) → 3. prestations → 4. chantiers (si reconstruits) → 5. devis → 6. devis_lignes → 7. factures (après correctif 3.4) → 8. facture_lignes → 9. paiements/planning (optionnel).
**Tester d'abord sur un compte bac-à-sable** (pas le futur vrai compte de Daniela), vérifier 3-4 lignes réelles, purger via soft-delete, puis refaire propre sur le compte de Daniela.

---

## 4. MISSION 2 — Onglet « Dépenses & Banque »

### 4.1 Étude coût des agrégateurs (la question que tu as posée)
| Solution | Gratuit ? | Prix | FR / BoursoBank | Agrément à ta charge ? |
|---|---|---|---|---|
| **GoCardless Bank Account Data** (ex-Nordigen) | ❌ **fermé aux nouveaux comptes depuis juil. 2025** | — | — | — |
| **Enable Banking** | ⚠️ gratuit **mais seulement pour tes propres comptes** (pas ceux de tes clients) | contrat/KYB pour la prod complète | oui | non (porté par eux) |
| **Bridge (by Bankin')** 🇫🇷 | ❌ (sandbox seul) | **~499 €/mois** (seul tarif public) | excellente | **non** (agréé ACPR) |
| **Powens** 🇫🇷 (utilisé par Clementine) | ❌ | **sur devis** | la meilleure sur petites banques | **non** (agréé) |
| Tink / Salt Edge / Yapily / TrueLayer | ❌ (sandbox) | sur devis | correcte | non |

**Réponse nette à « existe-t-il du gratuit ? »** : **non**, plus pour du live multi-clients. La seule brique gratuite (Enable Banking) ne marche que sur tes propres comptes — utile pour un prototype ou ta compta perso, pas pour offrir la fonction à tes clients.

**Point légal rassurant** : tu **n'as PAS besoin d'un agrément ACPR** si tu passes par un de ces agrégateurs — c'est **leur** agrément qui couvre la responsabilité, à condition de rester en **lecture seule** (afficher/catégoriser, jamais initier de paiement) et de recueillir le **consentement** du client. Piège : la connexion doit être **ré-autorisée tous les 180 jours** (authentification forte de la banque), sinon la synchro s'arrête → prévoir une notification « reconnectez votre banque ».

### 4.2 Recommandation : 2 phases
- **V1 — Import de relevé (CSV/OFX) + saisie manuelle + justificatif.** Gratuit, sans agrément, sans dépendance. Réutilise ta logique d'import existante. Le client télécharge son relevé depuis sa banque et pointe ses lignes. **C'est 80 % de la valeur de Clementine sans le coût ni le risque.**
- **V2 — Connexion live via agrégateur** (Bridge en 1er choix : FR, agréé, tarif public ; Powens en alternative). À réserver à un **palier d'abonnement payant** pour amortir les ~500 €/mois, une fois l'usage validé.
- **Toujours garder l'import fichier** même après la V2 : c'est le filet de sécurité quand une connexion bancaire tombe (ça arrive souvent).

### 4.3 Ce qui existe déjà en base (corrigé par l'audit) et ce qui manque
**Existe déjà** : table `achats` (fournisseur + chantier + montants + **`justificatif_url`**), `fournisseurs`, `factures_recues` (OCR fournisseurs, dormant), `sous_traitant_paiements`. Donc **l'entité « dépense avec justificatif » est déjà là** — pas à créer de zéro.
**Manque réellement** : (a) une **couche bancaire** (table de mouvements + import/agrégation) ; (b) un **moteur de rapprochement** ligne bancaire ↔ facture (encaissement) ou ↔ achat (décaissement) avec statut de pointage ; (c) côté encaissements, la table `paiements` existe mais est **vide/inutilisée** (le suivi se fait via le champ `factures.montant_paye`) → à activer pour du multi-versements.

### 4.4 Dépenses de vigilance
- **Idempotence** : réimporter deux fois le même relevé ne doit pas créer de doublons (dédup par hash date+montant+libellé+compte).
- **Dédoublonnage** du relevé Clementine (écriture double → 1 ligne par opération réelle).
- **Flux perso sur compte pro** (fréquent en EI) : prévoir une catégorie « privé / non professionnel » au pointage.
- **RGPD** : justificatifs et données bancaires dans un stockage **privé** (RLS `user_id = auth.uid()`), jamais de credentials bancaires stockés, DPA avec l'agrégateur.

---

## 5. Angles morts & corrections vérifiées

### 5.1 Angle mort RACINE — régime fiscal de Daniela inconnu
Clementine produit un **bilan** (compta de régime réel), mais Daniela réclame une **calculatrice URSSAF en % du CA** (réflexe **micro-entrepreneur**). **Les deux ne cohabitent normalement pas.** Ce paramètre commande la TVA, l'export comptable, la notion de dépense déductible. **→ Ajouter un champ « régime fiscal » (Micro / Réel simplifié / Réel normal) au profil entreprise et conditionner tout le module dessus.**

### 5.2 Historique 2025 vs exercice 2026
Le CA 2025 de Daniela a été déclaré via Clementine — il n'appartient pas à Nexartis. **Prévoir une date de bascule** (« je démarre sur Nexartis au 01/01/2026 ») et traiter les pièces 2025 comme **archive lecture seule, exclue des indicateurs de l'exercice courant** (sinon CA faux + collision de compteur).

### 5.3 ⚠️ Correction légale importante — seuil de franchise TVA
Le seuil BTP de **25 000 € / 27 500 €** (qui circule beaucoup) **n'est PAS en vigueur en 2026** : la réforme a été suspendue puis l'article 25 du PLF 2026 **rejeté le 20/11/2025**. Ce sont les **seuils classiques « prestations de services » revalorisés** qui s'appliquent (ordre de **~37 500 € base / ~41 250 € majoré**, à reconfirmer sur service-public.fr au moment d'implémenter). L'idée d'une **alerte de bascule TVA** reste excellente et différenciante — mais elle doit utiliser le **seuil réellement en vigueur, stocké en base et paramétrable**, jamais un chiffre en dur.

### 5.4 URSSAF micro 2026 (confirmé)
Prestations de services artisanales (BIC) **21,2 %**, vente de marchandises **12,3 %**. Bascule **ACRE de 50 % → 75 %** des taux au **01/07/2026**. Taux à stocker **datés en base** (ils changent chaque année).

### 5.5 Multi-acomptes (nuancé par l'audit)
Nexartis gère déjà la **facturation de situation** (plusieurs factures progressives par devis) + **un acompte unique par facture**, mais **pas** un vrai objet « plusieurs acomptes » avec suivi des versements. Le souhait de Daniela (« plusieurs acomptes possibles ») implique un **rapprochement many-to-one** (plusieurs virements → une facture) avec reste dû — à construire.

### 5.6 L'onglet doit être utile « à vide »
Beaucoup d'artisans ne connecteront jamais leur banque. L'onglet **« Dépenses & Banque »** doit fonctionner en **saisie manuelle + photo justificatif** sans aucune ligne bancaire, sinon il paraît cassé pour une grande partie des utilisateurs.

### 5.7 Nourrir l'expert-comptable
Nexartis ne fait pas le bilan → il doit **donner à l'utilisateur de quoi transmettre à son comptable** : un **« Pack comptable mensuel »** = livre des recettes + registre des achats catégorisés + ZIP des justificatifs (+ export FEC **seulement** si régime réel — un micro n'a pas d'obligation de FEC). C'est ce qui fait que Nexartis **remplace** Clementine au lieu de coexister avec.

---

## 6. Idées neuves — battre Clementine sur le terrain artisan
Clementine relie une dépense à un **compte comptable** ; Nexartis peut la relier à un **CHANTIER**. Toute la différenciation est là.

1. **⭐ Rentabilité réelle par chantier** : au pointage d'une dépense, « affecter à un chantier » → marge réelle = facturé − (matériel + MO + sous-traitance réels). *« Ce chantier t'a rapporté 1 240 € au lieu des 1 800 € prévus. »*
2. **Écart devis ↔ réel** matériel/MO, avec alerte quand un poste dérape.
3. **Scan justificatif par photo mobile → dépense pré-remplie (OCR)**, rattachée au chantier en cours (l'OCR fournisseur est déjà à ton backlog).
4. **Ajout au parc matériel via facture d'achat scannée** (demande explicite de Daniela).
5. **Suivi assurance / contrôle technique véhicule avec rappels** J-30/J-7 (demande de Daniela) — *quick win autonome*.
6. **Trésorerie prévisionnelle** = solde actuel + acomptes attendus des devis signés (échéancés via le planning) − dépenses connues. Clementine montre le passé, toi le futur.
7. **Échéancier d'acomptes multiples + rapprochement auto** de chaque virement entrant (demande de Daniela).
8. **Assistant bascule TVA** au seuil de franchise en vigueur (cf. 5.3) — bouclier juridique + argument de vente.
9. **Calculatrice URSSAF micro** à jour, avec **ventilation MO (21,2 %) / matériel revendu (12,3 %)** — *quick win*.
10. **Calculatrice section de câble selon mode de pose** (NF C 15-100) — ancre Nexartis comme « l'appli de l'électricien » (mention « à titre indicatif »). *Quick win*.

**Séquencement conseillé** : quick wins autonomes (5, 9, 10) → socle « import CSV/OFX + catégories + rapprochement » → idées à fort ROI chantier (1, 2, 7) → agrégateur live + trésorerie prévisionnelle (6) en dernier.

---

## 7. ✅ Décisions à valider (à trancher avec toi)

1. **Régime fiscal de Daniela** : micro-entrepreneur ou EI au réel ? *(défaut proposé : ajouter un champ « régime » et le conditionner ; cible micro par défaut).*
2. **Nom & nature de l'onglet** : « Banque » ou **« Dépenses & Banque »** (banque = simple source) ? *(défaut : Dépenses & Banque).*
3. **Historique 2025** : archive figée non-comptée avec date de bascule ? *(défaut : oui).*
4. **Périmètre reconstruction pièces** : seulement les 7 devis + 9 factures natives, ou aussi les **27 factures manuelles 2025** (ressaisie) ? *(défaut : natives d'abord, manuelles en lot 2).*
5. **Banque V1** : import CSV/OFX gratuit maintenant, agrégateur live (Bridge/Powens) en V2 payante ? *(défaut : oui).*
6. **Multi-acomptes** : construire le rapprochement many-to-one avec reste dû ? *(défaut : oui, dès le socle).*
7. **Livrable expert-comptable** : « Pack comptable mensuel » (recettes + achats + justificatifs zippés) ? *(défaut : oui).*
8. **Correctif numérotation (3.4)** : valider l'Option A (garde `IF numero IS NULL`) comme prérequis bloquant ? *(défaut : oui).*

---

## 8. Prochaine étape
Une fois ces 8 points tranchés, je prépare : (a) la **maquette HTML de validation** de l'onglet « Dépenses & Banque » (avant tout code, selon ta méthode) ; (b) le **script d'import** clients + prestations sur compte bac-à-sable ; (c) la **migration SQL** du correctif numérotation. Rien ne part en prod sans ta validation et ton push `.bat`.

---

## 9. ADDENDUM — Tour live de Clementine (10/07, session Daniela)

**Régime confirmé** : Daniela = **Micro-entreprise** (paramètres Clementine). SIRET 932 935 893 00010, APE **4321A** (installation électrique), N° TVA intra FR52932935893 (attribué mais franchise = pas de TVA facturée). → La question 1 de la section 7 est **tranchée : micro**. Conséquence : export comptable = livre de recettes + registre des achats (pas de FEC obligatoire).

**Organisation de l'app** (URLs réelles) : sidebar = À faire · Tableau de bord · Banques (`/banks` → Relevés + Espèces) · Paiements (`/sales/payments`) · Recouvrement (`/sales/recovery`) · Achats (`/purchases` → Factures + Notes de Frais + Fournisseurs) · Facturation (`/sales` → Factures, Devis, Brouillons, Articles, Clients, Tickets Z) · Comptabilité/Bilan · Salariés · Bibliothèque · Configuration.

**Devis — organisation** (`/sales/quotes`) : 4 cartes de synthèse en haut (Total · **Acceptés** · En attente · Refusé, en montant ttc), liste **groupée par mois**, chaque ligne = numéro `AAAAMM/n` + client, sous-titre « Devis - <objet> », date, **badge de statut**, montant. **Statuts devis** : *Accepté · Facturé · Expiré · En attente · Refusé*. Bouton **« Créer un bon de commande »** (Nexartis ne l'a pas — piste). → Les « devis en cours » de Daniela = statut **Accepté non encore Facturé** (ex. 202606/9 Mme DELMI 350 €, 202604/6 E. LEGROS 850 €).

**Factures — organisation** (`/sales`) : mêmes principes. **Statuts facture** : *Importée* (PDF déposé) · *Encaissé* · *En attente*. Actions : **Importer une facture · Créer un avoir · Créer une facture**. Les factures 2025 apparaissent en « Importée » (PDF).

**Gestion des acomptes (important, répond au point « multi-acomptes »)** : Clementine crée une **facture d'acompte séparée** qui **référence sa facture parente**. Vu en vrai : `202606/7 - AGNOLI · « Acompte sur la facture 202606/6 » (795 €)` puis la facture `202606/6` (1 855 €) ; et un acompte `202607/8` déduit sur la facture finale `202607/9` (-105 €). Donc un chantier = **plusieurs factures d'acompte reliées à la facture finale**, avec déduction automatique du déjà-payé. C'est le modèle à reproduire (many-to-one).

**Banques — le pointage** (`/banks`) : compte relié via **Powens**, carte solde + « Mise à jour effectuée le 09/07/2026 », deux compteurs **Encaissements / Décaissements**, bouton **« Importer des opérations »** (l'import coexiste avec la synchro live). Chaque ligne est **auto-catégorisée** (icône + libellé de catégorie : « Assurance RC », « Retrait de liquidités », « Rémunération dirigeant », « Publicités », « Fournitures administratives »…), avec **justificatif attachable** (trombone) et suggestion d'annotation. C'est **exactement** le cœur de valeur cité par Daniela.

**Recouvrement** (`/sales/recovery`) : ce n'est **pas** de simples relances — c'est un **service** : une facture impayée devient un **« dossier »** avec numéro (ex. Dossier n°C2602-5270065) et statuts *Recouvrée · En cours · Non recouvrée*. C'est de l'externalisation à une société de recouvrement (partenariat), à distinguer des relances logicielles que Nexartis a déjà.

**Exports** (`/settings/exports`) : c'est l'outil qui a généré ton dossier d'export. Deux modes : **« Données de votre application »** (Véhicules, Collaborateurs, Relevés, Caisse, Factures d'achats, Fournisseurs, Notes de frais/**Indemnités kilométriques**, Factures de ventes, Clients, Devis, Articles, Bibliothèque) et **« Données comptables »**. Sortie **ZIP CSV + PDF** sur une période. → Confirme la structure de l'import et valide l'idée du « Pack comptable » côté Nexartis.

## 10. ADDENDUM — Prix EXACTS des agrégateurs (recherche 10/07)

Marché quasi 100 % « sur devis ». Seuls chiffres solides :
- **Bridge (by Bankin', groupe BPCE)** : **~499 €/mois FIXE** (plancher public), agréé ACPR, français. Rentable seulement à volume.
- **Tink (Visa)** : **~0,50 €/utilisateur actif/mois** (+ 0,25 €/vérification de compte) — seul prix unitaire public, MAIS **minimum mensuel négocié caché**.
- **Enable Banking** : **gratuit sur TES propres comptes** ; prod complète (comptes clients) = contrat + KYB + facture mini non publique.
- **Powens** (celui de Clementine), **Salt Edge, Yapily, TrueLayer, Linxo** : **sur devis**, gamme entreprise (probablement ≥ Bridge pour démarrer).
- **GoCardless/Nordigen** : fermé aux nouveaux comptes (juil. 2025). **Plaid** : orienté US, à éviter.

**Coût estimé pour Nexartis** : à **10 utilisateurs** connectés → 100–500 €/mois (absurde, ~10–50 €/user). À **100 utilisateurs** → coût/user tombe à **3–6 €/mois** (absorbable dans un abonnement).
**Seuil de bascule** : en dessous de **~50 utilisateurs** qui réclament la synchro auto, **l'import CSV/OFX gratuit gagne à tous les coups**. → Confirme : **V1 = import CSV/OFX**, agrégateur (devis Enable Banking + Tink + Bridge) seulement à ~50 users, en option payante.
