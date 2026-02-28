DROP INDEX IF EXISTS clients_id_curseduca_unique;
ALTER TABLE public.clients ADD CONSTRAINT clients_id_curseduca_unique UNIQUE (id_curseduca);