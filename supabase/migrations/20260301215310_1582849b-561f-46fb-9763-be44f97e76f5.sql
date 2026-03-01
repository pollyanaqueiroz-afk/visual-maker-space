INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'aplicativos.view'),
  ('admin', 'aplicativos.edit'),
  ('admin', 'aplicativos.designer'),
  ('implantacao', 'aplicativos.view'),
  ('implantacao', 'aplicativos.edit'),
  ('gerente_implantacao', 'aplicativos.view'),
  ('gerente_implantacao', 'aplicativos.edit'),
  ('designer', 'aplicativos.view'),
  ('designer', 'aplicativos.designer')
ON CONFLICT DO NOTHING;