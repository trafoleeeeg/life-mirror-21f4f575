-- Таблица одноразовых кодов для desktop OAuth
CREATE TABLE public.desktop_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_desktop_auth_codes_code ON public.desktop_auth_codes(code);
CREATE INDEX idx_desktop_auth_codes_expires ON public.desktop_auth_codes(expires_at);

ALTER TABLE public.desktop_auth_codes ENABLE ROW LEVEL SECURITY;

-- Только сам пользователь может создавать коды (для своего user_id)
CREATE POLICY "users insert own desktop codes"
ON public.desktop_auth_codes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Никаких SELECT/UPDATE/DELETE для обычных юзеров — обмен идёт через service role
-- (отсутствие политик = запрет)

-- Очистка просроченных кодов (вызывается из edge function)
CREATE OR REPLACE FUNCTION public.cleanup_expired_desktop_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.desktop_auth_codes
  WHERE expires_at < now() - interval '5 minutes';
$$;