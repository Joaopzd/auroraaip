import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fmt, monthKey, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/fluxo-mensal")({
  component: FluxoMensalPage,
  head: () => ({ meta: [{ title: "Fluxo mensal — Ditto" }] }),
});

function FluxoMensalPage() {
  const navigate = useNavigate();

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
  });

  const months = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of txs) {
      const key = monthKey(t.occurred_on);
      const cur = map.get(key) ?? { income: 0, expense: 0 };
      if (t.type === "income") cur.income += t.amount; else cur.expense += t.amount;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([month, v]) => ({ month, ...v, balance: v.income - v.expense }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .slice(0, 12);
  }, [txs]);

  const maxValue = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));

  return (
    <div className="px-5">
      <button onClick={() => navigate({ to: "/financas" })} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Finanças
      </button>

      <h1 className="mb-6 text-2xl font-bold">Fluxo mensal</h1>

      {months.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma movimentação registrada ainda.
        </p>
      ) : (
        <ul className="space-y-3 pb-6">
          {months.map((m) => (
            <li key={m.month} className="rounded-2xl bg-surface p-4 ring-1 ring-border">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">
                  {new Date(m.month + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <span className={cn("text-sm font-bold tabular-nums", m.balance >= 0 ? "text-gold" : "text-destructive")}>
                  {fmt.format(m.balance)}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-gold" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(m.income / maxValue) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt.format(m.income)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${(m.expense / maxValue) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt.format(m.expense)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
