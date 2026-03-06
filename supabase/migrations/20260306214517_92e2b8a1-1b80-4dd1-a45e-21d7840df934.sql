
INSERT INTO public.role_permissions (role, permission)
VALUES 
  ('cs', 'carteira.view'),
  ('cs', 'dashboards.view')
ON CONFLICT DO NOTHING;
