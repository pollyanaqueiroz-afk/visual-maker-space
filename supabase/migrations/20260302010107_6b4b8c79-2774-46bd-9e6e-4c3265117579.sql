
-- Add aplicativos.edit permission for admin, gerente_implantacao, implantacao
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'aplicativos.edit'),
  ('gerente_implantacao', 'aplicativos.edit'),
  ('gerente_implantacao', 'aplicativos.view'),
  ('implantacao', 'aplicativos.edit'),
  ('implantacao', 'aplicativos.view')
ON CONFLICT DO NOTHING;
