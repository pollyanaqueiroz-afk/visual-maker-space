
-- Allow authenticated users to insert their own role as 'cliente' only
CREATE POLICY "Users can insert own cliente role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'cliente'::app_role
  );

-- Add a permissive INSERT policy on app_clientes for authenticated users
CREATE POLICY "Authenticated users can insert app_clientes"
  ON public.app_clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
