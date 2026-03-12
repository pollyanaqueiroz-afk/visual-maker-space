CREATE POLICY "Authenticated users can delete briefing images"
ON public.briefing_images
FOR DELETE
TO authenticated
USING (true);