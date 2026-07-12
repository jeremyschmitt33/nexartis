# Conception UX — Onglet « Dépenses & Banque » (Nexartis)

**Agent Expert Produit/UX · 11/07/2026 · Document de conception (pas de code)**

Fichiers du repo lus pour ancrer cette proposition dans l'existant :
- `CLAUDE.md` (conventions, palette navy/sky/orange/gold/cream, polices Syne/Manrope)
- `PLAN_CLEMENTINE_IMPORT_BANQUE_2026-07-10.md` (sections 4, 5, 6, 9 — décisions actées : V1 import CSV/OFX, micro-régime, différenciateur chantier)
- `app/dashboard/layout.tsx` (sidebar `NAV_GROUPS`, `PAGE_TITLES`, `CREATE_OPTIONS`, `BOTTOM_NAV` mobile)
- `app/dashboard/achats/page.tsx` (onglets `achats | recues`, modal de saisie avec champ chantier + justificatif, filtres période, export CSV/PDF, composants v4)
- `app/dashboard/import/page.tsx` + `lib/import/mappers.ts` (flux d'import en 4 étapes, détection automatique des colonnes, sources obat/tolteck/batappli/henrri/excel)
- `app/dashboard/chantiers/[id]/page.tsx` (fiche chantier existante — futur hôte du bloc rentabilité)
- `app/dashboard/urssaf/page.tsx` (calculatrice URSSAF existante à alimenter par les encaissements)

**Persona de référence** : Daniela, électricienne, micro-entreprise en franchise de TVA, peu à l'aise avec la comptabilité, consulte surtout **sur mobile 375 px le soir après le chantier**. Ce qu'elle aime chez Clementine : « je pointe mes opérations et j'attache le justificatif ». Ce que Clementine ne lui dira jamais : *« est-ce que ce chantier m'a rapporté de l'argent ? »*.

---

## 1. Architecture de l'information

### 1.1 Nom de l'onglet

**« Dépenses & Banque »** (décision actée dans le plan, section 7.2). La banque n'est qu'une **source** parmi d'autres (relevé importé, saisie manuelle, photo de ticket, caisse espèces). On ne l'appelle surtout pas « Banque » : l'onglet doit être pleinement utile sans aucune ligne bancaire (plan, 5.6).

### 1.2 Place dans la sidebar

Dans `NAV_GROUPS`, **groupe métier (groupe 2), juste après « Achats »** :

```
Devis · Planning · Chantiers · Factures · Documents · Rapports · Achats · Dépenses & Banque
```

- Icône : `Landmark` ou `Wallet` (lucide, cohérent avec `Banknote` déjà utilisé pour Factures).
- Ajouter `'/dashboard/depenses': 'Dépenses & Banque'` dans `PAGE_TITLES`.
- Route proposée : `/dashboard/depenses` (avec sous-routes `?tab=` comme le fait déjà Achats).
- Ajouter au menu « + » (`CREATE_OPTIONS`) : **« 📸 Dépense (photo du ticket) »** — c'est le geste star mobile (voir section 3).
- Mobile : ne PAS toucher au `BOTTOM_NAV` (5 items max, déjà plein). L'onglet est accessible via « Plus... », mais le geste photo est accessible via le « + » central.

### 1.3 Sous-onglets de « Dépenses & Banque »

Trois sous-onglets, sur le modèle exact des onglets soulignés orange de la page Achats :

| Sous-onglet | Contenu | Utile sans banque ? |
|---|---|---|
| **Opérations** (défaut) | Toutes les entrées/sorties d'argent : lignes bancaires importées + dépenses saisies à la main + encaissements pointés. Groupées par mois. | ✅ oui (saisies manuelles) |
| **Caisse** | Espèces : fond de caisse + entrées/sorties manuelles. | ✅ oui |
| **Par chantier** | Rentabilité : liste des chantiers avec « facturé − dépensé = gagné ». | ✅ oui |

Le bouton **« Importer un relevé »** est un bouton d'action en haut à droite du sous-onglet Opérations — **pas** un sous-onglet (l'import est un événement ponctuel, pas un lieu de vie).

### 1.4 Articulation avec « Achats » — zéro doublon

C'est LE point de vigilance. La règle :

> **La table `achats` reste l'unique entité « dépense » de Nexartis** (elle a déjà fournisseur, chantier, montants, `justificatif_url` — plan, 4.3). « Dépenses & Banque » ne crée pas une deuxième notion de dépense : il crée une couche **« mouvements d'argent »** (table de lignes bancaires) et un **rapprochement** entre un mouvement et un achat (sortie) ou une facture client (entrée).

