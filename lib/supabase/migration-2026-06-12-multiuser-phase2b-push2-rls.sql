-- ============================================================================
-- MULTI-UTILISATEUR — PHASE 2b / PUSH 2 : LECTURE ROLE-AWARE + MASQUAGE OUVRIER
-- Date : 2026-06-12
--
-- CONTEXTE
--   Phase 2a a ajoute des policies de lecture "*_select" (filtre ENTREPRISE via
--   les helpers SECURITY DEFINER) mais a LAISSE en place les anciennes policies
--   legacy "Users can view own *" (auth.uid() = user_id). Les deux policies
--   SELECT permissives se combinent en OR. Tant qu'il n'y a qu'un dirigeant par
--   entreprise, aucun effet ; des qu'un employe existe, la policy membership
--   laisse TOUT voir a TOUT membre, quel que soit son role => fuite potentielle
--   de montants (CA, marges, taux horaire) vers un Ouvrier.
--
-- CE QUE FAIT CETTE MIGRATION
--   1) Supprime les policies SELECT legacy doublons "Users can view own *".
--      => comportement INCHANGE pour le dirigeant : la policy membership couvre
--         deja TOUTES ses lignes (entreprise_of_user(user_id) renvoie SON
--         entreprise, qui est dans current_entreprise_ids()). La policy legacy
--         (auth.uid()=user_id) etait donc un sous-ensemble strict, redondante.
--   2) Reecrit chaque policy SELECT membership en ROLE-AWARE (ajout d'un filtre
--      current_role_in(entreprise_of_user(user_id)) IN (...)) selon la matrice
--      du design (PUSH2_DESIGN_RLS.md section 2).
--   3) Cree deux VUES de masquage pour l'Ouvrier, qui n'exposent QUE les colonnes
--      sures (jamais un montant, jamais un taux horaire, jamais un contact de
--      collegue), et qui portent ELLES-MEMES tout le filtrage de securite :
--        - chantiers_ouvrier  : chantiers AFFECTES a l'Ouvrier, sans montants.
--        - intervenants_safe  : trombinoscope d'equipe sans donnees sensibles.
--
-- PORTEE / NON-PORTEE
--   - On NE TOUCHE PAS aux policies INSERT / UPDATE / DELETE (sauf la policy
--     materiel "user_write_own" cmd=ALL, voir ci-dessous : elle DEVAIT etre
--     remplacee car FOR ALL couvre aussi le SELECT et rouvrait la lecture).
--   - On ne touche pas a profiles, user_onboarding, mr_* (intacts a raison).
--
-- ⚠️⚠️ DETTE DE SECURITE BLOQUANTE — PHASE 3 (A TRAITER AVANT D'INVITER UN
--      EMPLOYE NON-DIRIGEANT EN PROD) :
--   Cette migration ne durcit que la LECTURE (SELECT). Les policies
--   INSERT / UPDATE / DELETE restent en filtre ENTREPRISE SANS filtre de role.
--   Concretement, tant que la Phase 3 n'est pas faite, un commercial ou un
--   ouvrier authentifie peut, EN APPELANT L'API POSTGREST DIRECTEMENT (hors UI) :
--     - UPDATE / DELETE des factures, devis, clients, chantiers... de l'entreprise ;
--     - UPDATE entreprises (changer l'IBAN/BIC, le nom, les reglages) ;
--     - INSERT des lignes pour le compte de l'entreprise.
--   Le masquage en LECTURE de cette Phase 2b NE PROTEGE PAS contre l'ECRITURE.
--   => NE PAS inviter d'employe non-dirigeant en prod tant que la Phase 3
--      (durcissement role-aware des policies INSERT/UPDATE/DELETE) n'est pas
--      livree et auditee. Tant que l'unique role en prod est 'dirigeant',
--      cette dette est sans impact (un dirigeant a tous les droits).
--
-- REVERSIBILITE
--   Pour revenir a l'etat 2a : reexecuter la migration 2a (qui recree les
--   policies "*_select" sans filtre de role) puis recreer manuellement les
--   policies legacy "Users can view own *" si on les veut. Les vues s'annulent
--   par : DROP VIEW IF EXISTS chantiers_ouvrier; DROP VIEW IF EXISTS intervenants_safe;
--   Aucune donnee n'est modifiee/supprimee par cette migration (DDL pur sur les
--   policies + vues). Le risque de perte de donnees est NUL.
--
-- IDEMPOTENCE
--   Tout est DROP ... IF EXISTS avant CREATE, et les vues sont entierement
--   redefinies. La migration est rejouable sans erreur ni effet de bord.
--
-- A EXECUTER
--   Supabase > SQL Editor > New query > coller TOUT > Run > "Success".
--   (Le SQL Editor s'execute avec un role privilegie equivalent a "postgres",
--    proprietaire des tables, ce qui est REQUIS pour le bypass RLS des vues —
--    voir le bloc SECURITE DES VUES plus bas.)
-- ============================================================================


