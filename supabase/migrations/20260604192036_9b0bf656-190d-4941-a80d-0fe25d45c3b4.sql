
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS paid_credit_card_id uuid,
  ADD COLUMN IF NOT EXISTS transaction_id uuid;

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id uuid NOT NULL,
  description text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  installments_total integer NOT NULL DEFAULT 1,
  installments_paid integer NOT NULL DEFAULT 0,
  category text,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all purchases" ON public.purchases;
CREATE POLICY "auth all purchases" ON public.purchases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS purchases_touch ON public.purchases;
CREATE TRIGGER purchases_touch BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime
DO $$ BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF FOUND THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bills; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_blocks; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_budgets; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.list_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