Concrètement :
- **Saisir une dépense** dans « Dépenses & Banque » = créer un `achat` (même formulaire que la modal Achats existante, réutilisée). Elle apparaît dans les deux onglets, car c'est **le même objet** — pas une copie.
- **Pointer une ligne bancaire** = la relier à un achat existant, ou en créer un à la volée, ou la relier à une facture client (encaissement).
- **« Achats » devient l'onglet des pièces fournisseurs** : sous-onglets **Achats · Factures reçues · Fournisseurs** (on déplace l'entrée sidebar « Fournisseurs » en sous-onglet d'Achats, décision actée ; l'ancienne route `/dashboard/fournisseurs` redirige pour ne casser aucun lien).
- **« Dépenses & Banque » est l'onglet de l'argent qui bouge** : où il va, d'où il vient, et ce qu'il reste.

Une phrase pour l'utilisateur (affichée en infobulle « ? » sur le titre) : *« Achats = vos factures fournisseurs. Dépenses & Banque = l'argent qui entre et qui sort de votre compte. »*

### 1.5 Prérequis transversal : le régime fiscal

Un champ « Régime » (Micro-entreprise / Réel simplifié / Réel normal) dans Paramètres > Mon entreprise conditionne tout le module (plan, 5.1). Pour Daniela (micro, tranché en addendum 9) : **aucune mention de TVA dans les écrans de dépenses**, catégories simplifiées, export = livre de recettes + registre des achats (pas de FEC).

---

## 2. Les écrans, un par un

### 2.1 État vide (crucial — c'est le premier contact)

Clementine soigne son état vide caisse (2 illustrations + « Commencer »). On fait mieux : l'état vide de « Opérations » n'est **pas** une impasse « importez votre relevé », c'est un **choix à trois portes**, car la majorité des artisans ne connecteront jamais leur banque (plan, 5.6).

**Composition (fond `cream`, titre `font-syne` navy, corps `font-manrope`)** :

- Illustration légère (style trait, couleurs navy/orange de la charte — pas de stock photo).
- Titre : **« Suivez où part votre argent, chantier par chantier »**
- Sous-titre : « Ajoutez vos dépenses comme ça vous arrange. Pas besoin de connaître la compta : une photo du ticket suffit. »
- **3 cartes d'action** (empilées sur mobile, côte à côte sur desktop) :
  1. 📸 **« Photographier un ticket »** — « Le plus rapide. On lit le montant pour vous. » (bouton orange plein — action principale)
  2. ✍️ **« Saisir une dépense à la main »** — « 30 secondes, montant + chantier. »
  3. 🏦 **« Importer mon relevé bancaire »** — « Le fichier CSV ou OFX que votre banque vous laisse télécharger. On s'occupe du reste. »
- Micro-lien en dessous : « C'est quoi, un relevé CSV/OFX ? » → ouvre un panneau d'aide avec captures des 4-5 banques les plus courantes (Crédit Agricole, BNP, Boursorama, Qonto, Shine) montrant **où cliquer** pour télécharger le fichier. C'est un état vide qui **enseigne**, pas qui culpabilise.

État vide de « Caisse » : voir 2.7. État vide de « Par chantier » : « Ajoutez une dépense et rattachez-la à un chantier : on vous dira s'il vous rapporte de l'argent. » + bouton « Ajouter ma première dépense ».

### 2.2 Liste des opérations (sous-onglet « Opérations »)

On garde ce qui marche chez Clementine (cartes de synthèse, groupement par mois — patterns déjà présents dans Nexartis côté Devis/Achats) et on ajoute notre valeur (chantier, reste à trier).

