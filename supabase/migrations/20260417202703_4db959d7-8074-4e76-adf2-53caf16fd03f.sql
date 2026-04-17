
ALTER TABLE public.graph_entities
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS custom_label TEXT;

CREATE INDEX IF NOT EXISTS idx_graph_entities_user_pinned ON public.graph_entities(user_id, pinned) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS idx_graph_entities_user_hidden ON public.graph_entities(user_id, hidden);

CREATE OR REPLACE FUNCTION public.merge_graph_entities(_keep UUID, _drop UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID;
  _drop_user UUID;
  _keep_mentions INT;
  _drop_mentions INT;
  _drop_last TIMESTAMPTZ;
BEGIN
  SELECT user_id, mentions INTO _user, _keep_mentions FROM public.graph_entities WHERE id = _keep;
  SELECT user_id, mentions, last_seen_at INTO _drop_user, _drop_mentions, _drop_last FROM public.graph_entities WHERE id = _drop;

  IF _user IS NULL OR _drop_user IS NULL THEN
    RAISE EXCEPTION 'Entity not found';
  END IF;
  IF _user <> _drop_user OR _user <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Re-point edges from _drop to _keep
  UPDATE public.graph_edges SET a_id = _keep WHERE a_id = _drop AND user_id = _user;
  UPDATE public.graph_edges SET b_id = _keep WHERE b_id = _drop AND user_id = _user;

  -- Remove self-loops created by merge
  DELETE FROM public.graph_edges WHERE a_id = b_id AND user_id = _user;

  -- Collapse duplicate edges (sum strength, keep latest last_seen_at)
  WITH ranked AS (
    SELECT id,
      LEAST(a_id, b_id) AS lo,
      GREATEST(a_id, b_id) AS hi,
      ROW_NUMBER() OVER (PARTITION BY LEAST(a_id, b_id), GREATEST(a_id, b_id) ORDER BY last_seen_at DESC) AS rn,
      SUM(strength) OVER (PARTITION BY LEAST(a_id, b_id), GREATEST(a_id, b_id)) AS total_strength,
      MAX(last_seen_at) OVER (PARTITION BY LEAST(a_id, b_id), GREATEST(a_id, b_id)) AS max_last
    FROM public.graph_edges
    WHERE user_id = _user
  )
  UPDATE public.graph_edges e
  SET strength = r.total_strength, last_seen_at = r.max_last
  FROM ranked r
  WHERE e.id = r.id AND r.rn = 1;

  DELETE FROM public.graph_edges e
  USING (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY LEAST(a_id, b_id), GREATEST(a_id, b_id) ORDER BY last_seen_at DESC) AS rn
    FROM public.graph_edges WHERE user_id = _user
  ) d
  WHERE e.id = d.id AND d.rn > 1;

  -- Merge mentions and last_seen
  UPDATE public.graph_entities
  SET mentions = _keep_mentions + COALESCE(_drop_mentions, 0),
      last_seen_at = GREATEST(last_seen_at, COALESCE(_drop_last, last_seen_at))
  WHERE id = _keep;

  DELETE FROM public.graph_entities WHERE id = _drop;
END;
$$;
