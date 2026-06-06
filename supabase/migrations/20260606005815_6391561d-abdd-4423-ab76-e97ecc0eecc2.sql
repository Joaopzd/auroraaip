
CREATE TABLE public.investments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('deposit','withdrawal')),
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all investments" ON public.investments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.card_invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_card_id uuid NOT NULL,
  reference_month text NOT NULL, -- YYYY-MM
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  paid_method text NOT NULL DEFAULT 'cash', -- cash or transfer
  transaction_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, reference_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_invoice_payments TO authenticated;
GRANT ALL ON public.card_invoice_payments TO service_role;
ALTER TABLE public.card_invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all card_invoice_payments" ON public.card_invoice_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
