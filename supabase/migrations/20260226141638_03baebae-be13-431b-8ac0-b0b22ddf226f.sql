
-- Grant INSERT to anon and authenticated on briefing tables
GRANT INSERT ON public.briefing_requests TO anon, authenticated;
GRANT SELECT ON public.briefing_requests TO authenticated;
GRANT UPDATE ON public.briefing_requests TO authenticated;

GRANT INSERT ON public.briefing_images TO anon, authenticated;
GRANT SELECT ON public.briefing_images TO authenticated;
GRANT UPDATE ON public.briefing_images TO authenticated;

GRANT INSERT ON public.briefing_reference_images TO anon, authenticated;
GRANT SELECT ON public.briefing_reference_images TO authenticated;
