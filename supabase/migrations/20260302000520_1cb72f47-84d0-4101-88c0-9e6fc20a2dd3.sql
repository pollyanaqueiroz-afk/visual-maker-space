
-- Attach the recalcular_progresso_fase trigger to app_checklist_items
CREATE TRIGGER trg_recalcular_progresso_fase
  AFTER UPDATE OF feito ON public.app_checklist_items
  FOR EACH ROW
  WHEN (OLD.feito IS DISTINCT FROM NEW.feito)
  EXECUTE FUNCTION public.recalcular_progresso_fase();
