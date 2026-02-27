
-- Function to list columns of the clients table
CREATE OR REPLACE FUNCTION public.get_client_columns()
RETURNS TABLE(column_name text, data_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'information_schema'
AS $$
  SELECT c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'clients'
  ORDER BY c.ordinal_position;
$$;

-- Function to dynamically add a column to clients table
CREATE OR REPLACE FUNCTION public.add_client_column(col_name text, col_type text DEFAULT 'text')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  allowed_types text[] := ARRAY['text', 'integer', 'numeric', 'boolean', 'date', 'timestamp with time zone'];
  safe_type text;
BEGIN
  -- Validate type
  IF col_type = ANY(allowed_types) THEN
    safe_type := col_type;
  ELSE
    safe_type := 'text';
  END IF;
  
  -- Validate column name (alphanumeric + underscore only)
  IF col_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid column name: %', col_name;
  END IF;
  
  EXECUTE format('ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS %I %s', col_name, safe_type);
END;
$$;
