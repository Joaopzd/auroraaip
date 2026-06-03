
-- Credit cards
CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  limit_amount numeric NOT NULL DEFAULT 0,
  is_benefit boolean NOT NULL DEFAULT false,
  color text,
  closing_day integer,
  due_day integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all credit_cards" ON public.credit_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link transactions to credit cards (optional)
ALTER TABLE public.transactions ADD COLUMN credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL;

-- Tighten RLS on existing tables: only authenticated users now
DROP POLICY IF EXISTS "public all tasks" ON public.tasks;
CREATE POLICY "auth all tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all routine_blocks" ON public.routine_blocks;
CREATE POLICY "auth all routine_blocks" ON public.routine_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all lists" ON public.lists;
CREATE POLICY "auth all lists" ON public.lists FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all list_items" ON public.list_items;
CREATE POLICY "auth all list_items" ON public.list_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all transactions" ON public.transactions;
CREATE POLICY "auth all transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all chat_messages" ON public.chat_messages;
CREATE POLICY "auth all chat_messages" ON public.chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed the 3 cards
INSERT INTO public.credit_cards (name, limit_amount, is_benefit, color) VALUES
  ('Santander', 2900.00, false, '#EC0000'),
  ('Nubank', 5500.00, false, '#8A05BE'),
  ('EVA', 800.00, true, '#10B981');
