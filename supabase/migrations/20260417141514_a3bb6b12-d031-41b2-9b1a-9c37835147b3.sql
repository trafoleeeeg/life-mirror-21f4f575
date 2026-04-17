-- chat_sessions
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Новая сессия',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions select" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sessions delete" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_chat_sessions_updated BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id, updated_at DESC);

-- chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);

-- checkins
CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('morning','evening','moment')),
  energy integer,
  mood integer,
  sleep_hours numeric(3,1),
  intent text,
  note text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins select" ON public.checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own checkins insert" ON public.checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checkins update" ON public.checkins FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own checkins delete" ON public.checkins FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_checkins_user_time ON public.checkins(user_id, created_at DESC);

-- profiles extension
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ru',
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

-- avatars bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars own upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE USING (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE USING (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);