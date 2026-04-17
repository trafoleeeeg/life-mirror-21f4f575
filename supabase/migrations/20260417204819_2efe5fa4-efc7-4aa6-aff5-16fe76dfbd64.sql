-- Таблица для хранения утренних прогнозов настроения и фактической точности
CREATE TABLE public.mood_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  predicted NUMERIC(3,1) NOT NULL,
  baseline NUMERIC(3,1) NOT NULL,
  -- Список сущностей с их вкладами на момент прогноза:
  -- [{ "id": "...", "label": "...", "type": "...", "delta": 0.8 }]
  contributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  morning_text TEXT,
  -- Заполняется вечером
  actual NUMERIC(3,1),
  actual_n INTEGER,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

CREATE INDEX idx_mood_forecasts_user_day ON public.mood_forecasts (user_id, day DESC);

ALTER TABLE public.mood_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own forecasts select"
  ON public.mood_forecasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own forecasts insert"
  ON public.mood_forecasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own forecasts update"
  ON public.mood_forecasts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "own forecasts delete"
  ON public.mood_forecasts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "admins read mood_forecasts"
  ON public.mood_forecasts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_mood_forecasts_updated_at
  BEFORE UPDATE ON public.mood_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();