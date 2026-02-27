-- Change created_by to uuid and default to auth.uid()
ALTER TABLE public.meetings ALTER COLUMN created_by TYPE uuid USING created_by::uuid;
ALTER TABLE public.meetings ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Drop old permissive RLS policies
DROP POLICY IF EXISTS "Authenticated users can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can delete meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can create meetings" ON public.meetings;

-- New RLS: users can only see/edit their own meetings
CREATE POLICY "Users can view own meetings"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create own meetings"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own meetings"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own meetings"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());