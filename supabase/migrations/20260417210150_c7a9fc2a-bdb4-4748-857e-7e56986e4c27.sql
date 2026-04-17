CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(user_id uuid, email text, display_name text, avatar_url text, language text, ai_tone text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, deleted_at timestamp with time zone, is_admin boolean, checkins_count bigint, pings_count bigint, sleep_count bigint, avg_mood numeric, achievements_count bigint, last_activity timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    p.user_id,
    u.email::TEXT,
    p.display_name,
    p.avatar_url,
    p.language,
    p.ai_tone,
    u.created_at AS created_at,
    u.last_sign_in_at,
    p.deleted_at,
    public.has_role(p.user_id, 'admin') AS is_admin,
    (SELECT COUNT(*) FROM public.checkins c WHERE c.user_id = p.user_id) AS checkins_count,
    (SELECT COUNT(*) FROM public.mood_pings mp WHERE mp.user_id = p.user_id) AS pings_count,
    (SELECT COUNT(*) FROM public.sleep_sessions s WHERE s.user_id = p.user_id) AS sleep_count,
    (SELECT ROUND(AVG(mp.mood)::NUMERIC, 2) FROM public.mood_pings mp WHERE mp.user_id = p.user_id) AS avg_mood,
    (SELECT COUNT(*) FROM public.user_achievements ua WHERE ua.user_id = p.user_id) AS achievements_count,
    GREATEST(
      COALESCE((SELECT MAX(mp.created_at) FROM public.mood_pings mp WHERE mp.user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(c.created_at) FROM public.checkins c WHERE c.user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(s.started_at) FROM public.sleep_sessions s WHERE s.user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE(u.last_sign_in_at, 'epoch'::timestamptz)
    ) AS last_activity
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY u.created_at DESC;
END $function$;