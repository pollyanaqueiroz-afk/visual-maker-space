
CREATE POLICY "Authenticated users can upload to briefing-uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'briefing-uploads');

CREATE POLICY "Authenticated users can read briefing-uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'briefing-uploads');

CREATE POLICY "Anon users can read briefing-uploads"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'briefing-uploads');
