import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Star, Check, Trash2, Clock, Wallet, ShoppingBag, PartyPopper, ChevronRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/useProfile";

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
type Item = { id: string; list_id: string; content: string; completed: boolean };

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
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

function MeuDiaPage() {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const { displayName } = useProfile();

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

  const { data: weekBudget } = useQuery({
    queryKey: ["weekly_budget", startOfWeek()],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_budgets").select("amount").eq("week_start", startOfWeek()).maybeSingle();
      return data ? Number(data.amount) : 0;
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

  const { data: allItems = [] } = useQuery({
    queryKey: ["list_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("list_items").select("id,list_id,content,completed");
      if (error) throw error;
      return data as Item[];
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

  const toggleItem = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await supabase.from("list_items").update({ completed: !it.completed }).eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list_items"] }),
  });

  const priority = tasks.find((t) => t.is_priority);
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const nextPending = tasks.find((t) => !t.completed && (!priority || t.id !== priority.id));
  const priorityDone = !!priority && priority.completed;

  const focus = useMemo(() => {
    const dow = new Date().getDay();
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const todayBlocks = blocks.filter((b) => b.day_of_week === dow && b.time_label);
    const sorted = [...todayBlocks].sort((a, b) => minutesFromTime(a.time_label) - minutesFromTime(b.time_label));
    const current = [...sorted].reverse().find((b) => minutesFromTime(b.time_label) <= now);
    const next = sorted.find((b) => minutesFromTime(b.time_label) > now);
    return current ?? next ?? null;
  }, [blocks]);

  const { weekIncome, weekExpense } = useMemo(() => {
    let i = 0, e = 0;
    for (const t of weekTxs) {
      if (t.type === "income") i += t.amount; else e += t.amount;
    }
    return { weekIncome: i, weekExpense: e };
  }, [weekTxs]);

  const pendingByList = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of allItems) {
      if (!it.completed) {
        const arr = m.get(it.list_id) ?? [];
        arr.push(it); m.set(it.list_id, arr);
      }
    }
    return m;
  }, [allItems]);

  const activeShopping = useMemo(
    () => shoppingLists
      .map((l) => ({ ...l, items: pendingByList.get(l.id) ?? [] }))
      .filter((l) => l.items.length > 0),
    [shoppingLists, pendingByList],
  );
  const totalPendingItems = activeShopping.reduce((a, l) => a + l.items.length, 0);

  const budget = weekBudget ?? 0;
  const budgetPct = budget > 0 ? Math.min(100, (weekExpense / budget) * 100) : 0;
  const budgetRemaining = Math.max(0, budget - weekExpense);

  const insight = useMemo(() => {
    const parts: string[] = [];
    if (priorityDone) parts.push("Sua prioridade do dia já está concluída ✨");
    else if (priority) parts.push(`Sua prioridade é "${priority.title}"`);
    if (total > 0) parts.push(`${completed}/${total} tarefas feitas`);
    if (budget > 0) {
      if (weekExpense <= budget) parts.push(`R$ ${budgetRemaining.toFixed(0)} dentro da meta da semana`);
      else parts.push(`R$ ${(weekExpense - budget).toFixed(0)} acima da meta semanal`);
    } else if (weekExpense > 0) {
      parts.push(`R$ ${weekExpense.toFixed(0)} gastos esta semana`);
    }
    if (parts.length === 0) return "Que bom te ver por aqui! Adicione tarefas para começar o dia.";
    return parts.join(" · ") + ".";
  }, [priority, priorityDone, completed, total, budget, budgetRemaining, weekExpense]);

  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="px-1 sm:px-5">
      {/* Personal header */}
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground capitalize">{todayLabel}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          {greeting()}, {displayName?.split(" ")[0] || "por aqui"}! <span className="text-gold">🌟</span>
        </h1>
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-gold/10 px-4 py-3 ring-1 ring-gold/20">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">Insight da Aurora</p>
            <p className="mt-0.5 text-sm leading-snug">{insight}</p>
          </div>
        </div>
      </header>

      {/* Priority */}
      <section className={cn(
        "mb-4 overflow-hidden rounded-3xl p-6 shadow-[var(--shadow-card)] ring-1",
        priorityDone
          ? "bg-gradient-to-br from-gold/20 via-gold/10 to-transparent ring-gold/40"
          : "bg-[var(--gradient-hero)] ring-border",
      )}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
          {priorityDone ? <PartyPopper className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5 fill-gold" />}
          {priorityDone ? "Prioridade concluída!" : "Prioridade do dia"}
        </div>

        {priorityDone ? (
          <>
            <p className="mt-3 text-lg font-semibold leading-snug text-gold">
              Excelente! Você cumpriu o mais importante hoje. 🎉
            </p>
            {nextPending ? (
              <div className="mt-4 rounded-2xl bg-surface/80 p-4 ring-1 ring-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Próxima recomendação
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{nextPending.title}</p>
                  <button
                    onClick={() => toggle.mutate(nextPending)}
                    className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Sem mais tarefas pendentes. Aproveite o dia!</p>
            )}
          </>
        ) : priority ? (
          <p className="mt-3 text-xl font-semibold leading-snug">{priority.title}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Toque na estrela ao lado de uma tarefa para destacá-la como prioridade.
          </p>
        )}
      </section>

      {/* Mini widgets */}
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

        {/* Finance — budget aware */}
        <Link to="/financas" className="rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3 w-3" /> Semana
          </div>
          {budget > 0 ? (
            <>
              <p className="mt-2 text-sm font-bold tabular-nums">
                {fmt.format(weekExpense)}{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  de {fmt.format(budget)}
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={cn("h-full rounded-full transition-all", weekExpense > budget ? "bg-destructive" : "bg-gold")}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className={cn("mt-1 text-[11px]", weekExpense > budget ? "text-destructive" : "text-muted-foreground")}>
                {weekExpense > budget
                  ? `${fmt.format(weekExpense - budget)} acima da meta`
                  : `${fmt.format(budgetRemaining)} restantes`}
              </p>
            </>
          ) : (
            <>
              <p className={cn("mt-2 text-sm font-bold tabular-nums", weekIncome - weekExpense >= 0 ? "text-gold" : "text-destructive")}>
                {fmt.format(weekIncome - weekExpense)}
              </p>
              <p className="text-xs text-muted-foreground">−{fmt.format(weekExpense)} · defina uma meta</p>
            </>
          )}
        </Link>

        {/* Shopping — interactive */}
        <div
          className="relative rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40"
          onMouseEnter={() => setShoppingOpen(true)}
          onMouseLeave={() => setShoppingOpen(false)}
        >
          <button
            onClick={() => setShoppingOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <ShoppingBag className="h-3 w-3" /> Compras
              </div>
              {activeShopping.length > 0 ? (
                <>
                  <p className="mt-2 text-sm font-semibold">{activeShopping[0].name}</p>
                  <p className="text-xs text-gold">{totalPendingItems} itens pendentes</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Tudo em dia.</p>
              )}
            </div>
            {activeShopping.length > 0 && (
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", shoppingOpen && "rotate-90")} />
            )}
          </button>

          {shoppingOpen && activeShopping.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              {activeShopping[0].items.slice(0, 4).map((it) => (
                <button
                  key={it.id}
                  onClick={() => toggleItem.mutate(it)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs hover:bg-surface-elevated"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40">
                    {toggleItem.isPending ? null : null}
                  </span>
                  <span className="flex-1 truncate">{it.content}</span>
                </button>
              ))}
              {activeShopping[0].items.length > 4 && (
                <Link to="/listas" className="block pt-1 text-center text-[11px] text-gold hover:underline">
                  Ver todos ({activeShopping[0].items.length})
                </Link>
              )}
            </div>
          )}
        </div>
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
