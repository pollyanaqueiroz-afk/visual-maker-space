
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp with time zone DEFAULT NULL;
