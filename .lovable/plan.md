

# Fix: Storage Bucket MIME Type Allowlist

## Problem
The `briefing-uploads` storage bucket only allows these MIME types:
- image/jpeg, image/png, image/gif, image/webp, image/svg+xml
- application/pdf, docx, xlsx, doc, xls

Missing types that the client-side code expects:
- `application/zip`
- `application/x-zip-compressed`
- `application/octet-stream`
- `application/postscript` (AI files)
- `image/vnd.adobe.photoshop` (PSD files)
- `image/bmp`, `image/tiff`

## Solution
Run a single SQL migration to update the bucket's `allowed_mime_types` to include all formats the client supports:

```sql
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
]
WHERE name = 'briefing-uploads';
```

Also increase `file_size_limit` from 10MB to 52428800 (50MB) since brand files (ZIPs with PSDs) can be large.

No frontend code changes needed.

