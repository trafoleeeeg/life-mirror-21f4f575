CREATE TABLE public.user_dossier (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  summary TEXT,
  patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  values_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  last_auto_update_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dossier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own dossier select" ON public.user_dossier FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own dossier insert" ON public.user_dossier FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own dossier update" ON public.user_dossier FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own dossier delete" ON public.user_dossier FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "admins read dossier" ON public.user_dossier FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_dossier_updated_at
  BEFORE UPDATE ON public.user_dossier
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track learn progress (Duolingo-like)
CREATE TABLE public.learn_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  section_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'learned',
  learned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_slug)
);

ALTER TABLE public.learn_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learn select" ON public.learn_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own learn insert" ON public.learn_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own learn delete" ON public.learn_progress FOR DELETE USING (auth.uid() = user_id);