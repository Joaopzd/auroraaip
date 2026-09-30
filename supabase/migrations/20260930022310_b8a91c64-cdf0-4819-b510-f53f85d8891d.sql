CREATE TABLE public.day_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date)
);
GRANT SELECT, INSERT ON public.day_closures TO authenticated;
GRANT ALL ON public.day_closures TO service_role;
ALTER TABLE public.day_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own day closures" ON public.day_closures FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own day closures" ON public.day_closures FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE TRIGGER day_closures_touch_updated_at BEFORE UPDATE ON public.day_closures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.close_today_and_plan_tomorrow()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  day_now date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  day_next date := ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1);
  inserted_count integer;
  moved_count integer;
  base_order integer;
  existing_priority boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.day_closures (user_id, day_date) VALUES (auth.uid(), day_now)
    ON CONFLICT (user_id, day_date) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN RETURN 0; END IF;
  SELECT coalesce(max(sort_order), -1) INTO base_order FROM public.tasks WHERE user_id = auth.uid() AND scheduled_date = day_next;
  SELECT EXISTS (SELECT 1 FROM public.tasks WHERE user_id = auth.uid() AND scheduled_date = day_next AND is_priority) INTO existing_priority;
  WITH pending AS (
    SELECT id, row_number() OVER (ORDER BY scheduled_date, coalesce(sort_order, -1), created_at, id) AS position
    FROM public.tasks
    WHERE user_id = auth.uid() AND scheduled_date <= day_now AND completed = false
  )
  UPDATE public.tasks AS t
  SET scheduled_date = day_next,
      sort_order = base_order + pending.position::integer,
      is_priority = CASE WHEN existing_priority THEN false ELSE t.is_priority END
  FROM pending WHERE t.id = pending.id AND t.user_id = auth.uid();
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;
REVOKE ALL ON FUNCTION public.close_today_and_plan_tomorrow() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_today_and_plan_tomorrow() TO authenticated;