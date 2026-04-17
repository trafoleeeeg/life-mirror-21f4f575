-- Posts, comments, likes for community feed
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'breakthrough',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts read all auth" ON public.posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "posts insert own" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts update own" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts delete own" ON public.posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "admins read posts" ON public.posts FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_posts_category ON public.posts(category);

CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read all auth" ON public.post_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "comments insert own" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments update own" ON public.post_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments delete own" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_comments_post ON public.post_comments(post_id, created_at);

CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes read all auth" ON public.post_likes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "likes insert own" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes delete own" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_likes_post ON public.post_likes(post_id);