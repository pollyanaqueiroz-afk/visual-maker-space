CREATE TABLE public.client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id_curseduca text NOT NULL,
  client_name text,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'cs',
  status text NOT NULL DEFAULT 'na_fila',
  requested_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client_projects"
  ON public.client_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client_projects"
  ON public.client_projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_projects"
  ON public.client_projects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete client_projects"
  ON public.client_projects FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_client_projects_updated_at
  BEFORE UPDATE ON public.client_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();