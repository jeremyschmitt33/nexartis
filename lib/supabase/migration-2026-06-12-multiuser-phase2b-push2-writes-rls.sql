-- ============================================================================
-- MULTI-UTILISATEUR — PHASE 2b / PUSH 2 : ECRITURE ROLE-AWARE (INSERT/UPDATE/DELETE)
-- Date : 2026-06-12
--
-- ⚠️ ORDRE D'EXECUTION : ce fichier s'execute APRES la migration de LECTURE
--    "migration-2026-06-12-multiuser-phase2b-push2-rls.sql". Cette derniere
--    durcit les SELECT et cree les vues d'ouvrier ; le present fichier durcit
--    UNIQUEMENT les ecritures (INSERT / UPDATE / DELETE). Les deux sont
--    complementaires : la lecture sans l'ecriture laisse un trou (un ouvrier
--    peut modifier via PostgREST meme s'il ne voit rien) ; l'inverse n'est pas
--    recommande non plus. A deployer ENSEMBLE, dans cet ordre.
--
-- CONTEXTE (etat prod verifie via pg_policies, PG 17.6)
--   Chaque table metier a des policies d'ecriture EN DOUBLE :
--     - LEGACY : "Users can insert/update/delete own X"
--         INSERT  -> with_check (auth.uid() = user_id)
--         UPDATE  -> using (auth.uid() = user_id)            [pas de with_check]
--         DELETE  -> using (auth.uid() = user_id)
--     - MEMBERSHIP (phase 2a) : X_insert / X_update / X_delete
--         INSERT  -> with_check (auth.uid() = user_id)        [identique legacy !]
--         UPDATE  -> using (entreprise membership) + with_check (auth.uid()=user_id)
--         DELETE  -> using (entreprise membership)
--   Les deux jeux de policies se combinent en OR (policies PERMISSIVES). AUCUN
--   n'embarque de filtre de ROLE => aujourd'hui n'importe quel membre actif
--   (commercial, ouvrier) peut, en appelant PostgREST directement (hors UI) :
--     - UPDATE/DELETE des factures, devis, chantiers... de l'entreprise ;
--     - UPDATE entreprises (IBAN/BIC, reglages) ;
--     - INSERT des lignes pour le compte de l'entreprise.
--   C'est exactement la "dette de securite bloquante Phase 3" notee dans la
--   migration de lecture. Ce fichier LA SOLDE pour les ecritures.
--
-- CE QUE FAIT CETTE MIGRATION
--   Pour chaque table metier :
--     1) DROP des policies d'ecriture LEGACY et MEMBERSHIP existantes
--        (INSERT/UPDATE/DELETE), avec les NOMS REELS verifies via pg_policies.
--     2) Recree des policies INSERT/UPDATE/DELETE ROLE-AWARE :
--          - UPDATE/DELETE : USING = membership entreprise ET role autorise.
--          - INSERT/UPDATE : WITH CHECK = la ligne ecrite est rattachee a
--            l'entreprise du membre (entreprise_of_user(user_id) IN
--            current_entreprise_ids()) ET role autorise.
--        Le WITH CHECK empeche d'ecrire une ligne rattachee a une AUTRE
--        entreprise (contrairement au legacy auth.uid()=user_id qui n'imposait
--        que "ma propre ligne" mais pas le tenant via les helpers).
--
-- MATRICE D'ECRITURE (cible) — qui peut INSERT / UPDATE / DELETE
--   - Dirigeant : TOUT (toutes les tables ci-dessous).            -> role = 'dirigeant' inclus partout
--   - Commercial : devis, devis_lignes, clients, prestations,
--       chantiers, planning_interventions, intervention_intervenants,
--       chantier_notes, intervention_notes_client, chantier_intervenants
--                                                                  -> role IN ('dirigeant','commercial')
--   - Dirigeant SEUL : factures, facture_lignes, achats, paiements,
--       relances, fournisseurs, sous_traitant_paiements, documents,
--       rappels, points_collecte, entreprises                     -> role = 'dirigeant'
--   - Ouvrier : AUCUNE ecriture, nulle part (jamais inclus).
--   - materiel : DEJA traite dans la migration de LECTURE (policy materiel_write
--       FOR ALL, dirigeant seul). NON RETOUCHE ICI.
--
-- NON-REGRESSION DIRIGEANT
--   Le role 'dirigeant' est inclus dans CHAQUE policy ci-dessous. Un dirigeant
--   conserve donc l'integralite de ses droits d'ecriture, a l'identique d'avant.
--
-- TABLES VOLONTAIREMENT NON TOUCHEES
--   - materiel (deja role-aware via la migration lecture).
--   - profiles, user_onboarding, mr_*, entreprise_membres, facture_compteurs.
--
-- IDEMPOTENCE
--   Tout est DROP POLICY IF EXISTS avant CREATE. Rejouable sans erreur. DDL pur
--   sur les policies : aucune donnee modifiee, risque de perte NUL.
--
-- A EXECUTER
--   Supabase > SQL Editor > New query > coller TOUT > Run > "Success".
-- ============================================================================


