
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key') THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quick_actions_user_label_key') THEN
    ALTER TABLE public.quick_actions ADD CONSTRAINT quick_actions_user_label_key UNIQUE (user_id, label);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_eval_ping_ach ON public.mood_pings;
CREATE TRIGGER trg_eval_ping_ach
  AFTER INSERT ON public.mood_pings
  FOR EACH ROW EXECUTE FUNCTION public.eval_ping_achievements();

DROP TRIGGER IF EXISTS trg_eval_checkin_ach ON public.checkins;
CREATE TRIGGER trg_eval_checkin_ach
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.eval_checkin_achievements();

DROP TRIGGER IF EXISTS trg_np_touch ON public.notification_preferences;
CREATE TRIGGER trg_np_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_pings_user_created ON public.mood_pings(user_id, created_at DESC);

INSERT INTO public.achievements (code, title, description, emoji, category, threshold) VALUES
  ('first_ping', 'Первое касание', 'Первый микро-чек настроения', '🌱', 'mood', 1),
  ('pings_10', '10 пингов', '10 микро-чеков', '✨', 'mood', 10),
  ('pings_50', '50 пингов', 'Уверенный ритм трекинга', '⚡', 'mood', 50),
  ('pings_200', '200 пингов', 'Зеркало настроено', '💎', 'mood', 200),
  ('streak_3', '3 дня подряд', 'Стрик 3 дня микро-чеков', '🔥', 'streak', 3),
  ('streak_7', 'Неделя ритма', 'Стрик 7 дней микро-чеков', '🔥', 'streak', 7),
  ('streak_30', 'Месяц ритма', 'Стрик 30 дней микро-чеков', '🏔️', 'streak', 30),
  ('high_mood_streak', 'На волне', '5 пингов подряд с настроением 8+', '🌊', 'mood', 5),
  ('checkins_30', '30 чек-инов', 'Глубокая работа над зеркалом', '🪞', 'checkin', 30),
  ('morning_5', 'Жаворонок', '5 утренних чек-инов', '🌅', 'checkin', 5),
  ('evening_5', 'Сова', '5 вечерних чек-инов', '🌙', 'checkin', 5)
ON CONFLICT (code) DO NOTHING;
