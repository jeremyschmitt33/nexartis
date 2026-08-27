-- ============================================================================
-- CONFORMITE : preuve d'acceptation des CGV + desinscription emails
-- ============================================================================
-- A EXECUTER DANS Supabase > SQL Editor. Sans risque (cree 2 nouvelles tables,
-- ne touche a aucune table existante). Aucun test particulier requis.
-- ============================================================================

-- 1) Preuve d'acceptation des CGV / politique de confidentialite
--    Une ligne est ecrite par la route /api/stripe/create-checkout-session
--    (service_role) au moment ou l'artisan lance son paiement, case CGV cochee.
CREATE TABLE IF NOT EXISTS public.cgv_acceptances (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL,
  entreprise_id             uuid,
  cgv_version               text NOT NULL,
  confidentialite_version   text NOT NULL,
  ip                        text,
  accepted_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cgv_acceptances ENABLE ROW LEVEL SECURITY;

-- L'ecriture passe par service_role (route serveur) qui ignore la RLS.
-- Lecture : chaque utilisateur peut consulter ses propres acceptations.
DROP POLICY IF EXISTS cgv_acceptances_select_own ON public.cgv_acceptances;
CREATE POLICY cgv_acceptances_select_own ON public.cgv_acceptances
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cgv_acceptances_user ON public.cgv_acceptances(user_id);

-- 2) Desinscription des emails marketing (opt-out par adresse email)
--    Ecrit par la route publique /api/unsubscribe (lien signe dans les emails).
CREATE TABLE IF NOT EXISTS public.email_optouts (
  email         text PRIMARY KEY,
  opted_out_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_optouts ENABLE ROW LEVEL SECURITY;
-- Aucune policy publique : seul service_role (routes serveur) lit/ecrit cette table.

-- ============================================================================
-- POUR ANNULER (si besoin) :
--   DROP TABLE IF EXISTS public.cgv_acceptances;
--   DROP TABLE IF EXISTS public.email_optouts;
-- ============================================================================