-- ############################################################################
-- ## SECTION 1 — VISIBLE/EDITABLE PAR DIRIGEANT + COMMERCIAL                  ##
-- ##   devis, devis_lignes, clients, prestations, chantiers,                  ##
-- ##   planning_interventions, intervention_intervenants, chantier_notes,     ##
-- ##   intervention_notes_client, chantier_intervenants                       ##
-- ##   -> role IN ('dirigeant','commercial')                                  ##
-- ############################################################################

-- ----- 1.1 devis -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own devis" ON devis;
DROP POLICY IF EXISTS "Users can update own devis" ON devis;
DROP POLICY IF EXISTS "Users can delete own devis" ON devis;
DROP POLICY IF EXISTS devis_insert ON devis;
DROP POLICY IF EXISTS devis_update ON devis;
DROP POLICY IF EXISTS devis_delete ON devis;

CREATE POLICY devis_insert ON devis FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY devis_update ON devis FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY devis_delete ON devis FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.2 devis_lignes (pas de user_id propre : filtre via le parent devis) -
-- INSERT/UPDATE WITH CHECK : le devis parent doit appartenir a l'entreprise du
-- membre ET le role doit etre autorise (evalue sur le user_id du devis parent).
DROP POLICY IF EXISTS "Users can insert own devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Users can update own devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS "Users can delete own devis_lignes" ON devis_lignes;
DROP POLICY IF EXISTS devis_lignes_insert ON devis_lignes;
DROP POLICY IF EXISTS devis_lignes_update ON devis_lignes;
DROP POLICY IF EXISTS devis_lignes_delete ON devis_lignes;

CREATE POLICY devis_lignes_insert ON devis_lignes FOR INSERT WITH CHECK (
  devis_id IN (
    SELECT d.id FROM devis d
    WHERE entreprise_of_user(d.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(d.user_id)) IN ('dirigeant','commercial')
  )
);
CREATE POLICY devis_lignes_update ON devis_lignes FOR UPDATE
  USING (
    devis_id IN (
      SELECT d.id FROM devis d
      WHERE entreprise_of_user(d.user_id) IN (SELECT current_entreprise_ids())
        AND current_role_in(entreprise_of_user(d.user_id)) IN ('dirigeant','commercial')
    )
  )
  WITH CHECK (
    devis_id IN (
      SELECT d.id FROM devis d
      WHERE entreprise_of_user(d.user_id) IN (SELECT current_entreprise_ids())
        AND current_role_in(entreprise_of_user(d.user_id)) IN ('dirigeant','commercial')
    )
  );
CREATE POLICY devis_lignes_delete ON devis_lignes FOR DELETE USING (
  devis_id IN (
    SELECT d.id FROM devis d
    WHERE entreprise_of_user(d.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(d.user_id)) IN ('dirigeant','commercial')
  )
);

-- ----- 1.3 clients ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY clients_update ON clients FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY clients_delete ON clients FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.4 prestations -----------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own prestations" ON prestations;
DROP POLICY IF EXISTS "Users can update own prestations" ON prestations;
DROP POLICY IF EXISTS "Users can delete own prestations" ON prestations;
DROP POLICY IF EXISTS prestations_insert ON prestations;
DROP POLICY IF EXISTS prestations_update ON prestations;
DROP POLICY IF EXISTS prestations_delete ON prestations;

CREATE POLICY prestations_insert ON prestations FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY prestations_update ON prestations FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY prestations_delete ON prestations FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.5 chantiers -------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own chantiers" ON chantiers;
DROP POLICY IF EXISTS "Users can update own chantiers" ON chantiers;
DROP POLICY IF EXISTS "Users can delete own chantiers" ON chantiers;
DROP POLICY IF EXISTS chantiers_insert ON chantiers;
DROP POLICY IF EXISTS chantiers_update ON chantiers;
DROP POLICY IF EXISTS chantiers_delete ON chantiers;

