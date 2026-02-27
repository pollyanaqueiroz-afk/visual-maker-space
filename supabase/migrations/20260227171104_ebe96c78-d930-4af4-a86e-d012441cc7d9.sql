
-- Set 10MB file size limit on the bucket
UPDATE storage.buckets 
SET file_size_limit = 10485760
WHERE id = 'briefing-uploads';

-- Set allowed MIME types (images and common document types only)
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel'
]
WHERE id = 'briefing-uploads';

-- Replace overly broad upload policy with path-restricted one
DROP POLICY IF EXISTS "Anyone can upload briefing files" ON storage.objects;

CREATE POLICY "Uploads restricted to known folders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'briefing-uploads'
    AND (
      name LIKE 'references/%'
      OR name LIKE 'brands/%'
      OR name LIKE 'deliveries/%'
      OR name LIKE 'photos/%'
      OR name LIKE 'brand-assets/%'
    )
  );
