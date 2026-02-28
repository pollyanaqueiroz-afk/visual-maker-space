
-- Table for client interaction history (notes, calls, meetings)
CREATE TABLE public.client_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  content TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by client
CREATE INDEX idx_client_interactions_client_id ON public.client_interactions(client_id);

-- RLS
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view interactions"
  ON public.client_interactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create interactions"
  ON public.client_interactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update interactions"
  ON public.client_interactions FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete interactions"
  ON public.client_interactions FOR DELETE
  USING (true);