CREATE POLICY chantiers_insert ON chantiers FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY chantiers_update ON chantiers FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY chantiers_delete ON chantiers FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.6 planning_interventions ------------------------------------------
DROP POLICY IF EXISTS "Users can insert own planning" ON planning_interventions;
DROP POLICY IF EXISTS "Users can update own planning" ON planning_interventions;
DROP POLICY IF EXISTS "Users can delete own planning" ON planning_interventions;
DROP POLICY IF EXISTS planning_insert ON planning_interventions;
DROP POLICY IF EXISTS planning_update ON planning_interventions;
DROP POLICY IF EXISTS planning_delete ON planning_interventions;

CREATE POLICY planning_insert ON planning_interventions FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY planning_update ON planning_interventions FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY planning_delete ON planning_interventions FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.7 intervention_intervenants ---------------------------------------
-- (Pas de policy legacy "Users can ... own" en prod : seulement les nouvelles.)
DROP POLICY IF EXISTS intervention_intervenants_insert ON intervention_intervenants;
DROP POLICY IF EXISTS intervention_intervenants_update ON intervention_intervenants;
DROP POLICY IF EXISTS intervention_intervenants_delete ON intervention_intervenants;

CREATE POLICY intervention_intervenants_insert ON intervention_intervenants FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY intervention_intervenants_update ON intervention_intervenants FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY intervention_intervenants_delete ON intervention_intervenants FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.8 chantier_notes --------------------------------------------------
-- (Pas de legacy "Users can ... own" : seulement chantier_notes_insert/update/delete.)
DROP POLICY IF EXISTS chantier_notes_insert ON chantier_notes;
DROP POLICY IF EXISTS chantier_notes_update ON chantier_notes;
DROP POLICY IF EXISTS chantier_notes_delete ON chantier_notes;

CREATE POLICY chantier_notes_insert ON chantier_notes FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY chantier_notes_update ON chantier_notes FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY chantier_notes_delete ON chantier_notes FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.9 intervention_notes_client ---------------------------------------
-- (Policies prod : user_own_notes_insert/update/delete.)
DROP POLICY IF EXISTS user_own_notes_insert ON intervention_notes_client;
DROP POLICY IF EXISTS user_own_notes_update ON intervention_notes_client;
DROP POLICY IF EXISTS user_own_notes_delete ON intervention_notes_client;

CREATE POLICY user_own_notes_insert ON intervention_notes_client FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);
CREATE POLICY user_own_notes_update ON intervention_notes_client FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
  );
CREATE POLICY user_own_notes_delete ON intervention_notes_client FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 1.10 chantier_intervenants (pas de user_id propre : filtre via le parent chantier) -
-- Policies prod : chantier_intervenants_insert_own / _update_own / _delete_own.
-- Le filtre passe par le chantier parent (entreprise + role), comme devis_lignes.
DROP POLICY IF EXISTS chantier_intervenants_insert_own ON chantier_intervenants;
DROP POLICY IF EXISTS chantier_intervenants_update_own ON chantier_intervenants;
DROP POLICY IF EXISTS chantier_intervenants_delete_own ON chantier_intervenants;

CREATE POLICY chantier_intervenants_insert_own ON chantier_intervenants FOR INSERT WITH CHECK (
  chantier_id IN (
    SELECT c.id FROM chantiers c
    WHERE entreprise_of_user(c.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(c.user_id)) IN ('dirigeant','commercial')
  )
);
CREATE POLICY chantier_intervenants_update_own ON chantier_intervenants FOR UPDATE
  USING (
    chantier_id IN (
      SELECT c.id FROM chantiers c
      WHERE entreprise_of_user(c.user_id) IN (SELECT current_entreprise_ids())
        AND current_role_in(entreprise_of_user(c.user_id)) IN ('dirigeant','commercial')
    )
  )
  WITH CHECK (
    chantier_id IN (
      SELECT c.id FROM chantiers c
      WHERE entreprise_of_user(c.user_id) IN (SELECT current_entreprise_ids())
        AND current_role_in(entreprise_of_user(c.user_id)) IN ('dirigeant','commercial')
    )
  );
CREATE POLICY chantier_intervenants_delete_own ON chantier_intervenants FOR DELETE USING (
  chantier_id IN (
    SELECT c.id FROM chantiers c
    WHERE entreprise_of_user(c.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(c.user_id)) IN ('dirigeant','commercial')
  )
);


