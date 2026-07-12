# Confrontation — Étude « Devis par photo »

**Date : 11/07/2026 — Agent Confrontateur Nexartis**
**Document attaqué : `etude-devis-photo.md` (agent expert). Toutes les affirmations vérifiées dans le code réel du repo.**

---

## 1. Faits vérifiés dans le code : confirmés / infirmés / nuancés

### 1.1 CONFIRMÉ — le pipeline vocal existe bien tel que décrit

- `lib/voice/` contient bien `schema.ts`, `prompt.ts`, `gemini-call.ts` (+ `fallback-extraction.ts`, `parser.ts`, `routeIntent.ts`, `types.ts`).
- `app/api/voice-command/route.ts` : pipeline en 8 étapes conforme à la description (rate-limit IP 30/min → auth → **gating offre Complet via `getEffectivePlan`** → rate-limit user 10/min → multipart → Gemini → Zod). Preuve : lignes 1–80 du fichier.
- `export const maxDuration = 60` : **réellement déclaré** à la ligne 38 de `app/api/voice-command/route.ts`. Il est même déclaré dans 7 autres routes (`certifications/ocr`, 4 crons, `documents/envoyer`, `voice-devis-v2`) avec des commentaires « Vercel Pro : 60s » dans les crons — **le plan est très probablement déjà Pro**, la « condition préalable n°1 » de l'étude est quasi certainement déjà remplie (à confirmer en 2 minutes dans Vercel, pas en 0,5 jour).
- `handleVoiceResult` existe à la ligne 937 de `app/dashboard/devis/nouveau/page.tsx` (fichier de 1 690 lignes — chiffre exact confirmé), et le mécanisme `?voicePayload=base64(JSON)` aux lignes 535–546. Confirmé.
- `gemini-call.ts` : plan d'attaque 3 tentatives primaire + 2 fallback, `temperature: 0.1` par défaut, **`maxOutputTokens = 2048` par défaut** — détail que l'étude ne relève pas (voir §4.3 : c'est un piège pour le scan photo).
- Le bug `anyOf` de Gemini est bien documenté en tête de `lib/voice/schema.ts` (lignes 4–8), la regex téléphone FR existe (ligne 34). Confirmé.

### 1.2 CONFIRMÉ — R2 privé + URLs présignées

- `lib/r2.ts` : SigV4 maison, bucket privé, `presignR2Url` PUT/GET. Confirmé.
- `app/api/chantier-photos/sign-upload/route.ts` : quota 1 Go soft / 2 Go hard, clé `user.id/clientId/uuid.jpg`, rate-limit, propriété du client vérifiée. Confirmé.
- **Nuance importante** : l'étude dit « on le réutilise tel quel » puis reconnaît elle-même qu'il faut une clé `user.id/scans/…` sans `client_id`. Ce n'est PAS « tel quel » : la route actuelle **exige `client_id` et vérifie sa propriété** — il faut une nouvelle route ou une variante. De plus, **le quota 2 Go est calculé sur la table `photos`** : les scans non convertis (pas encore en table `photos`) échapperaient au décompte de stockage. Petit trou à boucher (compter les scans, ou table `scans` dédiée).
- La purge J+30 exige un **nouveau cron dans `vercel.json`** (5 crons existent, aucun de purge R2) : travail réel, pas « cron existant possible ».

### 1.3 CONFIRMÉ — `findClientIdByName` laxiste + auto-création

- `app/api/import/execute/route.ts` ligne 91 : `ilike('nom', '%' + clientName + '%')` + `limit(1)` — le PREMIER client dont le nom contient la chaîne, sans score. Confirmé laxiste.
- Lignes 469–479 : **AUTO-CRÉATION avérée** (« on cree un client minimal (nom) ») si aucun match. Le commentaire du code le revendique. L'étude a raison de dire que cette logique est inutilisable telle quelle pour le scan, et sa proposition de helper avec scoring est justifiée.
- **Risque non chiffré par l'étude** : extraire un helper partagé `lib/import/client-matching.ts` utilisé par l'import ET le scan = toucher à l'import (884 lignes, critique, déjà en prod pour Daniela). Le coût de non-régression sur l'import n'apparaît nulle part dans le plan à 12–13 jours.

### 1.4 DÉCOUVERTE MAJEURE — l'étude a raté le précédent le plus proche : `app/api/certifications/ocr/route.ts`

Il existe DÉJÀ dans le repo une route qui fait **image → Gemini multimodal → JSON strict → validation Zod → relecture humaine obligatoire avant enregistrement** :

- `app/api/certifications/ocr/route.ts` (maxDuration 60, MIME `image/jpeg|png|webp|heic|heif` + PDF, 10 Mo max, base64 inline, `callGeminiResilient`, prompt « Ne devine rien, ne complete pas. Si une information est absente ou illisible, mets null », champ `confiance` global, « NE FAIT QUE LIRE. Aucune ecriture en base. L'enregistrement se fait APRES validation humaine »).

Conséquences :
1. L'affirmation « ~60 % de l'infra existe » est en réalité **sous-estimée** : le traitement d'IMAGE par Gemini est déjà éprouvé en prod, pas seulement l'audio.
2. Mais surtout, cela **affaiblit la recommandation « Claude en primaire »** : le plan B « tout Gemini » de l'étude (qu'elle chiffre à −2 jours) réutiliserait un pipeline image déjà en production, un seul fournisseur IA, une seule clé API, un seul dialecte de schéma. L'étude aurait dû comparer honnêtement avec ce précédent sous les yeux. Le choix Claude reste défendable (rigueur manuscrit, respect du « ne pas inventer »), mais il doit être **tranché par le banc d'essai comparatif de la phase 1** (mêmes 10 photos envoyées aux deux), pas décrété d'avance.
3. Ajouter Anthropic = nouveau fournisseur : nouvelle clé, nouvelle facturation, nouveau DPA à lister au registre RGPD, et **deux dialectes de schéma à maintenir** (JSON Schema Anthropic vs `responseSchema` Gemini sans `anyOf`). L'étude affirme un « fallback Gemini avec le même schéma de sortie garanti » : **c'est faux en l'état** — le schéma §1.3 (enveloppes imbriquées) devra être réécrit et maintenu en double dans le dialecte Gemini. C'est précisément le « risque de divergence » que le CLAUDE.md du projet érige en leçon n°1 (les 4 rendus PDF/HTML). L'étude le voit pour le formulaire (§7.5) mais pas pour son propre double-schéma.

### 1.5 CONFIRMÉ avec réserve — la TVA

- `handleVoiceResult` applique bien `data.tva_taux` venu du modèle (ligne ~955) et met les lignes à `tva: autoEntrepreneur ? 0 : 10` : l'étude dit vrai, le vocal demande la TVA au modèle, et son durcissement (TVA jamais demandée au modèle pour le scan) est une vraie amélioration conforme au cahier.
- `isAutoEntrepreneur` existe (`lib/helpers.ts:30`). Confirmé.

---

## 2. Trous du schéma JSON vs cahier d'exigences de jeremy

Le schéma §1.3 est bon, mais **pas complet** :

1. **SIRET absent.** Le cahier (§5) exige : « Numéros de téléphone/**SIRET** partiels : compléter depuis la fiche client existante… sinon marquer "à compléter" ». Le bloc `client` du schéma n'a **aucun champ `siret` ni `siret_partiel`** (il a `societe` mais rien pour le SIRET). Or le formulaire devis gère les clients professionnels avec SIRET (`selectClientSuggestion` remplit `clientSiret`). **À ajouter.**
2. **Pas de structure de sections.** Le formulaire supporte `type: 'line'|'section'|'subsection'|'text'` et l'étude elle-même (§3.2.4) parle de sous-totaux « rattachés aux sections » — mais le schéma ne permet pas de grouper les lignes en sections. Une note manuscrite avec « SDB : … / Cuisine : … » et deux sous-totaux ne peut pas être représentée. Soit on ajoute un champ `section` par ligne, soit on assume « tout à plat en V1 » explicitement.
3. **`email_partiel` / `adresse_partielle` absents** alors que `telephone_partiel` existe : incohérence mineure, le principe « partiel = signalé » devrait être uniforme.
4. **La « re-tentative offerte » après `est_une_note_de_chantier: false` n'a aucun support** : il faut un état par scan (quel scan a déjà consommé sa re-tentative ?) — non conçu, la table `scan_usage` ne compte qu'un agrégat mensuel. À spécifier ou à abandonner.
5. Couvert correctement (vérifié point par point contre le cahier) : acompte, échéancier, paiements déjà reçus, adresse chantier différente, multi-ventes, ratures, unités implicites, HT/TTC ambigu, IBAN masqué, croquis, contraintes, dates. Sur ces points, le schéma tient.

---

## 3. Les coûts : recalcul indépendant

### 3.1 Le coût unitaire ~0,05 €/photo : plausible mais borne basse

Recalcul (tarifs Sonnet 4.5 : 3 $/M entrée, 15 $/M sortie — exacts) :
- Image 1 568×1 176 px ≈ (1568×1176)/750 ≈ **2 460 tokens** → 0,0074 $. L'étude est dans les clous.
- Sortie : le schéma-enveloppe est TRÈS verbeux (chaque donnée = 3 champs + clés françaises longues). L'exemple à 2 lignes de l'étude fait déjà ~1 100 tokens. Un devis de **15 lignes** ≈ 600 (meta+client+chantier) + 15×~120 + 400 (totaux+conditions) ≈ **3 200–4 500 tokens** → 0,048–0,068 $ rien qu'en sortie.
- **Total réaliste : 0,05–0,08 $ pour une note dense**, soit ~0,05–0,07 €. Le « ~0,05 € » de l'étude est la borne moyenne-basse, pas une moyenne prudente. Acceptable, mais à budgéter à 0,07 €.

### 3.2 ERREUR ARITHMÉTIQUE ×10 dans la projection MRR — inacceptable dans une étude qui prêche la « réconciliation au centime »

L'étude affirme : 10 utilisateurs → ~10 €/mois de coût API = « **0,35 % du MRR** ». Or 10 utilisateurs × 29 € = 290 € de MRR ; 10/290 = **3,45 %**, pas 0,35 %. L'erreur se propage sur les trois lignes du tableau (100 → ~100 €/2 900 € = 3,45 % ; 1 000 → ~1 000 €/29 000 € = 3,45 %). Le coût relatif réel est **dix fois** celui annoncé.

### 3.3 Le prix de l'offre est FAUX : 25 € HT, pas ~29 €

Vérifié dans le repo : `lib/plans.ts` ligne 131 → `priceMonthlyHT: 25` pour Complet (et 15 € pour Essentiel), confirmé par la page tarifs (`app/tarifs/page.tsx` : « Essentiel 15 € / Complet 25 € », « /mois HT »). Recalcul avec les vrais chiffres :
- Quota 30 photos × 0,05–0,07 € = **1,50–2,10 €/mois max par utilisateur = 6–8 % du prix de l'offre Complet (25 € HT)** pour un utilisateur qui sature son quota. Ça reste absorbable, mais c'est un ordre de grandeur au-dessus du récit « négligeable, 0,35 % ».
- Verdict quota : 30 photos/mois reste cohérent économiquement, MAIS présenté avec les vrais pourcentages.

### 3.4 « Essai gratuit : 5 photos, aligné sur la politique existante » — FAUX

`lib/plans.ts` (lignes 217, 252) : pendant l'essai, `getEffectivePlan` renvoie `complete` avec **tout débloqué** — le devis vocal n'est PAS limité pendant l'essai. Une limite de 5 photos en essai est une **nouvelle mécanique** (compteur + gating spécifiques), pas un alignement. Elle peut être une bonne idée (le vocal ne coûte presque rien, la photo si), mais il faut la présenter comme une exception à construire, et la chiffrer.

### 3.5 Piège technique relevé : `maxOutputTokens`

Le défaut de `gemini-call.ts` est **2 048 tokens** et l'étude propose de plafonner Claude à ~4 000. Or une note à 2 ventes × 12 lignes ≈ 4 800–5 500 tokens de sortie → **JSON tronqué → échec Zod → l'utilisateur paie son quota pour rien**, précisément sur les cas multi-ventes que le cahier exige de gérer. Le plafond doit être ≥ 8 000 tokens (et le coût max par photo recalculé en conséquence : jusqu'à ~0,12 $ sur ces cas extrêmes).

---

## 4. Angles morts

1. **L'utilisateur ferme l'app pendant l'analyse (V1 synchrone)** : la réponse est perdue, le quota est décompté, la photo reste orpheline dans R2, et rien ne permet de récupérer le résultat (le JSON n'est jamais persisté — par choix RGPD assumé). Sur chantier (4G instable, appel entrant qui tue l'onglet), ce cas sera FRÉQUENT. L'étude ne le traite que dans le plan B asynchrone. Exiger au minimum en V1 : le quota n'est décompté qu'à la LIVRAISON du résultat au client, ou la re-analyse gratuite de la même clé R2 pendant 24 h.
2. **Idempotence / doublon de photo** : aucune déduplication (hash SHA-256 du fichier) n'est prévue. Même photo envoyée 2 fois = 2 unités de quota et 2 appels payés. Un hash stocké avec le compteur coûte 30 minutes de dev et règle le cas.
3. **Prix hallucinés PLAUSIBLES à confiance élevée** : l'étude l'admet honnêtement (§7.2) mais sa parade — calibration mesurée sur 15 cas rejoués 3× — est **statistiquement insuffisante** : 45 échantillons ne calibrent pas un seuil à 0,8. C'est un test de fumée, pas une calibration. La seule vraie borne est structurelle : la réconciliation arithmétique attrape les prix inventés QUAND un total est noté sur le papier. Quand aucun total n'est noté, il n'existe AUCUN filet contre un PU halluciné plausible. Ce cas (note sans total) devrait déclencher un bandeau spécifique « aucun total sur la note : vérifiez chaque prix » — absent de l'étude.
4. **RGPD tierce personne** : correctement traité pour le client final de l'artisan (sous-traitance, DPA, purge J+30, JSON non persisté). Deux compléments : (a) la photo peut contenir des données de tiers non-clients (devis concurrent, voisin) — couvert de facto par la purge et la non-persistance, à mentionner au registre ; (b) **EXIF/GPS** : la compression canvas côté client supprime les métadonnées EXIF (donc le GPS du domicile client) — bien, mais alors la compression doit être OBLIGATOIRE, pas une optimisation réseau ; si un upload non compressé passe (desktop), le GPS part dans R2.
5. **Fallback Gemini ≠ même garantie** : voir §1.4.3 — double schéma à maintenir, et la dégradation « confiances × 0,85 » est arbitraire, non mesurée.

---

## 5. L'estimation 12–13 jours : optimiste de ~30 %

| Poste | Étude | Confrontation |
|---|---|---|
| Phase 3 (UI relecture mobile) | 3–4 j | Photo zoomable + champs ambre/rouge avec suivi « touché » + bandeau non fermable + transfert sessionStorage : **4–5 j** au niveau de qualité exigé |
| Phase 4 (cas tordus) | 2 j | Écran de scission multi-ventes SEUL (2 brouillons séquentiels, état entre les deux) vaut 1,5–2 j ; + IBAN + croquis/pièce jointe + quota en base + **nouveau cron de purge** : **3–4 j** |
| Phase 5 (15 tests) | 2 j | « 3 itérations de prompt » pour 15/15 rigueur avec 0 invention sur 3 rejeux : optimiste ; et le **corpus dépend de tiers** (Daniela + 2 artisans qui écrivent des notes) = délai calendaire non maîtrisé | 
| Non budgété | — | Non-régression de l'import après extraction du helper client-matching (~1 j) ; double schéma Gemini si fallback retenu (~0,5–1 j) |

**Estimation réaliste : 15–18 jours-dev**, plus le délai calendaire de constitution du corpus. La fourchette haute de l'étude (15) devrait être sa fourchette basse.

## 6. Priorisation : le cahier de jeremy a DÉJÀ tranché — l'étude l'ignore

`IDEE_DEVIS_PAR_PHOTO.md`, section « Priorité » : « **Après : (1) import réel sur le compte de Daniela, (2) Mission 2 — onglet Dépenses/Banque (V1 import CSV), (3) idempotence + rapport d'import.** » L'étude conclut « GO » sans jamais rappeler que cette fonctionnalité est **4ᵉ dans la file** selon le document même qu'elle cite en source n°1. Risque de dispersion réel : 15–18 jours sur la photo = Dépenses/Banque repoussé d'un mois. Le seul élément qui peut être fait TOUT DE SUITE sans disperser : le **banc d'essai de la phase 1** (1,5 j, ~2 €), qui lève le risque technique et peut attendre ensuite son tour dans la file.

---

## 7. VERDICT : **GO AVEC RÉSERVES**

Le fond de l'étude est solide : les briques existent (vérifiées), l'architecture est saine, la couche de rigueur est bien pensée, le prompt est de qualité. Mais elle contient une erreur de calcul ×10, un prix d'abonnement faux, une affirmation fausse sur l'essai gratuit, un précédent majeur du repo non vu, un schéma incomplet (SIRET, sections) et une estimation optimiste. Conditions du GO :

1. **Respecter la file de priorités du cahier** : seule la phase 1 (banc d'essai, 1,5 j) est lancée maintenant ; le développement complet passe APRÈS Daniela + Dépenses/Banque V1 + idempotence import.
2. **Banc d'essai COMPARATIF** Claude Sonnet vs Gemini 2.5 (Flash ET Pro) sur les mêmes 10 vraies notes — le choix du fournisseur primaire s'y décide, pas avant (le précédent `certifications/ocr` rend le tout-Gemini crédible à −2 jours et −1 fournisseur).
3. **Corriger le schéma** : ajouter `siret`/`siret_partiel`, trancher la question des sections, spécifier l'état « re-tentative ».
4. **Corriger le chiffrage** : coût budgété à 0,07 €/photo (30 photos = 6–8 % de l'offre Complet à 25 € HT), `max_tokens ≥ 8 000`, quota décompté à la livraison du résultat + déduplication par hash.
5. **Compression EXIF obligatoire** (pas optionnelle) + bandeau « aucun total noté » quand la note n'a pas de total.
6. Replanifier à **15–18 jours-dev**.

## 8. Les 3 questions à trancher par jeremy

1. **Calendrier** : confirmes-tu qu'on lance UNIQUEMENT le banc d'essai (1,5 j, ~2 €) maintenant, et que le développement complet reste derrière Daniela + Dépenses/Banque, comme l'écrit ton propre cahier ?
2. **Fournisseur** : acceptes-tu d'ajouter Anthropic comme 2ᵉ fournisseur IA (nouvelle clé, nouveau DPA, double schéma à maintenir) SI et SEULEMENT SI le banc d'essai montre un écart de rigueur réel vs Gemini — sinon tout-Gemini ?
3. **Quota et essai** : valides-tu 30 photos/mois à ~2 €/mois de coût max (6–8 % du prix de l'offre Complet à 25 € HT — vrais chiffres) et veux-tu vraiment limiter l'essai gratuit à 5 photos alors que l'essai donne aujourd'hui un accès Complet illimité ?

---

## Résumé (12 lignes)

1. Les 4 vérifications code demandées sont CONFIRMÉES : pipeline vocal complet (`lib/voice/*`, gating Complet), `maxDuration = 60` (route vocale ligne 38 + 7 autres routes), R2 privé présigné (`lib/r2.ts`), `findClientIdByName` en `ilike '%nom%'` + auto-création (import lignes 91 et 469–479).
2. DÉCOUVERTE : l'étude a raté `app/api/certifications/ocr/route.ts` — un pipeline image→Gemini→JSON→relecture humaine DÉJÀ en prod, qui renforce la faisabilité mais affaiblit le choix « Claude primaire » décrété d'avance.
3. ERREUR ×10 : le coût API représente ~3,5 % du MRR, pas 0,35 % ; et l'offre Complet coûte 25 € HT (`lib/plans.ts:131`), pas ~29 €.
4. « Essai gratuit 5 photos aligné sur l'existant » : faux — l'essai actuel donne tout en illimité.
5. Coût/photo ~0,05 € plausible mais borne basse ; budgéter 0,07 € ; `max_tokens` doit passer à ≥ 8 000 sous peine de JSON tronqués sur les notes multi-ventes.
6. Trous du schéma : SIRET absent (exigé par le cahier), pas de sections, état « re-tentative » non conçu.
7. Angles morts : app fermée pendant l'analyse (quota perdu), pas de déduplication par hash, calibration sur 45 échantillons insuffisante, aucun filet contre un prix halluciné quand la note n'a pas de total, EXIF/GPS si compression contournée.
8. Le fallback Gemini n'a PAS « le même schéma garanti » : double dialecte à maintenir — le risque de divergence que le CLAUDE.md dénonce.
9. Estimation réaliste : 15–18 jours-dev (pas 12–13), + délai calendaire du corpus de vraies notes.
10. Le cahier de jeremy place cette fonctionnalité APRÈS Daniela, Dépenses/Banque et l'idempotence import — l'étude ne le rappelle jamais.
11. VERDICT : **GO AVEC RÉSERVES** — lancer seulement le banc d'essai comparatif maintenant, corriger schéma et chiffrage, replanifier, garder la file de priorités.
12. 3 questions pour jeremy : calendrier (banc d'essai seul ?), fournisseur (Claude seulement si écart prouvé ?), quota/essai (vrais chiffres validés ?).
