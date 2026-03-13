
-- Email logs table
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sender_name text,
  sender_type text NOT NULL DEFAULT 'system',
  recipient_email text NOT NULL,
  client_name text,
  client_url text,
  subject text,
  html_body text,
  send_type text NOT NULL DEFAULT 'automatic',
  origin text,
  status text NOT NULL DEFAULT 'sent',
  resend_id text,
  error_message text,
  metadata jsonb
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email_logs" ON public.email_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can insert email_logs" ON public.email_logs
  FOR INSERT TO public WITH CHECK (true);

-- System error logs table
CREATE TABLE public.system_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_email text,
  user_role text,
  module text,
  screen text,
  action text,
  error_message text NOT NULL,
  stack_trace text,
  request_data text,
  endpoint text,
  severity text NOT NULL DEFAULT 'medium',
  metadata jsonb
);

ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view system_error_logs" ON public.system_error_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can insert system_error_logs" ON public.system_error_logs
  FOR INSERT TO public WITH CHECK (true);
