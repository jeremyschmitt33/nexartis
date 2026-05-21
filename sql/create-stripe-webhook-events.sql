-- ═══════════════════════════════════════════════════════════════════════════
-- Migration P9 (audit sécurité) : Idempotence du webhook Stripe
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CONTEXTE :
-- Stripe rejoue régulièrement les webhooks en cas de timeout réseau, d'erreur
-- 5xx renvoyée par notre endpoint, ou de coupure. Sans table d'idempotence,
-- on risque de traiter 2 fois un event :
--   - double activation d'abonnement,
--   - double déclenchement d'effets de bord (emails, etc.),
--   - notes admin dupliquées en cas de paiement échoué.
--
-- SOLUTION :
-- On enregistre chaque event Stripe reçu (clé primaire = event.id, unique
-- côté Stripe). Au traitement, on lit l'état actuel :
--   - si processed_ok = true → on renvoie 200 immédiatement (déjà traité),
--   - sinon on traite et on marque processed_ok = true en fin de pipeline.
--
-- À EXÉCUTER dans Supabase → SQL Editor → New Query → coller ce fichier → Run.
-- L'exécution est idempotente (IF NOT EXISTS partout) : peut être rejouée.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    processed_ok BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT
);

-- Index pour audit (lister les events récents)
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
    ON public.stripe_webhook_events(received_at DESC);

-- Index pour purge mensuelle des vieux events traités
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
    ON public.stripe_webhook_events(processed_at)
    WHERE processed_ok = true;

-- RLS désactivée : table interne, accédée UNIQUEMENT par le service role
-- (SUPABASE_SERVICE_ROLE_KEY côté serveur). Aucun utilisateur final ne
-- doit la voir ou la modifier.
ALTER TABLE public.stripe_webhook_events DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stripe_webhook_events IS
    'Table d''idempotence pour /api/stripe/webhook. Empêche le double-traitement '
    'des events rejoués par Stripe (timeouts, retries automatiques).';

COMMENT ON COLUMN public.stripe_webhook_events.event_id IS
    'ID unique fourni par Stripe (evt_xxx). Clé primaire = garantie d''unicité.';
COMMENT ON COLUMN public.stripe_webhook_events.processed_ok IS
    'true = event traité avec succès, on ignore les rejeux. false = à (re)traiter.';
COMMENT ON COLUMN public.stripe_webhook_events.error_message IS
    'Si processed_ok = false et que le traitement a planté, on stocke l''erreur '
    'ici pour debug. Stripe retentera automatiquement.';

-- ───────────────────────────────────────────────────────────────────────────
-- PURGE MENSUELLE (à exécuter manuellement ou via pg_cron)
-- ───────────────────────────────────────────────────────────────────────────
-- Garder 90 jours d'historique suffit largement pour le debug. Au-delà, on
-- supprime pour ne pas laisser la table grossir indéfiniment.
--
-- DELETE FROM public.stripe_webhook_events
-- WHERE processed_ok = true
--   AND processed_at < now() - INTERVAL '90 days';
-- ───────────────────────────────────────────────────────────────────────────
