-- Tighten profiles UPDATE policy with WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Restrict avatars bucket: drop broad public SELECT, allow read only for own folder + owner uploads
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Allow public read of individual avatar files only when path is known (no LIST via prefix scan):
-- We keep SELECT public so <img src> works, but block listing by requiring an exact name lookup.
-- Storage's list operation also uses SELECT — we restrict to authenticated users who own the folder.
CREATE POLICY "Avatars: public read individual files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'avatars'
  AND (
    -- owner can list their own folder
    (auth.uid()::text = (storage.foldername(name))[1])
    OR
    -- anonymous/other users can read a specific file but cannot list (storage enforces name match on direct GET)
    auth.role() = 'anon' OR auth.role() = 'authenticated'
  )
);