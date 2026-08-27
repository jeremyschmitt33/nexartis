-- ============================================================================
-- MULTI-UTILISATEUR — PHASE 2a : reecriture RLS "membre d'une entreprise"
-- Date : 2026-06-12
--
-- ⚠️  A EXECUTER IMPERATIVEMENT *APRES* LA PHASE 1
--     (migration-2026-06-12-multiuser-phase1-membres.sql), c'est-a-dire APRES
--     que la table `entreprise_membres` ait ete creee ET peuplee (chaque
--     entreprise = 1 membre 'dirigeant' 'actif'). Si vous executez ce script
--     avant le backfill Phase 1, les fonctions ci-dessous renverront NULL et
--     toutes les lectures seront vides => NE PAS LANCER avant Phase 1.
--
-- OBJECTIF
--   Passer le modele de securite (RLS) de "1 entreprise = 1 user"
--   (`auth.uid() = user_id`) au modele "membre d'une entreprise"
--   (`la ligne appartient a une entreprise dont je suis membre actif`).
--
-- ✅  BEHAVIOR-PRESERVING (comportement strictement inchange aujourd'hui)
--   Tant qu'il n'y a qu'UN seul membre actif par entreprise (etat actuel
--   apres Phase 1), la condition :
--       entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
--   est STRICTEMENT EQUIVALENTE a :
--       auth.uid() = user_id
--   Demonstration :
--     - entreprise_of_user(user_id) = l'entreprise dont user_id est membre actif.
--     - current_entreprise_ids()   = les entreprises dont auth.uid() est membre actif.
--     - Comme chaque user est membre actif d'exactement UNE entreprise et que
--       chaque entreprise n'a qu'UN membre actif, il y a une bijection
--       user <-> entreprise. Donc entreprise_of_user(X) appartient a
--       current_entreprise_ids() SI ET SEULEMENT SI X = auth.uid().
--   => aucune ligne nouvellement visible, aucune ligne perdue. Risque nul.
--   (Quand on invitera un 2e membre en Phase 2b, ce meme code ouvrira
--    automatiquement l'acces partage, sans nouvelle migration RLS.)
--
-- DURCISSEMENT inclus
--   - INSERT : on GARDE `auth.uid() = user_id` (le createur s'enregistre
--     lui-meme). Comportement preserve, et on empeche d'inserer pour autrui.
--   - UPDATE : on AJOUTE `WITH CHECK (auth.uid() = user_id)` => empeche de
--     "deplacer" une ligne vers un autre tenant via UPDATE de user_id.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS avant chaque CREATE.
--   Relancable sans danger. ENABLE/FORCE RLS conserves (deja poses en Phase 1
--   et par fix-rls-final.sql ; on les reaffirme par securite).
--
-- A EXECUTER
--   Supabase > SQL Editor > New query > coller TOUT > Run > "Success".
--   Aucun deploiement de code applicatif n'est requis pour cette phase
--   (le branchement applicatif sera fait en Phase 2b).
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1) FONCTIONS HELPER (SECURITY DEFINER, STABLE, search_path verrouille)
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER : la fonction s'execute avec les droits du proprietaire et
-- contourne la RLS => evite toute recursion quand une policy l'appelle.
-- STABLE : resultat constant dans une meme requete (optimisable par le planner).
-- SET search_path = public : verrou anti-injection (schema fige).

