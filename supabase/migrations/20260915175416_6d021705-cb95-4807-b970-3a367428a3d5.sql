ALTER TABLE public.routine_blocks
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Rotina',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS reminders integer[] NOT NULL DEFAULT ARRAY[30]::integer[];

ALTER TABLE public.routine_blocks
  ADD CONSTRAINT routine_blocks_recurrence_check
  CHECK (recurrence IN ('never', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'));

CREATE TABLE public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'teal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_categories TO authenticated;
GRANT ALL ON public.event_categories TO service_role;

ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own event categories"
ON public.event_categories
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX event_categories_user_id_idx ON public.event_categories (user_id);
CREATE INDEX routine_blocks_event_date_idx ON public.routine_blocks (user_id, event_date);

CREATE TRIGGER event_categories_touch_updated_at
BEFORE UPDATE ON public.event_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();