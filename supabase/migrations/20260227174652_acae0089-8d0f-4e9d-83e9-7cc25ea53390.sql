
-- Create clients table for carteira geral
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_url text NOT NULL UNIQUE,
  client_name text,
  loyalty_index integer,
  cs_user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to sync loyalty_index from meetings to clients
CREATE OR REPLACE FUNCTION public.sync_meeting_loyalty_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_url IS NOT NULL AND NEW.loyalty_index IS NOT NULL THEN
    INSERT INTO public.clients (client_url, client_name, loyalty_index, cs_user_id)
    VALUES (NEW.client_url, NEW.client_name, NEW.loyalty_index, NEW.created_by)
    ON CONFLICT (client_url) DO UPDATE SET
      loyalty_index = EXCLUDED.loyalty_index,
      client_name = COALESCE(EXCLUDED.client_name, clients.client_name),
      cs_user_id = COALESCE(EXCLUDED.cs_user_id, clients.cs_user_id),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on meetings
CREATE TRIGGER sync_loyalty_on_meeting_upsert
  AFTER INSERT OR UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION sync_meeting_loyalty_to_client();
