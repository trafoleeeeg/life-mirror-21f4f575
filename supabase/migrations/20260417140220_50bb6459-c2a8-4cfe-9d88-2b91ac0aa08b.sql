
-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  ai_tone TEXT NOT NULL DEFAULT 'soft' CHECK (ai_tone IN ('soft','hard','socratic')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Glyph stats: 8 axes 0..100 (game-like life stats)
CREATE TABLE public.glyph_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  body INT NOT NULL DEFAULT 50 CHECK (body BETWEEN 0 AND 100),
  mind INT NOT NULL DEFAULT 50 CHECK (mind BETWEEN 0 AND 100),
  emotions INT NOT NULL DEFAULT 50 CHECK (emotions BETWEEN 0 AND 100),
  relationships INT NOT NULL DEFAULT 50 CHECK (relationships BETWEEN 0 AND 100),
  career INT NOT NULL DEFAULT 50 CHECK (career BETWEEN 0 AND 100),
  finance INT NOT NULL DEFAULT 50 CHECK (finance BETWEEN 0 AND 100),
  creativity INT NOT NULL DEFAULT 50 CHECK (creativity BETWEEN 0 AND 100),
  meaning INT NOT NULL DEFAULT 50 CHECK (meaning BETWEEN 0 AND 100)
);
ALTER TABLE public.glyph_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stats" ON public.glyph_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON public.glyph_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.glyph_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stats" ON public.glyph_stats FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_glyph_stats_user_recorded ON public.glyph_stats(user_id, recorded_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + initial glyph_stats on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.glyph_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
