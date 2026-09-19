import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { categoryEmoji } from "@/lib/categories";
import { fmt, todayISO, monthKey, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/movimentacoes")({
  component: MovimentacoesPage,
  head: () => ({ meta: [{ title: "Movimentações — Ditto" }] }),
});

function MovimentacoesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey(todayISO()));

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Movimentação removida.");
    },
  });

  const groups = useMemo(() => {
    const monthTxs = txs.filter((t) => monthKey(t.occurred_on) === month);
    const map = new Map<string, Tx[]>();
    for (const t of monthTxs) {
      const arr = map.get(t.occurred_on) ?? [];
      arr.push(t);
      map.set(t.occurred_on, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        total: items.reduce((acc, t) => acc + (t.type === "expense" ? -t.amount : t.amount), 0),
      }));
  }, [txs, month]);

  const monthTotal = groups.reduce((a, g) => a + g.total, 0);

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
        <h1 className="text-2xl font-bold">Movimentações</h1>
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo do mês</p>
        <p className={cn("mt-1 text-3xl font-bold tabular-nums", monthTotal >= 0 ? "text-gold" : "text-destructive")}>{fmt.format(monthTotal)}</p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma movimentação nesse mês.
        </p>
      ) : (
        <div className="space-y-5 pb-6">
          {groups.map((g) => (
            <section key={g.date}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {new Date(g.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                </h2>
                <span className={cn("text-xs font-semibold tabular-nums", g.total >= 0 ? "text-gold" : "text-destructive")}>
                  {fmt.format(g.total)}
                </span>
              </div>
              <ul className="space-y-2">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
                    <span className="text-lg">{categoryEmoji(t.category)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      {t.category && <p className="text-[11px] text-muted-foreground">{t.category}</p>}
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
                    <button
                      onClick={() => { if (confirm(`Remover "${t.description}"?`)) remove.mutate(t.id); }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-elevated hover:text-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
