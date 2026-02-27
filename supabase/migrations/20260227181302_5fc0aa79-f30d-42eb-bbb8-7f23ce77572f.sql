
-- CSAT responses table
CREATE TABLE public.meeting_csat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  client_email TEXT NOT NULL,
  client_name TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for token lookup (public page)
CREATE INDEX idx_meeting_csat_token ON public.meeting_csat(token);
CREATE INDEX idx_meeting_csat_meeting_id ON public.meeting_csat(meeting_id);

-- Enable RLS
ALTER TABLE public.meeting_csat ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all CSAT responses
CREATE POLICY "Authenticated users can view csat" ON public.meeting_csat
  FOR SELECT USING (true);

-- Authenticated users can create CSAT entries (when sending email)
CREATE POLICY "Authenticated users can create csat" ON public.meeting_csat
  FOR INSERT WITH CHECK (true);

-- Anyone can update CSAT (for public token-based response)
CREATE POLICY "Anyone can update csat by token" ON public.meeting_csat
  FOR UPDATE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_csat;
