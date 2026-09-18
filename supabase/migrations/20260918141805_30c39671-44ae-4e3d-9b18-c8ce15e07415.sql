-- lovable-cron-fallback-reviewed: 1440 runs/day; event reminders require minute-level delivery and no enabled delayed-workflow connector is available
CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push devices" ON public.push_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX push_devices_user_enabled_idx ON public.push_devices(user_id, enabled);

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_kind text NOT NULL CHECK (notification_kind IN ('event', 'bill')),
  source_id uuid NOT NULL,
  occurrence_key text NOT NULL,
  reminder_minutes integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_kind, source_id, occurrence_key, reminder_minutes)
);
GRANT SELECT, DELETE ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notification deliveries" ON public.notification_deliveries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notification deliveries" ON public.notification_deliveries FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notification_deliveries_user_sent_idx ON public.notification_deliveries(user_id, sent_at DESC);

CREATE TABLE public.notification_scheduler_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_scheduler_config TO service_role;
ALTER TABLE public.notification_scheduler_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.notification_scheduler_config (singleton) VALUES (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER push_devices_set_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'ditto-process-reminders',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dittoai.lovable.app/api/public/process-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ditto-cron-secret', (SELECT secret::text FROM public.notification_scheduler_config WHERE singleton = true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);