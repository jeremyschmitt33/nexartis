-- ============================================================================
-- Fichier  : 2026-07-22-messagerie-02-rpc-lecture.sql
-- Module   : MESSAGERIE ENTRE ARTISANS — fichier 2 (fonctions de lecture)
-- ----------------------------------------------------------------------------
-- POURQUOI : afficher "qui" est en face (nom + métier) est impossible en lecture
--            directe — la RLS de `entreprises` empêche un artisan de lire
--            l'entreprise d'un autre. Ces 3 fonctions SECURITY DEFINER résolvent
--            les noms UNIQUEMENT pour les personnes que l'appelant a le droit de
--            voir (ses conversations, ses contacts). Aucune fuite : chaque
--            fonction est bornée à l'utilisateur connecté.
-- QUOI     :
--   - mes_conversations()      : la liste d'accueil (fil + aperçu + non-lus + qui).
--   - mes_contacts()           : avec qui je peux démarrer un chat (réseau + équipe).
--   - membres_conversation(id) : les participants d'une conversation (si j'en suis).
-- IDEMPOTENT : oui (CREATE OR REPLACE).
-- À EXÉCUTER : Supabase → SQL Editor → Run.
-- ============================================================================

-- 1) La liste d'accueil : tout ce qu'il faut pour l'écran "liste des chats".
CREATE OR REPLACE FUNCTION public.mes_conversations()
RETURNS TABLE (
  id                 uuid,
  type               text,
  titre              text,
  chantier_id        uuid,
  consigne           text,
  dernier_message_at timestamptz,
  mon_dernier_lu_at  timestamptz,
  role_conv          text,
  autre_user_id      uuid,
  autre_nom          text,
  autre_metier       text,
  apercu             text,
  apercu_type        text,
  apercu_expediteur  uuid,
  apercu_at          timestamptz,
  non_lus            bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_moi uuid := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    c.id, c.type, c.titre, c.chantier_id, c.consigne,
    c.dernier_message_at, cm.dernier_lu_at, cm.role_conv,
    autre.user_id, ent.nom, ent.metier,
    lm.contenu, lm.type_message, lm.expediteur_id, lm.created_at,
    COALESCE(nl.n, 0)
  FROM public.conversation_membres cm
  JOIN public.conversations c ON c.id = cm.conversation_id AND c.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT cm2.user_id FROM public.conversation_membres cm2
    WHERE cm2.conversation_id = c.id AND cm2.user_id <> v_moi
    ORDER BY cm2.created_at LIMIT 1
  ) autre ON c.type = 'direct'
  LEFT JOIN public.entreprises ent ON ent.user_id = autre.user_id
  LEFT JOIN LATERAL (
    SELECT m.contenu, m.type_message, m.expediteur_id, m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.messages m2
    WHERE m2.conversation_id = c.id AND m2.deleted_at IS NULL
      AND m2.expediteur_id <> v_moi
      AND (cm.dernier_lu_at IS NULL OR m2.created_at > cm.dernier_lu_at)
  ) nl ON true
  WHERE cm.user_id = v_moi
  ORDER BY c.dernier_message_at DESC NULLS LAST;
END;
$$;

-- 2) Mes contacts : réseau accepté + membres de ma propre entreprise.
CREATE OR REPLACE FUNCTION public.mes_contacts()
RETURNS TABLE (
  user_id       uuid,
  nom           text,
  metier        text,
  email         text,
  type_relation text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_moi uuid := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (u.id)
    u.id, e.nom, e.metier, u.email::text, r.type_relation
  FROM public.artisan_relations r
  JOIN auth.users u
    ON u.id = (CASE WHEN r.demandeur_id = v_moi THEN r.destinataire_id ELSE r.demandeur_id END)
  LEFT JOIN public.entreprises e ON e.user_id = u.id
  WHERE r.statut = 'acceptee' AND r.deleted_at IS NULL
    AND (r.demandeur_id = v_moi OR r.destinataire_id = v_moi)
    AND (CASE WHEN r.demandeur_id = v_moi THEN r.destinataire_id ELSE r.demandeur_id END) IS NOT NULL

  UNION

  SELECT u.id, e.nom, e.metier, u.email::text, 'equipe'::text
  FROM public.entreprise_membres m1
  JOIN public.entreprise_membres m2
    ON m1.entreprise_id = m2.entreprise_id AND m2.user_id <> v_moi
  JOIN auth.users u ON u.id = m2.user_id
  LEFT JOIN public.entreprises e ON e.user_id = u.id
  WHERE m1.user_id = v_moi AND m1.statut = 'actif' AND m2.statut = 'actif';
END;
$$;

-- 3) Les participants d'une conversation (si l'appelant en fait partie).
CREATE OR REPLACE FUNCTION public.membres_conversation(p_conversation_id uuid)
RETURNS TABLE (
  user_id   uuid,
  nom       text,
  metier    text,
  role_conv text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_moi uuid := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RETURN; END IF;
  IF NOT public.est_membre_conversation(p_conversation_id) THEN RETURN; END IF;
  RETURN QUERY
  SELECT cm.user_id, e.nom, e.metier, cm.role_conv
  FROM public.conversation_membres cm
  LEFT JOIN public.entreprises e ON e.user_id = cm.user_id
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.role_conv, cm.created_at;
END;
$$;


-- ============================================================================
-- 4) TEMPS RÉEL : ajoute la table `messages` au flux Realtime de Supabase
--    (sinon les nouveaux messages n'arrivent pas tout seuls dans l'app).
--    Idempotent.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
