import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDescription("");
      setAmount("");
      setCategory("");
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

  const { income, expense, balance, byMonth } = useMemo(() => {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    let income = 0;
    let expense = 0;
    const byMonth = new Map<string, Tx[]>();
    for (const t of txs) {
      if (t.occurred_on.startsWith(month)) {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
      }
      const key = t.occurred_on.slice(0, 7);
      const arr = byMonth.get(key) ?? [];
      arr.push(t);
      byMonth.set(key, arr);
    }
    return { income, expense, balance: income - expense, byMonth };
  }, [txs]);

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
        <SummaryCard
          label="Receitas (mês)"
          value={fmt.format(income)}
          icon={<ArrowUpCircle className="h-5 w-5" />}
          tone="income"
        />
        <SummaryCard
          label="Despesas (mês)"
          value={fmt.format(expense)}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          tone="expense"
        />
        <SummaryCard
          label="Saldo (mês)"
          value={fmt.format(balance)}
          icon={<Wallet className="h-5 w-5" />}
          tone={balance >= 0 ? "income" : "expense"}
          highlight
        />
      </section>

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
                {list.map((t) => (
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
                ))}
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
