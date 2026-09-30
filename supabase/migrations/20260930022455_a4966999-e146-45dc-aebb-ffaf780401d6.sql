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
    SELECT id, row_number() OVER (ORDER BY scheduled_date, coalesce(sort_order, -1), created_at, id) AS position,
      row_number() OVER (PARTITION BY is_priority ORDER BY scheduled_date, coalesce(sort_order, -1), created_at, id) AS priority_position
    FROM public.tasks
    WHERE user_id = auth.uid() AND scheduled_date <= day_now AND completed = false
  )
  UPDATE public.tasks AS t
  SET scheduled_date = day_next,
      sort_order = base_order + pending.position::integer,
      is_priority = NOT existing_priority AND t.is_priority AND pending.priority_position = 1
  FROM pending WHERE t.id = pending.id AND t.user_id = auth.uid();
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;