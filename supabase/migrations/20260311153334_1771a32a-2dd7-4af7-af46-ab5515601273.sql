
-- Migration Projects
CREATE TABLE public.migration_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_url TEXT NOT NULL,
  platform_origin TEXT NOT NULL DEFAULT 'hotmart',
  has_migration BOOLEAN DEFAULT false,
  has_app BOOLEAN DEFAULT false,
  has_design BOOLEAN DEFAULT false,
  migration_status TEXT DEFAULT 'waiting_form',
  portal_token UUID DEFAULT gen_random_uuid(),
  created_by UUID,
  cs_responsible TEXT,
  migrator_observations TEXT,
  cs_observations TEXT,
  rejected_tag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.migration_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read migration_projects" ON public.migration_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write migration_projects" ON public.migration_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update migration_projects" ON public.migration_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete migration_projects" ON public.migration_projects FOR DELETE TO authenticated USING (true);

-- Migration Form Submissions
CREATE TABLE public.migration_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.migration_projects(id) ON DELETE CASCADE NOT NULL,
  api_client_id TEXT,
  api_client_secret TEXT,
  api_basic TEXT,
  members_spreadsheet_url TEXT,
  members_spreadsheet_name TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_resubmission BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.migration_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read form_submissions" ON public.migration_form_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write form_submissions" ON public.migration_form_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update form_submissions" ON public.migration_form_submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Migration Clubs
CREATE TABLE public.migration_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.migration_form_submissions(id) ON DELETE CASCADE NOT NULL,
  club_name TEXT,
  club_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.migration_clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read clubs" ON public.migration_clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write clubs" ON public.migration_clubs FOR INSERT TO authenticated WITH CHECK (true);

-- Migration Validations
CREATE TABLE public.migration_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.migration_projects(id) ON DELETE CASCADE NOT NULL,
  item_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  observation TEXT,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.migration_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read validations" ON public.migration_validations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write validations" ON public.migration_validations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update validations" ON public.migration_validations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Migration Status History
CREATE TABLE public.migration_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.migration_projects(id) ON DELETE CASCADE NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.migration_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read history" ON public.migration_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write history" ON public.migration_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for migration files
INSERT INTO storage.buckets (id, name, public) VALUES ('migration-uploads', 'migration-uploads', true);

-- Storage policies
CREATE POLICY "Auth upload migration files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'migration-uploads');
CREATE POLICY "Anyone read migration files" ON storage.objects FOR SELECT USING (bucket_id = 'migration-uploads');
CREATE POLICY "Auth delete migration files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'migration-uploads');
