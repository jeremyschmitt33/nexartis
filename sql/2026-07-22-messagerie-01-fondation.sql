-- ============================================================================
-- Fichier  : 2026-07-22-messagerie-01-fondation.sql
-- Module   : MESSAGERIE ENTRE ARTISANS — fichier 1 (la fondation)
-- Version  : v2 (corrigée après audit sécurité + confrontation, 22/07/2026)
-- ----------------------------------------------------------------------------
-- POURQUOI : première brique de la messagerie. On crée UNIQUEMENT les "boîtes
--            de rangement" (tables) et la SÉCURITÉ. Aucune table existante n'est
--            modifiée : ce script ne fait qu'AJOUTER du nouveau → il ne peut PAS
--            casser le site en ligne. Aucune interface n'est encore branchée.
--
-- RÈGLE D'OR (promesse "un artisan ne voit JAMAIS le chat d'un autre") :
--   un utilisateur lit/écrit un message UNIQUEMENT s'il figure dans
--   `conversation_membres` pour cette conversation.
--
-- DÉCISIONS PRODUIT (jeremy, 22/07/2026) :
--   - 100% entre artisans Nexartis. Le CLIENT final ne participe jamais.
--   - Base = chat 1-à-1 ('direct'). Groupe = 'groupe' (chantier), renommable,
--     avec une consigne épinglée (note d'en-tête).
--   - Réseau FERMÉ sur invitation → `artisan_relations`. On ne peut ouvrir un
--     chat qu'avec une relation ACCEPTÉE (ou un membre de sa propre entreprise).
--   - RGPD : auteur d'un message => NULL à la suppression du compte (le fil
--     reste lisible pour les autres).
--
-- CORRECTIFS D'AUDIT APPLIQUÉS DANS CETTE v2 :
--   [SÉCU 1] fuite via UPDATE de conversation_membres  -> trigger "freeze"
--   [SÉCU 2] fuite via UPDATE de messages              -> WITH CHECK renforcé
--   [SÉCU 3] suppression RGPD impossible (NOT NULL)    -> created_by nullable
--   [SÉCU 4] plantage stockage (cast uuid)             -> fonction try_uuid()
--   [SÉCU 5] créateur ne pouvait pas ajouter un 2e     -> policy insert corrigée
--   [MODÈLE] doublon de conversation 1-à-1             -> cle_directe + RPC
--   [MODÈLE] reply, anti-doublon offline, consigne, uploaded_by, signalements
--
-- À EXÉCUTER : Supabase → SQL Editor → New Query → coller → Run.
--   ⚠️ De préférence QUAND CLAUDE EST DISPO. Sauvegarde d'abord (Database → Backups).
-- IDEMPOTENT : oui (relançable sans erreur).
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1) FONCTIONS DE SÉCURITÉ (SECURITY DEFINER pour éviter la récursion RLS)
-- ════════════════════════════════════════════════════════════════════════════

-- NB : ces fonctions sont en plpgsql (et NON en sql) volontairement : le corps
-- d'une fonction sql est vérifié à la création, or elles interrogent
-- `conversation_membres` qui n'est créée que plus bas → sur une base vierge, une
-- fonction sql planterait. Le plpgsql diffère cette vérification. (Audit 22/07.)
CREATE OR REPLACE FUNCTION public.est_membre_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_membres cm
    WHERE cm.conversation_id = p_conversation_id AND cm.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.est_admin_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_membres cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = auth.uid() AND cm.role_conv = 'admin'
  );
END;
$$;

