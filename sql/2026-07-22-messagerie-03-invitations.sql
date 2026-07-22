-- ============================================================================
-- Fichier  : 2026-07-22-messagerie-03-invitations.sql
-- Module   : MESSAGERIE — fichier 3 (INVITATIONS / réseau, Phase 1)
-- ----------------------------------------------------------------------------
-- POURQUOI : le réseau est vide et personne ne peut chatter. On construit la
--            mécanique d'invitation : ajouter un confrère par email ou par lien,
--            l'accepter/refuser/bloquer, et rattacher automatiquement un invité
--            à son parrain quand il s'inscrit.
-- QUOI     : 2 colonnes sur artisan_relations (token de lien + petit mot) +
--            1 trigger d'inscription (SÉPARÉ de handle_new_user, on n'y touche
--            PAS) + des RPC (envoyer / répondre / annuler + listes + landing).
-- SÉCURITÉ : toutes les RPC sont SECURITY DEFINER et bornées à auth.uid().
--            invitation_infos() est volontairement lisible par tous (page
--            publique) mais ne renvoie QUE le nom/métier de l'inviteur (le token
--            uuid est un secret non devinable).
-- IDEMPOTENT : oui.
-- À EXÉCUTER : Supabase → SQL Editor → Run.
-- ============================================================================

-- 1) Colonnes : token de lien partageable + petit mot d'invitation
ALTER TABLE public.artisan_relations
  ADD COLUMN IF NOT EXISTS token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS mot  text;

-- Backfill des lignes existantes sans token (au cas où), puis unicité.
UPDATE public.artisan_relations SET token = gen_random_uuid() WHERE token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_token ON public.artisan_relations (token);


