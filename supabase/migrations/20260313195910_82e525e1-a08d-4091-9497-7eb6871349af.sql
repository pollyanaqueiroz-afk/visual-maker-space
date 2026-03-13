
-- Delete duplicate clients (keeping the more complete record)
DELETE FROM clients WHERE id IN (
  'a819dde1-6469-46f9-ba42-6e2e2d3a4ef9',  -- dorsemfronteiras dupe (no cs_atual)
  '088aeef2-880d-4292-83b0-8a57371469fa',  -- ecco dupe (no cs_atual)
  'd4fe3fe7-2e96-4e6b-8a8b-1f8a6a5f6183',  -- juveracademy dupe (no cs_atual)
  '402f9c32-efc5-4b60-bc1c-542aab9a7f74',  -- percursus dupe (no cs_atual, no plano)
  'b7e500af-302b-4e2f-ab80-cb6f2c64c967'   -- spbim dupe (newer, same data)
);
