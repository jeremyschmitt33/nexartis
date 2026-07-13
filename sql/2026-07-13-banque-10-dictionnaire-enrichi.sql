-- ============================================================================
-- 2026-07-13-banque-10-dictionnaire-enrichi.sql
-- Chantier 4 (tri auto intelligent) — enrichissement du dictionnaire système.
-- ----------------------------------------------------------------------------
-- Ajoute 40 marchands mono-catégorie CERTAINS, distinctifs, sûrs à AUTO-POINTER
-- (débits) : matériaux (Castorama, Gedimat, Cedeo, Manomano, Würth…), carburant/
-- péages (Total Access, Shell, Vinci Autoroute, APRR, Sanef…), abonnements/SaaS
-- (Sosh, OVHcloud, Ionos, Adobe, Microsoft…), taxes (Trésor Public), publicité
-- (Google Ads, Meta, Pages Jaunes).
--
-- DÉCISION PRODUIT (auditée par l'agent vérificateur, 13/07/2026) :
--   - On n'AUTO-POINTE que le mono-catégorie certain (erreur invisible = danger).
--   - EXCLUS volontairement (→ futur mécanisme de « suggestion », jamais auto) :
--     * assureurs généralistes (Groupama, Generali, Matmut, April, MACSF, Swiss
--       Life) : perso/pro indiscernable depuis le libellé ;
--     * enseignes multi-activités (Leclerc, Intermarché, Carrefour, Amazon,
--       Action) : carburant OU courses OU bazar → suggestion, pas certitude ;
--     * patterns trop courts/ambigus retirés : ULYS (Ulysse), SEIGNEURIE (mot
--       courant), LAPEYRE (patronyme), OVH→OVHCLOUD, POINT.P (déjà couvert par
--       la règle existante « POINT P »), BRICO* (déjà couverts par « BRICO »).
--   - Crédits : JAMAIS auto-catégorisés en recette (enjeu URSSAF) — inchangé.
--
-- Vérifié avant application : 0 collision avec les 24 règles existantes,
-- 0 faux positif sur les mouvements réels en base, 16/16 libellés pro couverts.
-- Idempotent (NOT EXISTS sur pattern+source). Appliqué en prod le 13/07/2026.
-- ============================================================================

INSERT INTO categorisation_regles (pattern, type_match, categorie_id, sens, priorite, source, actif)
SELECT v.pattern, 'contient', c.id, 'debit', v.priorite, 'system', true
FROM (VALUES
  ('CASTORAMA','materiaux',900),('GEDIMAT','materiaux',900),('GEDIBOIS','materiaux',900),
  ('BIGMAT','materiaux',900),('PROLIANS','materiaux',900),('CEDEO','materiaux',900),
  ('PUM PLASTIQUES','materiaux',900),('DISPANO','materiaux',900),('CHAUSSON MATERIAUX','materiaux',900),
  ('SAMSE','materiaux',900),('WELDOM','materiaux',900),('TOLLENS','materiaux',900),
  ('ZOLPAN','materiaux',900),('PLATEFORME DU BATIMENT','materiaux',900),('FRANS BONHOMME','materiaux',900),
  ('MANOMANO','materiaux',900),('WURTH','materiaux',900),
  ('TOTAL ACCESS','carburant',900),('ESSO EXPRESS','carburant',900),('SHELL','carburant',900),
  ('DYNEFF','carburant',900),('VINCI AUTOROUTE','carburant',900),('APRR','carburant',900),
  ('SANEF','carburant',900),('COFIROUTE','carburant',900),('ESCOTA','carburant',900),('TELEPEAGE','carburant',900),
  ('SOSH','abonnements',910),('OVHCLOUD','abonnements',910),('IONOS','abonnements',910),
  ('GANDI','abonnements',910),('ADOBE','abonnements',910),('MICROSOFT','abonnements',910),('RED BY SFR','abonnements',910),
  ('TRESOR PUBLIC','taxes',890),('FINANCES PUBLIQUES','taxes',890),
  ('GOOGLE ADS','publicite',915),('GOOGLE*ADS','publicite',915),('META PLATFORMS','publicite',915),('PAGES JAUNES','publicite',915)
) AS v(pattern, cat_code, priorite)
JOIN depense_categories c ON c.code = v.cat_code AND c.user_id IS NULL AND c.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM categorisation_regles r
  WHERE r.pattern = v.pattern AND r.source = 'system' AND r.deleted_at IS NULL
);