**En haut** :
- **3 cartes de synthèse** (pattern existant de la page Achats) : **Entrées** (vert, ex. + 5 401 €) · **Sorties** (rouge doux, ex. − 5 921 €) · **À trier** (orange, ex. « 12 opérations ») — la 3ᵉ carte est cliquable et filtre la liste. C'est notre « to-do » intégré : Clementine a un onglet « À faire » séparé, nous on met le compteur là où on agit.
- **Filtre de période** : chips « Ce mois · Mois dernier · 3 derniers mois · Année · Personnalisé » (harmonisé avec le `FilterPeriod` d'Achats).
- Si un relevé a été importé : bandeau discret « Relevé à jour au 30/06/2026 — Importer la suite » (équivalent honnête du « mise à jour le X » de Clementine, sans faire croire à du temps réel).
- Barre de recherche (pattern `Search` d'Achats) + bouton **« Importer un relevé »** + bouton **« + Dépense »**.

**La liste, groupée par mois** (« Juin 2026 — 14 opérations · − 1 240 € »), chaque ligne :
- Icône ronde de catégorie (fond pastel sky/gold/cream selon la famille).
- **Ligne 1** : libellé lisible (si ligne bancaire : le libellé banque nettoyé, ex. « CB REXEL BORDEAUX » → « Rexel Bordeaux »).
- **Ligne 2 (sous-titre)** : catégorie + **chip chantier** si rattachée (ex. `🏠 Salle de bain Legros`) — c'est LA différence visuelle avec Clementine, le chantier est visible dès la liste.
- À droite : date, montant coloré (vert entrée / navy sortie ; le rouge est réservé aux alertes), trombone 📎 si justificatif.
- **Badge d'état** discret : rien si pointée · point orange « À trier » si non catégorisée · pastille grise « Perso » si marquée privée.
- Une ligne non pointée entière = zone tapable → ouvre le panneau de pointage.

**Différence assumée avec Clementine** : pas de pagination chiffrée — scroll infini par mois (plus naturel au pouce), la recherche et les filtres servant d'accès direct.

### 2.3 Panneau de pointage (clic/tap sur une ligne)

Desktop : panneau latéral droit (drawer). Mobile : **bottom sheet** plein écran qui se ferme en glissant vers le bas. Ordre des éléments pensé pour le pouce : les actions fréquentes en bas.

**Contenu, de haut en bas** :
1. **Rappel de l'opération** : montant en très grand (`font-syne`), libellé bancaire brut en dessous (petit, gris — on ne le cache pas, c'est la preuve), date, compte source (« Relevé Boursorama » ou « Saisie manuelle » ou « Caisse »).
2. **« C'est quoi cette dépense ? »** (catégorie) :
   - 3 **chips de suggestion** : « On pense à : Fournitures chantier · Carburant · Outillage » (heuristique par mots-clés du libellé + apprentissage : « la dernière fois, REXEL = Fournitures chantier » — on mémorise les choix de l'utilisateur, c'est plus fiable que l'IA générique de Clementine).
   - Sinon, recherche + liste de catégories **en français d'artisan avec exemples concrets** (on garde cette excellente idée de Clementine) : « Fournitures chantier — câbles, tableau, gaines, plomberie… », « Outillage — perceuse, multimètre… », « Véhicule — gasoil, entretien, assurance du camion », « Assurances pro — décennale, RC pro », « Repas & déplacements », « Téléphone & logiciels », « Cotisations & impôts — URSSAF, CFE », « Rémunération — ce que je me verse », « Perso — rien à voir avec l'entreprise ».
   - **Pas de plan comptable, pas de numéros de compte, jamais.** 12-15 catégories max en V1.
3. **« Pour quel chantier ? »** — LE geste différenciant, voir 2.6. Chips des chantiers actifs + « Aucun / frais généraux ».
4. **Justificatif** : zone « 📎 Ajouter le ticket ou la facture » — sur mobile, ouvre directement **l'appareil photo** (avec option « choisir un fichier »). Formats jpeg/png/pdf/**heic** (les iPhone produisent du HEIC, Clementine le refuse), **10 Mo** max (les 2 Mo de Clementine font échouer les photos d'iPhone — friction constatée). Miniatures des justificatifs déjà attachés avec aperçu / téléchargement / suppression.
5. **Cas particuliers** (liens discrets, pas des toggles anxiogènes) :
   - « C'est un remboursement ou un avoir » (équivalent du toggle Clementine, mais en français clair)
   - « C'est un virement entre mes comptes » → exclut des totaux (voir section 6)
   - « C'est perso » → catégorie Perso en un tap, exclu des stats pro
6. **Pied du panneau (zone du pouce)** : gros bouton **« C'est noté ✓ »** (orange plein) + lien « Passer » (garde « À trier »).
7. **Enchaînement rapide** : après validation, le panneau charge automatiquement **la prochaine opération à trier** avec un compteur « Plus que 7 à trier » — le pointage devient une file qu'on vide dans le bus, pas une corvée. (Clementine ferme le panneau à chaque fois : friction.)

### 2.4 Flux d'import CSV/OFX — étape par étape

On réutilise le squelette 4 étapes de `app/dashboard/import/page.tsx` (StepIndicator existant) et **on exploite la faiblesse n°1 de Clementine** : son import impose un modèle de colonnes rigide, un ordre imposé, 1 500 lignes max, et un avertissement culpabilisant. Nexartis a déjà une **détection sémantique des colonnes** (source `excel` de `lib/import/mappers.ts`, « Les colonnes seront détectées automatiquement ») : on l'étend aux relevés.

**Étape 1 — Déposer le fichier** (on saute le choix de source : inutile ici)
- Zone de dépôt : « Glissez le relevé téléchargé depuis votre banque (CSV, OFX ou Excel). **Pas besoin de le modifier : on se débrouille avec le fichier tel quel.** »
- Lien d'aide « Où trouver ce fichier dans ma banque ? » (même panneau qu'en 2.1).
- Accepte : `.csv` (tous séparateurs `;` `,` tab, encodages UTF-8/Latin-1 auto-détectés), `.ofx`/`.qif`, `.xlsx`. **Aucun modèle à télécharger, aucun ordre de colonnes imposé.**
- Limite généreuse : 10 000 lignes (vs 1 500 chez Clementine) — un an de relevé passe en une fois.

