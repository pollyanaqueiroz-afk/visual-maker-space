ALTER TABLE scorm_packages ADD COLUMN IF NOT EXISTS platform_url TEXT;
ALTER TABLE scorm_packages ADD COLUMN IF NOT EXISTS client_name TEXT;
CREATE INDEX IF NOT EXISTS idx_scorm_packages_platform_url ON scorm_packages(platform_url);