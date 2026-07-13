-- ============================================================================
-- 2026-07-13-achats-09-date-reglement.sql
-- Registres légaux — "date de règlement" (décaissement) sur les achats.
-- ----------------------------------------------------------------------------
-- Le registre des achats (obligation légale micro, art. R123-* / doctrine
-- service-public F36018) exige la DATE DU RÈGLEMENT (décaissement), et non la
-- date de la facture d'achat. On sépare donc les deux notions.
--
-- Backfill idempotent : date de l'opération bancaire liée quand l'achat provient
-- d'un pointage (mouvement_id → banque_mouvements.date_operation), sinon la
-- date_achat (meilleure approximation disponible pour une saisie manuelle).
-- Vérifié en prod le 13/07/2026 (2 achats → 2 date_reglement, 0 null).
-- ============================================================================

ALTER TABLE public.achats ADD COLUMN IF NOT EXISTS date_reglement date;

UPDATE public.achats a
SET date_reglement = COALESCE(
  (SELECT m.date_operation FROM public.banque_mouvements m WHERE m.id = a.mouvement_id),
  a.date_achat
)
WHERE a.date_reglement IS NULL;
