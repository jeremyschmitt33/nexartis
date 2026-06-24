-- ============================================================
-- MIGRATION PHOTOS DE CHANTIER — 2026-06-24
--
-- Stocke les METADONNEES des photos de chantier (le binaire des photos
-- est stocke sur Cloudflare R2, PAS en base ni dans Supabase Storage).
--
-- 100% ADDITIF : nouvelle table uniquement.
-- Securite : RLS activee, un artisan ne voit/gere QUE ses propres photos.
-- ============================================================

CREATE TABLE IF NOT EXISTS chantier_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier_id   UUID NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,

  -- Rangement : album de l'etape du chantier
  album         TEXT NOT NULL DEFAULT 'pendant'
                CHECK (album IN ('avant', 'pendant', 'apres')),

  -- Cles des objets dans le bucket R2
  r2_key        TEXT NOT NULL,            -- original (deja compresse + tampon grave au navigateur)
  thumb_key     TEXT,                     -- miniature (galerie)

  -- Metadonnees utiles
  largeur       INT,
  hauteur       INT,
  taille_octets BIGINT,
  legende       TEXT,
  prise_le      TIMESTAMPTZ,              -- date de prise (sert au tampon de preuve)

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ               -- soft delete (la purge R2 se fera via job)
);

CREATE INDEX IF NOT EXISTS idx_chantier_photos_chantier ON chantier_photos(chantier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chantier_photos_user     ON chantier_photos(user_id);

-- ------------------------------------------------------------
-- RLS : un artisan ne voit QUE ses photos. Les ecritures passent
-- par les routes API (service role), qui verifient la propriete.
-- ------------------------------------------------------------
ALTER TABLE chantier_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner peut voir ses photos" ON chantier_photos;
CREATE POLICY "Owner peut voir ses photos"
  ON chantier_photos FOR SELECT
  USING (auth.uid() = user_id);