-- entreprise_of_user(target) : l'entreprise (active) a laquelle `target` appartient.
-- Utilisee dans les USING des tables a user_id direct, et dans les sous-requetes
-- des tables enfants. Aujourd'hui (1 membre / entreprise) : renvoie l'unique
-- entreprise du user => equivalent a "le user lui-meme".
CREATE OR REPLACE FUNCTION entreprise_of_user(target UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- CORRECTIFS AUDIT (2026-06-12) :
  --  (P1) On NE filtre PAS sur le statut de `target` : l'appartenance d'une LIGNE
  --       a une entreprise est PERMANENTE. Sinon, revoquer un employe ferait
  --       DISPARAITRE ses devis/factures pour toute l'entreprise (orphelinage).
  --  (P2) On ne REVELE l'entreprise que si l'APPELANT en est membre actif :
  --       ferme l'enumeration "tel user appartient a telle entreprise" via RPC.
  SELECT m.entreprise_id
  FROM entreprise_membres m
  WHERE m.user_id = target
    AND m.entreprise_id IN (
      SELECT entreprise_id FROM entreprise_membres
      WHERE user_id = auth.uid() AND statut = 'actif'
    )
  LIMIT 1
$$;

-- current_role_in(ent) : role de l'utilisateur courant DANS l'entreprise `ent`.
-- Non utilisee par les policies de la Phase 2a (acces uniforme entre membres),
-- mais definie ici pour etre prete pour la Phase 2b (masquage par role :
-- ouvrier/commercial/dirigeant).
CREATE OR REPLACE FUNCTION current_role_in(ent UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role
  FROM entreprise_membres
  WHERE user_id = auth.uid() AND entreprise_id = ent AND statut = 'actif'
  LIMIT 1
$$;

-- Verrouillage des droits d'execution (coherent avec current_entreprise_ids).
REVOKE EXECUTE ON FUNCTION entreprise_of_user(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION entreprise_of_user(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION current_role_in(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION current_role_in(UUID) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 1bis) CORRECTIFS AUDIT (2026-06-12)
-- ════════════════════════════════════════════════════════════════════════════
-- (a) Invariant "1 user = 1 entreprise ACTIVE" => rend entreprise_of_user
--     deterministe (un user ne peut pas etre membre actif de 2 entreprises).
CREATE UNIQUE INDEX IF NOT EXISTS uq_membre_user_actif
  ON entreprise_membres (user_id)
  WHERE user_id IS NOT NULL AND statut = 'actif';

-- (b) Table `points_collecte` (decheteries) : oubliee dans le 1er recensement.
--     Elle a un user_id direct et est lue cote client (selection decheterie dans
--     un devis) => meme pattern "membre d'une entreprise" que les autres tables.
ALTER TABLE points_collecte ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_collecte FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own points_collecte" ON points_collecte;
DROP POLICY IF EXISTS "points_collecte_select" ON points_collecte;
DROP POLICY IF EXISTS "points_collecte_insert" ON points_collecte;
DROP POLICY IF EXISTS "points_collecte_update" ON points_collecte;
DROP POLICY IF EXISTS "points_collecte_delete" ON points_collecte;
CREATE POLICY "points_collecte_select" ON points_collecte FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "points_collecte_insert" ON points_collecte FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "points_collecte_update" ON points_collecte FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "points_collecte_delete" ON points_collecte FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));


-- ════════════════════════════════════════════════════════════════════════════
-- 2) TABLES A user_id DIRECT
--    SELECT/UPDATE/DELETE  : USING  -> entreprise_of_user(user_id) IN (...)
--    INSERT                : WITH CHECK -> auth.uid() = user_id  (PRESERVE)
--    UPDATE (durcissement) : + WITH CHECK (auth.uid() = user_id)
-- ════════════════════════════════════════════════════════════════════════════

-- On reaffirme ENABLE + FORCE RLS (no-op si deja actifs).

-- ── entreprises (pas de DELETE : une seule par user) ───────────────────────
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprises FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entreprises_select" ON entreprises;
DROP POLICY IF EXISTS "entreprises_insert" ON entreprises;
DROP POLICY IF EXISTS "entreprises_update" ON entreprises;
CREATE POLICY "entreprises_select" ON entreprises FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "entreprises_insert" ON entreprises FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entreprises_update" ON entreprises FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);

-- ── clients ────────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── fournisseurs ───────────────────────────────────────────────────────────
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fournisseurs_select" ON fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_insert" ON fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_update" ON fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_delete" ON fournisseurs;
CREATE POLICY "fournisseurs_select" ON fournisseurs FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "fournisseurs_insert" ON fournisseurs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fournisseurs_update" ON fournisseurs FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fournisseurs_delete" ON fournisseurs FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── intervenants ───────────────────────────────────────────────────────────
ALTER TABLE intervenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervenants FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intervenants_select" ON intervenants;
DROP POLICY IF EXISTS "intervenants_insert" ON intervenants;
DROP POLICY IF EXISTS "intervenants_update" ON intervenants;
DROP POLICY IF EXISTS "intervenants_delete" ON intervenants;
CREATE POLICY "intervenants_select" ON intervenants FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "intervenants_insert" ON intervenants FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intervenants_update" ON intervenants FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intervenants_delete" ON intervenants FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── prestations ────────────────────────────────────────────────────────────
ALTER TABLE prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestations FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prestations_select" ON prestations;
DROP POLICY IF EXISTS "prestations_insert" ON prestations;
DROP POLICY IF EXISTS "prestations_update" ON prestations;
DROP POLICY IF EXISTS "prestations_delete" ON prestations;
-- Variantes de noms historiques (cf. sql/create-prestations-table.sql).
DROP POLICY IF EXISTS "prestations_select_own" ON prestations;
DROP POLICY IF EXISTS "prestations_insert_own" ON prestations;
DROP POLICY IF EXISTS "prestations_update_own" ON prestations;
DROP POLICY IF EXISTS "prestations_delete_own" ON prestations;
CREATE POLICY "prestations_select" ON prestations FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "prestations_insert" ON prestations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prestations_update" ON prestations FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prestations_delete" ON prestations FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── chantiers ──────────────────────────────────────────────────────────────
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantiers FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chantiers_select" ON chantiers;
DROP POLICY IF EXISTS "chantiers_insert" ON chantiers;
DROP POLICY IF EXISTS "chantiers_update" ON chantiers;
DROP POLICY IF EXISTS "chantiers_delete" ON chantiers;
CREATE POLICY "chantiers_select" ON chantiers FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "chantiers_insert" ON chantiers FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chantiers_update" ON chantiers FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chantiers_delete" ON chantiers FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── devis ──────────────────────────────────────────────────────────────────
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devis_select" ON devis;
DROP POLICY IF EXISTS "devis_insert" ON devis;
DROP POLICY IF EXISTS "devis_update" ON devis;
DROP POLICY IF EXISTS "devis_delete" ON devis;
CREATE POLICY "devis_select" ON devis FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "devis_insert" ON devis FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devis_update" ON devis FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devis_delete" ON devis FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── factures ───────────────────────────────────────────────────────────────
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "factures_select" ON factures;
DROP POLICY IF EXISTS "factures_insert" ON factures;
DROP POLICY IF EXISTS "factures_update" ON factures;
DROP POLICY IF EXISTS "factures_delete" ON factures;
CREATE POLICY "factures_select" ON factures FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "factures_insert" ON factures FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "factures_update" ON factures FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "factures_delete" ON factures FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── paiements ──────────────────────────────────────────────────────────────
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "paiements_select" ON paiements;
DROP POLICY IF EXISTS "paiements_insert" ON paiements;
DROP POLICY IF EXISTS "paiements_update" ON paiements;
DROP POLICY IF EXISTS "paiements_delete" ON paiements;
CREATE POLICY "paiements_select" ON paiements FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "paiements_insert" ON paiements FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paiements_update" ON paiements FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paiements_delete" ON paiements FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── planning_interventions ─────────────────────────────────────────────────
ALTER TABLE planning_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_interventions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "planning_select" ON planning_interventions;
DROP POLICY IF EXISTS "planning_insert" ON planning_interventions;
DROP POLICY IF EXISTS "planning_update" ON planning_interventions;
DROP POLICY IF EXISTS "planning_delete" ON planning_interventions;
CREATE POLICY "planning_select" ON planning_interventions FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "planning_insert" ON planning_interventions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "planning_update" ON planning_interventions FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "planning_delete" ON planning_interventions FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── achats ─────────────────────────────────────────────────────────────────
ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achats FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achats_select" ON achats;
DROP POLICY IF EXISTS "achats_insert" ON achats;
DROP POLICY IF EXISTS "achats_update" ON achats;
DROP POLICY IF EXISTS "achats_delete" ON achats;
CREATE POLICY "achats_select" ON achats FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "achats_insert" ON achats FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "achats_update" ON achats FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "achats_delete" ON achats FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── documents (PAS d'UPDATE cote client, comportement conserve) ─────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_insert" ON documents;
DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "documents_insert" ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documents_delete" ON documents FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── relances ───────────────────────────────────────────────────────────────
ALTER TABLE relances ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "relances_select" ON relances;
DROP POLICY IF EXISTS "relances_insert" ON relances;
DROP POLICY IF EXISTS "relances_update" ON relances;
DROP POLICY IF EXISTS "relances_delete" ON relances;
CREATE POLICY "relances_select" ON relances FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "relances_insert" ON relances FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "relances_update" ON relances FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "relances_delete" ON relances FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── materiel (policies en 2 blocs : SELECT + FOR ALL ecriture) ─────────────
-- L'original (migration-materiel.sql) :
--   "user_read_own"  FOR SELECT USING (auth.uid() = user_id)
--   "user_write_own" FOR ALL    USING (auth.uid() = user_id)
--                               WITH CHECK (auth.uid() = user_id)
-- On scinde l'ecriture pour respecter le pattern : USING(entreprise) cote
-- INSERT-existant/UPDATE/DELETE, mais WITH CHECK reste auth.uid()=user_id
-- (un INSERT/UPDATE n'attache la ligne qu'a soi-meme). On garde FOR ALL en
-- conservant ce double critere : lecture/ecriture des lignes du tenant,
-- mais on ne peut creer/deplacer une ligne que vers soi-meme.
ALTER TABLE materiel ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiel FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_read_own"  ON materiel;
DROP POLICY IF EXISTS "user_write_own" ON materiel;
CREATE POLICY "user_read_own" ON materiel FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "user_write_own" ON materiel FOR ALL
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);

-- ── rappels ────────────────────────────────────────────────────────────────
ALTER TABLE rappels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rappels FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rappels_select_own" ON rappels;
DROP POLICY IF EXISTS "rappels_insert_own" ON rappels;
DROP POLICY IF EXISTS "rappels_update_own" ON rappels;
DROP POLICY IF EXISTS "rappels_delete_own" ON rappels;
CREATE POLICY "rappels_select_own" ON rappels FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "rappels_insert_own" ON rappels FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rappels_update_own" ON rappels FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rappels_delete_own" ON rappels FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── intervention_intervenants (a user_id direct) ───────────────────────────
ALTER TABLE intervention_intervenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_intervenants FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intervention_intervenants_select" ON intervention_intervenants;
DROP POLICY IF EXISTS "intervention_intervenants_insert" ON intervention_intervenants;
DROP POLICY IF EXISTS "intervention_intervenants_update" ON intervention_intervenants;
DROP POLICY IF EXISTS "intervention_intervenants_delete" ON intervention_intervenants;
CREATE POLICY "intervention_intervenants_select" ON intervention_intervenants FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "intervention_intervenants_insert" ON intervention_intervenants FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intervention_intervenants_update" ON intervention_intervenants FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intervention_intervenants_delete" ON intervention_intervenants FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── intervention_notes_client (a user_id direct) ───────────────────────────
ALTER TABLE intervention_notes_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_notes_client FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_notes_select" ON intervention_notes_client;
DROP POLICY IF EXISTS "user_own_notes_insert" ON intervention_notes_client;
DROP POLICY IF EXISTS "user_own_notes_update" ON intervention_notes_client;
DROP POLICY IF EXISTS "user_own_notes_delete" ON intervention_notes_client;
CREATE POLICY "user_own_notes_select" ON intervention_notes_client FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "user_own_notes_insert" ON intervention_notes_client FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_own_notes_update" ON intervention_notes_client FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_own_notes_delete" ON intervention_notes_client FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── chantier_notes (a user_id direct) ──────────────────────────────────────
ALTER TABLE chantier_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_notes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chantier_notes_select" ON chantier_notes;
DROP POLICY IF EXISTS "chantier_notes_insert" ON chantier_notes;
DROP POLICY IF EXISTS "chantier_notes_update" ON chantier_notes;
DROP POLICY IF EXISTS "chantier_notes_delete" ON chantier_notes;
CREATE POLICY "chantier_notes_select" ON chantier_notes FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "chantier_notes_insert" ON chantier_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chantier_notes_update" ON chantier_notes FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chantier_notes_delete" ON chantier_notes FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── sous_traitant_paiements (a user_id direct) ─────────────────────────────
ALTER TABLE sous_traitant_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sous_traitant_paiements FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "st_paiements_select" ON sous_traitant_paiements;
DROP POLICY IF EXISTS "st_paiements_insert" ON sous_traitant_paiements;
DROP POLICY IF EXISTS "st_paiements_update" ON sous_traitant_paiements;
DROP POLICY IF EXISTS "st_paiements_delete" ON sous_traitant_paiements;
CREATE POLICY "st_paiements_select" ON sous_traitant_paiements FOR SELECT
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));
CREATE POLICY "st_paiements_insert" ON sous_traitant_paiements FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_paiements_update" ON sous_traitant_paiements FOR UPDATE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_paiements_delete" ON sous_traitant_paiements FOR DELETE
  USING (entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()));

