
CREATE TABLE public.meeting_reschedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  previous_date DATE NOT NULL,
  previous_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_time TIME NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reschedules of own meetings"
  ON public.meeting_reschedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.meetings WHERE meetings.id = meeting_reschedules.meeting_id AND meetings.created_by = auth.uid())
  );

CREATE POLICY "Admins can view all reschedules"
  ON public.meeting_reschedules
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert reschedules for own meetings"
  ON public.meeting_reschedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.meetings WHERE meetings.id = meeting_reschedules.meeting_id AND meetings.created_by = auth.uid())
  );
