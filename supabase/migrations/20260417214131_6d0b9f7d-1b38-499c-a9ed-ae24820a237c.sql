
-- Подписки между пользователями
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  followee_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_followee ON public.follows(followee_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows read all auth" ON public.follows
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "follows insert own" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows delete own" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Уведомления (универсальная таблица для in-app уведомлений)
CREATE TABLE public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,           -- получатель
  actor_id UUID,                   -- кто инициировал (может быть NULL для системных)
  kind TEXT NOT NULL,              -- 'follow' | 'reaction' | 'comment' | ...
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_notif_user_unread ON public.app_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_app_notif_user ON public.app_notifications(user_id, created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.app_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own notifications update" ON public.app_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own notifications delete" ON public.app_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Триггер: при новом follow создаём уведомление получателю
CREATE OR REPLACE FUNCTION public.on_follow_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_notifications (user_id, actor_id, kind, payload)
  VALUES (
    NEW.followee_id,
    NEW.follower_id,
    'follow',
    jsonb_build_object('follow_id', NEW.id)
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_on_follow_created
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.on_follow_created();

-- ============= ВЕРСИИ ДОСЬЕ =============
CREATE TABLE public.user_dossier_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  version INTEGER NOT NULL,
  summary TEXT,
  patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  values_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'auto', -- 'auto' | 'manual' | 'restore'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dossier_versions_user ON public.user_dossier_versions(user_id, created_at DESC);

ALTER TABLE public.user_dossier_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own dossier versions select" ON public.user_dossier_versions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own dossier versions insert" ON public.user_dossier_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own dossier versions delete" ON public.user_dossier_versions
  FOR DELETE USING (auth.uid() = user_id);

-- Триггер: при апдейте user_dossier пишем снапшот в versions
CREATE OR REPLACE FUNCTION public.snapshot_dossier_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Снимаем СТАРОЕ состояние перед апдейтом, чтобы можно было откатиться
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.user_dossier_versions (
      user_id, version, summary, patterns, themes, triggers, resources,
      values_list, goals, relationships, notes, source, created_at
    ) VALUES (
      OLD.user_id, OLD.version, OLD.summary, OLD.patterns, OLD.themes, OLD.triggers,
      OLD.resources, OLD.values_list, OLD.goals, OLD.relationships, OLD.notes,
      'auto', COALESCE(OLD.updated_at, now())
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_snapshot_dossier_version
BEFORE UPDATE ON public.user_dossier
FOR EACH ROW EXECUTE FUNCTION public.snapshot_dossier_version();

-- RPC: откат досье к версии
CREATE OR REPLACE FUNCTION public.restore_dossier_version(_version_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _v public.user_dossier_versions%ROWTYPE;
BEGIN
  SELECT * INTO _v FROM public.user_dossier_versions WHERE id = _version_id;
  IF _v IS NULL THEN
    RAISE EXCEPTION 'Version not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> _v.user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.user_dossier
  SET
    summary = _v.summary,
    patterns = _v.patterns,
    themes = _v.themes,
    triggers = _v.triggers,
    resources = _v.resources,
    values_list = _v.values_list,
    goals = _v.goals,
    relationships = _v.relationships,
    notes = _v.notes,
    version = COALESCE(version, 1) + 1,
    updated_at = now()
  WHERE user_id = _v.user_id;
END $$;

-- ============= REALTIME =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
