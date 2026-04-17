-- Entities extracted from user content
CREATE TABLE public.graph_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('person','event','topic','emotion')),
  label text NOT NULL,
  mentions integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, label)
);

ALTER TABLE public.graph_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own entities select" ON public.graph_entities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own entities insert" ON public.graph_entities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entities update" ON public.graph_entities
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own entities delete" ON public.graph_entities
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_graph_entities_user ON public.graph_entities(user_id);

-- Edges between entities
CREATE TABLE public.graph_edges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  a_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  b_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  strength numeric NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (a_id <> b_id),
  UNIQUE (user_id, a_id, b_id)
);

ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own edges select" ON public.graph_edges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own edges insert" ON public.graph_edges
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own edges update" ON public.graph_edges
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own edges delete" ON public.graph_edges
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_graph_edges_user ON public.graph_edges(user_id);