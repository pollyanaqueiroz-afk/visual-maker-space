
DROP POLICY IF EXISTS "Anyone can create brand assets" ON public.brand_assets;
DROP POLICY IF EXISTS "Anyone can delete brand assets" ON public.brand_assets;

CREATE POLICY "Authenticated users can create brand assets"
  ON public.brand_assets FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete brand assets"
  ON public.brand_assets FOR DELETE TO authenticated
  USING (true);
