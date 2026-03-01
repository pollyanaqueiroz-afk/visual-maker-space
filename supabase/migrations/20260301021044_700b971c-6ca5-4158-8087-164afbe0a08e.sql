
-- Create kanban_boards table
CREATE TABLE public.kanban_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create kanban_card_positions to track client positions per board
CREATE TABLE public.kanban_card_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(board_id, client_id)
);

-- Add board_id to kanban_columns
ALTER TABLE public.kanban_columns ADD COLUMN board_id UUID REFERENCES public.kanban_boards(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_positions ENABLE ROW LEVEL SECURITY;

-- RLS for kanban_boards
CREATE POLICY "Authenticated users can view kanban boards" ON public.kanban_boards FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create kanban boards" ON public.kanban_boards FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update kanban boards" ON public.kanban_boards FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete kanban boards" ON public.kanban_boards FOR DELETE USING (true);

-- RLS for kanban_card_positions
CREATE POLICY "Authenticated users can view card positions" ON public.kanban_card_positions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage card positions" ON public.kanban_card_positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update card positions" ON public.kanban_card_positions FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete card positions" ON public.kanban_card_positions FOR DELETE USING (true);
