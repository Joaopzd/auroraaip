import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarClock, Check, CreditCard,
  Filter, Layers, Pencil, PiggyBank, Plus, Receipt, Repeat, RotateCcw,
  Trash2, TrendingUp, Wallet, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CATEGORIES, categoryEmoji } from "@/lib/categories";

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
  due_day: number | null;
  closing_day: number | null;
};

type Purchase = {
  id: string;
  credit_card_id: string;
  description: string;
  total_amount: number;
  installments_total: number;
  installments_paid: number;
  category: string | null;
  started_on: string;
};

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
  paid_method: string | null;
  paid_credit_card_id: string | null;
  transaction_id: string | null;
};

type Investment = {
  id: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  description: string;
  occurred_on: string;
};

type InvoicePayment = {
  id: string;
  credit_card_id: string;
  reference_month: string;
  amount: number;
  paid_on: string;
  paid_method: string;
};

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso: string) => iso.slice(0, 7);

function FinancasPage() {
  const [tab, setTab] = useState<"geral" | "investimentos">("geral");

  return (
    <div className="px-4 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Finanças</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {tab === "geral" ? "Despesas & Receitas" : "Investimentos"}
          </h1>
        </div>
        <div className="flex gap-1 rounded-2xl bg-surface p-1 ring-1 ring-border">
          <TabButton active={tab === "geral"} onClick={() => setTab("geral")} icon={<Wallet className="h-3.5 w-3.5" />}>Geral</TabButton>
          <TabButton active={tab === "investimentos"} onClick={() => setTab("investimentos")} icon={<TrendingUp className="h-3.5 w-3.5" />}>Investimentos</TabButton>
        </div>
      </header>

      {tab === "geral" ? <GeralTab /> : <InvestmentsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
        active ? "bg-gold text-gold-foreground shadow-[var(--shadow-gold)]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {children}
    </button>
  );
}

/* ============================================================ GERAL TAB */

function GeralTab() {
  const qc = useQueryClient();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [installmentMode, setInstallmentMode] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [cardId, setCardId] = useState<string>("");
  const [installments, setInstallments] = useState("2");

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [creatingCard, setCreatingCard] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<{ card: Card; month: string; amount: number } | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Card | null>(null);

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("*")
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
        .from("credit_cards").select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, limit_amount: Number(c.limit_amount) })) as Card[];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, total_amount: Number(p.total_amount) })) as Purchase[];
    },
  });

  const { data: invoicePayments = [] } = useQuery({
    queryKey: ["card_invoice_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("card_invoice_payments").select("*");
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, amount: Number(i.amount) })) as InvoicePayment[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) {
        throw new Error("Preencha descrição e valor válidos.");
      }
      if (installmentMode && type === "expense") {
        const n = parseInt(installments, 10);
        if (!cardId) throw new Error("Selecione o cartão da compra parcelada.");
        if (!Number.isFinite(n) || n < 1) throw new Error("Número de parcelas inválido.");
        const { error } = await supabase.from("purchases").insert({
          credit_card_id: cardId,
          description: description.trim(),
          total_amount: value,
          installments_total: n,
          installments_paid: 0,
          category: category.trim() || null,
          started_on: occurredOn,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert({
          type, amount: value,
          description: description.trim(),
          category: category.trim() || null,
          occurred_on: occurredOn,
          credit_card_id: type === "expense" && cardId ? cardId : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setDescription(""); setAmount(""); setCategory(""); setCardId(""); setInstallments("2");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(installmentMode ? "Compra parcelada criada!" : "Lançamento adicionado!");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  // Aggregations
  const { income, expense, balance, cardStats, categories, filtered } = useMemo(() => {
    const month = todayISO().slice(0, 7);
    let income = 0;
    let expense = 0;
    const cardSpendByMonth = new Map<string, Map<string, number>>();
    const cats = new Set<string>();
    for (const t of txs) {
      if (t.category) cats.add(t.category);
      if (t.occurred_on.startsWith(month)) {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
      }
      if (t.type === "expense" && t.credit_card_id) {
        const k = monthKey(t.occurred_on);
        if (!cardSpendByMonth.has(t.credit_card_id)) cardSpendByMonth.set(t.credit_card_id, new Map());
        const m = cardSpendByMonth.get(t.credit_card_id)!;
        m.set(k, (m.get(k) ?? 0) + t.amount);
      }
    }
    const cardCommitted = new Map<string, number>();
    for (const p of purchases) {
      const remaining = Math.max(0, p.installments_total - p.installments_paid);
      const perInst = p.installments_total > 0 ? p.total_amount / p.installments_total : 0;
      cardCommitted.set(p.credit_card_id, (cardCommitted.get(p.credit_card_id) ?? 0) + remaining * perInst);
    }
    const cardStats = cards.map((c) => {
      const monthMap = cardSpendByMonth.get(c.id) ?? new Map();
      const fatura = monthMap.get(month) ?? 0;
      const comprometido = cardCommitted.get(c.id) ?? 0;
      const usado = fatura + comprometido;
      const paidThisMonth = invoicePayments.find((i) => i.credit_card_id === c.id && i.reference_month === month);
      return {
        ...c,
        fatura,
        comprometido,
        disponivel: Math.max(0, c.limit_amount - usado),
        pct: c.limit_amount > 0 ? Math.min(100, (usado / c.limit_amount) * 100) : 0,
        invoicePaid: !!paidThisMonth,
      };
    });

    // filter txs
    const filtered = txs.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterFrom && t.occurred_on < filterFrom) return false;
      if (filterTo && t.occurred_on > filterTo) return false;
      return true;
    });

    return { income, expense, balance: income - expense, cardStats, categories: [...cats].sort(), filtered };
  }, [txs, cards, purchases, invoicePayments, filterCategory, filterFrom, filterTo, filterType]);

  const byMonth = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const t of filtered) {
      const key = monthKey(t.occurred_on);
      const arr = m.get(key) ?? [];
      arr.push(t); m.set(key, arr);
    }
    return m;
  }, [filtered]);

  const cardById = (id: string | null) => cards.find((c) => c.id === id);

  return (
    <>
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Receitas (mês)" value={fmt.format(income)} icon={<ArrowUpCircle className="h-5 w-5" />} tone="income" />
        <SummaryCard label="Despesas (mês)" value={fmt.format(expense)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="expense" />
        <SummaryCard label="Saldo (mês)" value={fmt.format(balance)} icon={<Wallet className="h-5 w-5" />} tone={balance >= 0 ? "income" : "expense"} highlight />
      </section>

      {/* Credit Cards */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cartões de crédito</h2>
          </div>
          <button onClick={() => setCreatingCard(true)} className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground">
            <Plus className="h-3.5 w-3.5" /> Novo cartão
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cardStats.map((c) => (
            <div
              key={c.id}
              onClick={() => setViewingInvoice(c)}
              className="relative cursor-pointer overflow-hidden rounded-3xl bg-surface p-5 ring-1 ring-border transition hover:ring-gold/50"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: c.color ?? "#F7C534" }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Limite {fmt.format(c.limit_amount)}
                    {c.is_benefit && " · Benefício"}
                    {c.due_day && ` · vence dia ${c.due_day}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingCard(c); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: c.color ?? "#F7C534" }}>
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Disponível</span>
                  <span className="text-lg font-bold tabular-nums">{fmt.format(c.disponivel)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                  <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, backgroundColor: c.color ?? "#F7C534" }} />
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.is_benefit ? "Gasto do mês" : "Fatura + parcelas"}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{fmt.format(c.fatura + c.comprometido)}</p>
                  {!c.is_benefit && c.comprometido > 0 && (
                    <p className="text-[10px] text-muted-foreground">{fmt.format(c.comprometido)} em parcelas futuras</p>
                  )}
                </div>
                {c.is_benefit ? (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-medium text-gold">Renova mensalmente</span>
                ) : c.invoicePaid ? (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-medium text-gold">Fatura paga</span>
                ) : c.fatura > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPayingInvoice({ card: c, month: todayISO().slice(0, 7), amount: c.fatura }); }}
                    className="rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/25"
                  >
                    <Receipt className="mr-1 inline h-3 w-3" />Pagar fatura
                  </button>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">Sem fatura</span>
                )}
              </div>
            </div>
          ))}
          {cards.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-3">
              Nenhum cartão cadastrado. Adicione para acompanhar limite e faturas.
            </div>
          )}
        </div>
      </section>

      <PurchasesSection cards={cards} purchases={purchases} />

      <BillsSection cards={cards} />

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="h-fit space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-border"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nova movimentação</h2>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
            <button type="button" onClick={() => { setType("expense"); }}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition",
                type === "expense" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-foreground")}>
              <ArrowDownCircle className="h-4 w-4" /> Despesa
            </button>
            <button type="button" onClick={() => { setType("income"); setInstallmentMode(false); }}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition",
                type === "income" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground")}>
              <ArrowUpCircle className="h-4 w-4" /> Receita
            </button>
          </div>

          {type === "expense" && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2 text-sm">
              <input type="checkbox" checked={installmentMode} onChange={(e) => setInstallmentMode(e.target.checked)} className="h-4 w-4 accent-gold" />
              <Layers className="h-4 w-4 text-gold" />
              <span className="font-medium">Compra parcelada no cartão</span>
            </label>
          )}

          <Field label="Descrição">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mercado, Salário, Uber..."
              className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={installmentMode ? "Valor total (R$)" : "Valor (R$)"}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
                className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
            </Field>
            {installmentMode ? (
              <Field label="Parcelas">
                <input value={installments} onChange={(e) => setInstallments(e.target.value)} inputMode="numeric" placeholder="2"
                  className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
              </Field>
            ) : (
              <Field label="Data">
                <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)}
                  className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
              </Field>
            )}
          </div>

          <Field label="Categoria">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base">
                {category ? categoryEmoji(category) : "🏷️"}
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none rounded-xl bg-surface-elevated py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                <option value="">Selecione uma categoria...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji}  {c.label}</option>
                ))}
                {categories.filter((c) => !CATEGORIES.some((x) => x.value === c)).map((c) => (
                  <option key={c} value={c}>🏷️  {c}</option>
                ))}
              </select>
            </div>
          </Field>

          {type === "expense" && (
            <Field label={installmentMode ? "Cartão" : "Pago com (opcional)"}>
              <select value={cardId} onChange={(e) => setCardId(e.target.value)}
                className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50">
                <option value="">{installmentMode ? "Selecione..." : "Dinheiro / débito"}</option>
                {cards.filter((c) => !installmentMode || !c.is_benefit).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          )}

          {add.isError && <p className="text-xs text-destructive">{(add.error as Error).message}</p>}

          <button type="submit" disabled={add.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground transition hover:opacity-90 disabled:opacity-60">
            <Plus className="h-4 w-4" /> {installmentMode ? "Criar compra parcelada" : "Adicionar"}
          </button>
        </form>

        <section className="space-y-4">
          {/* Filters */}
          <div className="rounded-3xl bg-surface p-4 ring-1 ring-border">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filtros
              {(filterCategory || filterFrom || filterTo || filterType !== "all") && (
                <button onClick={() => { setFilterCategory(""); setFilterFrom(""); setFilterTo(""); setFilterType("all"); }}
                  className="ml-auto text-[10px] text-gold hover:underline">Limpar</button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                className="rounded-xl bg-surface-elevated px-3 py-2 text-sm">
                <option value="all">Todos os tipos</option>
                <option value="expense">Despesas</option>
                <option value="income">Receitas</option>
              </select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-xl bg-surface-elevated px-3 py-2 text-sm">
                <option value="">Todas categorias</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="De"
                className="rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="Até"
                className="rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
            </div>
          </div>

          {[...byMonth.entries()].length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Nenhuma movimentação encontrada.
            </div>
          )}
          {[...byMonth.entries()].map(([month, list]) => (
            <div key={month} className="rounded-3xl bg-surface ring-1 ring-border">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold capitalize">
                  {new Date(month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </h3>
                <span className="text-xs text-muted-foreground">{list.length} itens</span>
              </div>
              <ul className="divide-y divide-border/60">
                {list.map((t) => {
                  const card = cardById(t.credit_card_id);
                  return (
                    <li key={t.id} className="flex items-center gap-4 px-5 py-3">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ring-1 ring-gold/30",
                        t.type === "income" ? "bg-gold/15" : "bg-gold/10")}>
                        {t.category ? (
                          <span aria-hidden>{categoryEmoji(t.category)}</span>
                        ) : (
                          t.type === "income" ? <ArrowUpCircle className="h-5 w-5 text-gold" /> : <ArrowDownCircle className="h-5 w-5 text-gold" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.occurred_on).toLocaleDateString("pt-BR")}
                          {t.category ? ` · ${t.category}` : ""}
                          {card && (<> · <span className="inline-flex items-center gap-1" style={{ color: card.color ?? undefined }}>
                            <CreditCard className="h-3 w-3" />{card.name}</span></>)}
                        </p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular-nums",
                        t.type === "income" ? "text-gold" : "text-destructive")}>
                        {t.type === "income" ? "+" : "−"} {fmt.format(t.amount)}
                      </span>
                      <button onClick={() => remove.mutate(t.id)} className="ml-2 text-muted-foreground hover:text-destructive" aria-label="Remover">
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

      {editingCard && <CardModal card={editingCard} onClose={() => setEditingCard(null)} />}
      {creatingCard && <CardModal card={null} onClose={() => setCreatingCard(false)} />}
      {payingInvoice && <PayInvoiceModal info={payingInvoice} onClose={() => setPayingInvoice(null)} />}
      {viewingInvoice && (
        <InvoiceDetailsModal
          card={viewingInvoice}
          txs={txs.filter((t) => t.credit_card_id === viewingInvoice.id)}
          purchases={purchases.filter((p) => p.credit_card_id === viewingInvoice.id)}
          invoicePayments={invoicePayments.filter((i) => i.credit_card_id === viewingInvoice.id)}
          onClose={() => setViewingInvoice(null)}
          onPay={(month, amount) => {
            setViewingInvoice(null);
            setPayingInvoice({ card: viewingInvoice, month, amount });
          }}
        />
      )}
    </>
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

function SummaryCard({ label, value, icon, tone, highlight }: { label: string; value: string; icon: React.ReactNode; tone: "income" | "expense"; highlight?: boolean }) {
  return (
    <div className={cn("rounded-3xl p-5 ring-1 ring-border", highlight ? "bg-[var(--gradient-hero)]" : "bg-surface")}>
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className={cn(tone === "income" ? "text-gold" : "text-destructive")}>{icon}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

/* ============================================================ CARD MODAL */

function CardModal({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(card?.name ?? "");
  const [limit, setLimit] = useState(card ? String(card.limit_amount).replace(".", ",") : "");
  const [color, setColor] = useState(card?.color ?? "#F7C534");
  const [isBenefit, setIsBenefit] = useState(card?.is_benefit ?? false);
  const [dueDay, setDueDay] = useState(card?.due_day?.toString() ?? "");
  const [closingDay, setClosingDay] = useState(card?.closing_day?.toString() ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const lim = parseFloat(limit.replace(",", "."));
      if (!name.trim() || !Number.isFinite(lim) || lim < 0) throw new Error("Preencha nome e limite.");
      const payload = {
        name: name.trim(),
        limit_amount: lim,
        color,
        is_benefit: isBenefit,
        due_day: dueDay ? Math.min(31, Math.max(1, parseInt(dueDay, 10))) : null,
        closing_day: closingDay ? Math.min(31, Math.max(1, parseInt(closingDay, 10))) : null,
      };
      if (card) {
        const { error } = await supabase.from("credit_cards").update(payload).eq("id", card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credit_cards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_cards"] });
      toast.success(card ? "Cartão atualizado!" : "Cartão criado!");
      onClose();
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!card) return;
      const { error } = await supabase.from("credit_cards").delete().eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_cards"] });
      toast.success("Cartão removido.");
      onClose();
    },
  });

  return (
    <ModalShell title={card ? "Editar cartão" : "Novo cartão"} onClose={onClose}>
      <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      <Field label="Limite (R$)"><input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia de vencimento"><input value={dueDay} onChange={(e) => setDueDay(e.target.value)} inputMode="numeric" placeholder="10" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
        <Field label="Dia de fechamento"><input value={closingDay} onChange={(e) => setClosingDay(e.target.value)} inputMode="numeric" placeholder="3" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      </div>
      <Field label="Cor"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-xl bg-surface-elevated" /></Field>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2 text-sm">
        <input type="checkbox" checked={isBenefit} onChange={(e) => setIsBenefit(e.target.checked)} className="h-4 w-4 accent-gold" />
        Benefício (renova mensalmente, sem fatura cumulativa)
      </label>
      {save.isError && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
      <div className="flex gap-2 pt-1">
        {card && (
          <button
            type="button"
            onClick={() => { if (confirm(`Remover o cartão "${card.name}"? Esta ação não pode ser desfeita.`)) del.mutate(); }}
            disabled={del.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover cartão
          </button>
        )}
        <button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">
          Salvar
        </button>
      </div>
    </ModalShell>
  );
}

/* ============================================================ PAY INVOICE */

function PayInvoiceModal({ info, onClose }: { info: { card: Card; month: string; amount: number }; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [value, setValue] = useState(String(info.amount.toFixed(2)).replace(".", ","));

  const pay = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Valor inválido.");
      const { error } = await supabase.from("card_invoice_payments").insert({
        credit_card_id: info.card.id,
        reference_month: info.month,
        amount: v,
        paid_on: paidOn,
        paid_method: method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["card_invoice_payments"] });
      toast.success("Fatura registrada como paga!");
      onClose();
    },
  });

  return (
    <ModalShell title={`Pagar fatura — ${info.card.name}`} onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        Referência: {new Date(info.month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </p>
      <Field label="Valor pago (R$)"><input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      <Field label="Data do pagamento"><input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
        <button type="button" onClick={() => setMethod("cash")} className={cn("rounded-lg py-2 text-sm font-medium", method === "cash" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>Dinheiro/Débito</button>
        <button type="button" onClick={() => setMethod("transfer")} className={cn("rounded-lg py-2 text-sm font-medium", method === "transfer" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>Transferência/Pix</button>
      </div>
      {pay.isError && <p className="text-xs text-destructive">{(pay.error as Error).message}</p>}
      <button onClick={() => pay.mutate()} disabled={pay.isPending} className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">
        Confirmar pagamento
      </button>
    </ModalShell>
  );
}

/* ============================================================ INVOICE DETAILS */

function InvoiceDetailsModal({
  card, txs, purchases, invoicePayments, onClose, onPay,
}: {
  card: Card;
  txs: Tx[];
  purchases: Purchase[];
  invoicePayments: InvoicePayment[];
  onClose: () => void;
  onPay: (month: string, amount: number) => void;
}) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const monthTxs = txs.filter((t) => t.occurred_on.startsWith(month));
  const fatura = monthTxs.reduce((s, t) => s + t.amount, 0);
  const paid = invoicePayments.find((i) => i.reference_month === month);
  const activePurchases = purchases.filter((p) => p.installments_paid < p.installments_total);
  const commitFuture = activePurchases.reduce((s, p) => {
    const per = p.total_amount / p.installments_total;
    return s + (p.installments_total - p.installments_paid) * per;
  }, 0);

  // build month picker (last 6 + next 2)
  const months: string[] = [];
  const now = new Date();
  for (let i = -6; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <ModalShell title={`Fatura — ${card.name}`} onClose={onClose}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mês de referência</span>
        <select value={month} onChange={(e) => setMonth(e.target.value)}
          className="flex-1 rounded-lg bg-surface-elevated px-2 py-1.5 text-sm">
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(m + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-surface-elevated p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total da fatura</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: card.color ?? undefined }}>{fmt.format(fatura)}</span>
        </div>
        {commitFuture > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            + {fmt.format(commitFuture)} comprometidos em parcelas futuras
          </p>
        )}
        {paid && (
          <p className="mt-2 rounded-lg bg-gold/15 px-2 py-1 text-[11px] font-medium text-gold">
            Paga em {new Date(paid.paid_on).toLocaleDateString("pt-BR")} via {paid.paid_method === "cash" ? "dinheiro/débito" : "transferência/pix"}
          </p>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lançamentos ({monthTxs.length})</h4>
        {monthTxs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nenhum lançamento neste mês.
          </p>
        ) : (
          <ul className="max-h-60 space-y-1.5 overflow-y-auto">
            {monthTxs.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2 text-sm">
                <span className="text-base">{categoryEmoji(t.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.occurred_on).toLocaleDateString("pt-BR")}{t.category ? ` · ${t.category}` : ""}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-destructive">− {fmt.format(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activePurchases.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parcelas em andamento</h4>
          <ul className="space-y-1.5">
            {activePurchases.map((p) => (
              <li key={p.id} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.description}</span>
                  <span className="text-muted-foreground">{p.installments_paid}/{p.installments_total}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!card.is_benefit && !paid && fatura > 0 && (
        <button onClick={() => onPay(month, fatura)}
          className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground">
          <Receipt className="mr-2 inline h-4 w-4" /> Pagar fatura
        </button>
      )}
    </ModalShell>
  );
}



/* ============================================================ BILLS */

function BillsSection({ cards }: { cards: Card[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [recurrence, setRecurrence] = useState<"once" | "monthly" | "weekly" | "yearly">("monthly");
  const [category, setCategory] = useState("");
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills").select("*")
        .order("is_paid", { ascending: true })
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) })) as Bill[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) throw new Error("Preencha descrição e valor.");
      const { error } = await supabase.from("bills").insert({
        description: description.trim(), amount: value, due_date: dueDate, recurrence,
        category: category.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDescription(""); setAmount(""); setCategory(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const undoPaid = useMutation({
    mutationFn: async (b: Bill) => {
      if (b.transaction_id) await supabase.from("transactions").delete().eq("id", b.transaction_id);
      const { error } = await supabase.from("bills")
        .update({ is_paid: false, paid_on: null, paid_method: null, paid_credit_card_id: null, transaction_id: null })
        .eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pagamento desfeito.");
    },
  });

  const remove = useMutation({
    mutationFn: async (b: Bill) => {
      if (b.transaction_id) await supabase.from("transactions").delete().eq("id", b.transaction_id);
      const { error } = await supabase.from("bills").delete().eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contas a pagar</h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
              {fmt.format(totalPending)} pendente
            </span>
          )}
        </div>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground">
          <Plus className="h-3.5 w-3.5" /> Nova conta
        </button>
      </div>

      {open && (
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mb-4 grid gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border md:grid-cols-5">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (ex: Aluguel)" className="rounded-xl bg-surface-elevated px-3 py-2 text-sm md:col-span-2" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Valor" className="rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as typeof recurrence)} className="rounded-xl bg-surface-elevated px-3 py-2 text-sm">
            <option value="once">Uma vez</option><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option>
          </select>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria (opcional)" className="rounded-xl bg-surface-elevated px-3 py-2 text-sm md:col-span-3" />
          <button type="submit" disabled={add.isPending} className="rounded-xl bg-gold py-2 text-sm font-semibold text-gold-foreground md:col-span-2">Salvar</button>
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
            const paidCard = b.paid_credit_card_id ? cards.find((c) => c.id === b.paid_credit_card_id) : null;
            return (
              <li key={b.id} className={cn("flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border", b.is_paid && "opacity-70")}>
                <button onClick={() => b.is_paid ? undoPaid.mutate(b) : setPayingBill(b)}
                  className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    b.is_paid ? "bg-gold/20 text-gold hover:bg-destructive/15 hover:text-destructive"
                      : overdue ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                      : "bg-surface-elevated text-muted-foreground hover:bg-gold/15 hover:text-gold")}
                  title={b.is_paid ? "Desfazer pagamento" : "Marcar como paga"}>
                  {b.is_paid ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", b.is_paid && "line-through")}>{b.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence {new Date(b.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    {b.category && ` · ${b.category}`}
                    {b.recurrence !== "once" && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <Repeat className="h-3 w-3" /> {b.recurrence === "monthly" ? "mensal" : b.recurrence === "weekly" ? "semanal" : "anual"}
                      </span>
                    )}
                    {b.is_paid && b.paid_method && (
                      <span className="ml-1">· Pago via {b.paid_method === "card" && paidCard ? paidCard.name : "Dinheiro/Débito"}</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{fmt.format(b.amount)}</p>
                  {!b.is_paid && (
                    <p className={cn("text-[10px] font-medium", overdue ? "text-destructive" : soon ? "text-gold" : "text-muted-foreground")}>
                      {overdue ? `${Math.abs(dleft)}d atrasada` : dleft === 0 ? "hoje" : dleft === 1 ? "amanhã" : `em ${dleft}d`}
                    </p>
                  )}
                </div>
                <button onClick={() => setEditingBill(b)} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove.mutate(b)} className="ml-1 text-muted-foreground hover:text-destructive" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}

      {payingBill && <PayBillModal bill={payingBill} cards={cards} onClose={() => setPayingBill(null)} />}
      {editingBill && <EditBillModal bill={editingBill} onClose={() => setEditingBill(null)} />}
    </section>
  );
}

function PayBillModal({ bill, cards, onClose }: { bill: Bill; cards: Card[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [cardId, setCardId] = useState<string>(cards[0]?.id ?? "");
  const [paidOn, setPaidOn] = useState(todayISO());

  const pay = useMutation({
    mutationFn: async () => {
      const { data: tx, error: txErr } = await supabase.from("transactions").insert({
        type: "expense", amount: bill.amount, description: bill.description,
        category: bill.category ?? "Contas", occurred_on: paidOn,
        credit_card_id: method === "card" ? cardId || null : null,
      }).select("id").single();
      if (txErr) throw txErr;

      const { error } = await supabase.from("bills").update({
        is_paid: true, paid_on: paidOn, paid_method: method,
        paid_credit_card_id: method === "card" ? cardId : null,
        transaction_id: tx?.id ?? null,
      }).eq("id", bill.id);
      if (error) throw error;

      if (bill.recurrence !== "once") {
        const d = new Date(bill.due_date + "T00:00:00");
        if (bill.recurrence === "monthly") d.setMonth(d.getMonth() + 1);
        if (bill.recurrence === "weekly") d.setDate(d.getDate() + 7);
        if (bill.recurrence === "yearly") d.setFullYear(d.getFullYear() + 1);
        await supabase.from("bills").insert({
          description: bill.description, amount: bill.amount,
          due_date: d.toISOString().slice(0, 10), recurrence: bill.recurrence,
          category: bill.category, credit_card_id: bill.credit_card_id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Conta paga!"); onClose();
    },
  });

  return (
    <ModalShell title={`Como você pagou "${bill.description}"?`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
        <button type="button" onClick={() => setMethod("cash")} className={cn("rounded-lg py-2 text-sm font-medium transition", method === "cash" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>Dinheiro/Débito</button>
        <button type="button" onClick={() => setMethod("card")} className={cn("rounded-lg py-2 text-sm font-medium transition", method === "card" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>Cartão de crédito</button>
      </div>
      {method === "card" && (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Cartão</span>
          <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm">
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Data do pagamento</span>
        <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
      </label>
      <p className="text-xs text-muted-foreground">Valor: <strong className="text-foreground">{fmt.format(bill.amount)}</strong></p>
      <button onClick={() => pay.mutate()} disabled={pay.isPending} className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">Confirmar pagamento</button>
    </ModalShell>
  );
}

function EditBillModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(bill.description);
  const [amount, setAmount] = useState(String(bill.amount).replace(".", ","));
  const [dueDate, setDueDate] = useState(bill.due_date);
  const [recurrence, setRecurrence] = useState(bill.recurrence);
  const [category, setCategory] = useState(bill.category ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!description.trim() || !Number.isFinite(value) || value <= 0) throw new Error("Preencha descrição e valor.");
      const { error } = await supabase.from("bills").update({
        description: description.trim(), amount: value, due_date: dueDate, recurrence,
        category: category.trim() || null,
      }).eq("id", bill.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Conta atualizada!"); onClose();
    },
  });

  return (
    <ModalShell title="Editar conta" onClose={onClose}>
      <Field label="Descrição"><input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
        <Field label="Vencimento"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      </div>
      <Field label="Recorrência">
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as typeof recurrence)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm">
          <option value="once">Uma vez</option><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option>
        </select>
      </Field>
      <Field label="Categoria"><input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
      {save.isError && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
      <button onClick={() => save.mutate()} disabled={save.isPending} className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">Salvar alterações</button>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ============================================================ PURCHASES */

function PurchasesSection({ cards, purchases }: { cards: Card[]; purchases: Purchase[] }) {
  const qc = useQueryClient();
  const payInstallment = useMutation({
    mutationFn: async (p: Purchase) => {
      if (p.installments_paid >= p.installments_total) return;
      const per = p.total_amount / p.installments_total;
      const next = p.installments_paid + 1;
      const { error: txErr } = await supabase.from("transactions").insert({
        type: "expense", amount: per,
        description: `${p.description} (${next}/${p.installments_total})`,
        category: p.category ?? "Parcelamento",
        occurred_on: todayISO(),
        credit_card_id: p.credit_card_id,
      });
      if (txErr) throw txErr;
      const { error } = await supabase.from("purchases").update({ installments_paid: next }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Parcela paga! Limite liberado.");
    },
  });

  const undoInstallment = useMutation({
    mutationFn: async (p: Purchase) => {
      if (p.installments_paid <= 0) return;
      const { error } = await supabase.from("purchases").update({ installments_paid: p.installments_paid - 1 }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  if (purchases.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Compras parceladas</h2>
        <span className="text-[10px] text-muted-foreground">(crie pelo formulário "Nova movimentação" marcando "Compra parcelada")</span>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {purchases.map((p) => {
          const card = cards.find((c) => c.id === p.credit_card_id);
          const per = p.installments_total > 0 ? p.total_amount / p.installments_total : 0;
          const remaining = p.installments_total - p.installments_paid;
          const remainingAmount = remaining * per;
          const pct = p.installments_total > 0 ? (p.installments_paid / p.installments_total) * 100 : 0;
          const done = remaining === 0;
          return (
            <li key={p.id} className="rounded-2xl bg-surface p-4 ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {card?.name ?? "Cartão"} · {fmt.format(p.total_amount)} em {p.installments_total}x de {fmt.format(per)}
                    {p.category && ` · ${p.category}`}
                  </p>
                </div>
                <button onClick={() => remove.mutate(p.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.installments_paid}/{p.installments_total} pagas · faltam {fmt.format(remainingAmount)}</span>
                <div className="flex gap-1.5">
                  {p.installments_paid > 0 && (
                    <button onClick={() => undoInstallment.mutate(p)} className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground" title="Desfazer última parcela">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                  {!done && (
                    <button onClick={() => payInstallment.mutate(p)} disabled={payInstallment.isPending} className="rounded-full bg-gold px-3 py-1 text-[11px] font-semibold text-gold-foreground disabled:opacity-60">
                      Pagar parcela
                    </button>
                  )}
                  {done && <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-medium text-gold">Quitada</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ============================================================ INVESTMENTS TAB */

function InvestmentsTab() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());

  const { data: items = [] } = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, amount: Number(i.amount) })) as Investment[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const v = parseFloat(amount.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Valor inválido.");
      const { error } = await supabase.from("investments").insert({
        kind, amount: v, description: description.trim(), occurred_on: occurredOn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDescription(""); setAmount("");
      qc.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Registrado!");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments"] }),
  });

  const { total, deposits, withdrawals } = useMemo(() => {
    let d = 0, w = 0;
    for (const i of items) {
      if (i.kind === "deposit") d += i.amount; else w += i.amount;
    }
    return { deposits: d, withdrawals: w, total: d - w };
  }, [items]);

  return (
    <>
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total investido" value={fmt.format(total)} icon={<PiggyBank className="h-5 w-5" />} tone="income" highlight />
        <SummaryCard label="Aportes (total)" value={fmt.format(deposits)} icon={<ArrowUpCircle className="h-5 w-5" />} tone="income" />
        <SummaryCard label="Resgates (total)" value={fmt.format(withdrawals)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="expense" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="h-fit space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Novo movimento</h2>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-elevated p-1">
            <button type="button" onClick={() => setKind("deposit")} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition", kind === "deposit" ? "bg-gold text-gold-foreground" : "text-muted-foreground")}>
              <ArrowUpCircle className="h-4 w-4" /> Aporte
            </button>
            <button type="button" onClick={() => setKind("withdrawal")} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition", kind === "withdrawal" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground")}>
              <ArrowDownCircle className="h-4 w-4" /> Resgate
            </button>
          </div>

          <Field label="Descrição (opcional)"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: CDB Banco X" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
            <Field label="Data"><input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" /></Field>
          </div>
          {add.isError && <p className="text-xs text-destructive">{(add.error as Error).message}</p>}
          <button type="submit" disabled={add.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-foreground disabled:opacity-60">
            <Plus className="h-4 w-4" /> Registrar
          </button>
        </form>

        <section>
          {items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Nenhum movimento ainda. Registre seu primeiro aporte ao lado.
            </div>
          ) : (
            <div className="rounded-3xl bg-surface ring-1 ring-border">
              <ul className="divide-y divide-border/60">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", i.kind === "deposit" ? "bg-gold/15 text-gold" : "bg-destructive/15 text-destructive")}>
                      {i.kind === "deposit" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{i.description || (i.kind === "deposit" ? "Aporte" : "Resgate")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(i.occurred_on).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums", i.kind === "deposit" ? "text-gold" : "text-destructive")}>
                      {i.kind === "deposit" ? "+" : "−"} {fmt.format(i.amount)}
                    </span>
                    <button onClick={() => remove.mutate(i.id)} className="ml-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
