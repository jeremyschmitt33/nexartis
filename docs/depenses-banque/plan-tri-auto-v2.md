# Tri automatique intelligent — plan V2 (à valider par jeremy)

> Objectif fondateur : **l'artisan ne doit PAS passer une demi-heure à trier ses premiers
> virements.** Le système reconnaît un maximum tout seul dès le premier import ; le tri
> manuel est réservé aux **vrais gros doutes**. Rédigé le 13/07/2026 après confrontation
> (agent confrontateur) + revue d'expérience (agent UX).

## Ce qui est DÉJÀ en production (fait le 13/07)

**Dictionnaire système enrichi** : 24 → **64 règles** mono-catégorie certaines
(migration `sql/2026-07-13-banque-10-dictionnaire-enrichi.sql`). Les marchands pro
distinctifs (Castorama, Gedimat, Cedeo, Manomano, Würth, Total Access, Shell, Vinci
Autoroute, APRR, Sanef, Sosh, OVHcloud, Adobe, Microsoft, Trésor Public, Google Ads,
Meta, Pages Jaunes…) sont **auto-catégorisés et auto-pointés** dès l'import. Audité :
0 faux positif sur données réelles, 0 collision. Les crédits ne sont jamais auto-classés
en recette (enjeu URSSAF).

## L'architecture cible à 3 niveaux de confiance (validée par les deux agents)

1. **Niveau 1a — Certain → auto-catégorisé ET auto-pointé** (débits only). Marchands
   mono-catégorie / payeurs institutionnels. *C'est ce qui vient d'être livré.* On
   continuera d'enrichir cette liste au fil de l'eau (marchands nationaux sûrs).

2. **Niveau 1b — Reconnu mais ambigu → SUGGESTION (catégorie pré-remplie, NON pointé).**
   Enseignes multi-activités : Leclerc, Intermarché, Carrefour, Super U, Amazon, Action
   (carburant OU courses OU bazar), assureurs généralistes (perso/pro indiscernable),
   supermarchés → suggéré « privé » requalifiable. L'artisan **confirme d'un clic**,
   idéalement **en masse par marchand**. *À CONSTRUIRE (voir plan ci-dessous).*

3. **Niveau 2 — Heuristique mots-clés → SUGGESTION.** Un noyau ULTRA-fiable seulement
   (AUTOROUTE/PEAGE, ASSURANCE/MUTUELLE), en **mot entier** (jamais sous-chaîne), pour
   ne pas générer d'erreurs grossières. Le reste (boulangerie/restaurant/garage…) est
   **reporté** tant qu'on n'observe pas de vraies données pro. *À CONSTRUIRE, prudent.*

3-bis. **Niveau 3 — Apprentissage** (déjà en prod) : correction manuelle → règle apprise
   → propagation aux similaires. Filet pour les marchands régionaux/locaux, appris aux
   imports suivants.

### Règles d'or (non négociables, issues de la confrontation)
- **Auto-pointer UNIQUEMENT le mono-catégorie certain.** Au moindre doute → suggestion.
- **Jamais auto-pointer « privé ».** Jamais auto-catégoriser un **crédit** en recette
  (un crédit peut être un apport perso, un remboursement, un virement interne : le
  classer en recette gonflerait la base URSSAF → l'artisan surpaierait ses cotisations).
- **Toute suggestion est réversible et visiblement « à confirmer »** (jamais présentée
  comme un acquis). L'auto-pointé est **taggé « classé automatiquement »**, consultable,
  et **dé-pointable en masse**.

## Ce qu'il reste à CONSTRUIRE (nécessite ton feu vert — touche le module vivant + l'UI)

### A. Distinguer « suggéré » de « confirmé » au niveau données (prérequis)
Aujourd'hui un mouvement `a_pointer` + `categorie_id` est ambigu (suggestion machine ?
choix utilisateur ?). Il faut un discriminant : soit un **3ᵉ statut `suggere`**, soit
une colonne `est_suggestion`. Sans lui, impossible d'afficher honnêtement
« X classés · Y à confirmer · Z à trier » et un « tout valider » avalerait des
suggestions risquées. → petite migration + adaptation des compteurs.

### B. Niveau 1b (enseignes ambiguës) + noyau heuristique → en SUGGESTION
Ajouter un drapeau `auto_point` (bool) sur `categorisation_regles` : les règles 1b ont
`auto_point=false` → l'import pose `categorie_id` mais laisse `suggere`/`a_pointer`.

### C. UX anti cold-start (le vrai levier — l'agent UX est formel)
1. **Écran de synthèse « victoire » post-import** : cadrer par le travail FAIT.
   « **47 opérations déjà classées** · 8 à confirmer · 5 à trier », gros chiffre vert,
   une seule action dominante (« Vérifier les 5 doutes » / « Terminer »).
2. **Tri groupé PAR MARCHAND** (mode principal, pas la file une-par-une) :
   « 9× E.LECLERC → [Privé ▼] [Valider les 9] ». Divise la charge perçue par 4-5.
   Cartes empilées (mobile-first), sélecteur = bottom sheet, action pleine largeur.
3. **Transparence sans friction** : les auto-classés restent visibles (onglet « Déjà
   classées »), avec le POURQUOI (« reconnu : Rexel → Matériel »), corrigibles en 1 geste.
4. **Correction reliée à l'apprentissage, visible** : « Compris. Les prochains Leclerc
   iront en Privé. » + proposition de propager aux autres du même import.
5. **File une-par-une** conservée UNIQUEMENT pour les derniers vrais doutes uniques.
6. **Langage artisan, pas comptable** : « Repas / restau », « Matériel & fournitures »,
   « Charges (URSSAF, impôts) », « Perso » — bannir « déplacements/immobilisations ».

### Les 3 décisions UX les plus importantes (agent UX)
1. Cadrer par le travail **fait** (« 47 faites »), jamais par le restant (« 60 à trier »).
2. Le **regroupement par marchand** est le mode de tri par défaut.
3. Transparence **sans friction** : auto-classé visible, expliqué, réversible — jamais
   caché, jamais reconfirmé.

### À éviter absolument
Afficher 60 lignes brutes ; transformer « à confirmer » en 8 clics ligne par ligne ;
cacher ou verrouiller l'auto-classé ; jargon comptable ; un état « limbo » qui fausse la
trésorerie ; forcer la file une-par-une pour tout.

## Ordre de construction proposé (à ta validation)
1. Migration discriminant `est_suggestion` (+ `auto_point` sur les règles).
2. Dictionnaire 1b (enseignes ambiguës) + noyau heuristique, en suggestion.
3. Écran de synthèse post-import.
4. Vue de tri groupée par marchand (mobile-first).
5. Audit vérificateur + tests + push.

## Reste hors périmètre (backlog assumé)
Classification IA des inconnus (coût/latence), seeding régional cross-tenant (RGPD),
logique TVA/déductibilité (hors micro).