-- ── module_events : table ABSENTE de la base de production => ignoree. ──────
--    (Definie dans un ancien fichier SQL jamais applique en prod. Verifie via
--     list_tables le 12/06/2026 : la table n'existe pas.)

-- ── user_onboarding : preference STRICTEMENT PERSONNELLE (etat du tutoriel,
--    1 ligne par user). On la GARDE en "par utilisateur" (auth.uid()=user_id),
--    PAS en "par entreprise" : un employe ne doit pas heriter de l'avancement
--    du tutoriel de son patron. Meme logique que la table `profiles`.
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own onboarding"   ON public.user_onboarding;
DROP POLICY IF EXISTS "Users can insert their own onboarding" ON public.user_onboarding;
DROP POLICY IF EXISTS "Users can update their own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can view their own onboarding" ON public.user_onboarding FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own onboarding" ON public.user_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own onboarding" ON public.user_onboarding FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 3) TABLES ENFANTS (pas de user_id direct, securisees via le parent)
--    SELECT/UPDATE/DELETE : parent_id IN (SELECT id FROM parent
--                            WHERE entreprise_of_user(user_id) IN (...))
--    INSERT : on GARDE la logique parent existante (rattachement au parent
--             dont je suis proprietaire => preserve).
-- ════════════════════════════════════════════════════════════════════════════

