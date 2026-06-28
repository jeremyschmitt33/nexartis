-- ============================================================
-- Migration : Module Rapport d'intervention
-- Date : 2026-06-28
-- Appliquee en base via MCP Supabase (migration "rapport_intervention_tables").
-- Ce fichier est une TRACE (la base est deja a jour). Ne pas re-executer tel quel.
-- Testee a blanc (insert + cascade + SET NULL + rollback) avant application.
-- ============================================================

-- Table parent : le rapport
CREATE TABLE public.rapports_intervention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text,                          -- RAP-AAAA-xxx, genere cote app (NON legal, pas de trigger)
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL,
  devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  facture_id uuid REFERENCES public.factures(id) ON DELETE SET NULL,
  objet text,
  client_nom_snapshot text,             -- fige le nom client au moment du rapport
  adresse_snapshot text,                -- fige l'adresse
  date_intervention date,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','finalise','envoye')),
  deleted_at timestamptz,               -- soft delete
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table enfant : les pages ordonnees (modele "pages-formulaires")
-- type = constat / poste / photo1 / photo2 / avap / fin (valide cote app via zod, pas d'enum DB)
-- contenu jsonb = textes + ids des photos par REFERENCE (jamais le binaire)
CREATE TABLE public.rapport_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapport_id uuid NOT NULL REFERENCES public.rapports_intervention(id) ON DELETE CASCADE,
  ordre integer NOT NULL DEFAULT 0,
  type text NOT NULL,
  contenu jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lien photo -> rapport (photo uploadee directement pour le rapport, chantier_id NULL).
-- ON DELETE SET NULL : supprimer un rapport NE supprime JAMAIS la photo ni le fichier R2.
ALTER TABLE public.photos
  ADD COLUMN rapport_id uuid REFERENCES public.rapports_intervention(id) ON DELETE SET NULL;

-- Index
CREATE INDEX idx_rapports_user ON public.rapports_intervention(user_id);
CREATE INDEX idx_rapports_chantier ON public.rapports_intervention(chantier_id);
CREATE INDEX idx_rapports_client ON public.rapports_intervention(client_id);
CREATE UNIQUE INDEX uq_rapports_numero ON public.rapports_intervention(user_id, numero)
  WHERE numero IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_rapport_pages_rapport ON public.rapport_pages(rapport_id, ordre);
CREATE INDEX idx_photos_rapport ON public.photos(rapport_id) WHERE rapport_id IS NOT NULL;

-- RLS (mirroir EXACT de clients/chantiers pour le parent, de devis_lignes pour l'enfant)
ALTER TABLE public.rapports_intervention ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapport_pages ENABLE ROW LEVEL SECURITY;

-- Parent : visible/modifiable par dirigeant + commercial de l'entreprise
CREATE POLICY rapports_intervention_select ON public.rapports_intervention FOR SELECT USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = ANY (ARRAY['dirigeant','commercial'])
);
CREATE POLICY rapports_intervention_insert ON public.rapports_intervention FOR INSERT WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = ANY (ARRAY['dirigeant','commercial'])
);
CREATE POLICY rapports_intervention_update ON public.rapports_intervention FOR UPDATE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = ANY (ARRAY['dirigeant','commercial'])
) WITH CHECK (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = ANY (ARRAY['dirigeant','commercial'])
);
CREATE POLICY rapports_intervention_delete ON public.rapports_intervention FOR DELETE USING (
  entreprise_of_user(user_id) IN (SELECT current_entreprise_ids())
  AND current_role_in(entreprise_of_user(user_id)) = ANY (ARRAY['dirigeant','commercial'])
);

-- Enfant : accessible si le rapport parent l'est
CREATE POLICY rapport_pages_select ON public.rapport_pages FOR SELECT USING (
  rapport_id IN (SELECT r.id FROM public.rapports_intervention r
    WHERE entreprise_of_user(r.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(r.user_id)) = ANY (ARRAY['dirigeant','commercial']))
);
CREATE POLICY rapport_pages_insert ON public.rapport_pages FOR INSERT WITH CHECK (
  rapport_id IN (SELECT r.id FROM public.rapports_intervention r
    WHERE entreprise_of_user(r.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(r.user_id)) = ANY (ARRAY['dirigeant','commercial']))
);
CREATE POLICY rapport_pages_update ON public.rapport_pages FOR UPDATE USING (
  rapport_id IN (SELECT r.id FROM public.rapports_intervention r
    WHERE entreprise_of_user(r.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(r.user_id)) = ANY (ARRAY['dirigeant','commercial']))
) WITH CHECK (
  rapport_id IN (SELECT r.id FROM public.rapports_intervention r
    WHERE entreprise_of_user(r.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(r.user_id)) = ANY (ARRAY['dirigeant','commercial']))
);
CREATE POLICY rapport_pages_delete ON public.rapport_pages FOR DELETE USING (
  rapport_id IN (SELECT r.id FROM public.rapports_intervention r
    WHERE entreprise_of_user(r.user_id) IN (SELECT current_entreprise_ids())
      AND current_role_in(entreprise_of_user(r.user_id)) = ANY (ARRAY['dirigeant','commercial']))
);