**Étape 2 — Vérification intelligente (l'écran qui tue Clementine)**
- Le moteur détecte : colonne date (formats FR `31/12/2025`, ISO, Excel serial), montant (virgule ou point, colonnes débit/crédit séparées **ou** montant signé — le CSV Clementine en écriture double est reconnu et dédoublonné automatiquement, plan 4.4), libellé, solde éventuel.
- Affichage : « **On a reconnu votre fichier** ✓ Banque détectée : Boursorama · 273 opérations · du 01/01 au 30/06/2026 · Total entrées + 5 401 € · Total sorties − 5 921 € » + **aperçu des 5 premières lignes déjà interprétées** (date propre, libellé propre, montant coloré).
- Si un doute subsiste sur UNE colonne seulement : mini-question ciblée en langage humain — « Cette colonne, c'est la date de l'opération ? [Oui] [Non, c'est une autre date] » — jamais un tableau de mapping complet à remplir.
- Choix du compte : « Ajouter à : [Compte pro Boursorama ▾] ou + Nouveau compte » (comme Clementine, mais avec le solde de fin de fichier proposé automatiquement comme solde de référence).
- **Détection de doublons AVANT import** : « 41 opérations sont déjà dans Nexartis (même date, même montant, même libellé) : on ne les réimportera pas. » (hash date+montant+libellé+compte, plan 4.4). Réimporter deux fois le même fichier = zéro doublon, zéro angoisse.

**Étape 3 — Import + pré-tri automatique**
- Barre de progression, puis : « **232 opérations ajoutées.** On en a trié 178 automatiquement (fournisseurs et catégories reconnus). Il vous en reste **54 à vérifier** — 5 minutes, promis. » Bouton « Commencer le tri » → ouvre la file de pointage (2.3, mode enchaîné).
- Reconnaissance automatique : les libellés contenant un fournisseur connu (table `fournisseurs`), l'URSSAF, une assurance déjà vue, un client dont une facture attend le même montant (→ suggestion d'encaissement, plan 4.3.b) sont pré-pointés en statut « suggéré » (l'utilisateur confirme d'un tap, il ne repart jamais de zéro).

**Étape 4 — Résultats** : réutilise le Step4 existant (compteurs verts) + « Importer un autre fichier » / « Voir mes opérations ».

**Ce qu'on ne copie PAS de l'import Clementine** : le modèle CSV à télécharger, l'ordre de colonnes imposé, la limite 1 500 lignes, la phrase « uniquement si vous n'avez pas pu synchroniser » (chez nous l'import est le chemin normal et fier, pas un pis-aller), l'import de PDF de relevé (V2 — OCR fragile, on ne promet pas ce qu'on ne tient pas).

### 2.5 Saisie manuelle d'une dépense

On réutilise la modal d'Achats existante (fournisseur, date, montant, description, chantier, justificatif) avec trois ajustements :
1. **Ordre des champs repensé pour la vitesse** : Montant (gros, clavier numérique) → Chantier (chips) → Catégorie (chips) → Photo → le reste est optionnel (fournisseur, description). Date pré-remplie à aujourd'hui.
2. **En régime micro : pas de champ TVA du tout** (la modal Achats actuelle affiche « TVA 20 % » par défaut — à masquer conditionnellement au régime, plan 5.1).
3. Choix « Payé avec : Compte pro · Espèces · Carte perso » — « Espèces » écrit aussi dans la Caisse ; « Carte perso » crée une note de frais remboursable (concept Clementine traduit en : *« payé de ma poche, l'entreprise me le doit »*).

Bouton de validation : « Enregistrer la dépense ». Toast de confirmation (pattern `lib/toast` existant) : « Dépense de 87,30 € ajoutée au chantier Legros ✓ ».

### 2.6 Rattachement au chantier — le geste ultra-rapide

Règles de design pour que ce geste prenne **moins de 2 secondes** :
- **Chips, jamais de dropdown** : les 4-6 chantiers **actifs** (statut en cours, table `chantiers` déjà branchée dans la modal Achats) en chips horizontales scrollables, ordonnées par activité récente. + une chip « Autre… » (recherche) et « Aucun / frais généraux ».
- **Proposition par défaut intelligente** : le chantier du jour selon le **Planning** (si une intervention est planifiée aujourd'hui sur le chantier Legros, la chip Legros est pré-surlignée : « Aujourd'hui vous étiez chez Legros, c'est pour ce chantier ? »). C'est le croisement Planning × Dépenses que Clementine ne peut structurellement pas faire.
- **Mémoire fournisseur × chantier** : si les 3 derniers achats Rexel sont allés au chantier Legros, Rexel → chip Legros pré-sélectionnée.
- **Rattachement réparable** : depuis la liste, appui long (mobile) ou menu ⋯ (desktop) → « Changer de chantier » sans rouvrir tout le panneau.
- **Multi-chantiers (V1.1, pas V1)** : « Répartir sur plusieurs chantiers » (ex. une commande Rexel pour 2 chantiers) — lien discret dans le panneau, split en pourcentage ou montants.

### 2.7 Caisse espèces (sous-onglet « Caisse »)

Version simplifiée du concept Clementine, vocabulaire artisan :
- **État vide** : « Vous encaissez ou payez parfois en liquide ? Notez-le ici pour ne rien perdre. » → bouton « Démarrer ma caisse » → une seule question : « Combien avez-vous en liquide aujourd'hui ? » (fond de caisse initial, peut être 0) + date.
- **Écran actif** : grosse carte « Dans la caisse : 240 € » + deux boutons « + Argent reçu » / « − Argent dépensé » + liste des mouvements par mois (mêmes lignes que 2.2, source « Caisse »).
- Un mouvement de caisse est une opération comme les autres : catégorie, chantier, justificatif — il apparaît aussi dans « Opérations » avec la pastille « Espèces ».
- Garde-fou : si la caisse passerait en négatif → message doux « Votre caisse passerait sous zéro. Vérifiez le montant, ou notez d'abord l'argent reçu. » (blocage non punitif).
- « Retrait de liquidités » pointé sur une ligne bancaire → proposition automatique : « Ajouter ces 100 € à votre caisse ? » (lien banque ↔ caisse, voir section 6 virements internes).

### 2.8 Vue rentabilité chantier (sous-onglet « Par chantier » + bloc dans la fiche chantier)

Le différenciateur assumé (plan, 6.1-6.2). Deux emplacements, une seule logique :

**a) Sous-onglet « Par chantier »** — liste des chantiers (actifs d'abord), une carte par chantier :
- Nom + client + statut.
- **Barre visuelle simple** : Facturé (vert) vs Dépensé (orange) — pas de camembert, pas de jargon.
- La phrase clé, en français : **« Ce chantier vous a rapporté 1 240 € »** (ou, en négatif : « Ce chantier vous a coûté 180 € de plus que ce qu'il a rapporté » — rouge doux + lien « Voir pourquoi »).
- Ligne secondaire : « Prévu au devis : 1 800 € · Écart : − 560 € ».
- Tri : « Les plus rentables / Les moins rentables / Récents ».

**b) Bloc « Argent » dans la fiche chantier** (`app/dashboard/chantiers/[id]/page.tsx`) : mêmes chiffres + liste des dépenses rattachées + bouton « + Ajouter une dépense à ce chantier » (pré-rattachée, évidemment).

**Honnêteté des chiffres (essentiel pour la confiance)** : une infobulle « Comment on calcule ? » : « Rapporté = ce que vous avez facturé sur ce chantier. Dépensé = les dépenses que vous y avez rattachées. Si vous n'avez pas tout rattaché, le chiffre est optimiste. » + indicateur « 3 dépenses sans chantier ce mois-ci → les trier ». On n'invente pas la main-d'œuvre en V1 (pas de coût horaire imposé) ; V1.1 : champ optionnel « mon coût horaire » pour intégrer les heures du Planning.

---

## 3. Parcours mobile 375 px (le soir, une main, fatigué)

**Principes** : toutes les actions primaires dans le tiers inférieur de l'écran ; bottom sheets plutôt que modales centrées ; cibles tactiles ≥ 44 px ; clavier numérique pour les montants ; jamais plus d'une décision par écran.

### 3.1 Le geste star : photo de ticket → dépense en 3 tapes

1. **Tape 1** : bouton « + » (déjà central dans le bottom nav) → « 📸 Dépense (photo du ticket) » (première option du menu).
2. **Tape 2** : l'appareil photo s'ouvre directement → photo du ticket. L'OCR (backlog existant, plan 6.3) pré-remplit montant + date + fournisseur ; en attendant l'OCR (V1 sans OCR) : la photo est attachée et le montant est le seul champ à saisir (clavier numérique auto-ouvert).
3. **Tape 3** : la chip chantier proposée (planning du jour, cf. 2.6) est pré-sélectionnée → **« Enregistrer »**. Toast : « C'est noté ✓ ». Terminé.

Si l'utilisateur veut préciser (catégorie, description), tout est éditable — mais **rien d'autre n'est obligatoire**. Une dépense « montant + photo + chantier » est une dépense valide ; le tri fin peut attendre le canapé.

### 3.2 Autres actions à une main
- **Vider la file « À trier »** : depuis la carte orange → bottom sheet enchaînée (2.3), boutons de validation en bas, swipe down pour passer. Rythme : ~6 s par opération.
- **Consulter « ce chantier me rapporte-t-il ? »** : 2 tapes (Plus… → Dépenses & Banque → Par chantier) ou depuis la fiche chantier.
- **Caisse** : « − Argent dépensé » → montant → chantier → OK.
- **À réserver au desktop** (assumé, avec message) : l'import de relevé (« Plus confortable sur ordinateur — mais ça marche aussi ici »), l'export comptable. On ne bloque pas, on recommande.

---

## 4. Ce qui rend Nexartis MEILLEUR que Clementine (et ce qu'on ne copie pas)

### On fait mieux
1. **Le chantier au cœur** : chaque euro dépensé répond à « pour quel chantier ? » → rentabilité réelle, écart devis/réel. Clementine relie à un compte comptable ; structurellement incapable de répondre à la question qui intéresse l'artisan (plan, section 6).
2. **Import sans modèle imposé** : détection sémantique des colonnes (moteur existant), tous formats/banques, dédoublonnage auto, 10 000 lignes — contre le CSV rigide, l'ordre imposé et les 1 500 lignes de Clementine. L'import est un chemin fier, pas un pis-aller « si vous n'avez pas pu synchroniser ».
3. **Utile à vide** : saisie manuelle + photo dès la première minute, sans banque, sans configuration (plan, 5.6). Clementine sans synchro Powens est une coquille.
4. **Croisement avec le Planning** : « vous étiez chez Legros aujourd'hui » → rattachement pré-rempli. Impossible chez un pur outil compta.
5. **File de pointage enchaînée** avec compteur, au lieu d'un panneau qui se referme à chaque ligne.
6. **Français d'artisan partout** : « C'est quoi cette dépense ? », « Ce chantier vous a rapporté… » — zéro « décaissement », zéro « annotation », zéro plan comptable.
7. **Adapté au régime micro** : pas de TVA affichée en franchise, calculatrice URSSAF alimentée par les vrais encaissements (ventilation 21,2 % services / 12,3 % ventes, plan 5.4), alerte seuil de franchise TVA avec seuil paramétré en base (plan 5.3).
8. **Pack comptable mensuel** (plan, 5.7) : livre de recettes + registre des achats + ZIP des justificatifs — de quoi remplacer Clementine, pas coexister avec.
9. **Justificatifs sans friction** : photo directe, HEIC accepté, 10 Mo (vs 2 Mo).
10. **Doublons impossibles** : hash d'idempotence à l'import — réimporter n'est jamais dangereux.

### On ne copie PAS
- **Bilan, liasse fiscale, déclarations TVA/IS** : métier d'expert-comptable, risqué et hors sujet (plan, section 2).
- **La synchro bancaire live en V1** : ~500 €/mois, non rentable sous ~50 utilisateurs (plan, addendum 10). V2, palier payant.
- **Le service de recouvrement externalisé** (dossiers C2602-…) : partenariat lourd ; Nexartis a déjà les relances logicielles. À réévaluer plus tard.
- **L'import PDF de relevé** : OCR fragile, promesse intenable en V1.
- **La pagination chiffrée et le tri multi-colonnes** : sur-outillage desktop ; scroll par mois + recherche suffisent.
- **Le jargon** : « Encaissements/Décaissements » → « Entrées/Sorties » ; « Avoir » seul → « Remboursement ou avoir » ; « Annotation » → rien (on n'en a pas besoin).

---

## 5. Textes d'interface (libellés exacts)

### Navigation & titres
- Sidebar : **Dépenses & Banque** · Sous-onglets : **Opérations · Caisse · Par chantier**
- Cartes de synthèse : **Entrées** / **Sorties** / **À trier**
- Boutons d'en-tête : **Importer un relevé** · **+ Dépense**
- Menu « + » global : **📸 Dépense (photo du ticket)**

### État vide (Opérations)
- Titre : **« Suivez où part votre argent, chantier par chantier »**
- Sous-titre : « Ajoutez vos dépenses comme ça vous arrange. Pas besoin de connaître la compta : une photo du ticket suffit. »
- Cartes : **« Photographier un ticket »** / **« Saisir une dépense à la main »** / **« Importer mon relevé bancaire »**
- Lien d'aide : « C'est quoi, un relevé CSV/OFX ? »

### Panneau de pointage
- Sections : **« C'est quoi cette dépense ? »** · **« Pour quel chantier ? »** · **« 📎 Ajouter le ticket ou la facture »**
- Suggestions : « On pense à : … »
- Liens cas particuliers : « C'est un remboursement ou un avoir » · « C'est un virement entre mes comptes » · « C'est perso »
- Validation : **« C'est noté ✓ »** · Compteur : « Plus que 7 à trier »
- Encaissement suggéré : « Ce virement de 850 € ressemble au règlement de la facture 2026-014 (Legros). C'est bien ça ? [Oui, c'est réglé] [Non] »

### Import
- Étape 1 : « Glissez le relevé téléchargé depuis votre banque (CSV, OFX ou Excel). Pas besoin de le modifier : on se débrouille avec le fichier tel quel. »
- Étape 2 : « **On a reconnu votre fichier ✓** » · « 41 opérations sont déjà dans Nexartis : on ne les réimportera pas. »
- Étape 3 : « 232 opérations ajoutées. Il vous en reste 54 à vérifier — 5 minutes, promis. » · Bouton **« Commencer le tri »**

### Messages d'erreur d'import (jamais culpabilisants, toujours une sortie)
- Fichier illisible : « **On n'arrive pas à lire ce fichier.** Vérifiez que c'est bien le relevé téléchargé depuis votre banque (CSV, OFX ou Excel). Si ça bloque toujours, envoyez-nous le fichier : on le fera passer. [Réessayer] [Contacter l'aide] »
- Colonne douteuse : « Cette colonne, c'est bien la date de l'opération ? [Oui] [Non, montrez-moi] »
- Fichier vide / que des doublons : « Tout est déjà là ! Ce fichier ne contient aucune opération nouvelle. »
- Mauvais fichier (ex. liste de clients) : « Ce fichier ressemble à une liste de clients, pas à un relevé bancaire. Pour importer des clients, passez par Importer > Clients. »
- PDF déposé : « Les relevés PDF ne sont pas encore acceptés. Téléchargez la version CSV ou OFX depuis votre banque — on vous montre où : [Voir le guide] »

### Rentabilité
- Positif : **« Ce chantier vous a rapporté 1 240 € »** · Négatif : « Ce chantier vous a coûté 180 € de plus que ce qu'il a rapporté. [Voir pourquoi] »
- Incomplet : « 3 dépenses ne sont rattachées à aucun chantier ce mois-ci. [Les trier] »

### Caisse
- État vide : « Vous encaissez ou payez parfois en liquide ? Notez-le ici pour ne rien perdre. » · Bouton **« Démarrer ma caisse »**
- Question initiale : « Combien avez-vous en liquide aujourd'hui ? »
- Boutons : **« + Argent reçu »** / **« − Argent dépensé »** · Carte : « Dans la caisse : 240 € »

---

## 6. Frictions anticipées et solutions

| # | Friction | Solution UX |
|---|---|---|
| 1 | **CSV mal formé** (séparateur exotique, encodage, colonnes débit/crédit séparées, dates US) | Détection sémantique multi-heuristiques ; en dernier recours une seule micro-question ciblée, jamais un mapping complet. Bouton « Contacter l'aide » avec envoi du fichier (anonymisé) pour ajouter la banque au moteur. |
| 2 | **Doublons** (réimport du même relevé, chevauchement de périodes) | Hash date+montant+libellé+compte, filtrage silencieux annoncé (« 41 déjà là »). Cas limite : 2 achats identiques le même jour chez le même fournisseur → on garde les deux si le fichier les contient deux fois dans le même import (le doublon n'existe qu'entre imports). |
| 3 | **Écriture double Clementine** (540 lignes = 270 opérations) | Détection du format « débit + crédit miroir » à l'étape 2 → dédoublonnage automatique, annoncé : « Ce fichier compte chaque opération deux fois (format comptable) : on a gardé une ligne par opération. » |
| 4 | **Opération inconnue** (libellé bancaire cryptique) | Statut « À trier » assumé et non bloquant : rien n'oblige à tout trier. Libellé brut toujours visible dans le panneau. Recherche Google du libellé proposée en lien discret (« C'est quoi ce prélèvement ? »). Apprentissage : une fois triée, toutes les futures occurrences du même libellé sont pré-triées. |
| 5 | **Virement interne** (compte pro → perso, retrait espèces, épargne) | Lien « C'est un virement entre mes comptes » → exclu des Entrées/Sorties et de la rentabilité, catégorie « Mouvement interne ». Cas « Retrait de liquidités » → proposition d'alimenter la Caisse (2.7). Cas « virement vers moi-même » → catégorie « Rémunération — ce que je me verse » (pas une dépense pro déductible en micro, mais utile à suivre). |
| 6 | **Dépense perso sur compte pro** (fréquent en EI, plan 4.4) | Bouton « C'est perso » en un tap → pastille grise, exclue des stats, de la rentabilité et du registre des achats. Aucun jugement dans le wording. |
| 7 | **Paiement pro avec la carte perso** | « Payé avec : Carte perso » → note de frais : « L'entreprise vous doit 45,80 € » + compteur cumulé dans Opérations ; remboursement pointable plus tard sur la ligne bancaire correspondante. |
| 8 | **Peur de « mal faire sa compta »** | Aucune action n'est irréversible : re-catégoriser, dé-rattacher, supprimer (soft delete `deleted_at`, convention projet) toujours possibles. Micro-texte rassurant dans le panneau : « Vous pourrez toujours modifier plus tard. » |
| 9 | **Solde faux** (import partiel, période manquante) | On n'affiche PAS de « solde du compte » calculé en V1 (piège de crédibilité) — seulement Entrées/Sorties de la période et « relevé à jour au X ». Le solde affiché n'arrive qu'avec la synchro live V2, ou si le fichier OFX fournit un solde certifié. |
| 10 | **Trou de période** (dernier import = mars, on est en juillet) | Bandeau : « Il manque peut-être des opérations entre le 31/03 et aujourd'hui. [Importer la suite] » — calculé sur la date max importée. |
| 11 | **Encaissement partiel / multi-acomptes** (plan 5.5) | Pointage d'un virement sur une facture → si montant < reste dû : « Acompte de 795 € sur la facture 2026-014. Reste dû : 1 060 €. » (many-to-one, table `paiements` à activer). |
| 12 | **Justificatif trop lourd / mauvais format** | Compression côté client avant upload ; HEIC converti automatiquement ; message : « Photo trop lourde : on l'a réduite pour vous. » (jamais de rejet sec). |
| 13 | **Historique 2025 importé** (plan 5.2) | Les opérations antérieures à la date de bascule (paramètre « Je démarre sur Nexartis au… ») sont marquées « Archive » : consultables, exclues des cartes de synthèse et de l'URSSAF de l'exercice courant. |

---

## Résumé (15 lignes)

1. Onglet **« Dépenses & Banque »** dans le groupe métier de la sidebar, après Achats ; 3 sous-onglets : **Opérations, Caisse, Par chantier**.
2. Zéro doublon avec Achats : la table `achats` reste l'unique entité « dépense » ; le nouvel onglet ajoute les **mouvements d'argent** et le **rapprochement** ; Fournisseurs devient un sous-onglet d'Achats.
3. **Utile à vide** : l'état vide propose 3 portes (photo de ticket, saisie manuelle, import de relevé) — la banque n'est qu'une source parmi d'autres.
4. Liste des opérations groupée par mois avec cartes **Entrées / Sorties / À trier**, chip chantier visible dès la liste.
5. Panneau de pointage en bottom sheet mobile : catégorie en français d'artisan (12-15 max, avec exemples), **chip chantier pré-remplie via le Planning du jour**, justificatif photo, validation « C'est noté ✓ », file enchaînée.
6. **Import sans modèle imposé** : détection sémantique des colonnes (moteur existant étendu), CSV/OFX/Excel, dédoublonnage par hash, gestion de l'écriture double Clementine — l'anti-Clementine assumé.
7. **Geste star mobile 375 px : photo du ticket → dépense en 3 tapes** via le « + » du bottom nav ; seul le montant est obligatoire.
8. **Rentabilité par chantier** : « Ce chantier vous a rapporté 1 240 € », écart devis/réel, bloc miroir dans la fiche chantier — le différenciateur que Clementine ne peut pas copier.
9. Caisse espèces simple (fond de caisse + « Argent reçu / dépensé »), reliée aux retraits bancaires.
10. Régime micro respecté : aucune TVA affichée, URSSAF alimentée par les encaissements, seuil de franchise paramétré en base.
11. Frictions couvertes : doublons, virements internes, dépense perso (« C'est perso » en 1 tap), carte perso → note de frais, pas de solde affiché en V1 (crédibilité).
12. On ne copie pas : bilan/liasse, synchro live (V2 payante), import PDF, recouvrement externalisé, jargon comptable.
13. Textes d'interface fournis mot à mot (boutons, états vides, erreurs d'import) en français simple artisan.
14. Réutilise l'existant : modal Achats, StepIndicator d'import, composants v4, toasts, patterns de la sidebar (`NAV_GROUPS`, `CREATE_OPTIONS`).
15. Prochaine étape logique : maquette HTML de validation (méthode projet, plan section 8) avant toute ligne de code.
