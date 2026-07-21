# SPEC — Vue plan unifiée 2D↔3D interactive
*(conception du 21/07/2026 — nourrie par recherche concurrentielle + 4 agents experts : UX, moteur 3D, confrontateur, vérificateur. À valider par Jeremy.)*

---

## 0. RÉSUMÉ EXÉCUTIF + LA SEULE DÉCISION QUI T'APPARTIENT

**Objectif** : remplacer le bouton binaire « 2D | 3D » et la fausse 3D figée par **une seule vue qu'on incline** — à plat = ton éditeur 2D actuel, on tire vers le haut = vraie 3D orbitable à la souris. L'édition fine (cotes) reste toujours en 2D ; la 3D est une vue (+ édition légère plus tard).

**LA DÉCISION** : cette vraie 3D interactive impose d'ajouter une dépendance **three.js** (moteur 3D WebGL, standard du secteur). C'est ~150 kB, chargés uniquement quand on incline (jamais dans le reste de l'app). Les 4 experts sont unanimes : étendre le moteur SVG actuel à l'orbite libre est un cul-de-sac technique (le tri de profondeur maison est faux dès qu'on tourne d'un angle quelconque). **Ton seul arbitrage : OK pour ajouter three.js ? (recommandation ferme : oui).**

**Déjà livré aujourd'hui (sans risque, sans three.js)** : les **dimensions éditables dans le panneau de droite** (Longueur × Largeur), exactement ta demande pour le couloir/WC. Voir §2.

---

## 1. CE QUI EST DÉJÀ FAIT (à pousser : push-plan-dimensions-panneau.bat)

Quand une pièce est sélectionnée, le panneau de droite affiche deux champs **Longueur × Largeur** éditables. On tape, on valide (Entrée / on quitte le champ) → la pièce se redimensionne. C'est le MÊME chemin que cliquer une cote sur le plan (donc le refus « mur trop court pour une porte » s'applique, en **message d'erreur inline**, jamais en toast, sans jamais modifier le modèle à moitié). Pur 2D, aucun risque sur le devis. Ça résout ton besoin « faire un couloir fin / régler le WC depuis le panneau, quasi instantanément ».

---

## 2. LA VISION (validée avec toi)

Plus de mode 2D ni 3D : un **continuum d'inclinaison** (`pitch` de 0° à ~82°).
- **0° = « Dessus »** = ton plan actuel, orthographique, pleinement éditable (cotes cliquables, pose de symboles, déplacement).
- **Incliné = « Revue »** = vraie 3D : on tourne librement (souris maintenue), on voit les hauteurs et infos en direct.
- On revient au plan d'un clic (« Dessus ») ou en ré-inclinant à 0°.

---

## 3. CE QUE FONT LES AUTRES (recherche concurrentielle)

- **Bascule** : presque tous les planners (Planner 5D, magicplan, RoomSketcher, Cedreo, Floorplanner) gardent un **bouton 2D/3D**. La bascule par **inclinaison continue** n'existe que dans les outils cartographiques (**Google Maps/Earth**), pas dans les planners → **ton idée est un vrai différenciateur**, mais sans recette toute prête : on s'inspire du geste Maps.
- **Édition** : la structure/les cotes se font **en 2D** ; la 3D est **une vue** (lecture) ou permet au mieux de **déplacer du mobilier** posé (HomeByMe, IKEA, Chief Architect). Personne ne saisit des cotes au mm en perspective.
- **Orbite** : maintenir un bouton souris + glisser (**bouton droit** dominant chez les planners web) ; molette = zoom. Mobile : 1 doigt = déplacer, 2 doigts = zoom + rotation/inclinaison.
- **Cotes/hauteurs en 3D** : à la **sélection/survol** (étiquette flottante), jamais une forêt de cotes permanentes.
- **Vues appréciées** : **maison de poupée** (murs coupés, plongée) pour lire un logement d'un coup.
- **Techno** : **WebGL/three.js est le standard** (Coohom, Archilogic, Planner 5D, Live Home 3D). Le SVG isométrique (notre cas actuel) ne sert qu'aux **aperçus figés**.

*(Sources : docs officielles Google Maps, SketchUp, Sweet Home 3D, Cedreo, HomeByMe, Planner 5D, Live Home 3D, magicplan, RoomSketcher, Chief Architect, Coohom, Archilogic, IKEA, Matterport — juillet 2026.)*

---

## 4. DÉCISION TECHNIQUE (verdict des experts : ferme)

**three.js + @react-three/fiber (R3F) + @react-three/drei.** Pas d'extension du moteur SVG.

Pourquoi : l'occultation correcte à tout angle, la perspective, l'orbite fluide 60 fps sont **gratuites sur le GPU** et à réimplémenter à la main (et bugguées) en SVG. Notre tri de profondeur actuel `(x+y)` n'est juste **que** pour les 4 quarts de tour ; il casse dès qu'on tourne autrement.

Maîtrise du coût :
- Chargé en **`dynamic(import, { ssr: false })`** : rien dans le bundle initial (dashboard, devis, éditeur 2D). three ne se charge **que** quand on incline.
- WebGL est client-only → `ssr:false` obligatoire de toute façon.
- R3F gère le cycle de vie React → **dispose** automatique (pas de fuite mémoire).

---

## 5. ARCHITECTURE

**Fait vérifié capital** : notre export d'image de plan pour le devis (`export.ts` → `PlanRender` 2D → `plan-images.ts`) **ne dépend PAS de la 3D**. `iso.ts` n'est importé QUE par `Iso3dView`, monté QUE dans `PlanEditor`. On peut donc bâtir la nouvelle 3D et jeter l'ancienne **sans toucher un octet du devis**.

- **Nouveau `lib/plan/scene3d.ts`** (pur, zéro React, zéro import three) : PORTE la géométrie de `iso.ts` (extrusion des murs + découpe des ouvertures + sols + clôtures + symboles + teinte d'avancement + calques existant/projet) mais émet des **sommets 3D réels** au lieu de la projection figée. Importable partout sans casser le SSR.
- **Nouveau `components/plan/Scene3dView.tsx`** (seul fichier qui touche three, en `dynamic ssr:false`) : `<Canvas>` R3F, `OrbitControls`, meshes, étiquettes en overlay DOM (`drei <Html>` — texte net), capture PNG via `toDataURL`.
- **On garde le SVG 2D pour l'édition** (option « a » — tranchée par les experts). Le WebGL vit **SOUS** le SVG ; à plat le SVG est visible et interactif ; on incline → **cross-fade** : le SVG s'estompe, le WebGL apparaît. **L'édition ne quitte jamais le SVG → zéro régression possible sur les cotes.**
- **Caméra pilotée par le MÊME viewport** `{k, tx, ty}` que le SVG (source unique). À plat = **caméra orthographique** calée exactement sur le plan (sinon « saut » au fondu).
- **Intouchables** : `export.ts`, `plan-images.ts`, `PlanRender.tsx`, `PlanCanvas.tsx`, tout le chemin d'édition/cotes.

---

## 6. MODÈLE D'INTERACTION (UX)

**États** : PLAN (0°, snap 0–6°, ortho, édition complète) → REVUE (6–82°, perspective, orbite + lecture + panneau + drag symbole au sol).

**Gestes bureau** : **bouton DROIT maintenu + glisser = orbiter/incliner** (le clic gauche reste 100 % sélection/édition, jamais l'orbite) ; molette = zoom ; clic-milieu = pan.
**Découvrabilité (obligatoire, car le geste est inhabituel)** : un **curseur d'inclinaison visible** (rail vertical) + des **presets nommés** « Dessus / Iso / Maison de poupée » + un coach-mark au 1er usage. « Dessus » = bouton de secours qui ramène toujours au plan éditable.
**Mobile** : 1 doigt = pan, 2 doigts = zoom + rotation, 2 doigts glissés vers le haut = incliner (redondé par le curseur). Panneau = feuille du bas.
**Cotes/hauteurs en 3D** : à la sélection/survol (étiquette face caméra + petite règle de hauteur sur le mur survolé).
**Édition** : géométrie fine (cotes, sommets, pose) **seulement à 0°**. Incliné = édition par le **panneau numérique** (déjà livré) + déplacement d'un symbole **contraint au sol**.

---

## 7. GARDE-FOUS DURCIS (confrontateur + vérificateur) — à respecter AVANT de coder

**Corrections indispensables (sinon on casse la règle « rien de faux au devis ») :**
1. **Redimensionnement panneau : commit à la validation, pas à chaque frappe** (déjà fait ainsi), refus = **erreur inline** jamais toast, jamais de mutation partielle. Unité verrouillée.
2. **Dimensions = emprise dans le repère MODÈLE (mm), jamais la boîte écran** — sinon une pièce affichée de travers donnerait des cotes fausses. *(Nos pièces sont toujours alignées aux axes aujourd'hui → OK, mais à graver.)*
3. **Caméra orthographique VRAIE à plat, calée sur le viewport SVG, azimut verrouillé à 0° en « Dessus », fondu PENDANT le mouvement** — sinon le passage 2D↔3D « saute » et le retour au plan re-cadre au mauvais endroit.
4. **Une seule couche de mutation validée** (mm entiers + anti-chevauchement) partagée par 2D, panneau ET 3D — le drag 3D ne doit jamais écrire une position non arrondie ou illégale.
5. **Fallback WebGL absent** (mobile ancien / perte de contexte) → repli sur le plan 2D, jamais d'écran noir.

**Invariants déjà ACQUIS par l'archi actuelle (à ne pas casser)** : édition = SVG uniquement ; export devis isolé de la 3D ; `iso.ts` supprimable sans casse ; le hook `redimensionner` (avec refus « mur trop court ») est le point de passage unique.

**Perf** : `dpr [1,2]` (borné), `frameloop="demand"`, découpes d'ouvertures précalculées (pas par frame), symboles instanciés, seul le niveau actif en solide. Budget cible à mesurer sur É1 avant d'aller plus loin.

---

## 8. PLAN PAR ÉTAPES (du plus sûr au plus ambitieux)

- **É0 — Panneau Dimensions.** ✅ **FAIT** (pur 2D, livrable seul, aucune 3D). Ta demande couloir/WC.
- **É1 — Vue WebGL orbitable en lecture seule** (remplace l'iso figée, derrière le bouton 3D actuel). Effort : **L**. Le gros du portage géométrique (`scene3d.ts` + `Scene3dView.tsx`). Zéro risque sur l'édition/l'export. On garde `iso.ts` comme référence/fallback jusqu'à parité visuelle validée.
- **É2 — Inclinaison continue unifiée + suppression du bouton 2D/3D.** Effort : **M**. Superposition WebGL/SVG, cross-fade piloté par l'angle, caméra ortho calée sur le viewport, snap 0°.
- **É3 — Édition légère en 3D** (déplacer un symbole au sol, sélectionner). Effort : **M/L**. Jamais de saisie de cote au mm en 3D.
- **É4 — Orbite au geste souris/tactile + coach-marks.** Effort : **M**.
- **É5 — Étiquettes/hauteurs live + maison de poupée.** Effort : **M**.

Dépendances strictes : É1 → É2 → É3. Chaque étape est livrable et réversible seule (méthode : V1 → confrontateur → vérificateur → .bat → test en prod, comme d'habitude).

---

## 9. RISQUES / BÊTISES À ÉVITER
- Mapper l'inclinaison sur le clic gauche (détruit sélection + clic-cote). → clic droit + curseur.
- Rester en perspective à 0° / pas de snap (cotes fausses). → ortho + snap-band.
- Poignées de redimensionnement en perspective (imprécis). → édition métrique par le panneau uniquement.
- Réduire une pièce en L/polygone à deux champs L×l (faux). → détecter le rectangle ; sinon segments.
- Import statique de three (casse le build SSR Vercel). → `dynamic ssr:false` strict.
- Fuite mémoire (dpr non borné, textures non disposées). → checklist perf.
- Toucher l'export devis. → interdit, il reste sur le SVG 2D coté.

---

## 10. TON ARBITRAGE
1. **three.js : OK ?** (recommandation ferme : oui — c'est le standard, coût maîtrisé par chargement à la demande).
2. **On démarre par É1** (vraie 3D orbitable, derrière le bouton actuel) — je le passe par la méthode complète (V1 → confrontateur → vérificateur → .bat) ?
3. Nom des presets : « Maison de poupée » est peu pro pour un artisan — préférence ? (ex. « Vue plongée »).

Dis « on y va » et j'attaque É1.
