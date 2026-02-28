
-- Table to store granular permissions per role
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read permissions (needed for UI guards)
CREATE POLICY "Authenticated users can view permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage permissions
CREATE POLICY "Admins can insert permissions"
  ON public.role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete permissions"
  ON public.role_permissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default permissions for admin (all permissions)
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'briefings.view'),
  ('admin', 'briefings.create'),
  ('admin', 'briefings.edit'),
  ('admin', 'briefings.delete'),
  ('admin', 'briefings.assign'),
  ('admin', 'agendamento.view'),
  ('admin', 'agendamento.create'),
  ('admin', 'agendamento.edit'),
  ('admin', 'agendamento.delete'),
  ('admin', 'dashboards.view'),
  ('admin', 'carteira.view'),
  ('admin', 'carteira.edit'),
  ('admin', 'carteira.import'),
  ('admin', 'kanban.view'),
  ('admin', 'kanban.edit'),
  ('admin', 'kanban.manage_columns'),
  ('admin', 'lideranca.view'),
  ('admin', 'admin.view'),
  ('admin', 'admin.manage_users'),
  ('admin', 'admin.manage_permissions');
