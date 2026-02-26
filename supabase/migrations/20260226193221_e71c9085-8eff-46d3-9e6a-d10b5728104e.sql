
-- Brand assets table for storing reference images per platform/brand
CREATE TABLE public.brand_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_url TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_by TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'delivery')),
  briefing_image_id UUID REFERENCES public.briefing_images(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view brand assets" ON public.brand_assets FOR SELECT USING (true);
CREATE POLICY "Anyone can create brand assets" ON public.brand_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete brand assets" ON public.brand_assets FOR DELETE USING (true);
