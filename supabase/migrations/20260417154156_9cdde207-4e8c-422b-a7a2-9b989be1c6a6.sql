
-- 1) Profiles: restrict SELECT to owner
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Public-safe view exposing only display_name and avatar_url
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) notification_preferences DELETE policy
CREATE POLICY "own prefs delete"
  ON public.notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- 3) Harden SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.try_unlock(_user uuid, _code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aid UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT id INTO _aid FROM public.achievements WHERE code = _code;
  IF _aid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (_user, _aid)
  ON CONFLICT DO NOTHING;
END $function$;

CREATE OR REPLACE FUNCTION public.compute_ping_streak(_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  streak INTEGER := 0;
  cursor_date DATE := CURRENT_DATE;
  has_today BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.mood_pings
    WHERE user_id = _user AND created_at::date = cursor_date
  ) INTO has_today;
  IF NOT has_today THEN cursor_date := cursor_date - 1; END IF;

  LOOP
    IF EXISTS (
      SELECT 1 FROM public.mood_pings
      WHERE user_id = _user AND created_at::date = cursor_date
    ) THEN
      streak := streak + 1;
      cursor_date := cursor_date - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN streak;
END $function$;

-- The trigger functions (eval_*) call try_unlock with NEW.user_id while running as
-- SECURITY DEFINER themselves; auth.uid() inside trigger context would block.
-- Recreate them to call an internal unlock variant that doesn't check auth.
CREATE OR REPLACE FUNCTION public._internal_unlock(_user uuid, _code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aid UUID;
BEGIN
  SELECT id INTO _aid FROM public.achievements WHERE code = _code;
  IF _aid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (_user, _aid)
  ON CONFLICT DO NOTHING;
END $function$;

REVOKE EXECUTE ON FUNCTION public._internal_unlock(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._internal_compute_ping_streak(_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  streak INTEGER := 0;
  cursor_date DATE := CURRENT_DATE;
  has_today BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.mood_pings
    WHERE user_id = _user AND created_at::date = cursor_date
  ) INTO has_today;
  IF NOT has_today THEN cursor_date := cursor_date - 1; END IF;
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.mood_pings
      WHERE user_id = _user AND created_at::date = cursor_date
    ) THEN
      streak := streak + 1;
      cursor_date := cursor_date - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN streak;
END $function$;

REVOKE EXECUTE ON FUNCTION public._internal_compute_ping_streak(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eval_ping_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total INTEGER;
  streak INTEGER;
  high_streak INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM public.mood_pings WHERE user_id = NEW.user_id;
  IF total >= 1 THEN PERFORM public._internal_unlock(NEW.user_id, 'first_ping'); END IF;
  IF total >= 10 THEN PERFORM public._internal_unlock(NEW.user_id, 'pings_10'); END IF;
  IF total >= 50 THEN PERFORM public._internal_unlock(NEW.user_id, 'pings_50'); END IF;
  IF total >= 200 THEN PERFORM public._internal_unlock(NEW.user_id, 'pings_200'); END IF;

  streak := public._internal_compute_ping_streak(NEW.user_id);
  IF streak >= 3 THEN PERFORM public._internal_unlock(NEW.user_id, 'streak_3'); END IF;
  IF streak >= 7 THEN PERFORM public._internal_unlock(NEW.user_id, 'streak_7'); END IF;
  IF streak >= 30 THEN PERFORM public._internal_unlock(NEW.user_id, 'streak_30'); END IF;

  SELECT COUNT(*) INTO high_streak
  FROM (
    SELECT mood FROM public.mood_pings
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) t WHERE mood >= 8;
  IF high_streak >= 5 THEN PERFORM public._internal_unlock(NEW.user_id, 'high_mood_streak'); END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.eval_checkin_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  morning_n INTEGER; evening_n INTEGER; total INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM public.checkins WHERE user_id = NEW.user_id;
  IF total >= 30 THEN PERFORM public._internal_unlock(NEW.user_id, 'checkins_30'); END IF;

  SELECT COUNT(*) INTO morning_n FROM public.checkins WHERE user_id = NEW.user_id AND mode = 'morning';
  IF morning_n >= 5 THEN PERFORM public._internal_unlock(NEW.user_id, 'morning_5'); END IF;

  SELECT COUNT(*) INTO evening_n FROM public.checkins WHERE user_id = NEW.user_id AND mode = 'evening';
  IF evening_n >= 5 THEN PERFORM public._internal_unlock(NEW.user_id, 'evening_5'); END IF;

  RETURN NEW;
END $function$;

-- 4) Realtime channel authorization: only allow subscribing to topics
-- matching the user's own id (used as topic name for per-user channels)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users own topic only" ON realtime.messages;
CREATE POLICY "Authenticated users own topic only"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() LIKE auth.uid()::text || ':%'
  );

DROP POLICY IF EXISTS "Authenticated users own topic broadcast" ON realtime.messages;
CREATE POLICY "Authenticated users own topic broadcast"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() LIKE auth.uid()::text || ':%'
  );

-- 5) Avatars bucket: prevent listing, allow direct object reads via URL
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;

-- Owners can manage their own files (path: <user_id>/...)
CREATE POLICY "Avatars owner manage"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Authenticated users can read individual avatars (no listing for anon)
CREATE POLICY "Avatars read auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
