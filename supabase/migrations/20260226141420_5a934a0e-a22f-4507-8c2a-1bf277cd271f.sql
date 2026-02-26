
-- Drop restrictive policies and recreate as permissive for briefing_requests
DROP POLICY IF EXISTS "Anyone can create briefing requests" ON public.briefing_requests;
CREATE POLICY "Anyone can create briefing requests" ON public.briefing_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Drop restrictive policies and recreate as permissive for briefing_images
DROP POLICY IF EXISTS "Anyone can create briefing images" ON public.briefing_images;
CREATE POLICY "Anyone can create briefing images" ON public.briefing_images FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Drop restrictive policies and recreate as permissive for briefing_reference_images
DROP POLICY IF EXISTS "Anyone can create reference images" ON public.briefing_reference_images;
CREATE POLICY "Anyone can create reference images" ON public.briefing_reference_images FOR INSERT TO anon, authenticated WITH CHECK (true);
