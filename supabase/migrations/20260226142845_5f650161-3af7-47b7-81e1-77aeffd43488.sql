
-- Add status column to briefing_images with same enum as requests
ALTER TABLE public.briefing_images
ADD COLUMN status request_status NOT NULL DEFAULT 'pending';
