
-- Remove the anonymous SELECT policy that exposes reviewer emails
DROP POLICY IF EXISTS "Anon can view reviews" ON public.briefing_reviews;