-- ── devis_lignes -> devis ──────────────────────────────────────────────────
ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_lignes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devis_lignes_select" ON devis_lignes;
DROP POLICY IF EXISTS "devis_lignes_insert" ON devis_lignes;
DROP POLICY IF EXISTS "devis_lignes_update" ON devis_lignes;
DROP POLICY IF EXISTS "devis_lignes_delete" ON devis_lignes;
CREATE POLICY "devis_lignes_select" ON devis_lignes FOR SELECT
  USING (devis_id IN (
    SELECT id FROM devis
    WHERE entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())));
CREATE POLICY "devis_lignes_insert" ON devis_lignes FOR INSERT
  WITH CHECK (devis_id IN (SELECT id FROM devis WHERE user_id = auth.uid()));
CREATE POLICY "devis_lignes_update" ON devis_lignes FOR UPDATE
  USING (devis_id IN (
    SELECT id FROM devis
    WHERE entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())));
CREATE POLICY "devis_lignes_delete" ON devis_lignes FOR DELETE
  USING (devis_id IN (
    SELECT id FROM devis
    WHERE entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())));

-- ── facture_lignes -> factures ─────────────────────────────────────────────
ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_lignes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facture_lignes_select" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_insert" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_update" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_delete" ON facture_lignes;
CREATE POLICY "facture_lignes_select" ON facture_lignes FOR SELECT
  USING (facture_id IN (
    SELECT id FROM factures
    WHERE entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())));
