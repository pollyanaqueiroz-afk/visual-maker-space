
-- Kanban columns table (user-defined columns)
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view kanban columns"
  ON public.kanban_columns FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage kanban columns"
  ON public.kanban_columns FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update kanban columns"
  ON public.kanban_columns FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete kanban columns"
  ON public.kanban_columns FOR DELETE USING (true);

-- Add kanban_column_id to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS kanban_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL;

-- Insert default columns
INSERT INTO public.kanban_columns (title, color, sort_order) VALUES
  ('Novo', '#6366f1', 0),
  ('Onboarding', '#f59e0b', 1),
  ('Ativo', '#10b981', 2),
  ('Em Risco', '#ef4444', 3);
