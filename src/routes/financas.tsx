import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarClock, Check, CreditCard, Eye, EyeOff, Layers,
  Pencil, PiggyBank, Plus, Receipt, Repeat, RotateCcw,
  Trash2, TrendingDown, TrendingUp, Wallet, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PayInvoiceModal } from "@/components/PayInvoiceModal";
import { UsagePie } from "@/components/UsagePie";
import {
  fmt, todayISO, monthKey, maskCurrency, HIDE_VALUES_KEY,
  type Tx, type Card, type Purchase, type Bill, type Investment, type InvoicePayment,
} from "@/lib/finance";

export const Route = createFileRoute("/financas")({
  component: FinancasPage,
  head: () => ({ meta: [
    { title: "Finanças — Ditto" },
    { name: "description", content: "Acompanhe despesas, contas, cartões e investimentos pessoais com a Ditto." },
    { property: "og:title", content: "Finanças — Ditto" },
    { property: "og:description", content: "Acompanhe despesas, contas, cartões e investimentos pessoais com a Ditto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function FinancasPage() {
  const [tab, setTab] = useState<"geral" | "investimentos">("geral");

  return (
    <div className="px-4 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Finanças</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {tab === "geral" ? "Finanças" : "Investimentos"}
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
  const [payingInvoice, setPayingInvoice] = useState<{ card: Card; month: string; amount: number } | null>(null);
  const [hideValues, setHideValues] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(HIDE_VALUES_KEY) === "1";
  });
  const toggleHideValues = () => {
    setHideValues((v) => {
      const next = !v;
      if (typeof window !== "undefined") localStorage.setItem(HIDE_VALUES_KEY, next ? "1" : "0");
      return next;
    });
  };

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

  // Aggregations
  const { income, expense, balance, cardStats, totalInvoices, categories, dailyExpenseSeries } = useMemo(() => {
    const month = todayISO().slice(0, 7);
    let income = 0;
    let expense = 0;
    const cardSpendByMonth = new Map<string, Map<string, number>>();
    const cats = new Set<string>();
    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const dailyExpenseSeries = new Array(daysInMonth).fill(0) as number[];

    for (const t of txs) {
      if (!t.occurred_on) continue;
      if (t.category) cats.add(t.category);
      if (monthKey(t.occurred_on) === month) {
        if (t.type === "income") income += t.amount;
        else {
          expense += t.amount;
          const day = Number(t.occurred_on.slice(8, 10));
          if (day >= 1 && day <= daysInMonth) dailyExpenseSeries[day - 1] += t.amount;
        }
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
    let totalInvoices = 0;
    const cardStats = cards.map((c) => {
      const monthMap = cardSpendByMonth.get(c.id) ?? new Map();
      const fatura = monthMap.get(month) ?? 0;
      const comprometido = cardCommitted.get(c.id) ?? 0;
      const usado = fatura + comprometido;
      const paidThisMonth = invoicePayments.find((i) => i.credit_card_id === c.id && i.reference_month === month);
      if (!c.is_benefit) totalInvoices += usado;
      return {
        ...c,
        fatura,
        comprometido,
        disponivel: Math.max(0, c.limit_amount - usado),
        pct: c.limit_amount > 0 ? Math.min(100, (usado / c.limit_amount) * 100) : 0,
        invoicePaid: !!paidThisMonth,
      };
    });

    // running cumulative for the sparkline
    let running = 0;
    const cumulative = dailyExpenseSeries.map((v) => (running += v));

    return { income, expense, balance: income - expense, cardStats, totalInvoices, categories: [...cats].sort(), dailyExpenseSeries: cumulative };
  }, [txs, cards, purchases, invoicePayments]);

  return (
    <>
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="relative rounded-3xl bg-[var(--gradient-hero)] p-5 ring-1 ring-border">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Saldo do mês</span>
            <button onClick={toggleHideValues} className="text-muted-foreground hover:text-foreground" aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}>
              {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className={cn("text-2xl font-bold tabular-nums sm:text-3xl", balance >= 0 ? "text-gold" : "text-destructive")}>
            {maskCurrency(balance, hideValues)}
          </p>
        </div>
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-border">
          <div className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Total em faturas
          </div>
          <p className="text-2xl font-bold tabular-nums sm:text-3xl">{maskCurrency(totalInvoices, hideValues)}</p>
        </div>
      </section>

      <div className="mb-8">
        <Link
          to="/nova-movimentacao"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90 sm:w-auto sm:px-6"
        >
          <Plus className="h-4 w-4" /> Nova movimentação
        </Link>
      </div>


      {/* Credit Cards */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cartões</h2>
          </div>
          <Link to="/novo-cartao" search={{ id: undefined }} className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground">
            <Plus className="h-3.5 w-3.5" /> Novo cartão
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cardStats.map((c) => (
            <Link
              key={c.id}
              to="/cartao/$id" params={{ id: c.id }}
              className="relative overflow-hidden rounded-3xl bg-surface p-5 ring-1 ring-border transition hover:ring-gold/50"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: c.color ?? "var(--gold)" }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Limite {maskCurrency(c.limit_amount, hideValues)}
                    {c.is_benefit && " · Benefício"}
                    {c.due_day && ` · vence dia ${c.due_day}`}
                    {c.is_benefit && c.renewal_day && ` · renova dia ${c.renewal_day}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/novo-cartao" search={{ id: c.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground" aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <UsagePie pct={c.pct} color={c.color ?? "#F7C534"} size={44} />
                </div>
              </div>

              <div className="mt-5 flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Disponível</span>
                <span className="text-lg font-bold tabular-nums">{maskCurrency(c.disponivel, hideValues)}</span>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.is_benefit ? "Gasto do mês" : "Fatura + parcelas"}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{maskCurrency(c.fatura + c.comprometido, hideValues)}</p>
                  {!c.is_benefit && c.comprometido > 0 && (
                    <p className="text-[10px] text-muted-foreground">{maskCurrency(c.comprometido, hideValues)} em parcelas futuras</p>
                  )}
                </div>
                {c.is_benefit ? (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-medium text-gold">Renova mensalmente</span>
                ) : c.invoicePaid ? (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-medium text-gold">Fatura paga</span>
                ) : c.fatura > 0 ? (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPayingInvoice({ card: c, month: todayISO().slice(0, 7), amount: c.fatura }); }}
                    className="rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/25"
                  >
                    <Receipt className="mr-1 inline h-3 w-3" />Pagar fatura
                  </button>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">Sem fatura</span>
                )}
              </div>
            </Link>
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

      {/* Monthly overview: clickable spending line + income/expense flow */}
      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <Link to="/gastos-mes" className="rounded-3xl bg-surface p-5 ring-1 ring-border transition hover:ring-gold/40">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Gastos do mês</h3>
            <span className="text-xs font-medium text-gold">Por categoria →</span>
          </div>
          <MonthlySparkline data={dailyExpenseSeries} hidden={hideValues} />
        </Link>

        <Link to="/fluxo-mensal" className="rounded-3xl bg-surface p-5 ring-1 ring-border transition hover:ring-gold/40">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Entradas × saídas</h3>
            <span className="text-xs font-medium text-gold">Fluxo mensal →</span>
          </div>
          <div className="space-y-2.5">
            <FlowRow icon={<TrendingUp className="h-3.5 w-3.5 text-gold" />} value={income} total={Math.max(income, expense, 1)} color="bg-gold" hidden={hideValues} />
            <FlowRow icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />} value={expense} total={Math.max(income, expense, 1)} color="bg-destructive" hidden={hideValues} />
          </div>
        </Link>
      </section>

      {payingInvoice && <PayInvoiceModal info={payingInvoice} onClose={() => setPayingInvoice(null)} />}
    </>
  );
}

function MonthlySparkline({ data, hidden }: { data: number[]; hidden: boolean }) {
  const max = Math.max(1, ...data);
  const w = 280;
  const h = 64;
  const points = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  const total = data[data.length - 1] ?? 0;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-2 text-lg font-bold tabular-nums text-destructive">{maskCurrency(total, hidden)}</p>
    </div>
  );
}

function FlowRow({ icon, value, total, color, hidden }: { icon: React.ReactNode; value: number; total: number; color: string; hidden: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">{maskCurrency(value, hidden)}</span>
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
          Nenhuma conta cadastrada. A Ditto vai te lembrar 1 dia antes e no dia do vencimento.
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
