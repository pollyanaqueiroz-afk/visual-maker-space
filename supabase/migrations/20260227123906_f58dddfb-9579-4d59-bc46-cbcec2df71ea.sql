
-- Allow anon users to SELECT briefing_images (for client review portal)
CREATE POLICY "Anon can view briefing images" ON public.briefing_images
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to SELECT briefing_deliveries (already exists for anyone, but ensure anon)
-- Already has "Anyone can view deliveries" policy

-- Allow anon users to INSERT briefing_reviews (for client approval/rejection)
CREATE POLICY "Anyone can create reviews" ON public.briefing_reviews
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to UPDATE briefing_images (for status changes from client review)
CREATE POLICY "Anon can update briefing images" ON public.briefing_images
  FOR UPDATE
  TO anon
  USING (true);

-- Allow anon to SELECT briefing_requests (to join for requester_email lookup)
CREATE POLICY "Anon can view briefing requests" ON public.briefing_requests
  FOR SELECT
  TO anon
  USING (true);

-- Grant necessary permissions to anon role
GRANT SELECT ON public.briefing_images TO anon;
GRANT UPDATE ON public.briefing_images TO anon;
GRANT INSERT ON public.briefing_reviews TO anon;
GRANT SELECT ON public.briefing_requests TO anon;
GRANT SELECT ON public.briefing_deliveries TO anon;
