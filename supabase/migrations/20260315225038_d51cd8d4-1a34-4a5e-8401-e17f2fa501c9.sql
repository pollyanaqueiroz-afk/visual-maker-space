-- Function to compute status_curseduca based on priority rules
CREATE OR REPLACE FUNCTION public.compute_client_status_curseduca(p_id_curseduca text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_id_curseduca IS NULL THEN NULL
    WHEN (SELECT status_financeiro FROM public.clients WHERE id_curseduca = p_id_curseduca LIMIT 1) = 'Cancelada'
      THEN 'Cancelado'
    WHEN COALESCE(
      (SELECT e.membros_ativos_total FROM public.cliente_engajamento_produto e WHERE e.id_curseduca = p_id_curseduca LIMIT 1),
      0
    ) < 5
      THEN 'Implantacao'
    WHEN (SELECT e.data_ultimo_login FROM public.cliente_engajamento_produto e WHERE e.id_curseduca = p_id_curseduca LIMIT 1)
      >= (CURRENT_DATE - INTERVAL '30 days')
      THEN 'Ativo'
    ELSE 'Risco por Engajamento'
  END
$$;

-- Trigger function for engajamento changes
CREATE OR REPLACE FUNCTION public.sync_status_curseduca()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  SET status_curseduca = compute_client_status_curseduca(v_id_curseduca)
  WHERE id_curseduca = v_id_curseduca;

  IF TG_OP = 'UPDATE' AND OLD.id_curseduca IS DISTINCT FROM NEW.id_curseduca THEN
    UPDATE public.clients
    SET status_curseduca = compute_client_status_curseduca(OLD.id_curseduca)
    WHERE id_curseduca = OLD.id_curseduca;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_status_curseduca_engajamento ON public.cliente_engajamento_produto;
CREATE TRIGGER trg_sync_status_curseduca_engajamento
  AFTER INSERT OR UPDATE OR DELETE ON public.cliente_engajamento_produto
  FOR EACH ROW EXECUTE FUNCTION public.sync_status_curseduca();

-- Trigger function for clients.status_financeiro changes
CREATE OR REPLACE FUNCTION public.sync_status_curseduca_from_clients()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status_financeiro IS DISTINCT FROM OLD.status_financeiro THEN
    NEW.status_curseduca := compute_client_status_curseduca(NEW.id_curseduca);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_status_curseduca_clients ON public.clients;
CREATE TRIGGER trg_sync_status_curseduca_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_status_curseduca_from_clients();