-- Cast uuid tolérant : renvoie NULL au lieu de PLANTER si le texte n'est pas un
-- uuid (protège les policies storage contre un chemin mal formé). [SÉCU 4]
CREATE OR REPLACE FUNCTION public.try_uuid(t text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN t::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2) TABLE `artisan_relations` — le carnet du réseau fermé (les "amis")
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.artisan_relations (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  demandeur_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinataire_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  destinataire_email TEXT,
  type_relation      TEXT NOT NULL DEFAULT 'confrere'
                       CHECK (type_relation IN ('confrere','partenaire','equipe')),
  statut             TEXT NOT NULL DEFAULT 'en_attente'
                       CHECK (statut IN ('en_attente','acceptee','bloquee')),
  invited_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_paire_unique
  ON public.artisan_relations (demandeur_id, destinataire_id)
  WHERE destinataire_id IS NOT NULL AND deleted_at IS NULL;

-- Évite de dupliquer une invitation par e-mail (destinataire pas encore inscrit).
CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_email_unique
  ON public.artisan_relations (demandeur_id, lower(destinataire_email))
  WHERE destinataire_email IS NOT NULL AND destinataire_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_relations_demandeur ON public.artisan_relations (demandeur_id);
CREATE INDEX IF NOT EXISTS idx_relations_destinataire ON public.artisan_relations (destinataire_id);

ALTER TABLE public.artisan_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS relations_select ON public.artisan_relations;
CREATE POLICY relations_select ON public.artisan_relations FOR SELECT
  USING (demandeur_id = auth.uid() OR destinataire_id = auth.uid());

DROP POLICY IF EXISTS relations_insert ON public.artisan_relations;
CREATE POLICY relations_insert ON public.artisan_relations FOR INSERT
  WITH CHECK (demandeur_id = auth.uid());

DROP POLICY IF EXISTS relations_update ON public.artisan_relations;
CREATE POLICY relations_update ON public.artisan_relations FOR UPDATE
  USING (demandeur_id = auth.uid() OR destinataire_id = auth.uid())
  WITH CHECK (demandeur_id = auth.uid() OR destinataire_id = auth.uid());

DROP POLICY IF EXISTS relations_delete ON public.artisan_relations;
CREATE POLICY relations_delete ON public.artisan_relations FOR DELETE
  USING (demandeur_id = auth.uid() OR destinataire_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- 3) TABLE `conversations` — un fil de discussion
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conversations (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type               TEXT NOT NULL DEFAULT 'direct'
                       CHECK (type IN ('direct','groupe')),
  titre              TEXT,
  -- Clé d'unicité d'un 1-à-1 : "idPetit:idGrand" (identique quel que soit le sens).
  cle_directe        TEXT,
  chantier_id        UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
  -- Consigne épinglée (note d'en-tête : adresse, code portail, sécurité...).
  consigne           TEXT,
  consigne_par       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consigne_maj_at    TIMESTAMPTZ,
  -- [SÉCU 3] nullable : sinon la suppression RGPD d'un compte échoue.
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dernier_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

-- Un seul fil 'direct' possible par paire → jamais de doublon d'historique. [MODÈLE]
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_unique
  ON public.conversations (cle_directe)
  WHERE type = 'direct' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_chantier ON public.conversations (chantier_id);
CREATE INDEX IF NOT EXISTS idx_conversations_dernier_msg ON public.conversations (dernier_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT
  USING (public.est_membre_conversation(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations FOR UPDATE
  USING (public.est_admin_conversation(id) OR created_by = auth.uid())
  WITH CHECK (public.est_admin_conversation(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS conversations_delete ON public.conversations;
CREATE POLICY conversations_delete ON public.conversations FOR DELETE
  USING (created_by = auth.uid());

-- Fige l'identité d'une conversation (on ne peut pas voler la "propriété"
-- ni changer la clé de paire après coup).
CREATE OR REPLACE FUNCTION public.conversations_freeze()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by est immuable';
  END IF;
  IF NEW.cle_directe IS DISTINCT FROM OLD.cle_directe THEN
    RAISE EXCEPTION 'cle_directe est immuable';
  END IF;
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'type est immuable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_conversations_freeze ON public.conversations;
CREATE TRIGGER trg_conversations_freeze BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_freeze();


-- ════════════════════════════════════════════════════════════════════════════
-- 4) TABLE `conversation_membres` — QUI participe à QUELLE conversation (pivot)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conversation_membres (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_conv       TEXT NOT NULL DEFAULT 'membre' CHECK (role_conv IN ('admin','membre')),
  dernier_lu_at   TIMESTAMPTZ,
  silencieux      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_membres_conv ON public.conversation_membres (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_membres_user ON public.conversation_membres (user_id);

ALTER TABLE public.conversation_membres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_membres_select ON public.conversation_membres;
CREATE POLICY conv_membres_select ON public.conversation_membres FOR SELECT
  USING (public.est_membre_conversation(conversation_id));

-- [SÉCU 5] Le CRÉATEUR de la conversation (ou un admin) compose la liste.
DROP POLICY IF EXISTS conv_membres_insert ON public.conversation_membres;
CREATE POLICY conv_membres_insert ON public.conversation_membres FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
    OR public.est_admin_conversation(conversation_id)
  );

DROP POLICY IF EXISTS conv_membres_update ON public.conversation_membres;
CREATE POLICY conv_membres_update ON public.conversation_membres FOR UPDATE
  USING (user_id = auth.uid() OR public.est_admin_conversation(conversation_id))
  WITH CHECK (user_id = auth.uid() OR public.est_admin_conversation(conversation_id));

DROP POLICY IF EXISTS conv_membres_delete ON public.conversation_membres;
CREATE POLICY conv_membres_delete ON public.conversation_membres FOR DELETE
  USING (user_id = auth.uid() OR public.est_admin_conversation(conversation_id));

-- [SÉCU 1] EMPÊCHE de déplacer sa ligne vers une autre conversation (= s'inviter
-- dans un chat privé) et l'auto-promotion en admin. Une policy RLS ne peut pas
-- comparer ancienne/nouvelle valeur : c'est le rôle de ce trigger.
CREATE OR REPLACE FUNCTION public.conv_membres_freeze()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.conversation_id <> OLD.conversation_id THEN
    RAISE EXCEPTION 'conversation_id est immuable';
  END IF;
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'user_id est immuable';
  END IF;
  IF NEW.role_conv IS DISTINCT FROM OLD.role_conv
     AND NOT public.est_admin_conversation(OLD.conversation_id) THEN
    RAISE EXCEPTION 'seul un admin peut changer un role';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_conv_membres_freeze ON public.conversation_membres;
CREATE TRIGGER trg_conv_membres_freeze BEFORE UPDATE ON public.conversation_membres
  FOR EACH ROW EXECUTE FUNCTION public.conv_membres_freeze();


-- ════════════════════════════════════════════════════════════════════════════
-- 5) TABLE `messages`
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  expediteur_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contenu           TEXT,
  type_message      TEXT NOT NULL DEFAULT 'texte'
                      CHECK (type_message IN
                        ('texte','vocal','photo','document','devis','facture','systeme')),
  -- Répondre à un message précis ("re: quelle photo ?"). [MODÈLE]
  reply_to_id       UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  -- Anti-doublon quand l'app renvoie un message après une coupure réseau. [MODÈLE]
  client_message_id UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  edited_at         TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_unique
  ON public.messages (conversation_id, expediteur_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- (SELECT ...) autour de la fonction = évaluée une seule fois (perf sur gros fils).
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT
  USING ((SELECT public.est_membre_conversation(conversation_id)));

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT
  WITH CHECK (
    expediteur_id = auth.uid()
    AND public.est_membre_conversation(conversation_id)
  );

-- [SÉCU 2] WITH CHECK renforcé : impossible de déplacer son message vers la
-- conversation d'un autre.
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages FOR UPDATE
  USING (expediteur_id = auth.uid())
  WITH CHECK (
    expediteur_id = auth.uid()
    AND public.est_membre_conversation(conversation_id)
  );

DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_delete ON public.messages FOR DELETE
  USING (expediteur_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- 6) TABLE `message_pieces_jointes`
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.message_pieces_jointes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id    UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  type_pj       TEXT NOT NULL DEFAULT 'document'
                  CHECK (type_pj IN ('photo','document','vocal','devis','facture')),
  fichier_path  TEXT,
  nom           TEXT,
  mime_type     TEXT,
  taille_octets BIGINT,
  devis_id      UUID REFERENCES public.devis(id) ON DELETE SET NULL,
  facture_id    UUID REFERENCES public.factures(id) ON DELETE SET NULL,
  transcription TEXT,
  -- Qui a uploadé (utile purge RGPD + modération). [MODÈLE]
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pj_message ON public.message_pieces_jointes (message_id);

ALTER TABLE public.message_pieces_jointes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pj_select ON public.message_pieces_jointes;
CREATE POLICY pj_select ON public.message_pieces_jointes FOR SELECT
  USING ((SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND public.est_membre_conversation(m.conversation_id)
  )));

DROP POLICY IF EXISTS pj_insert ON public.message_pieces_jointes;
CREATE POLICY pj_insert ON public.message_pieces_jointes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.expediteur_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pj_delete ON public.message_pieces_jointes;
CREATE POLICY pj_delete ON public.message_pieces_jointes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.expediteur_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 7) TABLE `signalements` — obligation légale d'hébergeur (LCEN)
--    Tout membre peut signaler un contenu ; le traitement se fait côté admin
--    plateforme (service role, qui contourne la RLS comme pour /api/admin).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.signalements (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id      UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  signale_par     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motif           TEXT NOT NULL,
  details         TEXT,
  statut          TEXT NOT NULL DEFAULT 'ouvert'
                    CHECK (statut IN ('ouvert','en_cours','traite','rejete')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  traite_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_signalements_statut ON public.signalements (statut);

ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signalements_insert ON public.signalements;
CREATE POLICY signalements_insert ON public.signalements FOR INSERT
  WITH CHECK (
    signale_par = auth.uid()
    AND (conversation_id IS NULL OR public.est_membre_conversation(conversation_id))
  );

DROP POLICY IF EXISTS signalements_select ON public.signalements;
CREATE POLICY signalements_select ON public.signalements FOR SELECT
  USING (signale_par = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- 8) TRIGGERS updated_at + remontée de conversation
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS set_updated_at ON public.artisan_relations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.artisan_relations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Remonte la conversation en haut de la liste à chaque message. On borne à
-- "maintenant" pour qu'un created_at trafiqué ne fausse pas le tri. [MINEUR #6]
CREATE OR REPLACE FUNCTION public.bump_conversation_dernier_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
     SET dernier_message_at = GREATEST(COALESCE(dernier_message_at, now()), now())
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_dernier_message ON public.messages;
CREATE TRIGGER trg_bump_dernier_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_dernier_message();


-- ════════════════════════════════════════════════════════════════════════════
-- 9) RPC `trouver_ou_creer_direct` — ouvre (ou retrouve) le chat 1-à-1
--    L'app appelle CECI, jamais un INSERT direct pour un 1-à-1. Garantit :
--    (a) réseau fermé (relation acceptée OU même entreprise),
--    (b) aucun doublon de fil (clé de paire + index unique). [MODÈLE]
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trouver_ou_creer_direct(p_autre uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moi  uuid := auth.uid();
  v_cle  text;
  v_conv uuid;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  IF p_autre = v_moi OR p_autre IS NULL THEN
    RAISE EXCEPTION 'Destinataire invalide';
  END IF;

  -- Réseau fermé : relation acceptée dans un sens ou l'autre, OU même entreprise.
  IF NOT EXISTS (
        SELECT 1 FROM public.artisan_relations r
         WHERE r.statut = 'acceptee' AND r.deleted_at IS NULL
           AND ((r.demandeur_id = v_moi AND r.destinataire_id = p_autre)
             OR (r.demandeur_id = p_autre AND r.destinataire_id = v_moi))
     )
     AND NOT EXISTS (
        SELECT 1 FROM public.entreprise_membres m1
          JOIN public.entreprise_membres m2 ON m1.entreprise_id = m2.entreprise_id
         WHERE m1.user_id = v_moi AND m2.user_id = p_autre
           AND m1.statut = 'actif' AND m2.statut = 'actif'
     )
  THEN
    RAISE EXCEPTION 'Vous devez etre connectes (relation acceptee) pour discuter';
  END IF;

  v_cle := LEAST(v_moi::text, p_autre::text) || ':' || GREATEST(v_moi::text, p_autre::text);

  SELECT id INTO v_conv FROM public.conversations
   WHERE type = 'direct' AND cle_directe = v_cle AND deleted_at IS NULL;
  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  INSERT INTO public.conversations (type, created_by, cle_directe)
  VALUES ('direct', v_moi, v_cle) RETURNING id INTO v_conv;

  INSERT INTO public.conversation_membres (conversation_id, user_id, role_conv)
  VALUES (v_conv, v_moi, 'admin'), (v_conv, p_autre, 'membre');

  RETURN v_conv;
EXCEPTION WHEN unique_violation THEN
  -- Deux appareils en même temps : on récupère le fil déjà créé.
  SELECT id INTO v_conv FROM public.conversations
   WHERE type = 'direct' AND cle_directe = v_cle AND deleted_at IS NULL;
  RETURN v_conv;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 10) STOCKAGE — bucket privé 'messagerie'
--    Chemin imposé côté app : {conversation_id}/{message_id}/{timestamp}-{nom}.
--    Sécurité par APPARTENANCE (les autres membres doivent aussi ouvrir le
--    fichier), via try_uuid() pour ne jamais planter sur un chemin mal formé.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messagerie', 'messagerie', FALSE, 15728640,
  ARRAY['image/jpeg','image/png','image/webp','image/heic',
        'application/pdf','audio/webm','audio/mpeg','audio/mp4','audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS messagerie_select ON storage.objects;
CREATE POLICY messagerie_select ON storage.objects FOR SELECT
  USING (bucket_id = 'messagerie'
     AND public.est_membre_conversation(public.try_uuid((storage.foldername(name))[1])));

DROP POLICY IF EXISTS messagerie_insert ON storage.objects;
CREATE POLICY messagerie_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'messagerie'
     AND public.est_membre_conversation(public.try_uuid((storage.foldername(name))[1])));

DROP POLICY IF EXISTS messagerie_delete ON storage.objects;
CREATE POLICY messagerie_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'messagerie'
     AND public.est_membre_conversation(public.try_uuid((storage.foldername(name))[1])));


-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS EXÉCUTION
-- ════════════════════════════════════════════════════════════════════════════
-- 1) RLS active sur les 6 tables :
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename IN ('artisan_relations','conversations','conversation_membres',
--                      'messages','message_pieces_jointes','signalements');
-- 2) Bucket privé :
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'messagerie';
-- 3) Nombre de policies par table (doit être > 0) :
-- SELECT tablename, count(*) FROM pg_policies
--  WHERE tablename IN ('artisan_relations','conversations','conversation_membres',
--                      'messages','message_pieces_jointes','signalements')
--  GROUP BY tablename;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (tout annuler) :
-- ════════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS public.signalements CASCADE;
-- DROP TABLE IF EXISTS public.message_pieces_jointes CASCADE;
-- DROP TABLE IF EXISTS public.messages CASCADE;
-- DROP TABLE IF EXISTS public.conversation_membres CASCADE;
-- DROP TABLE IF EXISTS public.conversations CASCADE;
-- DROP TABLE IF EXISTS public.artisan_relations CASCADE;
-- DROP FUNCTION IF EXISTS public.trouver_ou_creer_direct(uuid);
-- DROP FUNCTION IF EXISTS public.est_membre_conversation(uuid);
-- DROP FUNCTION IF EXISTS public.est_admin_conversation(uuid);
-- DROP FUNCTION IF EXISTS public.bump_conversation_dernier_message();
-- DROP FUNCTION IF EXISTS public.conv_membres_freeze();
-- DROP FUNCTION IF EXISTS public.conversations_freeze();
-- DROP FUNCTION IF EXISTS public.try_uuid(text);
-- DROP POLICY IF EXISTS messagerie_select ON storage.objects;
-- DROP POLICY IF EXISTS messagerie_insert ON storage.objects;
-- DROP POLICY IF EXISTS messagerie_delete ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id = 'messagerie';
-- DELETE FROM storage.buckets WHERE id = 'messagerie';
-- ============================================================================
