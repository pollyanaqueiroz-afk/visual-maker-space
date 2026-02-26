
-- Add delivery_token column to briefing_images
ALTER TABLE public.briefing_images ADD COLUMN delivery_token uuid DEFAULT gen_random_uuid();

-- Create briefing_deliveries table
CREATE TABLE public.briefing_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_image_id uuid NOT NULL REFERENCES public.briefing_images(id),
  file_url text NOT NULL,
  comments text,
  delivered_by_email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.briefing_deliveries ENABLE ROW LEVEL SECURITY;

-- Public INSERT policy (designers submit without login)
CREATE POLICY "Anyone can create deliveries" ON public.briefing_deliveries
  FOR INSERT WITH CHECK (true);

-- Public SELECT policy
CREATE POLICY "Anyone can view deliveries" ON public.briefing_deliveries
  FOR SELECT USING (true);

-- Also allow public SELECT on briefing_images by delivery_token (for the delivery page)
-- The existing policy already allows authenticated SELECT; we need anon access via token
-- We'll handle this by querying with the anon key which has the existing permissive policies
