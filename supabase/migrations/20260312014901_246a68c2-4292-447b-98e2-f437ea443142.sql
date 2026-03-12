-- Allow deleting reference images, deliveries, and reviews for cleanup
CREATE POLICY "Authenticated users can delete reference images"
ON public.briefing_reference_images
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete deliveries"
ON public.briefing_deliveries
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete reviews"
ON public.briefing_reviews
FOR DELETE
TO authenticated
USING (true);