ALTER TABLE public.meetings 
  ADD COLUMN minutes_url text,
  ADD COLUMN recording_url text,
  ADD COLUMN loyalty_index integer,
  ADD COLUMN loyalty_reason text;