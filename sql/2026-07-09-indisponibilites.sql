-- ============================================================================
-- 2026-07-09 — Table des indisponibilites (conges / maladie / vacances...)
-- ----------------------------------------------------------------------------
-- Absences posees PAR NOM (membre de "Mon equipe" via intervenant_id, OU nom
-- libre). Affichees sur le planning, avec avertissement de conflit si on
-- planifie une intervention sur une personne absente.
--
-- Table DEDIEE (et non reutilisation de planning_interventions) pour ne pas
-- polluer les compteurs de charge / le CA / les exports d'interventions.
--
-- RLS : user_id = auth.uid() sur SELECT/INSERT/UPDATE/DELETE. Soft delete via
-- deleted_at (filtre WHERE deleted_at IS NULL cote code).
--
-- Deja appliquee en production le 2026-07-09 (Supabase project skuqfqnfitrovzeexwsr).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.indisponibilites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  intervenant_id uuid NULL REFERENCES public.intervenants(id) ON DELETE SET NULL,
  nom_libre text NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  demi_journee text NULL CHECK (demi_journee IN ('matin','apres_midi')),
  type text NOT NULL DEFAULT 'conge' CHECK (type IN ('conge','maladie','vacances','formation','ferie','autre')),
  motif text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT indispo_identite CHECK (intervenant_id IS NOT NULL OR nom_libre IS NOT NULL),
  CONSTRAINT indispo_dates CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_indispo_user  ON public.indisponibilites(user_id);
CREATE INDEX IF NOT EXISTS idx_indispo_dates ON public.indisponibilites(date_debut, date_fin);

ALTER TABLE public.indisponibilites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indispo_select_own" ON public.indisponibilites FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "indispo_insert_own" ON public.indisponibilites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "indispo_update_own" ON public.indisponibilites FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "indispo_delete_own" ON public.indisponibilites FOR DELETE USING (user_id = auth.uid());
