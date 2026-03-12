CREATE POLICY "Admins can delete adjustments"
ON public.briefing_adjustments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete adjustment items"
ON public.briefing_adjustment_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.briefing_adjustments ba
    WHERE ba.id = briefing_adjustment_items.adjustment_id
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);