-- ############################################################################
-- ## SECTION 1 — NETTOYAGE DES POLICIES SELECT LEGACY (doublons "view own")  ##
-- ############################################################################
-- Ces policies (auth.uid() = user_id) sont des SOUS-ENSEMBLES de la policy
-- membership : pour le dirigeant, ses propres lignes (user_id = lui) ont
-- entreprise_of_user(user_id) = son entreprise, deja couverte par la membership.
-- Les supprimer ne retire donc AUCUNE ligne visible au dirigeant. En revanche,
-- les garder reintroduirait l'OR qui annule le filtre de role (un Ouvrier
-- dont user_id = la ligne... ne s'applique pas ici car les lignes metier
-- portent le user_id du DIRIGEANT, pas de l'Ouvrier ; mais on supprime par
-- hygiene et pour eviter toute future divergence).
--
-- NB : DROP IF EXISTS est inoffensif quand la policy n'existe pas (ex. materiel,
-- chantier_notes, points_collecte, intervention_intervenants, sous_traitant_paiements
-- n'ont jamais eu de policy legacy "view own").

DROP POLICY IF EXISTS "Users can view own devis"            ON devis;
DROP POLICY IF EXISTS "Users can view own devis_lignes"     ON devis_lignes;
DROP POLICY IF EXISTS "Users can view own factures"         ON factures;
DROP POLICY IF EXISTS "Users can view own facture_lignes"   ON facture_lignes;
DROP POLICY IF EXISTS "Users can view own achats"           ON achats;
DROP POLICY IF EXISTS "Users can view own paiements"        ON paiements;
DROP POLICY IF EXISTS "Users can view own relances"         ON relances;
DROP POLICY IF EXISTS "Users can view own fournisseurs"     ON fournisseurs;
DROP POLICY IF EXISTS "Users can view own clients"          ON clients;
DROP POLICY IF EXISTS "Users can view own prestations"      ON prestations;
DROP POLICY IF EXISTS "Users can view own chantiers"        ON chantiers;
DROP POLICY IF EXISTS "Users can view own intervenants"     ON intervenants;
DROP POLICY IF EXISTS "Users can view own planning"         ON planning_interventions;
-- Tables sans legacy connue (DROP defensif, no-op si absente) :
DROP POLICY IF EXISTS "Users can view own materiel"                 ON materiel;
DROP POLICY IF EXISTS "Users can view own sous_traitant_paiements"  ON sous_traitant_paiements;
DROP POLICY IF EXISTS "Users can view own chantier_notes"           ON chantier_notes;
DROP POLICY IF EXISTS "Users can view own points_collecte"          ON points_collecte;
DROP POLICY IF EXISTS "Users can view own intervention_intervenants" ON intervention_intervenants;


-- ############################################################################
-- ## SECTION 2 — REECRITURE DES POLICIES SELECT MEMBERSHIP EN ROLE-AWARE     ##
-- ############################################################################
-- Forme : on GARDE le filtre entreprise existant et on AJOUTE le filtre de role.
--   entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())   -- tenant
--   AND current_role_in(entreprise_of_user(user_id)) IN (...)          -- role
-- current_role_in(ent) renvoie le role du user courant DANS l'entreprise ent
-- (NULL s'il n'est pas membre actif -> IN (...) renvoie NULL -> ligne masquee).
-- Les noms de policy reels en prod ne sont PAS uniformes ; on supprime TOUS les
-- variants connus puis on recree un nom canonique "<table>_select".

-- ----- 2.1 Visible DIRIGEANT + COMMERCIAL : devis, devis_lignes, prestations, clients

DROP POLICY IF EXISTS devis_select ON devis;
CREATE POLICY devis_select ON devis FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- devis_lignes : pas de colonne user_id propre -> filtre via le parent devis,
-- ET filtre de role evalue sur le user_id du devis parent.
DROP POLICY IF EXISTS devis_lignes_select ON devis_lignes;
CREATE POLICY devis_lignes_select ON devis_lignes FOR SELECT USING (
  devis_id IN (
    SELECT d.id FROM devis d
    WHERE entreprise_of_user(d.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(d.user_id)) IN ('dirigeant','commercial')
  )
);

