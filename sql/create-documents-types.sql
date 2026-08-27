-- ============================================================================
-- Migration : table documents_types (Documents types — CGV + PV de reception)
-- Feature "Bibliotheque de documents types". 100% gratuit.
-- A EXECUTER DANS SUPABASE (SQL Editor) AVANT le push du code.
-- ============================================================================
-- Securite : RLS activee + 4 policies filtrant sur user_id = auth.uid().
-- Soft delete : colonne deleted_at (coherent avec devis/factures/intervenants).
-- Le trigger updated_at reutilise la fonction update_updated_at() deja en place
-- dans le schema (cf. lib/supabase/schema.sql).
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('cgv','pv_reception')) NOT NULL,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  chantier_id UUID REFERENCES chantiers(id) ON DELETE SET NULL,
  devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_types_user ON documents_types(user_id);

ALTER TABLE documents_types ENABLE ROW LEVEL SECURITY;

-- Policies : un utilisateur ne voit / ecrit / modifie / supprime que ses lignes.
DROP POLICY IF EXISTS dt_select ON documents_types;
CREATE POLICY dt_select ON documents_types FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS dt_insert ON documents_types;
CREATE POLICY dt_insert ON documents_types FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dt_update ON documents_types;
CREATE POLICY dt_update ON documents_types FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dt_delete ON documents_types;
CREATE POLICY dt_delete ON documents_types FOR DELETE USING (user_id = auth.uid());

-- Trigger updated_at (reutilise la fonction existante update_updated_at()).
DROP TRIGGER IF EXISTS set_updated_at ON documents_types;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
