-- ============================================================
-- Migration : Certifications & assurances V1
-- Date      : 2026-06-27
-- Objet     : Table flexible pour les certifications/assurances de l'artisan
--             (decennale, RC pro, vigilance URSSAF, RGE, Qualibat,
--              Qualifelec, habilitations, autre) avec rappels auto
--             J-30 / J-15 avant expiration + rappel d'audit intermediaire RGE.
-- Nature    : ADDITIVE / NON DESTRUCTIVE.
--             - cree la table certifications (RLS 4 policies + trigger updated_at)
--             - ajoute une colonne lien_certification_id a la table rappels
--               (alimente le widget "a faire" du tableau de bord)
-- Pre-requis verifies : fonction update_updated_at() existe,
--                       table documents_stockes(id uuid) existe.
-- ============================================================

-- 1) TABLE certifications
CREATE TABLE IF NOT EXISTS public.certifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                 text NOT NULL DEFAULT 'autre',   -- 'decennale','rc_pro','vigilance_urssaf','rge','qualibat','qualifelec','habilitation','autre'
  intitule             text NOT NULL,
  organisme            text,
  numero               text,
  date_obtention       date,
  date_expiration      date NOT NULL,
  date_audit           date,                            -- audit intermediaire RGE (limite), NULL si non applicable
  lien_document_id     uuid REFERENCES public.documents_stockes(id) ON DELETE SET NULL,
  notes                text,
  -- Suivi des emails de rappel deja envoyes (idempotence du cron, pattern relances factures)
  rappel_envoye_j30    timestamptz,
  rappel_envoye_j15    timestamptz,
  rappel_audit_envoye  timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.certifications IS 'Certifications et assurances de l artisan, avec rappels auto J-30/J-15 et audit intermediaire RGE.';
COMMENT ON COLUMN public.certifications.date_expiration IS 'Date critique : declenche les rappels J-30 et J-15.';
COMMENT ON COLUMN public.certifications.date_audit IS 'Date limite de l audit intermediaire RGE (NULL si non applicable).';
COMMENT ON COLUMN public.certifications.rappel_envoye_j30 IS 'Horodatage envoi email J-30 (NULL = pas encore envoye).';
COMMENT ON COLUMN public.certifications.rappel_envoye_j15 IS 'Horodatage envoi email J-15 (NULL = pas encore envoye).';
COMMENT ON COLUMN public.certifications.rappel_audit_envoye IS 'Horodatage envoi email rappel audit RGE (NULL = pas encore envoye).';

-- 2) INDEXES (filtres soft-delete + tri par expiration)
CREATE INDEX IF NOT EXISTS idx_certifications_user
  ON public.certifications (user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_certifications_expiration
  ON public.certifications (user_id, date_expiration)
  WHERE deleted_at IS NULL;

-- 3) RLS : chaque utilisateur ne voit/modifie que ses propres lignes
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certifications_select_own ON public.certifications;
CREATE POLICY certifications_select_own ON public.certifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS certifications_insert_own ON public.certifications;
CREATE POLICY certifications_insert_own ON public.certifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS certifications_update_own ON public.certifications;
CREATE POLICY certifications_update_own ON public.certifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS certifications_delete_own ON public.certifications;
CREATE POLICY certifications_delete_own ON public.certifications
  FOR DELETE USING (auth.uid() = user_id);

-- 4) TRIGGER updated_at (fonction existante du projet)
DROP TRIGGER IF EXISTS set_updated_at ON public.certifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5) LIEN vers la table rappels (widget "a faire" du tableau de bord)
ALTER TABLE public.rappels
  ADD COLUMN IF NOT EXISTS lien_certification_id uuid
  REFERENCES public.certifications(id) ON DELETE SET NULL;
