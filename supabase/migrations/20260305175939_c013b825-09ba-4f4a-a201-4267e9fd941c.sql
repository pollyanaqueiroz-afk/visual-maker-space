
-- Create scorm_packages table
CREATE TABLE public.scorm_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  entry_point text NOT NULL,
  storage_path text NOT NULL,
  file_count integer NOT NULL DEFAULT 0,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scorm_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view scorm packages"
  ON public.scorm_packages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scorm packages"
  ON public.scorm_packages FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scorm packages"
  ON public.scorm_packages FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete scorm packages"
  ON public.scorm_packages FOR DELETE TO authenticated
  USING (true);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('scorm-packages', 'scorm-packages', true);

-- Storage RLS: authenticated can upload
CREATE POLICY "Authenticated users can upload scorm files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scorm-packages');

-- Storage RLS: public read
CREATE POLICY "Anyone can read scorm files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'scorm-packages');

-- Storage RLS: authenticated can delete
CREATE POLICY "Authenticated users can delete scorm files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scorm-packages');
