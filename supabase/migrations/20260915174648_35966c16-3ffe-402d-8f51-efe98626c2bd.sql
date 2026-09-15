CREATE UNIQUE INDEX lists_id_user_key ON public.lists (id, user_id);
CREATE UNIQUE INDEX credit_cards_id_user_key ON public.credit_cards (id, user_id);

ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_list_id_fkey;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_list_owner_fkey FOREIGN KEY (list_id, user_id) REFERENCES public.lists(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_credit_card_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_card_owner_fkey FOREIGN KEY (credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE SET NULL (credit_card_id);

ALTER TABLE public.purchases ADD CONSTRAINT purchases_card_owner_fkey FOREIGN KEY (credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD CONSTRAINT bills_card_owner_fkey FOREIGN KEY (credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE SET NULL (credit_card_id);
ALTER TABLE public.bills ADD CONSTRAINT bills_paid_card_owner_fkey FOREIGN KEY (paid_credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE SET NULL (paid_credit_card_id);
ALTER TABLE public.card_invoice_payments ADD CONSTRAINT invoice_payments_card_owner_fkey FOREIGN KEY (credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE CASCADE;