DROP POLICY IF EXISTS prestations_select ON prestations;
CREATE POLICY prestations_select ON prestations FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 2.2 Visible DIRIGEANT SEUL (donnees financieres) :
-- factures, facture_lignes, achats, paiements, relances, fournisseurs,
-- sous_traitant_paiements, materiel

DROP POLICY IF EXISTS factures_select ON factures;
CREATE POLICY factures_select ON factures FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

DROP POLICY IF EXISTS facture_lignes_select ON facture_lignes;
CREATE POLICY facture_lignes_select ON facture_lignes FOR SELECT USING (
  facture_id IN (
    SELECT f.id FROM factures f
    WHERE entreprise_of_user(f.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(f.user_id)) IN ('dirigeant')
  )
);

DROP POLICY IF EXISTS achats_select ON achats;
CREATE POLICY achats_select ON achats FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

DROP POLICY IF EXISTS paiements_select ON paiements;
CREATE POLICY paiements_select ON paiements FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

DROP POLICY IF EXISTS relances_select ON relances;
CREATE POLICY relances_select ON relances FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

DROP POLICY IF EXISTS fournisseurs_select ON fournisseurs;
CREATE POLICY fournisseurs_select ON fournisseurs FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

-- sous_traitant_paiements : la policy membership en prod s'appelle "st_paiements_select".
DROP POLICY IF EXISTS st_paiements_select ON sous_traitant_paiements;
DROP POLICY IF EXISTS sous_traitant_paiements_select ON sous_traitant_paiements;
CREATE POLICY st_paiements_select ON sous_traitant_paiements FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

-- materiel : la policy membership en prod s'appelle "user_read_own".
DROP POLICY IF EXISTS user_read_own ON materiel;
DROP POLICY IF EXISTS materiel_select ON materiel;
CREATE POLICY materiel_select ON materiel FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant')
);

-- ⚠️ FUITE FINANCIERE CORRIGEE (double audit) : il existe en prod sur materiel
-- une policy "user_write_own" en cmd=ALL. Une policy FOR ALL couvre AUSSI le
-- SELECT et, combinee en OR avec materiel_select, ROUVRE la LECTURE de materiel
-- (cout/prix) a TOUT membre, y compris commercial/ouvrier => le masquage
-- dirigeant-seul ci-dessus serait neutralise. On la supprime et on la remplace
-- par une policy d'ecriture role-aware (dirigeant SEUL), sans clause SELECT.
DROP POLICY IF EXISTS user_write_own ON materiel;
CREATE POLICY materiel_write ON materiel FOR ALL
  USING (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  )
  WITH CHECK (
    entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
    AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
  );

-- ----- 2.3 Visible DIRIGEANT + COMMERCIAL sur la TABLE DE BASE :
-- chantiers, intervenants. L'OUVRIER est volontairement EXCLU de ces tables
-- (elles contiennent montants / taux_horaire) ; il lit les VUES (section 3).

DROP POLICY IF EXISTS chantiers_select ON chantiers;
CREATE POLICY chantiers_select ON chantiers FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

DROP POLICY IF EXISTS intervenants_select ON intervenants;
CREATE POLICY intervenants_select ON intervenants FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);

-- ----- 2.4 Visible TOUS LES ROLES (aucun montant) : planning, liens, notes, points
-- On garde le filtre ENTREPRISE SANS filtre de role. (current_role_in <> NULL
-- est implicite : si le user n'est pas membre actif, entreprise_of_user(user_id)
-- n'est de toute facon pas dans current_entreprise_ids().)
-- La policy membership en prod sur planning s'appelle "planning_select".

DROP POLICY IF EXISTS planning_select ON planning_interventions;
DROP POLICY IF EXISTS planning_interventions_select ON planning_interventions;
CREATE POLICY planning_select ON planning_interventions FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
);

DROP POLICY IF EXISTS intervention_intervenants_select ON intervention_intervenants;
CREATE POLICY intervention_intervenants_select ON intervention_intervenants FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
);

-- NB : chantier_notes (notes internes de chantier) a ete RETIREE de cette
-- section "tous roles" : elle est trop large (l'ouvrier y lirait toutes les
-- notes internes de l'entreprise). Sa policy role-aware est recreee en SECTION
-- 3.3, APRES la vue chantiers_ouvrier qu'elle reference (ordre obligatoire).

DROP POLICY IF EXISTS points_collecte_select ON points_collecte;
CREATE POLICY points_collecte_select ON points_collecte FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
);

