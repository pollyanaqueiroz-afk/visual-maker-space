ALTER TABLE public.briefing_images
ADD COLUMN assigned_email text,
ADD COLUMN deadline timestamp with time zone;