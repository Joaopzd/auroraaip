export type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  occurred_on: string;
  created_at: string;
  credit_card_id: string | null;
};

export type Card = {
  id: string;
  name: string;
  limit_amount: number;
  is_benefit: boolean;
  color: string | null;
  due_day: number | null;
  closing_day: number | null;
  renewal_day: number | null;
};

export type Purchase = {
  id: string;
  credit_card_id: string;
  description: string;
  total_amount: number;
  installments_total: number;
  installments_paid: number;
  category: string | null;
  started_on: string;
};

export type Bill = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  recurrence: "once" | "monthly" | "weekly" | "yearly";
  category: string | null;
  credit_card_id: string | null;
  is_paid: boolean;
  paid_on: string | null;
  paid_method: string | null;
  paid_credit_card_id: string | null;
  transaction_id: string | null;
};

export type Investment = {
  id: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  description: string;
  occurred_on: string;
};

export type InvoicePayment = {
  id: string;
  credit_card_id: string;
  reference_month: string;
  amount: number;
  paid_on: string;
  paid_method: string;
};

export const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthKey = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : "");

export const HIDE_VALUES_KEY = "ditto:hide-finance-values";
export function maskCurrency(value: number, hidden: boolean): string {
  return hidden ? "R$ ••••••" : fmt.format(value);
}
