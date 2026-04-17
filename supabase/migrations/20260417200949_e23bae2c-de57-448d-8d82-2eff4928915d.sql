-- =========================================
-- 1. РОЛИ
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins see all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 2. SOFT-DELETE
-- =========================================
ALTER TABLE public.profiles ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_profiles_deleted_at ON public.profiles(deleted_at);

CREATE OR REPLACE FUNCTION public.admin_set_deleted(_user UUID, _deleted BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
  SET deleted_at = CASE WHEN _deleted THEN now() ELSE NULL END,
      updated_at = now()
  WHERE user_id = _user;
END $$;

-- =========================================
-- 3. PUSH EVENTS
-- =========================================
CREATE TABLE public.push_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status_code INTEGER,
  error TEXT,
  payload_kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_events_user ON public.push_events(user_id, created_at DESC);

ALTER TABLE public.push_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push events select" ON public.push_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins read push events" ON public.push_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 4. AUTH / DEVICE EVENTS (IP + UA)
-- =========================================
CREATE TABLE public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_events_user ON public.auth_events(user_id, created_at DESC);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own auth events select" ON public.auth_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own auth events insert" ON public.auth_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read auth events" ON public.auth_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 5. ADMIN SELECT POLICIES (без чувствительного содержимого)
-- =========================================
CREATE POLICY "admins read profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read mood_pings" ON public.mood_pings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read checkins" ON public.checkins
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read sleep_sessions" ON public.sleep_sessions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read sleep_events" ON public.sleep_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read glyph_stats" ON public.glyph_stats
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read user_achievements" ON public.user_achievements
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read notification_preferences" ON public.notification_preferences
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read quick_actions" ON public.quick_actions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read push_subscriptions" ON public.push_subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read graph_entities" ON public.graph_entities
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read graph_edges" ON public.graph_edges
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- chat_sessions / chat_messages — НЕ даём админу. Только агрегаты через функцию.

-- =========================================
-- 6. АДМИН-ФУНКЦИИ (агрегаты + список юзеров с email)
-- =========================================
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  language TEXT,
  ai_tone TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  checkins_count BIGINT,
  pings_count BIGINT,
  sleep_count BIGINT,
  avg_mood NUMERIC,
  achievements_count BIGINT,
  last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    p.user_id,
    u.email::TEXT,
    p.display_name,
    p.avatar_url,
    p.language,
    p.ai_tone,
    u.created_at,
    u.last_sign_in_at,
    p.deleted_at,
    public.has_role(p.user_id, 'admin') AS is_admin,
    (SELECT COUNT(*) FROM public.checkins c WHERE c.user_id = p.user_id),
    (SELECT COUNT(*) FROM public.mood_pings mp WHERE mp.user_id = p.user_id),
    (SELECT COUNT(*) FROM public.sleep_sessions s WHERE s.user_id = p.user_id),
    (SELECT ROUND(AVG(mood)::NUMERIC, 2) FROM public.mood_pings mp WHERE mp.user_id = p.user_id),
    (SELECT COUNT(*) FROM public.user_achievements ua WHERE ua.user_id = p.user_id),
    GREATEST(
      COALESCE((SELECT MAX(created_at) FROM public.mood_pings mp WHERE mp.user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM public.checkins c WHERE c.user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(started_at) FROM public.sleep_sessions s WHERE s.user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE(u.last_sign_in_at, 'epoch'::timestamptz)
    ) AS last_activity
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_user_activity(_user UUID, _days INT DEFAULT 30)
RETURNS TABLE (day DATE, pings BIGINT, checkins BIGINT, sleep_sessions BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(CURRENT_DATE - (_days - 1), CURRENT_DATE, '1 day'::interval)::date AS day
  )
  SELECT
    d.day,
    (SELECT COUNT(*) FROM public.mood_pings mp WHERE mp.user_id = _user AND mp.created_at::date = d.day),
    (SELECT COUNT(*) FROM public.checkins c WHERE c.user_id = _user AND c.created_at::date = d.day),
    (SELECT COUNT(*) FROM public.sleep_sessions s WHERE s.user_id = _user AND s.started_at::date = d.day)
  FROM days d
  ORDER BY d.day;
END $$;

-- Назначаем admin пользователю fancules9@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'fancules9@gmail.com'
ON CONFLICT DO NOTHING;