CREATE POLICY "facture_lignes_insert" ON facture_lignes FOR INSERT
  WITH CHECK (facture_id IN (SELECT id FROM factures WHERE user_id = auth.uid()));
CREATE POLICY "facture_lignes_update" ON facture_lignes FOR UPDATE
  USING (facture_id IN (
    SELECT id FROM factures
    WHERE entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())));
CREATE POLICY "facture_lignes_delete" ON facture_lignes FOR DELETE
  USING (facture_id IN (
    SELECT id FROM factures
    WHERE entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())));

-- ── chantier_intervenants -> chantiers (via EXISTS) ────────────────────────
ALTER TABLE chantier_intervenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_intervenants FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chantier_intervenants_select_own" ON chantier_intervenants;
DROP POLICY IF EXISTS "chantier_intervenants_insert_own" ON chantier_intervenants;
DROP POLICY IF EXISTS "chantier_intervenants_update_own" ON chantier_intervenants;
DROP POLICY IF EXISTS "chantier_intervenants_delete_own" ON chantier_intervenants;
CREATE POLICY "chantier_intervenants_select_own" ON chantier_intervenants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chantiers
    WHERE chantiers.id = chantier_intervenants.chantier_id
      AND entreprise_of_user(chantiers.user_id) IN (SELECT current_entreprise_ids())));
