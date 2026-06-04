
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false;

UPDATE public.credit_cards SET color = '#EC4899' WHERE name = 'EVA';
UPDATE public.credit_cards SET color = COALESCE(color, '#E2231A') WHERE name = 'Santander';
UPDATE public.credit_cards SET color = COALESCE(color, '#820AD1') WHERE name = 'Nubank';

INSERT INTO public.lists (name, type, is_fixed)
SELECT 'Compras do Mês', 'shopping', true
WHERE NOT EXISTS (SELECT 1 FROM public.lists WHERE name = 'Compras do Mês');

UPDATE public.lists SET is_fixed = true WHERE name = 'Compras do Mês';
