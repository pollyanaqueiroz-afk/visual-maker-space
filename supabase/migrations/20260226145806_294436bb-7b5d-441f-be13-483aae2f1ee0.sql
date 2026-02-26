
-- Table to track review decisions (approve/reject) with full history
CREATE TABLE public.briefing_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_image_id uuid NOT NULL REFERENCES public.briefing_images(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'revision_requested')),
  reviewer_comments text,
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only authenticated users can insert/view reviews
ALTER TABLE public.briefing_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create reviews"
  ON public.briefing_reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view reviews"
  ON public.briefing_reviews FOR SELECT
  USING (true);
