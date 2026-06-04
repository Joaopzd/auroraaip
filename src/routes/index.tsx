import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Star, Check, Trash2, Clock, Wallet, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: MeuDiaPage,
  head: () => ({ meta: [{ title: "Meu Dia — Aurora" }] }),
});

type Task = {
  id: string;
  title: string;
  is_priority: boolean;
  completed: boolean;
  scheduled_date: string;
};
type Block = { id: string; day_of_week: number; time_label: string; title: string; completed: boolean };
type Tx = { type: "income" | "expense"; amount: number; occurred_on: string };
type List = { id: string; name: string };
type ItemCount = { list_id: string; completed: boolean };

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
};
const minutesFromTime = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return -1;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

function MeuDiaPage() {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*").eq("scheduled_date", today())
        .order("is_priority", { ascending: false }).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["routine_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routine_blocks").select("*").order("time_label");
      if (error) throw error;
      return data as Block[];
    },
  });

  const { data: weekTxs = [] } = useQuery({
    queryKey: ["transactions", "week"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("type,amount,occurred_on")
        .gte("occurred_on", startOfWeek());
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
    },
  });

  const { data: shoppingLists = [] } = useQuery({
    queryKey: ["lists", "shopping"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lists").select("id,name").eq("type", "shopping");
      if (error) throw error;
      return data as List[];
    },
  });

  const { data: itemCounts = [] } = useQuery({
    queryKey: ["list_items", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("list_items").select("list_id,completed");
      if (error) throw error;
      return data as ItemCount[];
    },
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from("tasks").insert({ title, scheduled_date: today() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const setPriority = useMutation({
    mutationFn: async (t: Task) => {
      await supabase.from("tasks").update({ is_priority: false }).eq("scheduled_date", today());
      const { error } = await supabase.from("tasks").update({ is_priority: !t.is_priority }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const priority = tasks.find((t) => t.is_priority);
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Current/next routine block for today
  const focus = useMemo(() => {
    const dow = new Date().getDay();
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const today = blocks.filter((b) => b.day_of_week === dow && b.time_label);
    const sorted = [...today].sort((a, b) => minutesFromTime(a.time_label) - minutesFromTime(b.time_label));
    const current = [...sorted].reverse().find((b) => minutesFromTime(b.time_label) <= now);
    const next = sorted.find((b) => minutesFromTime(b.time_label) > now);
    return current ?? next ?? null;
  }, [blocks]);

  // Week balance
  const { weekIncome, weekExpense } = useMemo(() => {
    let i = 0, e = 0;
    for (const t of weekTxs) {
      if (t.type === "income") i += t.amount; else e += t.amount;
    }
    return { weekIncome: i, weekExpense: e };
  }, [weekTxs]);

  // Active shopping lists (with pending items)
  const activeShopping = useMemo(() => {
    const pendingByList = new Map<string, number>();
    for (const it of itemCounts) {
      if (!it.completed) pendingByList.set(it.list_id, (pendingByList.get(it.list_id) ?? 0) + 1);
    }
    return shoppingLists
      .map((l) => ({ ...l, pending: pendingByList.get(l.id) ?? 0 }))
      .filter((l) => l.pending > 0);
  }, [shoppingLists, itemCounts]);

  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="px-5">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Meu Dia</p>
        <h1 className="mt-1 text-3xl font-bold capitalize">{todayLabel}</h1>
      </header>

      {/* Priority */}
      <section className="mb-4 overflow-hidden rounded-3xl bg-[var(--gradient-hero)] p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
          <Star className="h-3.5 w-3.5 fill-gold" /> Prioridade do dia
        </div>
        {priority ? (
          <p className="mt-3 text-xl font-semibold leading-snug">{priority.title}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Toque na estrela ao lado de uma tarefa para destacá-la como prioridade.
          </p>
        )}
      </section>

      {/* Integrated mini-widgets */}
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link to="/semana" className="rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" /> Foco da rotina
          </div>
          {focus ? (
            <>
              <p className="mt-2 text-sm font-semibold">{focus.title}</p>
              <p className="text-xs text-gold">{focus.time_label}</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Sem blocos hoje.</p>
          )}
        </Link>

        <Link to="/financas" className="rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3 w-3" /> Semana
          </div>
          <p className={cn("mt-2 text-sm font-bold tabular-nums", weekIncome - weekExpense >= 0 ? "text-gold" : "text-destructive")}>
            {fmt.format(weekIncome - weekExpense)}
          </p>
          <p className="text-xs text-muted-foreground">
            −{fmt.format(weekExpense)} gastos
          </p>
        </Link>

        <Link to="/listas" className="rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ShoppingBag className="h-3 w-3" /> Compras
          </div>
          {activeShopping.length > 0 ? (
            <>
              <p className="mt-2 text-sm font-semibold">{activeShopping[0].name}</p>
              <p className="text-xs text-gold">{activeShopping.reduce((a, l) => a + l.pending, 0)} itens pendentes</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Tudo em dia.</p>
          )}
        </Link>
      </section>

      {/* Progress */}
      <section className="mb-6 rounded-2xl bg-surface p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Progresso</span>
          <span className="text-sm font-semibold">{completed}/{total} concluídas</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {/* New task */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (newTitle.trim()) { addTask.mutate(newTitle.trim()); setNewTitle(""); } }}
        className="mb-4 flex gap-2 rounded-2xl bg-surface p-2 ring-1 ring-border"
      >
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova tarefa de hoje..."
          className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none" />
        <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground" aria-label="Adicionar">
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id}
            className={cn("flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border", t.completed && "opacity-60")}>
            <button onClick={() => toggle.mutate(t)}
              className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                t.completed ? "border-gold bg-gold text-gold-foreground" : "border-muted-foreground/40")}
              aria-label="Concluir">
              {t.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={cn("flex-1 text-sm", t.completed && "line-through")}>{t.title}</span>
            <button onClick={() => setPriority.mutate(t)}
              className={cn("rounded-lg p-1.5", t.is_priority ? "text-gold" : "text-muted-foreground hover:text-foreground")}
              aria-label="Marcar prioridade">
              <Star className={cn("h-4 w-4", t.is_priority && "fill-gold")} />
            </button>
            <button onClick={() => remove.mutate(t.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa para hoje. Comece adicionando uma acima.
          </li>
        )}
      </ul>
    </div>
  );
}
