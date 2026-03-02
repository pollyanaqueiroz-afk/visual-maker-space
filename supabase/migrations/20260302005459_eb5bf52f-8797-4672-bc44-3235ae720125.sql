
DELETE FROM app_notificacoes WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_conversas WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_assets WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_formulario WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_prerequisitos WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_checklist_items WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_fases WHERE cliente_id IN (SELECT id FROM app_clientes);
DELETE FROM app_clientes;
