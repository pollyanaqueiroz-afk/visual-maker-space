UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'image/bmp','image/tiff','image/vnd.adobe.photoshop',
  'application/pdf','application/postscript',
  'application/zip','application/x-zip-compressed','application/octet-stream',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword','application/vnd.ms-excel',
  'application/x-rar-compressed'
],
file_size_limit = 52428800
WHERE name = 'briefing-uploads';