-- ############################################################################
-- ## SECTION 2 — EDITABLE PAR DIRIGEANT SEUL (donnees financieres/sensibles) ##
-- ##   factures, facture_lignes, achats, paiements, relances, fournisseurs,   ##
-- ##   sous_traitant_paiements, documents, rappels, points_collecte           ##
-- ##   -> role = 'dirigeant'                                                   ##
-- ############################################################################

-- ----- 2.1 factures --------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own factures" ON factures;
DROP POLICY IF EXISTS "Users can update own factures" ON factures;
DROP POLICY IF EXISTS "Users can delete own factures" ON factures;
DROP POLICY IF EXISTS factures_insert ON factures;
DROP POLICY IF EXISTS factures_update ON factures;
DROP POLICY IF EXISTS factures_delete ON factures;

CREATE POLICY factures_insert ON factures FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY factures_update ON factures FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY factures_delete ON factures FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.2 facture_lignes (filtre via le parent facture) -------------------
DROP POLICY IF EXISTS "Users can insert own facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Users can update own facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Users can delete own facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS facture_lignes_insert ON facture_lignes;
DROP POLICY IF EXISTS facture_lignes_update ON facture_lignes;
DROP POLICY IF EXISTS facture_lignes_delete ON facture_lignes;

CREATE POLICY facture_lignes_insert ON facture_lignes FOR INSERT WITH CHECK (
  facture_id IN (
    SELECT f.id FROM factures f
    WHERE entreprise_of_user(f.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(f.user_id)) = 'dirigeant'
  )
);
CREATE POLICY facture_lignes_update ON facture_lignes FOR UPDATE
  USING (
    facture_id IN (
      SELECT f.id FROM factures f
      WHERE entreprise_of_user(f.user_id) IN (SELECT current_entreprise_ids())
        AND current_role_in(entreprise_of_user(f.user_id)) = 'dirigeant'
    )
  )
  WITH CHECK (
    facture_id IN (
      SELECT f.id FROM factures f
      WHERE entreprise_of_user(f.user_id) IN (SELECT current_entreprise_ids())
        AND current_role_in(entreprise_of_user(f.user_id)) = 'dirigeant'
    )
  );
CREATE POLICY facture_lignes_delete ON facture_lignes FOR DELETE USING (
  facture_id IN (
    SELECT f.id FROM factures f
    WHERE entreprise_of_user(f.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(f.user_id)) = 'dirigeant'
  )
);

-- ----- 2.3 achats ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own achats" ON achats;
DROP POLICY IF EXISTS "Users can update own achats" ON achats;
DROP POLICY IF EXISTS "Users can delete own achats" ON achats;
DROP POLICY IF EXISTS achats_insert ON achats;
DROP POLICY IF EXISTS achats_update ON achats;
DROP POLICY IF EXISTS achats_delete ON achats;

CREATE POLICY achats_insert ON achats FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY achats_update ON achats FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY achats_delete ON achats FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.4 paiements -------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own paiements" ON paiements;
DROP POLICY IF EXISTS "Users can update own paiements" ON paiements;
DROP POLICY IF EXISTS "Users can delete own paiements" ON paiements;
DROP POLICY IF EXISTS paiements_insert ON paiements;
DROP POLICY IF EXISTS paiements_update ON paiements;
DROP POLICY IF EXISTS paiements_delete ON paiements;

CREATE POLICY paiements_insert ON paiements FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY paiements_update ON paiements FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY paiements_delete ON paiements FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.5 relances --------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own relances" ON relances;
DROP POLICY IF EXISTS "Users can update own relances" ON relances;
DROP POLICY IF EXISTS "Users can delete own relances" ON relances;
DROP POLICY IF EXISTS relances_insert ON relances;
DROP POLICY IF EXISTS relances_update ON relances;
DROP POLICY IF EXISTS relances_delete ON relances;

CREATE POLICY relances_insert ON relances FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY relances_update ON relances FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY relances_delete ON relances FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.6 fournisseurs ----------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Users can update own fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Users can delete own fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS fournisseurs_insert ON fournisseurs;
DROP POLICY IF EXISTS fournisseurs_update ON fournisseurs;
DROP POLICY IF EXISTS fournisseurs_delete ON fournisseurs;

CREATE POLICY fournisseurs_insert ON fournisseurs FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY fournisseurs_update ON fournisseurs FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY fournisseurs_delete ON fournisseurs FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.7 sous_traitant_paiements (policies prod : st_paiements_*) ----------
DROP POLICY IF EXISTS st_paiements_insert ON sous_traitant_paiements;
DROP POLICY IF EXISTS st_paiements_update ON sous_traitant_paiements;
DROP POLICY IF EXISTS st_paiements_delete ON sous_traitant_paiements;

