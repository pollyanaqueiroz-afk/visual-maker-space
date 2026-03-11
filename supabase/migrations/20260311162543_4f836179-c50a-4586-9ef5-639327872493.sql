-- Seed default permissions for migrador role
INSERT INTO public.role_permissions (role, permission) VALUES
  ('migrador', 'migracao.view'),
  ('migrador', 'migracao.manage'),
  ('migrador', 'migracao.validate'),
  ('migrador', 'migracao.move_cards'),
  ('migrador', 'migracao.send_feedback')
ON CONFLICT DO NOTHING;

-- Also add granular migration permissions for admin and implantacao
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'migracao.validate'),
  ('admin', 'migracao.move_cards'),
  ('admin', 'migracao.send_feedback'),
  ('implantacao', 'migracao.validate'),
  ('implantacao', 'migracao.move_cards'),
  ('implantacao', 'migracao.send_feedback'),
  ('cs', 'migracao.view')
ON CONFLICT DO NOTHING;