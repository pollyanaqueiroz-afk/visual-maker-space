
-- Table for adjustment requests
CREATE TABLE public.briefing_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_url TEXT NOT NULL,
  client_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_email TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for individual adjustment items (image + observation)
CREATE TABLE public.briefing_adjustment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_id UUID NOT NULL REFERENCES public.briefing_adjustments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.briefing_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefing_adjustment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for adjustments
CREATE POLICY "Authenticated users can view adjustments"
  ON public.briefing_adjustments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create adjustments"
  ON public.briefing_adjustments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update adjustments"
  ON public.briefing_adjustments FOR UPDATE TO authenticated USING (true);

-- RLS policies for adjustment items
CREATE POLICY "Authenticated users can view adjustment items"
  ON public.briefing_adjustment_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create adjustment items"
  ON public.briefing_adjustment_items FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_briefing_adjustments_updated_at
  BEFORE UPDATE ON public.briefing_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
