-- ============================================================
-- Migration : Systeme d'onboarding tutoriel Nexartis
-- Date : 2026-05-26
-- ============================================================
-- Cree la table user_onboarding pour stocker l'avancement du
-- tutoriel de chaque utilisateur (spotlight sidebar + infobulles
-- devis). Permet de ne pas reafficher les elements deja vus et
-- de gerer la reactivation depuis les Parametres.
--
-- Les utilisateurs deja inscrits sont marques comme onboardes
-- pour ne pas leur afficher le tutoriel retroactivement.
-- ============================================================

-- 1. Creation de la table
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_dashboard_seen BOOLEAN NOT NULL DEFAULT false,
  tour_devis_seen BOOLEAN NOT NULL DEFAULT false,
  tour_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_onboarding IS
  'Avancement du tutoriel onboarding (spotlight + infobulles) pour chaque utilisateur. Une ligne par user_id.';

COMMENT ON COLUMN public.user_onboarding.tour_dashboard_seen IS
  'TRUE quand l''utilisateur a vu (ou ferme) le spotlight pointant vers les Parametres au 1er login.';

COMMENT ON COLUMN public.user_onboarding.tour_devis_seen IS
  'TRUE quand l''utilisateur a vu (ou ferme) les 2 infobulles sur la page de creation de devis.';

COMMENT ON COLUMN public.user_onboarding.tour_completed_at IS
  'Date a laquelle tous les elements du tutoriel ont ete vus ou explicitement skipes.';

-- 2. Trigger pour mettre a jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.user_onboarding_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_onboarding_updated_at ON public.user_onboarding;
CREATE TRIGGER trg_user_onboarding_updated_at
  BEFORE UPDATE ON public.user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.user_onboarding_set_updated_at();

-- 3. Activer RLS (Row Level Security)
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

-- 4. Policies : chaque utilisateur ne voit/modifie que sa propre ligne
DROP POLICY IF EXISTS "Users can view their own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can view their own onboarding"
  ON public.user_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can insert their own onboarding"
  ON public.user_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can update their own onboarding"
  ON public.user_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Marquer tous les utilisateurs existants comme deja onboardes
--    (pour ne pas leur afficher le tutoriel retroactivement)
INSERT INTO public.user_onboarding (user_id, tour_dashboard_seen, tour_devis_seen, tour_completed_at)
SELECT
  id,
  true,
  true,
  now()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Verification (a executer apres la migration) :
-- ============================================================
-- SELECT count(*) AS utilisateurs_onboardes
-- FROM public.user_onboarding
-- WHERE tour_completed_at IS NOT NULL;
--
-- Doit renvoyer le nombre total d'utilisateurs actuellement
-- inscrits sur Nexartis.
-- ============================================================
