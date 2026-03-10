
CREATE TABLE public.user_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_managers"
  ON public.user_managers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view their subordinates"
  ON public.user_managers
  FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());

CREATE POLICY "Users can view their own manager"
  ON public.user_managers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
