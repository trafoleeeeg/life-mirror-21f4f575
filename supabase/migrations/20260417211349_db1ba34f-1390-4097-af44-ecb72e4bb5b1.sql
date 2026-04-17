-- Allow AI-authored posts (no user_id)
ALTER TABLE public.posts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.posts ADD COLUMN is_ai BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN ai_author TEXT;

-- AI posts are visible to all authenticated users
DROP POLICY IF EXISTS "posts read all auth" ON public.posts;
CREATE POLICY "posts read all auth" ON public.posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Block users from inserting AI posts directly (only service role can)
DROP POLICY IF EXISTS "posts insert own" ON public.posts;
CREATE POLICY "posts insert own" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ai = false);

-- Users cannot modify AI posts
DROP POLICY IF EXISTS "posts update own" ON public.posts;
CREATE POLICY "posts update own" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id AND is_ai = false);

DROP POLICY IF EXISTS "posts delete own" ON public.posts;
CREATE POLICY "posts delete own" ON public.posts
  FOR DELETE USING (auth.uid() = user_id AND is_ai = false);

-- Replica identity FULL for realtime (gets full row on UPDATE/DELETE)
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;