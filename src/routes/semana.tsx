import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2, Wallet, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { categoryEmoji } from "@/lib/categories";
import { occursOn, categoryColorClass, type EventLike } from "@/lib/eventRecurrence";

export const Route = createFileRoute("/semana")({
  component: SemanaPage,
  head: () => ({ meta: [
    { title: "Calendário — Ditto" },
    { name: "description", content: "Acompanhe a semana e o calendário de eventos com a Ditto." },
    { property: "og:title", content: "Calendário — Ditto" },
    { property: "og:description", content: "Acompanhe a semana e o calendário de eventos com a Ditto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type EventRow = EventLike & {
  id: string;
  title: string;
  time_label: string;
  category: string;
  completed: boolean;
};
type Category = { id: string; name: string; color: string };

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function sundayOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function SemanaPage() {
  const qc = useQueryClient();
  const [activeDay, setActiveDay] = useState(new Date().getDay());

  const weekDates = useMemo(() => {
    const sunday = sundayOfThisWeek();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, []);
  const activeDate = weekDates[activeDay];

  const { data: events = [] } = useQuery({
    queryKey: ["routine_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_blocks")
        .select("id,title,event_date,time_label,recurrence,category,day_of_week,completed")
        .order("time_label", { ascending: true });
      if (error) throw error;
      return data as EventRow[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["event_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_categories").select("id,name,color");
      if (error) throw error;
      return data as Category[];
    },
  });
  const catColor = (name: string) => categories.find((c) => c.name === name)?.color;

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routine_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine_blocks"] }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("routine_blocks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine_blocks"] }),
  });

  const dayEvents = events.filter((e) => occursOn(e, activeDate));

  return (
    <div className="px-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Semana</p>
          <h1 className="mt-1 text-3xl font-bold">Calendário</h1>
        </div>
        <Link
          to="/calendario"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-xs font-semibold ring-1 ring-border hover:ring-gold/40"
        >
          <CalendarDays className="h-3.5 w-3.5 text-gold" /> Ver calendário
        </Link>
      </header>

      <WeeklyBudgetCard />


      <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SHORT.map((d, i) => {
          const active = i === activeDay;
          return (
            <button
              key={d}
              onClick={() => setActiveDay(i)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                active
                  ? "bg-gold text-gold-foreground shadow-[var(--shadow-gold)]"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-80">{d}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{DAYS[activeDay]}</h2>
        <Link
          to="/novo-evento" search={{ date: activeDate }}
          className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Novo evento
        </Link>
      </div>

      <ul className="mb-6 space-y-2">
        {dayEvents.map((e) => (
          <li
            key={e.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border transition",
              e.completed && "opacity-60",
            )}
          >
            <Checkbox
              checked={e.completed}
              onCheckedChange={(v) => toggle.mutate({ id: e.id, completed: v === true })}
              className="h-5 w-5 shrink-0 rounded-md border-gold data-[state=checked]:bg-gold data-[state=checked]:text-gold-foreground"
              aria-label="Marcar como concluído"
            />
            <span className={cn("h-2 w-2 shrink-0 rounded-full", categoryColorClass(catColor(e.category)))} />
            <div className="w-14 shrink-0 text-sm font-semibold text-gold">
              {e.time_label || "--:--"}
            </div>
            <div className="h-10 w-px bg-border" />
            <Link to="/novo-evento" search={{ id: e.id }} className={cn("flex-1 truncate text-sm", e.completed && "line-through")}>
              {e.title}
            </Link>
            <button
              onClick={() => remove.mutate(e.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {dayEvents.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum evento para {DAYS[activeDay]} ainda.
          </li>
        )}
      </ul>
    </div>
  );
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function sundayOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

function WeeklyBudgetCard() {
  const qc = useQueryClient();
  const weekStart = sundayOfWeek();
  const weekEnd = (() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const [editing, setEditing] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [value, setValue] = useState("");

  const { data: budget } = useQuery({
    queryKey: ["weekly_budget", weekStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_budgets")
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle();
      return data;
    },
  });

  const { data: spent = 0 } = useQuery({
    queryKey: ["week_expenses", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount,type,occurred_on")
        .eq("type", "expense")
        .gte("occurred_on", weekStart)
        .lte("occurred_on", weekEnd);
      if (error) throw error;
      return (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Valor inválido");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("weekly_budgets")
        .upsert(
          { user_id: authData.user.id, week_start: weekStart, amount: v },
          { onConflict: "user_id,week_start" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["weekly_budget", weekStart] });
    },
  });

  const cap = budget ? Number(budget.amount) : 0;
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
  const over = cap > 0 && spent > cap;
  const isSunday = new Date().getDay() === 0;

  return (
    <section className="mb-6 rounded-3xl bg-surface p-5 ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold">Gasto semanal</h2>
          {isSunday && !budget && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
              Domingo de planejamento
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setValue(cap ? String(cap) : "");
            setEditing((v) => !v);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {budget ? "Editar teto" : "Definir teto"}
        </button>
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="flex gap-2"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="R$ 500,00"
            className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-sm focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground"
          >
            Salvar
          </button>
        </form>
      ) : budget ? (
        <button
          type="button"
          onClick={() => setBreakdownOpen(true)}
          className="w-full text-left transition hover:opacity-90"
          title="Ver detalhamento da semana"
        >
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="tabular-nums">
              <span className={cn("font-semibold", over && "text-destructive")}>
                {fmt.format(spent)}
              </span>
              <span className="text-muted-foreground"> / {fmt.format(cap)}</span>
            </span>
            <span
              className={cn(
                "text-xs",
                over ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {over ? `Excedeu em ${fmt.format(spent - cap)}` : `Sobra ${fmt.format(cap - spent)}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                over ? "bg-destructive" : "bg-gold",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-gold/80">
            Toque para ver detalhamento ↗
          </p>
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Defina um teto de gastos para esta semana e a Ditto te avisa se passar.
        </p>
      )}

      {breakdownOpen && <WeeklyBreakdownModal onClose={() => setBreakdownOpen(false)} />}
    </section>
  );
}


function WeeklyBreakdownModal({ onClose }: { onClose: () => void }) {
  const weekStart = sundayOfWeek();
  const weekEnd = (() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  const { data: rows = [] } = useQuery({
    queryKey: ["week_breakdown", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount,category,description,occurred_on,type")
        .eq("type", "expense")
        .gte("occurred_on", weekStart)
        .lte("occurred_on", weekEnd)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
    },
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const cat = r.category || "Sem categoria";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + r.amount);
    total += r.amount;
  }
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] space-y-4 overflow-y-auto rounded-3xl bg-surface p-6 ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Detalhamento da semana</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(weekStart).toLocaleDateString("pt-BR")} – {new Date(weekEnd).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-baseline justify-between rounded-2xl bg-surface-elevated px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total gasto</span>
          <span className="text-xl font-bold tabular-nums">{fmt.format(total)}</span>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum gasto registrado esta semana.
          </p>
        ) : (
          <>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por categoria</h4>
              <ul className="space-y-2">
                {sorted.map(([cat, amt]) => {
                  const pct = total > 0 ? (amt / total) * 100 : 0;
                  return (
                    <li key={cat}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="text-base">{categoryEmoji(cat)}</span>
                          {cat}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{fmt.format(amt)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lançamentos ({rows.length})</h4>
              <ul className="space-y-1.5">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2 text-sm">
                    <span className="text-base">{categoryEmoji(r.category)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{r.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.occurred_on).toLocaleDateString("pt-BR")}{r.category ? ` · ${r.category}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-destructive">− {fmt.format(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



