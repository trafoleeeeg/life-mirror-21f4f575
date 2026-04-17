DROP POLICY IF EXISTS "Avatars: public read individual files" ON storage.objects;

-- Owner-only listing/SELECT through API. Public reads of individual files
-- continue to work via the public CDN (which bypasses RLS for public buckets).
CREATE POLICY "Avatars: owner can list own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);