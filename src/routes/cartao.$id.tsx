import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Receipt, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { categoryEmoji } from "@/lib/categories";
import { UsagePie } from "@/components/UsagePie";
import { PayInvoiceModal } from "@/components/PayInvoiceModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { fmt, todayISO, monthKey, type Card, type Tx, type Purchase, type InvoicePayment } from "@/lib/finance";

export const Route = createFileRoute("/cartao/$id")({
  component: CartaoPage,
  head: () => ({ meta: [{ title: "Movimentações do cartão — Ditto" }] }),
});

function CartaoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [month, setMonth] = useState(monthKey(todayISO()));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showPay, setShowPay] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: card } = useQuery({
    queryKey: ["credit_cards", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_cards").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Card;
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", "card", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("credit_card_id", id);
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases", "card", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("*").eq("credit_card_id", id);
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, total_amount: Number(p.total_amount) })) as Purchase[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["card_invoice_payments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("card_invoice_payments").select("*").eq("credit_card_id", id);
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as InvoicePayment[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(txs.map((t) => t.category).filter(Boolean))) as string[],
    [txs],
  );

  const filtered = useMemo(() => {
    return txs
      .filter((t) => {
        if (from && t.occurred_on < from) return false;
        if (to && t.occurred_on > to) return false;
        if (!from && !to && monthKey(t.occurred_on) !== month) return false;
        if (category !== "all" && t.category !== category) return false;
        return true;
      })
      .sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));
  }, [txs, from, to, month, category]);

  const currentMonthTotal = useMemo(
    () => txs.filter((t) => t.type === "expense" && monthKey(t.occurred_on) === month).reduce((a, t) => a + t.amount, 0),
    [txs, month],
  );
  const paidThisMonth = useMemo(
    () => payments.filter((p) => p.reference_month === month).reduce((a, p) => a + p.amount, 0),
    [payments, month],
  );
  const activePurchases = purchases.filter((p) => p.installments_paid < p.installments_total);
  const usagePct = card ? Math.min(100, (currentMonthTotal / Math.max(1, card.limit_amount)) * 100) : 0;
  const isPaid = paidThisMonth >= currentMonthTotal && currentMonthTotal > 0;

  if (!card) return <LoadingScreen />;

  return (
    <div className="px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={() => navigate({ to: "/financas" })} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Finanças
        </button>
        <Link to="/novo-cartao" search={{ id: card.id }} className="text-xs text-gold hover:underline">Editar cartão</Link>
      </div>

      <header className="mb-6 flex items-center gap-4 rounded-3xl p-5 ring-1 ring-border"
        style={{ background: `linear-gradient(135deg, ${card.color ?? "#2DD4BF"}22, transparent)` }}>
        <UsagePie pct={usagePct} color={card.color ?? "#2DD4BF"} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{card.name}</h1>
          <p className="text-xs text-muted-foreground">
            {card.is_benefit ? `Renova dia ${card.renewal_day ?? "—"}` : `Vence dia ${card.due_day ?? "—"} · Fecha dia ${card.closing_day ?? "—"}`}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-gold">
            {fmt.format(currentMonthTotal)} <span className="text-xs font-normal text-muted-foreground">de {fmt.format(card.limit_amount)}</span>
          </p>
        </div>
        {!card.is_benefit && !isPaid && currentMonthTotal > 0 && (
          <button onClick={() => setShowPay(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-gold-foreground">
            <Receipt className="h-3.5 w-3.5" /> Pagar
          </button>
        )}
      </header>

      {activePurchases.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Parcelamentos ativos</h2>
          <ul className="space-y-2">
            {activePurchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-surface p-3 ring-1 ring-border text-sm">
                <span className="truncate">{p.description}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.installments_paid + 1}/{p.installments_total} · {fmt.format(p.total_amount / p.installments_total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Movimentações</h2>
        <button onClick={() => setFiltersOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium ring-1 ring-border hover:ring-gold/40">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
        </button>
      </div>

      {filtersOpen && (
        <div className="mb-4 space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-border">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Mês (sem período customizado)</p>
            <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setFrom(""); setTo(""); }}
              className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">De</p>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Até</p>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm" />
            </div>
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="flex items-center gap-1 text-xs text-gold hover:underline">
              <X className="h-3 w-3" /> Limpar período, voltar a filtrar por mês
            </button>
          )}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoria</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCategory("all")}
                className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1", category === "all" ? "bg-gold text-gold-foreground ring-gold" : "bg-surface-elevated text-muted-foreground ring-border")}>
                Todas
              </button>
              {categories.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1", category === c ? "bg-gold text-gold-foreground ring-gold" : "bg-surface-elevated text-muted-foreground ring-border")}>
                  {categoryEmoji(c)} {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-2 pb-6">
        {filtered.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
            <span className="text-lg">{categoryEmoji(t.category)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.description}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(t.occurred_on + "T00:00:00").toLocaleDateString("pt-BR")}{t.category ? ` · ${t.category}` : ""}
              </p>
            </div>
            <span className={cn("shrink-0 text-sm font-semibold tabular-nums", t.type === "expense" ? "text-destructive" : "text-gold")}>
              {t.type === "expense" ? "− " : "+ "}{fmt.format(t.amount)}
            </span>
            <Link
              to="/nova-movimentacao" search={{ id: t.id }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma movimentação nesse período.
          </li>
        )}
      </ul>

      {showPay && (
        <PayInvoiceModal
          info={{ card, month, amount: currentMonthTotal - paidThisMonth }}
          onClose={() => setShowPay(false)}
        />
      )}
    </div>
  );
}
