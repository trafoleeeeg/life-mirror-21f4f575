-- 1. Расширяем profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 2. Расширяем posts: картинка + репост
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS reposted_from UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repost_quote TEXT;

-- 3. Таблица эмодзи-реакций (5 типов: heart, fire, thought, hug, sad)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('heart','fire','thought','hug','sad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions read all auth"
  ON public.post_reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "reactions insert own"
  ON public.post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions delete own"
  ON public.post_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

-- 4. Публичные профили: новое представление с username/bio/is_demo
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  user_id,
  display_name,
  username,
  avatar_url,
  bio,
  is_demo,
  created_at
FROM public.profiles
WHERE deleted_at IS NULL;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 5. Разрешаем авторизованным читать публичные поля любых профилей
CREATE POLICY "authenticated read public profile fields"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- 6. Разрешаем демо-постам существовать без user_id (уже есть is_ai),
-- добавляем фильтр для удаления демо только сервисом
DROP POLICY IF EXISTS "posts delete own" ON public.posts;
CREATE POLICY "posts delete own"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id AND is_ai = false);

-- 7. Realtime для реакций
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;