-- INSERT : rattachement a un chantier dont je suis proprietaire (logique parent preservee).
CREATE POLICY "chantier_intervenants_insert_own" ON chantier_intervenants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM chantiers
    WHERE chantiers.id = chantier_intervenants.chantier_id
      AND chantiers.user_id = auth.uid()));
CREATE POLICY "chantier_intervenants_update_own" ON chantier_intervenants FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM chantiers
    WHERE chantiers.id = chantier_intervenants.chantier_id
      AND entreprise_of_user(chantiers.user_id) IN (SELECT current_entreprise_ids())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chantiers
    WHERE chantiers.id = chantier_intervenants.chantier_id
      AND chantiers.user_id = auth.uid()));
CREATE POLICY "chantier_intervenants_delete_own" ON chantier_intervenants FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM chantiers
    WHERE chantiers.id = chantier_intervenants.chantier_id
      AND entreprise_of_user(chantiers.user_id) IN (SELECT current_entreprise_ids())));

-- ── chantier_devis : table ABSENTE de la base de production => ignoree. ─────
--    (La liaison chantier<->devis se fait par la colonne devis.chantier_id,
--     pas par une table d'association. Verifie via list_tables le 12/06/2026.)


-- ════════════════════════════════════════════════════════════════════════════
-- 4) TABLES VOLONTAIREMENT LAISSEES INTACTES (server-only, AUCUNE policy client)
-- ════════════════════════════════════════════════════════════════════════════
--   - entreprise_membres   : geree en Phase 1 (RLS stricte, ecriture service_role).
--   - facture_compteurs    : compteur sequentiel des numeros de facture, ecrit
--                            uniquement par trigger/route serveur (pas de policy
--                            client => deny-all par defaut). NE PAS y ajouter de
--                            policy : cela ouvrirait un canal de manipulation du
--                            numerotage legal.
--   - tables abonnement/stripe (subscription, webhooks d'idempotence, etc.) :
--                            pas de policy client aujourd'hui (server-only).
--   => On ne LEUR AJOUTE AUCUNE policy. Statu quo.


-- ════════════════════════════════════════════════════════════════════════════
-- 5) VERIFICATIONS (a executer apres, manuellement)
-- ════════════════════════════════════════════════════════════════════════════
-- a) Equivalence comportementale (doit etre VRAI partout : 1 membre/entreprise) :
--      SELECT user_id,
--             entreprise_of_user(user_id) AS ent_du_user,
--             (SELECT entreprise_id FROM entreprise_membres
--               WHERE user_id = m.user_id AND statut='actif' LIMIT 1) AS ent_membre
--      FROM entreprise_membres m WHERE statut='actif';
--    (ent_du_user doit toujours egaler ent_membre)
--
-- b) Compter les policies par table (sanity check, doit matcher l'avant) :
--      SELECT tablename, COUNT(*) FROM pg_policies
--      WHERE schemaname='public' GROUP BY tablename ORDER BY tablename;
--
-- c) Connecte en utilisateur normal : ouvrir le dashboard et verifier que
--    devis / factures / clients / planning s'affichent comme avant (rien en
--    plus, rien en moins).
-- ============================================================================
