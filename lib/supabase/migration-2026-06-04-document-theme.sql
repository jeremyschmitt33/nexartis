-- ============================================================
-- Migration : Theme de couleurs personnalisable pour les documents
-- Date      : 2026-06-04
-- Cible     : table entreprises
--
-- Ajoute 6 colonnes TEXT pour stocker les couleurs choisies par
-- l'artisan sur ses devis et factures (6 zones visuelles).
-- Chaque colonne est contrainte au format hex #RRGGBB.
-- Les defauts reproduisent strictement la charte Nexartis actuelle,
-- garantissant qu'aucun document existant ne change d'apparence
-- avant que l'utilisateur n'ait personnalise quelque chose.
--
-- RLS : aucune nouvelle policy necessaire, la table entreprises
-- est deja filtree par user_id = auth.uid().
-- ============================================================

-- 1. Ajout des 6 colonnes de couleurs (idempotent)
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS doc_color_bandeau_haut    TEXT DEFAULT '#0f1a3a',
  ADD COLUMN IF NOT EXISTS doc_color_accent          TEXT DEFAULT '#e87a2a',
  ADD COLUMN IF NOT EXISTS doc_color_cadre_emetteur  TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS doc_color_cadre_adresse   TEXT DEFAULT '#0f1a3a',
  ADD COLUMN IF NOT EXISTS doc_color_net_payer       TEXT DEFAULT '#e87a2a',
  ADD COLUMN IF NOT EXISTS doc_color_footer          TEXT DEFAULT '#0f1a3a';

-- 2. Contraintes CHECK : format hex strict #RRGGBB
-- Postgres ne supporte pas ADD CONSTRAINT IF NOT EXISTS directement,
-- on encapsule donc chaque ajout dans un bloc DO conditionnel.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doc_color_bandeau_haut_hex'
  ) THEN
    ALTER TABLE entreprises
      ADD CONSTRAINT doc_color_bandeau_haut_hex
      CHECK (doc_color_bandeau_haut ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doc_color_accent_hex'
  ) THEN
    ALTER TABLE entreprises
      ADD CONSTRAINT doc_color_accent_hex
      CHECK (doc_color_accent ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doc_color_cadre_emetteur_hex'
  ) THEN
    ALTER TABLE entreprises
      ADD CONSTRAINT doc_color_cadre_emetteur_hex
      CHECK (doc_color_cadre_emetteur ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doc_color_cadre_adresse_hex'
  ) THEN
    ALTER TABLE entreprises
      ADD CONSTRAINT doc_color_cadre_adresse_hex
      CHECK (doc_color_cadre_adresse ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doc_color_net_payer_hex'
  ) THEN
    ALTER TABLE entreprises
      ADD CONSTRAINT doc_color_net_payer_hex
      CHECK (doc_color_net_payer ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doc_color_footer_hex'
  ) THEN
    ALTER TABLE entreprises
      ADD CONSTRAINT doc_color_footer_hex
      CHECK (doc_color_footer ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

-- 3. Commentaires (documentation a meme la DB)
COMMENT ON COLUMN entreprises.doc_color_bandeau_haut
  IS 'Couleur du bandeau d en-tete des devis et factures (zone DEVIS/N/dates). Format hex #RRGGBB. Defaut Nexartis : #0f1a3a (navy).';

COMMENT ON COLUMN entreprises.doc_color_accent
  IS 'Couleur d accent (diagonales orange + bordure gauche cadre emetteur). Format hex #RRGGBB. Defaut Nexartis : #e87a2a (orange).';

COMMENT ON COLUMN entreprises.doc_color_cadre_emetteur
  IS 'Couleur de fond de la carte Emetteur (bloc entreprise). Format hex #RRGGBB. Defaut Nexartis : #ffffff (blanc).';

COMMENT ON COLUMN entreprises.doc_color_cadre_adresse
  IS 'Couleur de fond de la carte Adresse a (bloc destinataire). Format hex #RRGGBB. Defaut Nexartis : #0f1a3a (navy).';

COMMENT ON COLUMN entreprises.doc_color_net_payer
  IS 'Couleur de fond de l encadre Net a payer (bloc montant TTC). Format hex #RRGGBB. Defaut Nexartis : #e87a2a (orange).';

COMMENT ON COLUMN entreprises.doc_color_footer
  IS 'Couleur de fond du bandeau de pied de page (coordonnees + mentions). Format hex #RRGGBB. Defaut Nexartis : #0f1a3a (navy).';
