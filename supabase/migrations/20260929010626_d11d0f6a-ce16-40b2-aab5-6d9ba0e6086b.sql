CREATE TABLE public.event_occurrence_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.routine_blocks(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, occurrence_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_occurrence_completions TO authenticated;
GRANT ALL ON public.event_occurrence_completions TO service_role;
ALTER TABLE public.event_occurrence_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own event occurrence completions" ON public.event_occurrence_completions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.routine_blocks b WHERE b.id = event_id AND b.user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.routine_blocks b WHERE b.id = event_id AND b.user_id = auth.uid()));
CREATE INDEX event_occurrence_completions_event_idx ON public.event_occurrence_completions(event_id, occurrence_date);
CREATE TRIGGER event_occurrence_completions_touch_updated_at BEFORE UPDATE ON public.event_occurrence_completions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Preserve legacy completed flags as the completion of the original occurrence, not the entire recurring series.
INSERT INTO public.event_occurrence_completions (user_id, event_id, occurrence_date)
SELECT b.user_id, b.id, COALESCE(b.event_date, CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::integer - b.day_of_week + 7) % 7))
FROM public.routine_blocks b WHERE b.completed = true;
UPDATE public.routine_blocks SET completed = false WHERE completed = true;