-- Add campo dados_preenchidos to store client-entered data for each checklist item
ALTER TABLE public.app_checklist_items 
ADD COLUMN IF NOT EXISTS dados_preenchidos text;

-- Add campo updated_at for tracking modifications
ALTER TABLE public.app_checklist_items 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create table for checklist item edit history
CREATE TABLE IF NOT EXISTS public.app_checklist_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid REFERENCES public.app_checklist_items(id) ON DELETE CASCADE NOT NULL,
  dados_anteriores text,
  dados_novos text,
  editado_por text NOT NULL DEFAULT 'cliente',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_checklist_historico ENABLE ROW LEVEL SECURITY;

-- RLS policies for history table
CREATE POLICY "Equipe acessa app_checklist_historico" ON public.app_checklist_historico
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Portal cliente le historico" ON public.app_checklist_historico
  FOR SELECT USING (true);