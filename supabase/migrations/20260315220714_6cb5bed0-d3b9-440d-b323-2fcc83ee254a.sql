
-- Update compute function for status_financeiro_inadimplencia
CREATE OR REPLACE FUNCTION public.compute_client_status_financeiro_inadimplencia(p_id_curseduca text)
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

-- Update compute function for status_financeiro (based on vigencia_assinatura)
CREATE OR REPLACE FUNCTION public.compute_client_status_financeiro(p_id_curseduca text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN NULL
    WHEN COUNT(*) FILTER (WHERE vigencia_assinatura = 'Ativa') > 0 THEN 'Ativa'
    ELSE 'Cancelada'
  END
  FROM public.cliente_financeiro
  WHERE id_curseduca = p_id_curseduca;
$$;

-- Update trigger function to sync both columns
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
  SET status_financeiro = compute_client_status_financeiro(v_id_curseduca),
      status_financeiro_inadimplencia = compute_client_status_financeiro_inadimplencia(v_id_curseduca)
  WHERE id_curseduca = v_id_curseduca;

  IF TG_OP = 'UPDATE' AND OLD.id_curseduca IS DISTINCT FROM NEW.id_curseduca THEN
    UPDATE public.clients
    SET status_financeiro = compute_client_status_financeiro(OLD.id_curseduca),
        status_financeiro_inadimplencia = compute_client_status_financeiro_inadimplencia(OLD.id_curseduca)
    WHERE id_curseduca = OLD.id_curseduca;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill existing data
UPDATE public.clients
SET status_financeiro = compute_client_status_financeiro(id_curseduca),
    status_financeiro_inadimplencia = compute_client_status_financeiro_inadimplencia(id_curseduca)
WHERE id_curseduca IS NOT NULL;
