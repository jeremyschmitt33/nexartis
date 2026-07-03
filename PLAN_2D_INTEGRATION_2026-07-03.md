# Module Plan 2D — Plan d'intégration dans Nexartis
**03/07/2026 — Basé sur la cartographie du code réel + spec V2 arbitrée. Maquette V2.1 validée par Jerem. À exécuter push par push, audit TS + test prod entre chaque.**

## 1. Où le module s'accroche (points confirmés dans le code)

- **Chantier** : `app/dashboard/chantiers/[id]/page.tsx` (1 810 lignes, à NE PAS grossir) a 4 onglets (resume | devis | factures | photos) → **5e onglet « Plan »** qui charge un composant séparé (`components/plan/PlanTab.tsx`), léger : liste des plans du chantier + bouton « Ouvrir l'éditeur ».
- **Éditeur plein écran** : route dédiée `app/dashboard/plans/[id]/page.tsx` (l'éditeur a besoin de tout l'écran, pas d'un onglet). Reste sous `/dashboard` → auth middleware déjà couverte, sidebar masquée par un layout local plein écran (PAS de modification de HIDDEN_ROUTES : on est déjà sous dashboard).
- **Devis** : lignes = table `devis_lignes` (`quantite`, `unite`, `prix_unitaire_ht`, `taux_tva`, `type`, `prestation_id`), insertion via `insertRow('devis_lignes', …)` (`lib/hooks.tsx`). L'injection plan→devis crée des lignes standard + un champ `source_plan JSONB` (nouvelle colonne nullable : `{planId, revisionId, roomId, metric}`) — append-only, ne touche JAMAIS aux lignes existantes.
- **Catalogue** : la combobox prestations existante alimente `prestation_id` → dans le tiroir d'injection, l'artisan choisit la prestation, la quantité vient du plan.
- **Gating** : `canUseFeatureForUser()` (`lib/plans.ts`) — nouvelles features : `plan_editeur` (toutes offres) et `plan_scan` (Complet). Pattern identique à `planning_chantier`.
- **R2** : `presignR2Url()` (navigateur) pour l'export PNG du plan ; `r2Delete()` serveur au soft delete.
- **PDF devis** : orchestrateur `lib/pdf.ts` + modules — l'image du plan s'insère via `.addImage()` comme le logo (Push 4, PNG unique depuis R2 → parité des 4 rendus par construction).
- **Sécurité** : toute route API du module passe par `lib/api-security.ts` (auth + rate-limit + validation + ownership), `getUser()` uniquement.

## 2. Migration SQL (à exécuter dans Supabase AVANT le Push 1)

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  chantier_id UUID REFERENCES chantiers(id),
  client_id UUID REFERENCES clients(id),        -- mémoire du logement (roadmap)
  name TEXT NOT NULL DEFAULT 'Plan',
  data JSONB NOT NULL DEFAULT '{"schemaVersion":1,"unit":"mm","levels":[]}',
  computed JSONB,                                -- métrés dénormalisés
  metier_defaut TEXT,
  schema_version INT NOT NULL DEFAULT 1,
  export_image_path TEXT,                        -- PNG R2
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  user_id UUID NOT NULL,
  data JSONB NOT NULL,
  reason TEXT,                                   -- autosave | devis_envoye | manuel
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE devis_lignes ADD COLUMN source_plan JSONB;
-- RLS sur plans + plan_revisions : policies SELECT/INSERT/UPDATE/DELETE user_id = auth.uid()
-- (reprendre mot pour mot le pattern de la table la plus récente, soft delete inclus)
```

## 3. Découpage en pushes (chacun : audit TS exhaustif + build vert + test prod + .bat)

**PUSH 1 — Fondations (zéro UI visible, zéro risque)**
`lib/plan/geometry.ts` (shoelace, périmètres, polylignes ml, point-dans-polygone, snap) + `lib/plan/metrics.ts` (métrés par métier, 3 modes de déduction, chutes) + `lib/plan/types.ts` (schéma JSON) + tests unitaires (reprendre les valeurs recalculées à la main par le Vérificateur : salon 17,10 m² / murs 32,01 / plinthes 13,77 / véranda 14,70 / clôture 28,4 ml). Migration SQL exécutée. Aucune page. Fichiers < 500 lignes chacun.

**PUSH 2 — Éditeur de base**
`app/dashboard/plans/[id]/page.tsx` + `components/plan/PlanCanvas.tsx`, `PlanRender.tsx` (fonction pure partagée éditeur/export), `RoomSheet.tsx`, `viewport.ts`. Portage depuis la maquette V2.1 (le code de la maquette sert de référence, PAS de copier-coller aveugle : conversion en React idiomatique). Rectangle/L/polygone, cotes cliquables, calques existant/projet, niveaux, undo/redo, autosave (debounce 2 s + revisions 10 min). Onglet « Plan » dans le chantier. ⚠️ INTERDIT : l'heuristique ÷2 des ouvertures mitoyennes de la maquette (spec §6 bis) — une ouverture = un objet référencé par 2 pièces.

**PUSH 3 — Profils métier + métrés + injection devis**
Palette avec libellés filtrée par profil (6 profils : peintre, carreleur, plaquiste, élec, plombier, TCE), panneau métrés, wizard création (métier → méthode), tiroir d'injection → `insertRow('devis_lignes', …)` avec `source_plan`, groupes par lot, anti-doublon, règle « ligne éditée = déliée ». Extérieur (terrasse/piscine/clôture/portail). C'est LE push différenciateur.

**PUSH 4 — Export + PDF + partage**
`lib/plan/export.ts` : SVG statique → PNG @2x → R2 → `export_image_path` → insertion dans les 4 rendus devis (HTML, PDF download, PDF email, /signer) via le pattern logo. Snapshot revision `devis_envoye`. Légende + calque projet visibles sur l'export.

**PUSH 5 — Scan photo (gating Complet)**
Route API `app/api/plan/scan/route.ts` (api-security, rate-limit 10/h, `canUseFeatureForUser('plan_scan')`), pipeline Gemini (schéma A2 de la spec), écran de validation pièce par pièce, gate serveur « rien d'injectable avant validation totale », disclaimers + mention RGPD (politique de confidentialité à mettre à jour).

**PUSH 6+ (V2.1/V2.2, dans l'ordre de valeur)**
Iso 3D (avec **symboles projetés sur la vue 3D rotative** — demande Jerem du 03/07 : prises/radiateurs visibles en 3D, faisable : projeter les symboles au sol et sur les murs extrudés) → mode Avancement lié aux situations (« je facture ce qui est vert ») → Carnet du logement → plan dicté à la voix (réutilise le pipeline vocal) → reste de la roadmap §8 bis.

## 4. Garde-fous hérités des audits (rappel avant chaque push)

1. Jamais de modification silencieuse du devis : injection append-only, badge « métré modifié » plutôt que recalcul auto.
2. Montants/quantités toujours éditables par l'artisan ; coefficient de chutes visible.
3. « Suggestion indicative — à vérifier » partout (NF C 15-100, urbanisme) ; le mot « conforme » est interdit à l'écran.
4. Fichiers < 500 lignes, pas de régression sur `chantiers/[id]/page.tsx` (1 810 lignes : on n'y ajoute QUE l'onglet qui délègue).
5. Helper `fmtISO()` pour toute date (bug timezone documenté). Gros fichiers : jamais d'Edit direct, bash + vérification tail.
6. Test prod sur nexartis.fr après chaque push (règle à vie), PDF de test après le Push 4.
