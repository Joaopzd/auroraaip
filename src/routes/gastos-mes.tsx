import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoryEmoji } from "@/lib/categories";
import { fmt, todayISO, monthKey, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/gastos-mes")({
  component: GastosMesPage,
  head: () => ({ meta: [{ title: "Gastos do mês — Ditto" }] }),
});

const PALETTE = ["#F7C534", "#2DD4BF", "#F472B6", "#818CF8", "#FB923C", "#4ADE80", "#F87171", "#A78BFA"];

function GastosMesPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(monthKey(todayISO()));

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
  });

  const monthExpenses = useMemo(
    () => txs.filter((t) => t.type === "expense" && monthKey(t.occurred_on) === month),
    [txs, month],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthExpenses) {
      const key = t.category || "Outros";
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    const total = monthExpenses.reduce((a, t) => a + t.amount, 0);
    return Array.from(map.entries())
      .map(([category, amount], i) => ({ category, amount, pct: total > 0 ? (amount / total) * 100 : 0, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  const total = byCategory.reduce((a, c) => a + c.amount, 0);

  const shiftMonth = (delta: number) => {
    const d = new Date(month + "-01T00:00:00");
    d.setMonth(d.getMonth() + delta);
    setMonth(monthKey(d.toISOString().slice(0, 10)));
  };

  return (
    <div className="px-5">
      <button onClick={() => navigate({ to: "/financas" })} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Finanças
      </button>

      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gastos por categoria</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-medium capitalize">
            {new Date(month + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => shiftMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mb-6 rounded-2xl bg-surface p-5 text-center ring-1 ring-border">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total gasto</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-destructive">{fmt.format(total)}</p>
      </div>

      {byCategory.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum gasto registrado nesse mês.
        </p>
      ) : (
        <>
          <div className="mb-6 flex h-3 overflow-hidden rounded-full">
            {byCategory.map((c) => (
              <div key={c.category} style={{ width: `${c.pct}%`, backgroundColor: c.color }} title={c.category} />
            ))}
          </div>

          <ul className="space-y-2 pb-6">
            {byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-lg">{categoryEmoji(c.category)}</span>
                <span className="flex-1 truncate text-sm font-medium">{c.category}</span>
                <span className="text-xs text-muted-foreground">{c.pct.toFixed(0)}%</span>
                <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{fmt.format(c.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
