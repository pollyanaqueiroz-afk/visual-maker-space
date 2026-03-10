
ALTER TABLE public.briefing_adjustments
ADD COLUMN IF NOT EXISTS delivery_url text,
ADD COLUMN IF NOT EXISTS delivery_comments text,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivered_by text;
