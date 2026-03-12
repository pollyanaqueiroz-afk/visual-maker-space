
CREATE TABLE public.meeting_minutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  loyalty_stars INTEGER NOT NULL CHECK (loyalty_stars >= 1 AND loyalty_stars <= 5),
  observations TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id)
);

ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create minutes for own meetings"
  ON public.meeting_minutes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_minutes.meeting_id AND meetings.created_by = auth.uid()));

CREATE POLICY "Users can update own minutes"
  ON public.meeting_minutes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_minutes.meeting_id AND meetings.created_by = auth.uid()));

CREATE POLICY "Users can view own minutes"
  ON public.meeting_minutes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_minutes.meeting_id AND meetings.created_by = auth.uid()));

CREATE POLICY "Admins can view all minutes"
  ON public.meeting_minutes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all minutes"
  ON public.meeting_minutes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
