-- Allow admins to view ALL meetings (leadership dashboard)
CREATE POLICY "Admins can view all meetings"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));