CREATE POLICY st_paiements_insert ON sous_traitant_paiements FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY st_paiements_update ON sous_traitant_paiements FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY st_paiements_delete ON sous_traitant_paiements FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.8 documents -------------------------------------------------------
-- Coherent avec la migration LECTURE qui a passe documents_select en dirigeant
-- seul (PDF de factures = montants/CA). On verrouille l'ecriture pareil.
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS documents_insert ON documents;
DROP POLICY IF EXISTS documents_update ON documents;
DROP POLICY IF EXISTS documents_delete ON documents;

CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY documents_update ON documents FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY documents_delete ON documents FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.9 rappels (policies prod : rappels_*_own) -------------------------
DROP POLICY IF EXISTS rappels_insert_own ON rappels;
DROP POLICY IF EXISTS rappels_update_own ON rappels;
DROP POLICY IF EXISTS rappels_delete_own ON rappels;

CREATE POLICY rappels_insert_own ON rappels FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY rappels_update_own ON rappels FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY rappels_delete_own ON rappels FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- ----- 2.10 points_collecte ------------------------------------------------
-- NB : en LECTURE, points_collecte est visible par TOUS les roles (donnee non
-- sensible : decheteries). Mais sa GESTION (creation/modif du referentiel) est
-- une operation de parametrage -> reservee au DIRIGEANT (comme demande dans la
-- matrice d'ecriture). Un ouvrier/commercial peut LIRE les points, pas les modifier.
DROP POLICY IF EXISTS points_collecte_insert ON points_collecte;
DROP POLICY IF EXISTS points_collecte_update ON points_collecte;
DROP POLICY IF EXISTS points_collecte_delete ON points_collecte;

CREATE POLICY points_collecte_insert ON points_collecte FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);
CREATE POLICY points_collecte_update ON points_collecte FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );
CREATE POLICY points_collecte_delete ON points_collecte FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);