-- 2) TRIGGER d'inscription — rattache les invitations email au nouveau compte.
--    SÉPARÉ de handle_new_user (qui crée l'entreprise) : on ne modifie pas
--    l'existant. On lie l'invitation (destinataire_id) mais on garde le statut
--    'en_attente' → double opt-in : le nouvel inscrit accepte ensuite lui-même.
CREATE OR REPLACE FUNCTION public.conclure_invitations_a_inscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  BEGIN
    UPDATE public.artisan_relations
       SET destinataire_id = NEW.id, updated_at = now()
     WHERE destinataire_id IS NULL
       AND destinataire_email IS NOT NULL
       AND lower(destinataire_email) = lower(NEW.email)
       AND deleted_at IS NULL
       -- ceinture + bretelles : ne jamais lier si (demandeur, NEW.id) existe déjà
       AND NOT EXISTS (
         SELECT 1 FROM public.artisan_relations x
          WHERE x.demandeur_id = artisan_relations.demandeur_id
            AND x.destinataire_id = NEW.id
            AND x.deleted_at IS NULL);
  EXCEPTION WHEN OTHERS THEN
    -- Ne JAMAIS faire échouer l'inscription à cause des invitations.
    RAISE WARNING 'conclure_invitations_a_inscription ignoree: % (user=%)', SQLERRM, NEW.id;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_invitations ON auth.users;
CREATE TRIGGER on_auth_user_created_invitations
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.conclure_invitations_a_inscription();


-- 3) RPC — envoyer une invitation à un confrère (par email).
--    Renvoie le token (pour le lien) + si le destinataire est déjà membre.
CREATE OR REPLACE FUNCTION public.envoyer_invitation_confrere(p_email text, p_mot text DEFAULT NULL)
RETURNS TABLE (relation_id uuid, lien_token uuid, destinataire_existe boolean, deja_relie boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moi   uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_dest  uuid;
  v_id    uuid;
  v_token uuid;
  v_rel   record;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Email invalide';
  END IF;

  SELECT id INTO v_dest FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  IF v_dest = v_moi THEN RAISE EXCEPTION 'Vous ne pouvez pas vous inviter vous-meme'; END IF;

  IF v_dest IS NOT NULL THEN
    -- destinataire déjà membre : relation existante ?
    SELECT * INTO v_rel FROM public.artisan_relations r
     WHERE r.deleted_at IS NULL
       AND ((r.demandeur_id = v_moi AND r.destinataire_id = v_dest)
         OR (r.demandeur_id = v_dest AND r.destinataire_id = v_moi))
     LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_rel.id, v_rel.token, true, (v_rel.statut = 'acceptee');
      RETURN;
    END IF;
    INSERT INTO public.artisan_relations
      (demandeur_id, destinataire_id, destinataire_email, type_relation, statut, invited_by, mot)
    VALUES (v_moi, v_dest, v_email, 'confrere', 'en_attente', v_moi, p_mot)
    RETURNING id, token INTO v_id, v_token;
    RETURN QUERY SELECT v_id, v_token, true, false;
    RETURN;
  ELSE
    -- destinataire non inscrit : invitation par email
    SELECT * INTO v_rel FROM public.artisan_relations r
     WHERE r.demandeur_id = v_moi AND lower(r.destinataire_email) = v_email
       AND r.destinataire_id IS NULL AND r.deleted_at IS NULL
     LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_rel.id, v_rel.token, false, false;
      RETURN;
    END IF;
    INSERT INTO public.artisan_relations
      (demandeur_id, destinataire_email, type_relation, statut, invited_by, mot)
    VALUES (v_moi, v_email, 'confrere', 'en_attente', v_moi, p_mot)
    RETURNING id, token INTO v_id, v_token;
    RETURN QUERY SELECT v_id, v_token, false, false;
    RETURN;
  END IF;
EXCEPTION WHEN unique_violation THEN
  -- Course (double-clic) : une ligne identique vient d'être créée en parallèle,
  -- on la relit et on la renvoie au lieu de planter.
  SELECT * INTO v_rel FROM public.artisan_relations r
   WHERE r.deleted_at IS NULL AND r.demandeur_id = v_moi
     AND ( (v_dest IS NOT NULL AND r.destinataire_id = v_dest)
        OR (v_dest IS NULL AND lower(r.destinataire_email) = v_email) )
   LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_rel.id, v_rel.token, (v_dest IS NOT NULL), (v_rel.statut = 'acceptee');
  END IF;
  RETURN;
END;
$$;


-- 4) RPC — répondre à une invitation reçue (accepter / refuser / bloquer).
CREATE OR REPLACE FUNCTION public.repondre_invitation(p_relation_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_moi uuid := auth.uid(); v_rel record;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  SELECT * INTO v_rel FROM public.artisan_relations WHERE id = p_relation_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;

  IF p_action = 'accepter' THEN
    IF v_rel.destinataire_id IS DISTINCT FROM v_moi THEN RAISE EXCEPTION 'Non autorise'; END IF;
    UPDATE public.artisan_relations SET statut = 'acceptee', updated_at = now() WHERE id = p_relation_id;
  ELSIF p_action = 'refuser' THEN
    IF v_rel.destinataire_id IS DISTINCT FROM v_moi THEN RAISE EXCEPTION 'Non autorise'; END IF;
    UPDATE public.artisan_relations SET deleted_at = now(), updated_at = now() WHERE id = p_relation_id;
  ELSIF p_action = 'bloquer' THEN
    IF v_moi <> v_rel.demandeur_id AND v_moi IS DISTINCT FROM v_rel.destinataire_id THEN
      RAISE EXCEPTION 'Non autorise';
    END IF;
    UPDATE public.artisan_relations SET statut = 'bloquee', updated_at = now() WHERE id = p_relation_id;
  ELSE
    RAISE EXCEPTION 'Action inconnue';
  END IF;
END;
$$;


-- 5) RPC — accepter une invitation via son token (clic sur le lien, connecté).
CREATE OR REPLACE FUNCTION public.accepter_invitation_par_token(p_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_moi uuid := auth.uid(); v_rel record; v_existante uuid;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  SELECT * INTO v_rel FROM public.artisan_relations WHERE token = p_token AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;
  IF v_rel.demandeur_id = v_moi THEN RAISE EXCEPTION 'Ceci est votre propre invitation'; END IF;
  IF v_rel.destinataire_id IS NOT NULL AND v_rel.destinataire_id <> v_moi THEN
    RAISE EXCEPTION 'Cette invitation ne vous est pas destinee';
  END IF;
  -- Une relation (demandeur, moi) existe déjà (ex : invit email + ajout direct) :
  -- on l'accepte et on archive le doublon, pour éviter une collision d'index.
  SELECT id INTO v_existante FROM public.artisan_relations
   WHERE demandeur_id = v_rel.demandeur_id AND destinataire_id = v_moi
     AND deleted_at IS NULL AND id <> v_rel.id
   LIMIT 1;
  IF v_existante IS NOT NULL THEN
    UPDATE public.artisan_relations SET statut = 'acceptee', updated_at = now() WHERE id = v_existante;
    UPDATE public.artisan_relations SET deleted_at = now(), updated_at = now() WHERE id = v_rel.id;
    RETURN v_existante;
  END IF;
  UPDATE public.artisan_relations
     SET destinataire_id = v_moi, statut = 'acceptee', updated_at = now()
   WHERE id = v_rel.id;
  RETURN v_rel.id;
END;
$$;


-- 6) RPC — supprimer/annuler une relation (l'une des deux parties).
--    Sert à annuler une invitation envoyée ET à retirer un contact.
CREATE OR REPLACE FUNCTION public.supprimer_relation(p_relation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_moi uuid := auth.uid(); v_rel record;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  SELECT * INTO v_rel FROM public.artisan_relations WHERE id = p_relation_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_moi <> v_rel.demandeur_id AND v_moi IS DISTINCT FROM v_rel.destinataire_id THEN
    RAISE EXCEPTION 'Non autorise';
  END IF;
  UPDATE public.artisan_relations SET deleted_at = now(), updated_at = now() WHERE id = p_relation_id;
END;
$$;


-- 7) RPC — infos publiques d'une invitation (page d'atterrissage, lisible par TOUS).
--    Ne renvoie QUE le nom/métier de l'inviteur. Le token est un secret.
CREATE OR REPLACE FUNCTION public.invitation_infos(p_token uuid)
RETURNS TABLE (inviteur_nom text, inviteur_metier text, statut text, deja_pris boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_rel record;
BEGIN
  SELECT * INTO v_rel FROM public.artisan_relations WHERE token = p_token AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
    SELECT e.nom, e.metier, v_rel.statut, (v_rel.destinataire_id IS NOT NULL)
    FROM public.entreprises e WHERE e.user_id = v_rel.demandeur_id;
END;
$$;


-- 8) RPC — mes demandes reçues (invitations en attente vers MOI).
CREATE OR REPLACE FUNCTION public.mes_demandes_recues()
RETURNS TABLE (relation_id uuid, demandeur_user_id uuid, nom text, metier text, mot text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_moi uuid := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT r.id, r.demandeur_id, e.nom, e.metier, r.mot, r.created_at
    FROM public.artisan_relations r
    LEFT JOIN public.entreprises e ON e.user_id = r.demandeur_id
    WHERE r.destinataire_id = v_moi AND r.statut = 'en_attente' AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC;
END;
$$;


-- 9) RPC — mes invitations envoyées (en attente).
CREATE OR REPLACE FUNCTION public.mes_invitations_envoyees()
RETURNS TABLE (relation_id uuid, lien_token uuid, destinataire_email text, destinataire_nom text, deja_inscrit boolean, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_moi uuid := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT r.id, r.token, r.destinataire_email, e.nom, (r.destinataire_id IS NOT NULL), r.created_at
    FROM public.artisan_relations r
    LEFT JOIN public.entreprises e ON e.user_id = r.destinataire_id
    WHERE r.demandeur_id = v_moi AND r.statut = 'en_attente' AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC;
END;
$$;


-- ============================================================================
-- VÉRIFICATION
-- ============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('conclure_invitations_a_inscription','envoyer_invitation_confrere',
--    'repondre_invitation','accepter_invitation_par_token','supprimer_relation',
--    'invitation_infos','mes_demandes_recues','mes_invitations_envoyees');
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created_invitations';

-- ROLLBACK :
-- DROP TRIGGER IF EXISTS on_auth_user_created_invitations ON auth.users;
-- DROP FUNCTION IF EXISTS public.conclure_invitations_a_inscription();
-- DROP FUNCTION IF EXISTS public.envoyer_invitation_confrere(text,text);
-- DROP FUNCTION IF EXISTS public.repondre_invitation(uuid,text);
-- DROP FUNCTION IF EXISTS public.accepter_invitation_par_token(uuid);
-- DROP FUNCTION IF EXISTS public.supprimer_relation(uuid);
-- DROP FUNCTION IF EXISTS public.invitation_infos(uuid);
-- DROP FUNCTION IF EXISTS public.mes_demandes_recues();
-- DROP FUNCTION IF EXISTS public.mes_invitations_envoyees();
-- ALTER TABLE public.artisan_relations DROP COLUMN IF EXISTS token, DROP COLUMN IF EXISTS mot;
-- ============================================================================
