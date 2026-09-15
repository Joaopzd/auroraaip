import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Star, Check, Trash2, Wallet, PartyPopper, Sparkles, Eye, EyeOff, TrendingUp, TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/useProfile";

export const Route = createFileRoute("/")({
  component: MeuDiaPage,
  head: () => ({ meta: [
    { title: "Meu Dia — Ditto" },
    { name: "description", content: "Organize tarefas, prioridades e compromissos do seu dia com a Ditto." },
    { property: "og:title", content: "Meu Dia — Ditto" },
    { property: "og:description", content: "Organize tarefas, prioridades e compromissos do seu dia com a Ditto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Task = {
  id: string;
  title: string;
  is_priority: boolean;
  completed: boolean;
  scheduled_date: string;
};
type Tx = { type: "income" | "expense"; amount: number; occurred_on: string };

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const HIDE_BALANCE_KEY = "ditto:hide-home-balance";
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

function MeuDiaPage() {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [hideBalance, setHideBalance] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(HIDE_BALANCE_KEY) === "1";
  });
  const { displayName } = useProfile();

  const toggleHideBalance = () => {
    setHideBalance((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        localStorage.setItem(HIDE_BALANCE_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

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

  const { data: monthTxs = [] } = useQuery({
    queryKey: ["transactions", "month", currentMonth()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("type,amount,occurred_on")
        .gte("occurred_on", `${currentMonth()}-01`);
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Tx[];
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
  const nextPending = tasks.find((t) => !t.completed && (!priority || t.id !== priority.id));
  const priorityDone = !!priority && priority.completed;

  const { monthIncome, monthExpense } = useMemo(() => {
    let i = 0, e = 0;
    for (const t of monthTxs) {
      if (t.type === "income") i += t.amount; else e += t.amount;
    }
    return { monthIncome: i, monthExpense: e };
  }, [monthTxs]);
  const monthBalance = monthIncome - monthExpense;

  const insight = useMemo(() => {
    const parts: string[] = [];
    if (priorityDone) parts.push("Sua prioridade do dia já está concluída ✨");
    else if (priority) parts.push(`Sua prioridade é "${priority.title}"`);
    if (total > 0) parts.push(`${completed}/${total} tarefas feitas`);
    if (parts.length === 0) return "Que bom te ver por aqui! Adicione tarefas para começar o dia.";
    return parts.join(" · ") + ".";
  }, [priority, priorityDone, completed, total]);

  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div>
      {/* Personal header */}
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground capitalize">{todayLabel}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          {greeting()}, {displayName?.split(" ")[0] || "por aqui"}! <span className="text-gold">🌟</span>
        </h1>
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-gold/10 px-4 py-3 ring-1 ring-gold/20">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">Insight da Ditto</p>
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

      {/* Saldo do mês */}
      <Link
        to="/financas"
        className="mb-4 block rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-gold/40 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3 w-3" /> Saldo do mês
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); toggleHideBalance(); }}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={hideBalance ? "Mostrar saldo" : "Esconder saldo"}
          >
            {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <p className={cn(
          "mt-2 text-2xl font-bold tabular-nums sm:text-3xl",
          hideBalance ? "text-muted-foreground" : monthBalance >= 0 ? "text-gold" : "text-destructive",
        )}>
          {hideBalance ? "R$ ••••••" : fmt.format(monthBalance)}
        </p>

        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-gold" />
            {hideBalance ? "••••" : fmt.format(monthIncome)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            {hideBalance ? "••••" : fmt.format(monthExpense)}
          </span>
        </div>
      </Link>

      {/* Progress */}
      <section className="mb-6 flex items-center gap-4 rounded-2xl bg-surface p-4 sm:p-5">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg viewBox="0 0 40 40" className="h-14 w-14 -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-surface-elevated" />
            <circle
              cx="20" cy="20" r="16" fill="none" strokeWidth="4" strokeLinecap="round"
              className="stroke-gold transition-all"
              strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct / 100)}`}
            />
          </svg>
          <span className="absolute text-xs font-bold tabular-nums">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Progresso do dia</p>
          <p className="text-sm font-semibold">{completed}/{total} tarefas concluídas</p>
        </div>
      </section>

      {/* New task */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (newTitle.trim()) { addTask.mutate(newTitle.trim()); setNewTitle(""); } }}
        className="mb-4 flex gap-2 rounded-2xl bg-surface p-2 ring-1 ring-border"
      >
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova tarefa de hoje..."
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base placeholder:text-muted-foreground focus:outline-none sm:text-sm" />
        <button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-foreground" aria-label="Adicionar">
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id}
            className={cn("flex items-center gap-3 rounded-2xl bg-surface px-3 py-3 ring-1 ring-border sm:px-4", t.completed && "opacity-60")}>
            <button onClick={() => toggle.mutate(t)}
              className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                t.completed ? "border-gold bg-gold text-gold-foreground" : "border-muted-foreground/40")}
              aria-label="Concluir">
              {t.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={cn("flex-1 truncate text-sm", t.completed && "line-through")}>{t.title}</span>
            <button onClick={() => setPriority.mutate(t)}
              className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", t.is_priority ? "text-gold" : "text-muted-foreground hover:text-foreground")}
              aria-label="Marcar prioridade">
              <Star className={cn("h-4 w-4", t.is_priority && "fill-gold")} />
            </button>
            <button onClick={() => remove.mutate(t.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="Remover">
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
