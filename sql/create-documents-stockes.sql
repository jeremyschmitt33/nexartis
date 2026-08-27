-- =============================================================
-- Coffre-fort de documents (Vague 2b) — 26/06/2026
-- Stocke les metadonnees des fichiers televerses par l'artisan.
-- Le binaire vit sur Cloudflare R2 (cle scopee user_id/coffre/...).
-- A APPLIQUER manuellement via le MCP Supabase (NE PAS pousser ce .sql).
-- =============================================================

CREATE TABLE IF NOT EXISTS documents_stockes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL DEFAULT 'autre',
  fichier_url TEXT NOT NULL,
  mime_type TEXT,
  taille_octets BIGINT,
  devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_stockes_user ON documents_stockes(user_id);

ALTER TABLE documents_stockes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ds_select ON documents_stockes;
CREATE POLICY ds_select ON documents_stockes FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS ds_insert ON documents_stockes;
CREATE POLICY ds_insert ON documents_stockes FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ds_update ON documents_stockes;
CREATE POLICY ds_update ON documents_stockes FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ds_delete ON documents_stockes;
CREATE POLICY ds_delete ON documents_stockes FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at ON documents_stockes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents_stockes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
