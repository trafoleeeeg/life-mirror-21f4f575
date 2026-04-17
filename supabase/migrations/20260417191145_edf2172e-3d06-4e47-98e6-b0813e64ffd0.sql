-- Sleep Cycle tables
CREATE TABLE public.sleep_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  wake_window_start TIMESTAMP WITH TIME ZONE,
  wake_window_end TIMESTAMP WITH TIME ZONE,
  woken_at TIMESTAMP WITH TIME ZONE,
  smart_wake BOOLEAN NOT NULL DEFAULT true,
  quality SMALLINT,
  interruptions INTEGER NOT NULL DEFAULT 0,
  avg_loudness NUMERIC(6,3),
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sleep_sessions_user_started ON public.sleep_sessions(user_id, started_at DESC);

ALTER TABLE public.sleep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sleep sessions select" ON public.sleep_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sleep sessions insert" ON public.sleep_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sleep sessions update" ON public.sleep_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sleep sessions delete" ON public.sleep_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_sleep_sessions_updated
BEFORE UPDATE ON public.sleep_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase events captured during a session
CREATE TABLE public.sleep_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sleep_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL CHECK (event_type IN ('silence','movement','snore','noise')),
  magnitude NUMERIC(6,3) NOT NULL DEFAULT 0
);

CREATE INDEX idx_sleep_events_session_ts ON public.sleep_events(session_id, ts);

ALTER TABLE public.sleep_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sleep events select" ON public.sleep_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sleep events insert" ON public.sleep_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sleep events delete" ON public.sleep_events FOR DELETE USING (auth.uid() = user_id);