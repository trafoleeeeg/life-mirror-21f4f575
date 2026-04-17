-- =========================================================
-- PUSH SUBSCRIPTIONS
-- =========================================================
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push select" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own push insert" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own push delete" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "own push update" ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_push_user ON public.push_subscriptions(user_id);

-- =========================================================
-- NOTIFICATION PREFERENCES (one row per user)
-- =========================================================
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  start_hour SMALLINT NOT NULL DEFAULT 10 CHECK (start_hour BETWEEN 0 AND 23),
  end_hour SMALLINT NOT NULL DEFAULT 22 CHECK (end_hour BETWEEN 0 AND 23),
  interval_minutes INTEGER NOT NULL DEFAULT 120 CHECK (interval_minutes BETWEEN 15 AND 720),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  weekdays SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon..7=Sun
  track_mood BOOLEAN NOT NULL DEFAULT true,
  track_activity BOOLEAN NOT NULL DEFAULT true,
  mood_emojis TEXT[] NOT NULL DEFAULT ARRAY['😞','😕','😐','🙂','😊','😄','😍','🤩','🚀','✨'],
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs select" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own prefs insert" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- MOOD PINGS (micro check-ins from notifications)
-- =========================================================
CREATE TABLE public.mood_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mood SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 10),
  emoji TEXT,
  activities TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  source TEXT NOT NULL DEFAULT 'notification', -- notification | manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mood_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mood select" ON public.mood_pings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own mood insert" ON public.mood_pings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mood update" ON public.mood_pings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own mood delete" ON public.mood_pings FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_mood_user_created ON public.mood_pings(user_id, created_at DESC);

-- =========================================================
-- QUICK ACTIONS (user-customizable activity chips with emoji)
-- =========================================================
CREATE TABLE public.quick_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  use_count INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);
ALTER TABLE public.quick_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own qa select" ON public.quick_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own qa insert" ON public.quick_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own qa update" ON public.quick_actions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own qa delete" ON public.quick_actions FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- ACHIEVEMENTS (catalog) + USER_ACHIEVEMENTS (unlocked)
-- =========================================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏆',
  threshold INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'general', -- streak | volume | morning | evening | mood
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements public read" ON public.achievements FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ach select" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ach insert" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed achievements catalog
INSERT INTO public.achievements (code, title, description, emoji, threshold, category) VALUES
  ('first_ping', 'Первый сигнал', 'Записал первое настроение', '🌱', 1, 'volume'),
  ('pings_10', 'Внимательный', '10 пингов настроения', '👀', 10, 'volume'),
  ('pings_50', 'Постоянный наблюдатель', '50 пингов настроения', '🔍', 50, 'volume'),
  ('pings_200', 'Архивариус себя', '200 пингов настроения', '📚', 200, 'volume'),
  ('streak_3', 'Три дня подряд', 'Отмечался 3 дня подряд', '🔥', 3, 'streak'),
  ('streak_7', 'Неделя подряд', 'Отмечался 7 дней подряд', '🔥🔥', 7, 'streak'),
  ('streak_30', 'Месяц подряд', '30 дней подряд', '🌋', 30, 'streak'),
  ('morning_5', 'Жаворонок', '5 утренних чек-инов', '🌅', 5, 'morning'),
  ('evening_5', 'Сова', '5 вечерних чек-инов', '🌙', 5, 'evening'),
  ('checkins_30', 'Ритуал', '30 чек-инов всего', '🕯️', 30, 'volume'),
  ('high_mood_streak', 'Светлая полоса', '5 пингов подряд с настроением ≥ 8', '☀️', 5, 'mood');

-- =========================================================
-- ACHIEVEMENT EVALUATION FUNCTIONS
-- =========================================================

-- Compute current consecutive-day streak of mood_pings
CREATE OR REPLACE FUNCTION public.compute_ping_streak(_user UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  streak INTEGER := 0;
  cursor_date DATE := CURRENT_DATE;
  has_today BOOLEAN;
BEGIN
  -- Walk back from today; allow today to be empty (then start from yesterday)
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
END $$;

-- Unlock helper (idempotent)
CREATE OR REPLACE FUNCTION public.try_unlock(_user UUID, _code TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _aid UUID;
BEGIN
  SELECT id INTO _aid FROM public.achievements WHERE code = _code;
  IF _aid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (_user, _aid)
  ON CONFLICT DO NOTHING;
END $$;

-- Trigger: after mood_ping insert, evaluate ping-related achievements
CREATE OR REPLACE FUNCTION public.eval_ping_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total INTEGER;
  streak INTEGER;
  high_streak INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM public.mood_pings WHERE user_id = NEW.user_id;
  IF total >= 1 THEN PERFORM public.try_unlock(NEW.user_id, 'first_ping'); END IF;
  IF total >= 10 THEN PERFORM public.try_unlock(NEW.user_id, 'pings_10'); END IF;
  IF total >= 50 THEN PERFORM public.try_unlock(NEW.user_id, 'pings_50'); END IF;
  IF total >= 200 THEN PERFORM public.try_unlock(NEW.user_id, 'pings_200'); END IF;

  streak := public.compute_ping_streak(NEW.user_id);
  IF streak >= 3 THEN PERFORM public.try_unlock(NEW.user_id, 'streak_3'); END IF;
  IF streak >= 7 THEN PERFORM public.try_unlock(NEW.user_id, 'streak_7'); END IF;
  IF streak >= 30 THEN PERFORM public.try_unlock(NEW.user_id, 'streak_30'); END IF;

  -- High mood streak: last 5 pings all >= 8
  SELECT COUNT(*) INTO high_streak
  FROM (
    SELECT mood FROM public.mood_pings
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) t WHERE mood >= 8;
  IF high_streak >= 5 THEN PERFORM public.try_unlock(NEW.user_id, 'high_mood_streak'); END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_eval_ping_ach
  AFTER INSERT ON public.mood_pings
  FOR EACH ROW EXECUTE FUNCTION public.eval_ping_achievements();

-- Trigger: after checkin insert, evaluate checkin achievements
CREATE OR REPLACE FUNCTION public.eval_checkin_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  morning_n INTEGER; evening_n INTEGER; total INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM public.checkins WHERE user_id = NEW.user_id;
  IF total >= 30 THEN PERFORM public.try_unlock(NEW.user_id, 'checkins_30'); END IF;

  SELECT COUNT(*) INTO morning_n FROM public.checkins WHERE user_id = NEW.user_id AND mode = 'morning';
  IF morning_n >= 5 THEN PERFORM public.try_unlock(NEW.user_id, 'morning_5'); END IF;

  SELECT COUNT(*) INTO evening_n FROM public.checkins WHERE user_id = NEW.user_id AND mode = 'evening';
  IF evening_n >= 5 THEN PERFORM public.try_unlock(NEW.user_id, 'evening_5'); END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_eval_checkin_ach
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.eval_checkin_achievements();