ALTER TABLE public.transactions DROP CONSTRAINT transactions_card_owner_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_card_owner_fkey FOREIGN KEY (credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE NO ACTION;

ALTER TABLE public.bills DROP CONSTRAINT bills_card_owner_fkey;
ALTER TABLE public.bills ADD CONSTRAINT bills_card_owner_fkey FOREIGN KEY (credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE NO ACTION;

ALTER TABLE public.bills DROP CONSTRAINT bills_paid_card_owner_fkey;
ALTER TABLE public.bills ADD CONSTRAINT bills_paid_card_owner_fkey FOREIGN KEY (paid_credit_card_id, user_id) REFERENCES public.credit_cards(id, user_id) ON DELETE NO ACTION;