-- ----- 2.5 TABLES OUBLIEES PAR LA VERSION INITIALE (corrections double audit)
-- Ces 3 tables avaient encore leur policy SELECT membership SANS filtre de role
-- => fuite directe vers l'ouvrier (PDF de factures, rappels d'echeance, notes
-- privees artisan). On les durcit ici.

-- documents (PDF stockes de devis ET de factures, lies par reference_type/_id).
-- Risque : l'ouvrier telecharge les PDF de factures (montants, CA) via l'URL.
-- DECISION JEREMY (12/06) : le COMMERCIAL accede aux PDF de DEVIS (ce sont ses
--   chantiers, il peut avoir a les consulter/modifier), MAIS les PDF de FACTURES
--   restent reserves au DIRIGEANT (conformite / finances). L'OUVRIER : rien.
-- Implementation par LISTE BLANCHE : commercial autorise uniquement si
--   reference_type = 'devis' (toute autre valeur, dont les factures, reste
--   dirigeant-seul). NB : la table documents est actuellement vide et n'est pas
--   ecrite par le code applicatif courant (les PDF sont regeneres a la volee) ;
--   si la valeur reelle de reference_type pour un devis differe de 'devis', le
--   commercial ne verra rien (fail-safe, AUCUNE fuite) -> ajuster la valeur ici
--   le jour ou la fonctionnalite de stockage PDF sera activee.
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND (
    current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
    OR (
      current_role_in(entreprise_of_user(user_id)) = 'commercial'
      AND reference_type = 'devis'
    )
  )
);

-- rappels (relances d'echeance liees aux factures : lien_facture_id, etc.).
-- Donnee a connotation financiere -> DIRIGEANT SEUL.
-- ⚠️ DECISION JEREMY : a elargir eventuellement au COMMERCIAL selon le besoin
--    metier (suivi des relances clients), a valider.
DROP POLICY IF EXISTS rappels_select_own ON rappels;
CREATE POLICY rappels_select_own ON rappels FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'
);

-- intervention_notes_client : contient une colonne "type" qui distingue la note
-- CLIENT de la note PRIVEE artisan. Une note privee ne doit pas fuiter a
-- l'ouvrier. DIRIGEANT + COMMERCIAL (qui pilotent la relation client).
DROP POLICY IF EXISTS user_own_notes_select ON intervention_notes_client;
CREATE POLICY user_own_notes_select ON intervention_notes_client FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
);


