
ALTER TABLE public.briefing_adjustments 
ADD COLUMN source_briefing_image_id uuid REFERENCES public.briefing_images(id) ON DELETE SET NULL DEFAULT NULL;

COMMENT ON COLUMN public.briefing_adjustments.source_briefing_image_id IS 'Links this adjustment to the original briefing image for revision tracking';
