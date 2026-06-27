-- ============================================================
-- Migration : Facture d'avoir (credit note) V1
-- Date      : 2026-06-27
-- Objet     : Liaison d'une facture d'avoir a sa facture d'origine.
--             Le type 'avoir' existe deja sur factures.type ; on ajoute
--             juste la reference vers la facture corrigee/annulee, pour :
--               - afficher "Avoir afferent a la facture N..." sur le PDF,
--               - calculer le net restant du de la facture d'origine
--                 (TTC - paiements - avoirs imputes) cote relances,
--               - afficher le badge "Soldee par avoir" / "Avoir emis".
-- Nature    : ADDITIVE / NON DESTRUCTIVE.
-- Numerotation : l'avoir suit la MEME sequence que les factures
--                (trigger set_facture_numero existant) -> continuite legale.
-- ============================================================

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS facture_origine_id uuid
  REFERENCES public.factures(id) ON DELETE SET NULL;

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS facture_origine_numero text;

CREATE INDEX IF NOT EXISTS idx_factures_origine
  ON public.factures (facture_origine_id)
  WHERE facture_origine_id IS NOT NULL;

COMMENT ON COLUMN public.factures.facture_origine_id IS
  'Pour un avoir (type=avoir) : reference la facture corrigee/annulee. NULL sinon.';
COMMENT ON COLUMN public.factures.facture_origine_numero IS
  'Snapshot du numero de la facture d origine (affichage PDF, robuste meme si origine supprimee).';
