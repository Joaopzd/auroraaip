import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Check, CreditCard, Layers, Pencil, Plus, Repeat, RotateCcw, Trash2, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/financas")({
  component: FinancasPage,
  head: () => ({ meta: [{ title: "Finanças — Aurora" }] }),
});

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  occurred_on: string;
  created_at: string;
  credit_card_id: string | null;
};

type Card = {
  id: string;
  name: string;
  limit_amount: number;
  is_benefit: boolean;
  color: string | null;
};

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => new Date().toISOString().slice(0, 10);

function FinancasPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [cardId, setCardId] = useState<string>("");

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["credit_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, limit_amount: Number(c.limit_amount) })) as Card[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) {
        throw new Error("Preencha descrição e valor válidos.");
      }
      const { error } = await supabase.from("transactions").insert({
        type,
        amount: value,
        description: description.trim(),
        category: category.trim() || null,
        occurred_on: occurredOn,
        credit_card_id: type === "expense" && cardId ? cardId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDescription("");
      setAmount("");
      setCategory("");
      setCardId("");
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const { income, expense, balance, byMonth, cardStats } = useMemo(() => {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    let income = 0;
    let expense = 0;
    const byMonth = new Map<string, Tx[]>();
    const cardSpend = new Map<string, number>();
    for (const t of txs) {
      if (t.occurred_on.startsWith(month)) {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
        if (t.type === "expense" && t.credit_card_id) {
          cardSpend.set(t.credit_card_id, (cardSpend.get(t.credit_card_id) ?? 0) + t.amount);
        }
      }
      const key = t.occurred_on.slice(0, 7);
      const arr = byMonth.get(key) ?? [];
      arr.push(t);
      byMonth.set(key, arr);
    }
    const cardStats = cards.map((c) => {
      const fatura = cardSpend.get(c.id) ?? 0;
      return {
        ...c,
        fatura,
        disponivel: Math.max(0, c.limit_amount - fatura),
        pct: c.limit_amount > 0 ? Math.min(100, (fatura / c.limit_amount) * 100) : 0,
      };
    });
    return { income, expense, balance: income - expense, byMonth, cardStats };
  }, [txs, cards]);

  const cardById = (id: string | null) => cards.find((c) => c.id === id);

  return (
    <div className="px-6">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Finanças</p>
          <h1 className="mt-1 text-3xl font-bold">Despesas & Receitas</h1>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:block">
          Visão geral do mês corrente
        </span>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Receitas (mês)" value={fmt.format(income)} icon={<ArrowUpCircle className="h-5 w-5" />} tone="income" />
        <SummaryCard label="Despesas (mês)" value={fmt.format(expense)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="expense" />
        <SummaryCard label="Saldo (mês)" value={fmt.format(balance)} icon={<Wallet className="h-5 w-5" />} tone={balance >= 0 ? "income" : "expense"} highlight />
      </section>

      {/* Credit Cards */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Cartões de crédito
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cardStats.map((c) => (
            <div
              key={c.id}
              className="relative overflow-hidden rounded-3xl bg-surface p-5 ring-1 ring-border"
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: c.color ?? "#F7C534" }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Limite {fmt.format(c.limit_amount)}
                    {c.is_benefit && " · Benefício"}
                  </p>
                </div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: c.color ?? "#F7C534" }}
                >
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Disponível</span>
                  <span className="text-lg font-bold tabular-nums">{fmt.format(c.disponivel)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${c.pct}%`,
                      backgroundColor: c.color ?? "#F7C534",
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.is_benefit ? "Gasto do mês" : "Fatura"}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{fmt.format(c.fatura)}</p>
                </div>
                {c.is_benefit ? (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-medium text-gold">
                    Renova mensalmente
                  </span>
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-medium",
                      c.fatura > 0
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.fatura > 0 ? "A pagar" : "Sem fatura"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <BillsSection />


      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="h-fit space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-border"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nova movimentação
          </h2>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition",
                type === "expense"
                  ? "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowDownCircle className="h-4 w-4" /> Despesa
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition",
                type === "income"
                  ? "bg-gold text-gold-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowUpCircle className="h-4 w-4" /> Receita
            </button>
          </div>

          <Field label="Descrição">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Mercado, Salário, Uber..."
              className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </Field>
          </div>

          <Field label="Categoria (opcional)">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Alimentação, Transporte..."
              className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </Field>

          {type === "expense" && (
            <Field label="Pago com (opcional)">
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                <option value="">Dinheiro / débito</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {add.isError && (
            <p className="text-xs text-destructive">{(add.error as Error).message}</p>
          )}

          <button
            type="submit"
            disabled={add.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </form>

        <section className="space-y-6">
          {[...byMonth.entries()].length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Nenhuma movimentação ainda. Adicione a primeira ao lado.
            </div>
          )}
          {[...byMonth.entries()].map(([month, list]) => (
            <div key={month} className="rounded-3xl bg-surface ring-1 ring-border">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold capitalize">
                  {new Date(month + "-01").toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <span className="text-xs text-muted-foreground">{list.length} itens</span>
              </div>
              <ul className="divide-y divide-border/60">
                {list.map((t) => {
                  const card = cardById(t.credit_card_id);
                  return (
                    <li key={t.id} className="flex items-center gap-4 px-5 py-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          t.type === "income"
                            ? "bg-gold/15 text-gold"
                            : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {t.type === "income" ? (
                          <ArrowUpCircle className="h-5 w-5" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.occurred_on).toLocaleDateString("pt-BR")}
                          {t.category ? ` · ${t.category}` : ""}
                          {card && (
                            <>
                              {" · "}
                              <span
                                className="inline-flex items-center gap-1"
                                style={{ color: card.color ?? undefined }}
                              >
                                <CreditCard className="h-3 w-3" />
                                {card.name}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          t.type === "income" ? "text-gold" : "text-destructive",
                        )}
                      >
                        {t.type === "income" ? "+" : "−"} {fmt.format(t.amount)}
                      </span>
                      <button
                        onClick={() => remove.mutate(t.id)}
                        className="ml-2 text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "income" | "expense";
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl p-5 ring-1 ring-border",
        highlight ? "bg-[var(--gradient-hero)]" : "bg-surface",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className={cn(tone === "income" ? "text-gold" : "text-destructive")}>{icon}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

type Bill = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  recurrence: "once" | "monthly" | "weekly" | "yearly";
  category: string | null;
  credit_card_id: string | null;
  is_paid: boolean;
  paid_on: string | null;
};

function BillsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [recurrence, setRecurrence] = useState<"once" | "monthly" | "weekly" | "yearly">("monthly");
  const [category, setCategory] = useState("");

  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .order("is_paid", { ascending: true })
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) })) as Bill[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) {
        throw new Error("Preencha descrição e valor.");
      }
      const { error } = await supabase.from("bills").insert({
        description: description.trim(),
        amount: value,
        due_date: dueDate,
        recurrence,
        category: category.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDescription("");
      setAmount("");
      setCategory("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const markPaid = useMutation({
    mutationFn: async (b: Bill) => {
      const today = todayISO();
      // marca atual como paga
      const { error } = await supabase
        .from("bills")
        .update({ is_paid: true, paid_on: today })
        .eq("id", b.id);
      if (error) throw error;
      // se recorrente, cria o próximo vencimento
      if (b.recurrence !== "once") {
        const d = new Date(b.due_date + "T00:00:00");
        if (b.recurrence === "monthly") d.setMonth(d.getMonth() + 1);
        if (b.recurrence === "weekly") d.setDate(d.getDate() + 7);
        if (b.recurrence === "yearly") d.setFullYear(d.getFullYear() + 1);
        await supabase.from("bills").insert({
          description: b.description,
          amount: b.amount,
          due_date: d.toISOString().slice(0, 10),
          recurrence: b.recurrence,
          category: b.category,
          credit_card_id: b.credit_card_id,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
  });

  const pending = bills.filter((b) => !b.is_paid);
  const totalPending = pending.reduce((s, b) => s + b.amount, 0);

  function daysUntil(iso: string) {
    const d = new Date(iso + "T00:00:00").getTime();
    const t = new Date(todayISO() + "T00:00:00").getTime();
    return Math.round((d - t) / 86400000);
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contas a pagar
          </h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
              {fmt.format(totalPending)} pendente
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Nova conta
        </button>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="mb-4 grid gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border md:grid-cols-5"
        >
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (ex: Aluguel)"
            className="rounded-xl bg-surface-elevated px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Valor"
            className="rounded-xl bg-surface-elevated px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl bg-surface-elevated px-3 py-2 text-sm"
          />
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
            className="rounded-xl bg-surface-elevated px-3 py-2 text-sm"
          >
            <option value="once">Uma vez</option>
            <option value="monthly">Mensal</option>
            <option value="weekly">Semanal</option>
            <option value="yearly">Anual</option>
          </select>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria (opcional)"
            className="rounded-xl bg-surface-elevated px-3 py-2 text-sm md:col-span-3"
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="rounded-xl bg-gold py-2 text-sm font-semibold text-gold-foreground md:col-span-2"
          >
            Salvar
          </button>
        </form>
      )}

      {bills.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma conta cadastrada. A Aurora vai te lembrar 1 dia antes e no dia do vencimento.
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {bills.map((b) => {
            const dleft = daysUntil(b.due_date);
            const overdue = !b.is_paid && dleft < 0;
            const soon = !b.is_paid && dleft >= 0 && dleft <= 1;
            return (
              <li
                key={b.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border",
                  b.is_paid && "opacity-60",
                )}
              >
                <button
                  onClick={() => !b.is_paid && markPaid.mutate(b)}
                  disabled={b.is_paid}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    b.is_paid
                      ? "bg-gold/20 text-gold"
                      : overdue
                        ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                        : "bg-surface-elevated text-muted-foreground hover:bg-gold/15 hover:text-gold",
                  )}
                  title={b.is_paid ? "Paga" : "Marcar como paga"}
                >
                  <Check className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", b.is_paid && "line-through")}>
                    {b.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vence {new Date(b.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    {b.category && ` · ${b.category}`}
                    {b.recurrence !== "once" && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <Repeat className="h-3 w-3" />{" "}
                        {b.recurrence === "monthly" ? "mensal" : b.recurrence === "weekly" ? "semanal" : "anual"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{fmt.format(b.amount)}</p>
                  {!b.is_paid && (
                    <p
                      className={cn(
                        "text-[10px] font-medium",
                        overdue ? "text-destructive" : soon ? "text-gold" : "text-muted-foreground",
                      )}
                    >
                      {overdue
                        ? `${Math.abs(dleft)}d atrasada`
                        : dleft === 0
                          ? "hoje"
                          : dleft === 1
                            ? "amanhã"
                            : `em ${dleft}d`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove.mutate(b.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

