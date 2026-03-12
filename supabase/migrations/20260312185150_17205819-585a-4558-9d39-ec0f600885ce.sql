
CREATE POLICY "Anon upload migration files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'migration-uploads');