-- ############################################################################
-- ## SECTION 3 — VUES DE MASQUAGE POUR L'OUVRIER (le point critique)         ##
-- ############################################################################
--
-- POURQUOI DES VUES (et pas des GRANT de colonne) ?
--   Tous les utilisateurs Supabase connectes partagent le MEME role Postgres
--   "authenticated". On ne peut donc pas masquer une colonne "par utilisateur"
--   via des GRANT de colonne. La strategie est :
--     - l'Ouvrier est BLOQUE sur les tables de base chantiers/intervenants
--       (section 2.3 ne l'inclut pas) ;
--     - il lit a la place des VUES qui n'EXPOSENT QUE les colonnes sures.
--   Les colonnes montant n'existent tout simplement PAS dans la projection de la
--   vue : aucune requete client ne peut les recuperer (ni en SELECT *, ni en
--   ciblant la colonne -> erreur "column does not exist"). Le masquage est donc
--   STRUCTUREL, pas cosmetique.
--
-- ----------------------------------------------------------------------------
-- SECURITE DES VUES — POURQUOI ELLES BYPASSENT LA RLS DES TABLES DE BASE
-- (raisonnement explicite — A FAIRE RELIRE PAR LA RED TEAM)
-- ----------------------------------------------------------------------------
--   Faits verifies en prod (PG 17.6) :
--     * chantiers, intervenants, clients, planning_interventions : RLS ENABLED
--       + FORCE ROW LEVEL SECURITY, toutes detenues par le role "postgres".
--     * Le role "postgres" possede l'attribut BYPASSRLS = true (et N'est PAS
--       superuser ; l'attribut est donc bien reel et porteur).
--     * Les vues Postgres ne sont PAS en security_invoker par defaut
--       (security_invoker = false par defaut en PG 15+, dont 17). Une vue non-
--       invoker execute ses requetes sous-jacentes avec les droits de son
--       PROPRIETAIRE, pas de l'appelant.
--
--   Consequence : ces vues, creees et donc DETENUES par "postgres" (le SQL
--   Editor Supabase s'execute avec ce role privilegie), lisent les tables de
--   base sous l'identite "postgres". Or :
--     - BYPASSRLS est un attribut de ROLE qui prime sur RLS et meme sur
--       FORCE RLS. (Doc PG : "roles with the BYPASSRLS attribute always bypass
--       the row security system when accessing a table.") FORCE RLS ne sert
--       qu'a retirer l'exemption AUTOMATIQUE du proprietaire ; il ne neutralise
--       PAS BYPASSRLS.
--     => Les lectures de la vue sur chantiers/intervenants/clients/planning
--        IGNORENT donc les policies RLS de ces tables. C'est VOULU et c'est ce
--        qui permet a l'Ouvrier (bloque sur les tables) de lire la vue.
--
--   COROLLAIRE CRITIQUE DE SECURITE : puisque la RLS des tables de base est
--   contournee, AUCUN filtrage de securite n'est herite. TOUT le filtrage
--   (tenant + role ouvrier + affectation) DOIT etre porte par le WHERE de la
--   vue. Si une condition manque, c'est une fuite directe cross-entreprise.
--   Le WHERE ci-dessous est verrouille sur auth.uid() via les helpers
--   SECURITY DEFINER (eux-memes auto-limites a auth.uid()), de sorte qu'aucune
--   ligne d'une autre entreprise ni aucune ligne pour un non-ouvrier ne peut
--   etre renvoyee.
--
--   On force explicitement security_invoker = false (au lieu de se reposer sur
--   le defaut) pour rendre l'intention non ambigue et resistante a un futur
--   changement de defaut.
-- ----------------------------------------------------------------------------

-- DROP prealable (la projection de colonnes peut changer entre versions) :
DROP VIEW IF EXISTS chantiers_ouvrier;
DROP VIEW IF EXISTS intervenants_safe;

-- ----- 3.1 VUE chantiers_ouvrier ------------------------------------------
-- Expose UNIQUEMENT les colonnes sures de chantiers (JAMAIS les 5 colonnes
-- montant) + coordonnees du client (nom/telephone/adresse) via jointure.
-- Filtree par : (a) chantier de l'entreprise de l'appelant,
--               (b) appelant = membre actif de role 'ouvrier' de cette entreprise,
--               (c) chantier AFFECTE a l'intervenant lie au compte de l'appelant.
-- Affectation = il existe une planning_interventions OU une intervention_intervenants
-- (via planning_interventions.intervention... NB: intervention_intervenants
-- n'a pas de chantier_id direct ; il se relie au chantier via
-- planning_interventions.id = intervention_intervenants.intervention_id).
-- ⚠️ PROJECTION DURCIE (double audit) :
--   - c.notes RETIREE : c'est la NOTE INTERNE du chantier (visible par le seul
--     dirigeant) ; elle n'a rien a faire dans une vue destinee a l'ouvrier.
--   - c.user_id RETIREE : c'est l'id du DIRIGEANT proprietaire ; aucune raison
--     de l'exposer a l'ouvrier (fuite d'identifiant + surface d'attaque).
--   Le filtrage de la vue continue d'utiliser la COLONNE de base c.user_id dans
--   le WHERE (non projetee) ; seule la PROJECTION est nettoyee.
CREATE VIEW chantiers_ouvrier
WITH (security_invoker = false) AS
SELECT
  c.id,
  c.client_id,
  c.titre,
  c.description,
  c.statut,
  c.adresse_chantier,
  c.code_postal_chantier,
  c.ville_chantier,
  c.date_debut,
  c.date_fin_prevue,
  c.date_fin_reelle,
  c.couleur,
  c.created_at,
  c.updated_at,
  c.acces_info,
  c.description_client,
  c.preparation_client,
  c.non_inclus,
  c.modalites_personnalisees,
  c.pacte_chantier_texte,
  -- Coordonnees client (champs de contact uniquement, AUCUN champ financier
  -- n'existe sur clients ; on n'expose pas siret/notes_internes/email pro
  -- au-dela du minimum operationnel : nom + telephone + adresse).
  cl.civilite       AS client_civilite,
  cl.prenom         AS client_prenom,
  cl.nom            AS client_nom,
  cl.raison_sociale AS client_raison_sociale,
  cl.telephone      AS client_telephone,
  cl.adresse        AS client_adresse,
  cl.code_postal    AS client_code_postal,
  cl.ville          AS client_ville
FROM chantiers c
LEFT JOIN clients cl ON cl.id = c.client_id
WHERE
  -- (a) le chantier appartient a une entreprise de l'appelant
  entreprise_of_user(c.user_id) IN (SELECT current_entreprise_ids())
  -- (b) l'appelant est un membre ACTIF de role 'ouvrier' de CETTE entreprise
  AND EXISTS (
    SELECT 1 FROM entreprise_membres m_self
    WHERE m_self.user_id = auth.uid()
      AND m_self.statut = 'actif'
      AND m_self.role = 'ouvrier'
      AND m_self.entreprise_id = entreprise_of_user(c.user_id)
      -- (c) le chantier est AFFECTE a l'intervenant lie a ce compte ouvrier.
      --     m_self.intervenant_id NULL => aucun chantier (fail-safe, jamais de fuite).
      AND m_self.intervenant_id IS NOT NULL
      AND (
        -- affecte via une intervention de planning sur ce chantier
        EXISTS (
          SELECT 1 FROM planning_interventions pi
          WHERE pi.chantier_id = c.id
            AND pi.intervenant_id = m_self.intervenant_id
        )
        -- ou affecte via la table de liaison multi-intervenants, reliee au
        -- chantier par l'intervention de planning parente.
        OR EXISTS (
          SELECT 1
          FROM intervention_intervenants ii
          JOIN planning_interventions pi2 ON pi2.id = ii.intervention_id
          WHERE pi2.chantier_id = c.id
            AND ii.intervenant_id = m_self.intervenant_id
        )
      )
  );

-- ----- 3.2 VUE intervenants_safe ------------------------------------------
-- Trombinoscope d'equipe : id, prenom, nom, metier, couleur, role, is_self, actif.
-- JAMAIS taux_horaire / email / telephone / type_contrat / niveau_acces.
-- Filtree a l'entreprise de l'appelant. Lisible par l'Ouvrier (et inoffensive
-- pour les autres roles, qui ont de toute facon acces a la table de base).
-- On exclut les fiches soft-deleted (deleted_at IS NOT NULL) par coherence app.
-- ⚠️ PROJECTION DURCIE (double audit) : i.user_id RETIREE de la projection
--   (id du dirigeant proprietaire, inutile a l'ouvrier). Le filtrage de la vue
--   utilise toujours la COLONNE de base i.user_id dans le WHERE (non projetee).
CREATE VIEW intervenants_safe
WITH (security_invoker = false) AS
SELECT
  i.id,
  i.prenom,
  i.nom,
  i.metier,
  i.couleur,
  i.role,
  i.is_self,
  i.actif
FROM intervenants i
WHERE
  i.deleted_at IS NULL
  AND entreprise_of_user(i.user_id) IN (SELECT current_entreprise_ids());

-- ----- 3.3 PROPRIETAIRE DES VUES (le bypass RLS en depend) -----------------
-- ⚠️ CRITIQUE (double audit) : toute la securite des vues repose sur le fait
-- qu'elles soient DETENUES par un role BYPASSRLS (postgres). Si une vue etait
-- (re)creee par un autre role (ex. supabase_admin selon le contexte d'execution
-- du SQL Editor), elle pourrait soit appliquer la RLS des tables de base (et
-- renvoyer 0 ligne), soit avoir un comportement non maitrise. On force donc
-- explicitement le proprietaire a postgres au lieu de le laisser dependre du
-- role de session courant.
ALTER VIEW chantiers_ouvrier OWNER TO postgres;
ALTER VIEW intervenants_safe OWNER TO postgres;

-- ----- 3.4 POLICY chantier_notes ROLE-AWARE (apres la vue qu'elle reference)
-- ⚠️ CORRECTION (double audit) : l'ancienne policy chantier_notes_select etait
-- en filtre ENTREPRISE seul (tous roles) => l'ouvrier lisait TOUTES les notes
-- internes de chantier de l'entreprise. On la restreint a :
--   - dirigeant + commercial : toutes les notes de l'entreprise ;
--   - ouvrier : UNIQUEMENT les notes des chantiers qui lui sont AFFECTES,
--     via la vue chantiers_ouvrier (qui porte deja tout le filtrage d'affectation).
-- ORDRE OBLIGATOIRE : chantiers_ouvrier (section 3.1) DOIT exister avant cette
-- policy, d'ou son emplacement ici et non en section 2.4.
DROP POLICY IF EXISTS chantier_notes_select ON chantier_notes;
CREATE POLICY chantier_notes_select ON chantier_notes FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND (
    current_role_in(entreprise_of_user(user_id)) IN ('dirigeant','commercial')
    OR chantier_id IN (SELECT id FROM chantiers_ouvrier)
  )
);

-- ----- 3.5 TABLES VOLONTAIREMENT NON MODIFIEES (justification double audit) -
-- chantier_intervenants : NON modifiee. Sa policy SELECT (chantier_intervenants_select_own)
--   filtre via un EXISTS sur chantiers. Or chantiers est desormais role-gated
--   dirigeant+commercial (section 2.3) : pour un ouvrier, le sous-EXISTS sur
--   chantiers ne renvoie aucune ligne => chantier_intervenants est TRANSITIVEMENT
--   vide pour lui. De plus cette table ne contient AUCUN montant. Inutile donc de
--   la durcir ici (et la durcir casserait l'affichage equipe cote dirigeant).
-- facture_compteurs : NON modifiee. Cette table n'a AUCUNE policy SELECT
--   (verifie en prod) => avec RLS active, elle est deja TOTALEMENT inaccessible
--   aux clients PostgREST (anon/authenticated). Elle n'est lue que cote serveur
--   (service_role, qui bypasse la RLS). Aucune fuite possible vers l'ouvrier.

-- ----- 3.6 GRANTS sur les vues --------------------------------------------
-- Les vues ne doivent JAMAIS etre accessibles a anon (visiteur non connecte).
-- authenticated y accede (le filtrage par auth.uid() dans le WHERE fait le tri).
-- service_role pour les usages serveur.
REVOKE ALL ON chantiers_ouvrier  FROM anon;
REVOKE ALL ON intervenants_safe  FROM anon;
GRANT SELECT ON chantiers_ouvrier TO authenticated, service_role;
GRANT SELECT ON intervenants_safe TO authenticated, service_role;

-- ----- 3.7 entreprises (IBAN/BIC) — DECISION A TRANCHER, NON IMPLEMENTEE ----
-- ⚠️ DECISION A TRANCHER AVEC JEREMY : la table entreprises est lisible par TOUS
--   les membres (la policy entreprises_select n'est PAS modifiee ici), car l'app
--   a besoin du nom / logo / reglages de l'entreprise pour TOUS les roles (en-tete
--   de l'UI, mentions, etc.). Or entreprises contient AUSSI iban / bic : ces
--   coordonnees bancaires sont donc actuellement visibles d'un commercial et d'un
--   ouvrier (lecture directe de la table).
--   Option recommandee (Phase 3) : creer une vue entreprise_safe SANS iban/bic
--   destinee aux non-dirigeants, restreindre la table de base au dirigeant, et
--   router le hook front useEntreprise vers la vue selon le role.
--   NON IMPLEMENTE ICI car cela exige un changement FRONT (routage useEntreprise)
--   + la decision de Jeremy. Tant que l'unique role en prod est 'dirigeant',
--   aucun impact. A trancher AVANT d'inviter un employe non-dirigeant.


-- ############################################################################
-- ## SECTION 4 — VERIFICATIONS & TESTS PAR IMPERSONATION                     ##
-- ############################################################################
--
-- A executer MANUELLEMENT apres la migration (en commentaire, prets a coller).
-- Le pattern d'impersonation simule un appel PostgREST en tant qu'un user donne :
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<USER_ID>"}';
-- Toujours dans une transaction (BEGIN ... ROLLBACK) pour ne rien laisser.
-- Remplacer <DIRIGEANT_UID>, <OUVRIER_UID>, <OUVRIER_AUTRE_ENTREPRISE_UID>.
--
-- ----------------------------------------------------------------------------
-- (a) DIRIGEANT : voit ses devis (non-regression)
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DIRIGEANT_UID>"}';
--   SELECT count(*) AS devis_visibles FROM devis;        -- doit etre > 0
--   SELECT count(*) AS factures_visibles FROM factures;  -- doit etre > 0
--   SELECT count(*) AS chantiers_visibles FROM chantiers;-- doit etre > 0
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (b) OUVRIER : 0 devis, 0 ligne sur chantiers (base), 0 sur intervenants (base),
--     mais voit ses chantiers via chantiers_ouvrier SANS colonne montant.
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<OUVRIER_UID>"}';
--   SELECT count(*) AS devis        FROM devis;              -- DOIT etre 0
--   SELECT count(*) AS factures     FROM factures;           -- DOIT etre 0
--   SELECT count(*) AS chantiers_base FROM chantiers;        -- DOIT etre 0
--   SELECT count(*) AS intervenants_base FROM intervenants;  -- DOIT etre 0
--   SELECT count(*) AS materiel     FROM materiel;           -- DOIT etre 0
--   -- Tables durcies en section 2.5 -> DOIVENT etre 0 pour l'ouvrier :
--   SELECT count(*) AS documents    FROM documents;                 -- DOIT etre 0 (PDF factures)
--   SELECT count(*) AS rappels      FROM rappels;                   -- DOIT etre 0
--   SELECT count(*) AS notes_client FROM intervention_notes_client; -- DOIT etre 0 (note privee artisan)
--   -- Transitivement vide (section 3.5) :
--   SELECT count(*) AS chantier_intervenants FROM chantier_intervenants; -- DOIT etre 0
--   -- Mais via les vues :
--   SELECT count(*) AS mes_chantiers FROM chantiers_ouvrier; -- > 0 si affecte
--   SELECT count(*) AS equipe        FROM intervenants_safe; -- > 0 (son equipe)
--   SELECT count(*) AS planning      FROM planning_interventions; -- > 0 (equipe)
--   -- chantier_notes : l'ouvrier ne voit QUE les notes de SES chantiers affectes.
--   -- Doit etre <= au nombre de notes des chantiers de chantiers_ouvrier, et
--   -- JAMAIS une note d'un chantier hors de sa liste :
--   SELECT count(*) AS notes_hors_mes_chantiers FROM chantier_notes
--     WHERE chantier_id NOT IN (SELECT id FROM chantiers_ouvrier); -- DOIT etre 0
--   -- Tentative de fuite directe d'un montant via la vue -> DOIT echouer :
--   -- SELECT montant_facture FROM chantiers_ouvrier LIMIT 1;
--   --   => ERROR: column "montant_facture" does not exist
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (c) OUVRIER D'UNE AUTRE ENTREPRISE : ne voit RIEN de cette entreprise-ci.
-- ----------------------------------------------------------------------------
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<OUVRIER_AUTRE_ENTREPRISE_UID>"}';
--   SELECT count(*) FROM chantiers_ouvrier;  -- ne doit montrer QUE ses chantiers a lui
--   -- Verifier qu'aucun chantier d'une autre entreprise n'apparait. NB : la vue
--   -- n'expose plus user_id ; on rejoint la table de base par id (service_role
--   -- ou postgres pour ce controle, hors impersonation, car l'ouvrier ne lit pas
--   -- la table chantiers) :
--   SELECT DISTINCT entreprise_of_user(c.user_id) AS ent
--     FROM chantiers c WHERE c.id IN (SELECT id FROM chantiers_ouvrier);
--   --   => ne doit lister QUE les entreprises de CET ouvrier
-- ROLLBACK;
--
-- ----------------------------------------------------------------------------
-- (d) STRUCTURE DE LA VUE : aucune colonne montant exposee.
-- ----------------------------------------------------------------------------
-- En SQL Editor : \d chantiers_ouvrier  (ou la requete portable ci-dessous)
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='chantiers_ouvrier'
--   ORDER BY ordinal_position;
--   => la liste ne doit contenir AUCUN de :
--      montant_devis_total, montant_facture, montant_encaisse, cout_mo, cout_materiaux
--   ET ne doit contenir NI 'notes' (note interne chantier) NI 'user_id'
--   (id du dirigeant) — retirees de la projection au double audit. Controle :
--   SELECT count(*) AS colonnes_interdites FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='chantiers_ouvrier'
--       AND column_name IN ('notes','user_id',
--             'montant_devis_total','montant_facture','montant_encaisse','cout_mo','cout_materiaux');
--     => DOIT etre 0.
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='intervenants_safe'
--   ORDER BY ordinal_position;
--   => ne doit contenir AUCUN de :
--      taux_horaire, email, telephone, type_contrat, niveau_acces
--   ET ne doit PAS contenir 'user_id' (retire au double audit). Controle :
--   SELECT count(*) AS colonnes_interdites FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='intervenants_safe'
--       AND column_name IN ('user_id','taux_horaire','email','telephone','type_contrat','niveau_acces');
--     => DOIT etre 0.
--
-- ----------------------------------------------------------------------------
-- (e) CONTROLE DE PROPRIETE DES VUES (le bypass RLS en depend) :
--     les vues DOIVENT etre detenues par un role BYPASSRLS (postgres).
-- ----------------------------------------------------------------------------
-- SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, r.rolbypassrls
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid=c.relnamespace
--   JOIN pg_roles r ON r.oid=c.relowner
--   WHERE n.nspname='public' AND c.relname IN ('chantiers_ouvrier','intervenants_safe');
--   => owner = postgres, rolbypassrls = true. Sinon, les vues renverraient 0
--      ligne (RLS appliquee) ou pire (mauvais owner) => A NE PAS DEPLOYER.
-- ============================================================================
