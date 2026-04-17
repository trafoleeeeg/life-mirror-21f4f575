-- 1) profiles: убрать широкий read для authenticated
DROP POLICY IF EXISTS "authenticated read public profile fields" ON public.profiles;

-- public_profiles view уже существует и покрывает безопасные поля для чтения.
-- Убедимся, что он доступен на чтение authenticated/anon.
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2) storage.objects: добавить UPDATE policy для post-images
DROP POLICY IF EXISTS "Users can update their own post images" ON storage.objects;
CREATE POLICY "Users can update their own post images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) has_role: запретить проверку чужих ролей
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND _user_id = auth.uid()
  )
$function$;