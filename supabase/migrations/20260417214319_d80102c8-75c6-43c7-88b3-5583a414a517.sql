
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Взамен: при удалении auth.users каскадно удаляем profile (только реальных юзеров)
CREATE OR REPLACE FUNCTION public.on_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE user_id = OLD.id AND is_demo = false;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_deleted();
