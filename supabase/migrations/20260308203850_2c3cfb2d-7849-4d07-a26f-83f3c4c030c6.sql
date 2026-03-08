-- Indexes para briefing_images
CREATE INDEX IF NOT EXISTS idx_briefing_images_status ON briefing_images(status);
CREATE INDEX IF NOT EXISTS idx_briefing_images_request_id ON briefing_images(request_id);
CREATE INDEX IF NOT EXISTS idx_briefing_images_assigned_email ON briefing_images(assigned_email);
CREATE INDEX IF NOT EXISTS idx_briefing_images_image_type ON briefing_images(image_type);
CREATE INDEX IF NOT EXISTS idx_briefing_images_created_at ON briefing_images(created_at DESC);

-- Indexes para briefing_requests
CREATE INDEX IF NOT EXISTS idx_briefing_requests_requester_email ON briefing_requests(requester_email);
CREATE INDEX IF NOT EXISTS idx_briefing_requests_platform_url ON briefing_requests(platform_url);

-- Indexes para briefing_reviews
CREATE INDEX IF NOT EXISTS idx_briefing_reviews_image_id ON briefing_reviews(briefing_image_id);
CREATE INDEX IF NOT EXISTS idx_briefing_reviews_reviewed_by ON briefing_reviews(reviewed_by);

-- Indexes para briefing_deliveries
CREATE INDEX IF NOT EXISTS idx_briefing_deliveries_image_id ON briefing_deliveries(briefing_image_id);

-- Indexes para brand_assets
CREATE INDEX IF NOT EXISTS idx_brand_assets_platform_url ON brand_assets(platform_url);
CREATE INDEX IF NOT EXISTS idx_brand_assets_image_id ON brand_assets(briefing_image_id);

-- Indexes para app_checklist_items
CREATE INDEX IF NOT EXISTS idx_app_checklist_cliente ON app_checklist_items(cliente_id);
CREATE INDEX IF NOT EXISTS idx_app_checklist_fase ON app_checklist_items(fase_numero);
CREATE INDEX IF NOT EXISTS idx_app_checklist_ator ON app_checklist_items(ator);
CREATE INDEX IF NOT EXISTS idx_app_checklist_responsavel ON app_checklist_items(responsavel);

-- Indexes para app_fases
CREATE INDEX IF NOT EXISTS idx_app_fases_cliente ON app_fases(cliente_id);
CREATE INDEX IF NOT EXISTS idx_app_fases_status ON app_fases(status);

-- Indexes para app_clientes
CREATE INDEX IF NOT EXISTS idx_app_clientes_email ON app_clientes(email);
CREATE INDEX IF NOT EXISTS idx_app_clientes_empresa ON app_clientes(empresa);
CREATE INDEX IF NOT EXISTS idx_app_clientes_status ON app_clientes(status);

-- Unique constraint para evitar brand_assets duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_assets_unique_image 
ON brand_assets(briefing_image_id) 
WHERE briefing_image_id IS NOT NULL;