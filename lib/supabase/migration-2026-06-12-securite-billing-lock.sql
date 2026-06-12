-- ============================================================================
-- MIGRATION SECURITE (R1-001) — Verrou anti auto-octroi d'abonnement
-- Date : 2026-06-12
--
-- POURQUOI ?
--   La policy RLS "entreprises_update" autorise un utilisateur a modifier
--   N'IMPORTE QUELLE colonne de SA propre ligne entreprises (USING auth.uid()
--   = user_id, sans WITH CHECK restreignant les colonnes). Depuis la console
--   du navigateur, avec la cle anon publique et sa session, un utilisateur
--   pouvait donc s'auto-octroyer un abonnement :
--     supabase.from('entreprises')
--       .update({ abonnement_type: 'lifetime', subscription_plan: 'complete' })
--       .eq('user_id', '<son_user_id>')
--   => contournement total du paywall.
--
--   PostgreSQL/RLS ne sait pas restreindre les colonnes nativement. On pose
--   donc un trigger BEFORE UPDATE qui leve une exception si un appelant
--   NON service_role tente de modifier une colonne de facturation.
--
-- COMMENT L'EXECUTER ?
--   1. Ouvrir Supabase > votre projet > SQL Editor (menu de gauche).
--   2. Coller TOUT ce fichier.
--   3. Cliquer "Run" (en bas a droite).
--   4. Verifier qu'il n'y a pas d'erreur (message "Success. No rows returned").
--
-- CE QUI N'EST PAS AFFECTE :
--   - Le webhook Stripe (app/api/stripe/webhook) utilise la cle service_role
--     => il contourne le trigger et continue de mettre a jour l'abonnement.
--   - La route admin (app/api/admin/users) utilise aussi la cle service_role
--     => elle continue de fonctionner (prolongation, lifteime, geste commercial).
--   - La route auth/auto-confirm (service_role) cree la ligne entreprise (INSERT,
--     pas UPDATE) => non concernee par ce trigger BEFORE UPDATE.
--   Seuls les UPDATE faits avec la cle ANON (cote navigateur) sont bloques sur
--   ces colonnes. Aucun code client legitime ne modifie ces colonnes
--   (toutes les MAJ d'abonnement passent par Stripe ou l'admin).
--
-- COLONNES PROTEGEES (verifiees presentes sur la table entreprises) :
--   abonnement_type, abonnement_expire_at, subscription_plan,
--   stripe_subscription_id, stripe_customer_id, notes_admin, trial_started_at
-- ============================================================================

CREATE OR REPLACE FUNCTION protect_entreprise_billing_columns()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Recupere le role de l'appelant depuis les claims JWT.
  -- Pour le service_role (routes serveur), ce sera 'service_role' => bypass.
  caller_role := current_setting('request.jwt.claims', true)::jsonb->>'role';

  IF caller_role IS DISTINCT FROM 'service_role' THEN
    IF NEW.abonnement_type        IS DISTINCT FROM OLD.abonnement_type        OR
       NEW.abonnement_expire_at   IS DISTINCT FROM OLD.abonnement_expire_at   OR
       NEW.subscription_plan      IS DISTINCT FROM OLD.subscription_plan      OR
       NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id OR
       NEW.stripe_customer_id     IS DISTINCT FROM OLD.stripe_customer_id     OR
       NEW.notes_admin            IS DISTINCT FROM OLD.notes_admin            OR
       NEW.trial_started_at       IS DISTINCT FROM OLD.trial_started_at       THEN
      RAISE EXCEPTION 'Modification interdite des colonnes de facturation (entreprises)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_entreprise_billing ON entreprises;
CREATE TRIGGER trg_protect_entreprise_billing
  BEFORE UPDATE ON entreprises
  FOR EACH ROW EXECUTE FUNCTION protect_entreprise_billing_columns();

-- ============================================================================
-- VERIFICATIONS (a executer manuellement apres la migration) :
--
-- 1. En tant qu'utilisateur normal (cle anon / console navigateur connecte),
--    cette requete DOIT echouer avec "Modification interdite des colonnes
--    de facturation" :
--      update entreprises set abonnement_type = 'lifetime'
--      where user_id = auth.uid();
--
-- 2. Une mise a jour d'une colonne NON sensible par l'utilisateur DOIT
--    toujours marcher (ex: changer le telephone, la couleur, etc.) :
--      update entreprises set telephone = '0600000000'
--      where user_id = auth.uid();
--
-- 3. Cote serveur (Stripe webhook / admin), les MAJ d'abonnement continuent
--    de fonctionner normalement (test depuis l'app admin).
-- ============================================================================
