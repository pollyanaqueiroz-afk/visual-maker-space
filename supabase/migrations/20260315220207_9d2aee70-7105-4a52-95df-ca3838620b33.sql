
-- Function to compute status_financeiro from cliente_financeiro
CREATE OR REPLACE FUNCTION public.compute_client_status_financeiro(p_id_curseduca text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN NULL
    WHEN COUNT(*) FILTER (WHERE status = 'Inadimplente') > 0 THEN 'Inadimplente'
    ELSE 'Adimplente'
  END
  FROM public.cliente_financeiro
  WHERE id_curseduca = p_id_curseduca;
$$;

-- Trigger function to sync status_financeiro on cliente_financeiro changes
CREATE OR REPLACE FUNCTION public.sync_status_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id_curseduca text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id_curseduca := OLD.id_curseduca;
  ELSE
    v_id_curseduca := NEW.id_curseduca;
  END IF;

  UPDATE public.clients
  SET status_financeiro = compute_client_status_financeiro(v_id_curseduca)
  WHERE id_curseduca = v_id_curseduca;

  IF TG_OP = 'UPDATE' AND OLD.id_curseduca IS DISTINCT FROM NEW.id_curseduca THEN
    UPDATE public.clients
    SET status_financeiro = compute_client_status_financeiro(OLD.id_curseduca)
    WHERE id_curseduca = OLD.id_curseduca;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on cliente_financeiro
DROP TRIGGER IF EXISTS trg_sync_status_financeiro ON public.cliente_financeiro;
CREATE TRIGGER trg_sync_status_financeiro
  AFTER INSERT OR UPDATE OR DELETE ON public.cliente_financeiro
  FOR EACH ROW EXECUTE FUNCTION public.sync_status_financeiro();

-- Backfill existing data
UPDATE public.clients
SET status_financeiro = compute_client_status_financeiro(id_curseduca)
WHERE id_curseduca IS NOT NULL;