-- ############################################################################
-- ## SECTION 3 — entreprises : UPDATE dirigeant seul, INSERT onboarding intact ##
-- ############################################################################
--
-- UPDATE -> DIRIGEANT SEUL (IBAN/BIC, nom, reglages, mentions legales).
--   On verrouille l'UPDATE sur le role 'dirigeant'. USING + WITH CHECK.
--   ⚠️ Note WITH CHECK : on impose que la ligne reste rattachee a l'entreprise
--   du membre (entreprise_of_user(user_id) = l'entreprise elle-meme, qui doit
--   etre dans current_entreprise_ids()) ET role dirigeant. Empeche un dirigeant
--   d'une entreprise A de "deplacer" la ligne vers une entreprise B.
--
-- INSERT -> CONSERVE TEL QUEL (onboarding du tout 1er compte).
--   ⚠️ POINT D'HESITATION (cf. rapport) : entreprises_insert / "Users can insert
--   own entreprise" servent a la CREATION INITIALE de l'entreprise lors de
--   l'onboarding. A ce moment-la, l'utilisateur n'est PAS encore membre d'une
--   entreprise (entreprise_membres n'existe pas encore pour lui) -> un filtre
--   current_role_in(...) renverrait NULL et BLOQUERAIT la creation du compte.
--   On NE TOUCHE DONC PAS a l'INSERT : il reste with_check (auth.uid()=user_id),
--   ce qui est correct (on ne peut creer qu'une entreprise dont on est le user).
--   On supprime juste le DOUBLON d'INSERT pour ne garder qu'une policy canonique.
--
-- DELETE -> AUCUNE policy DELETE n'existe en prod sur entreprises (verifie), et
--   on n'en cree pas : la suppression d'entreprise n'est pas une operation
--   self-service employe (passe par suppression de compte cote serveur).

-- INSERT onboarding : on garde UNE policy, on retire le doublon.
DROP POLICY IF EXISTS "Users can insert own entreprise" ON entreprises;
DROP POLICY IF EXISTS entreprises_insert ON entreprises;
CREATE POLICY entreprises_insert ON entreprises FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- UPDATE dirigeant seul.
DROP POLICY IF EXISTS "Users can update own entreprise" ON entreprises;
DROP POLICY IF EXISTS entreprises_update ON entreprises;
CREATE POLICY entreprises_update ON entreprises FOR UPDATE
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );


-- ############################################################################
-- ## SECTION 4 — VERIFICATIONS & TESTS PAR IMPERSONATION (commentaires)      ##
-- ############################################################################
--
-- A executer MANUELLEMENT apres la migration. Pattern d'impersonation PostgREST :
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<USER_ID>"}';
-- Toujours dans une transaction BEGIN ... ROLLBACK pour ne RIEN persister.
-- Remplacer <DIRIGEANT_UID>, <COMMERCIAL_UID>, <OUVRIER_UID> et les <..._ID>.
--
-- ----------------------------------------------------------------------------
-- (a) OUVRIER : AUCUNE ecriture nulle part -> chaque commande DOIT echouer
--     (RLS : "new row violates row-level security policy") ou affecter 0 ligne.
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<OUVRIER_UID>"}';
--   -- INSERT (doit ECHOUER : violates RLS) :
--   INSERT INTO devis (user_id, ...) VALUES ('<DIRIGEANT_UID>', ...);            -- ECHEC attendu
--   INSERT INTO chantiers (user_id, ...) VALUES ('<DIRIGEANT_UID>', ...);        -- ECHEC attendu
--   INSERT INTO planning_interventions (user_id, ...) VALUES ('<DIRIGEANT_UID>', ...); -- ECHEC attendu
--   -- UPDATE / DELETE (USING ne matche aucune ligne -> 0 ligne affectee) :
--   UPDATE devis SET titre = 'HACK' WHERE id = '<UN_DEVIS_ID>';                  -- 0 ligne
--   DELETE FROM chantiers WHERE id = '<UN_CHANTIER_ID>';                         -- 0 ligne
--   DELETE FROM planning_interventions WHERE id = '<UNE_INTERVENTION_ID>';       -- 0 ligne
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (b) COMMERCIAL : peut ecrire son domaine, mais PAS factures ni entreprise.
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<COMMERCIAL_UID>"}';
--   -- Autorise (doit REUSSIR) :
--   UPDATE devis SET titre = 'ok' WHERE id = '<UN_DEVIS_ID>';                    -- 1 ligne
--   UPDATE chantiers SET titre = 'ok' WHERE id = '<UN_CHANTIER_ID>';            -- 1 ligne
--   -- Interdit (UPDATE/DELETE -> 0 ligne ; INSERT -> ECHEC RLS) :
--   UPDATE factures SET montant_total_ttc = 0 WHERE id = '<UNE_FACTURE_ID>';     -- 0 ligne
--   DELETE FROM factures WHERE id = '<UNE_FACTURE_ID>';                          -- 0 ligne
--   UPDATE entreprises SET iban = 'HACK' WHERE id = '<ENTREPRISE_ID>';           -- 0 ligne
--   INSERT INTO achats (user_id, ...) VALUES ('<DIRIGEANT_UID>', ...);           -- ECHEC attendu
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (c) DIRIGEANT : non-regression, peut TOUT ecrire.
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DIRIGEANT_UID>"}';
--   UPDATE devis SET titre = 'ok' WHERE id = '<UN_DEVIS_ID>';                    -- 1 ligne
--   UPDATE factures SET note = 'ok' WHERE id = '<UNE_FACTURE_ID>';               -- 1 ligne
--   UPDATE entreprises SET nom = nom WHERE id = '<ENTREPRISE_ID>';               -- 1 ligne
--   -- INSERT d'une ligne rattachee a SON entreprise (doit REUSSIR) :
--   INSERT INTO devis (user_id, ...) VALUES ('<DIRIGEANT_UID>', ...);            -- REUSSITE
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (d) CROSS-ENTREPRISE : un dirigeant de l'entreprise A ne peut pas ecrire une
--     ligne rattachee a l'entreprise B (WITH CHECK le bloque).
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DIRIGEANT_A_UID>"}';
--   -- Tenter d'inserer un devis avec le user_id d'un dirigeant de l'entreprise B :
--   INSERT INTO devis (user_id, ...) VALUES ('<DIRIGEANT_B_UID>', ...);          -- ECHEC attendu (RLS WITH CHECK)
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (e) CONTROLE DES POLICIES EN PLACE (doit lister les nouvelles, sans doublon legacy)
-- ----------------------------------------------------------------------------
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
--   ORDER BY tablename, cmd, policyname;
--   => plus aucune policy "Users can insert/update/delete own *" ne doit subsister
--      sur les tables traitees ; materiel garde sa policy user_write_own (ALL).
-- ============================================================================
