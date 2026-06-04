
-- Bills (contas a pagar) — vencimentos futuros e recorrentes
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'once', -- once | monthly | weekly | yearly
  category text,
  credit_card_id uuid,
  is_paid boolean NOT NULL DEFAULT false,
  paid_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all bills" ON public.bills FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Weekly budget (teto semanal)
CREATE TABLE public.weekly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE, -- domingo da semana
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_budgets TO authenticated;
GRANT ALL ON public.weekly_budgets TO service_role;
ALTER TABLE public.weekly_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all weekly_budgets" ON public.weekly_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
